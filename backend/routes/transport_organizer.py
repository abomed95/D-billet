"""
Transport Organizer routes (Ferry & Train Dashboard)
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from config import db
from services import generate_staff_password, get_current_user, hash_password

router = APIRouter(prefix="/transport-organizer", tags=["Transport Organizer"])

VALID_TRANSPORT_TYPES = {"ferry", "train"}
VALID_ANNOUNCEMENT_TYPES = {"info", "delay", "cancellation", "maintenance"}
VALID_PROMO_TYPES = {"percentage", "fixed"}


# ============== MODELS ==============

class VehiclePriceUpdate(BaseModel):
    vehicle_type: str
    price: int


class TransportSettings(BaseModel):
    passenger_price: Optional[int] = None
    child_free_age: Optional[int] = None
    max_passengers_per_trip: Optional[int] = None
    max_vehicles_per_trip: Optional[int] = None


class TrainSettingsUpdate(BaseModel):
    price: Optional[int] = None
    departure_time: Optional[str] = None
    active: Optional[bool] = None


class TransportAnnouncementCreate(BaseModel):
    title: str
    message: str
    announcement_type: str = "info"
    travel_date: Optional[str] = None
    destination: Optional[str] = None
    active: bool = True


class TransportAnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    announcement_type: Optional[str] = None
    travel_date: Optional[str] = None
    destination: Optional[str] = None
    active: Optional[bool] = None


class TransportAgencyCreate(BaseModel):
    name: str
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    target_bookings: int = 0
    notes: Optional[str] = None
    active: bool = True


class TransportAgencyUpdate(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    target_bookings: Optional[int] = None
    notes: Optional[str] = None
    active: Optional[bool] = None


class TransportOrganizerStaffCreate(BaseModel):
    username: str
    full_name: str
    role: str = "transport_agent"
    agency_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    active: bool = True


class TransportOrganizerStaffUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    agency_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    active: Optional[bool] = None


class TransportPromoCodeCreate(BaseModel):
    code: str
    title: Optional[str] = None
    discount_type: str
    discount_value: int
    max_uses: int = 100
    valid_until: Optional[str] = None
    agency_id: Optional[str] = None
    staff_id: Optional[str] = None
    active: bool = True


class TransportPromoCodeUpdate(BaseModel):
    title: Optional[str] = None
    max_uses: Optional[int] = None
    valid_until: Optional[str] = None
    agency_id: Optional[str] = None
    staff_id: Optional[str] = None
    active: Optional[bool] = None


# ============== AUTH HELPERS ==============

async def get_ferry_organizer(user: dict = Depends(get_current_user)):
    """Check if user is ferry organizer or admin"""
    if user.get("role") not in ["ferry_organizer", "admin"]:
        raise HTTPException(status_code=403, detail="Acces organisateur ferry requis")
    return user


async def get_train_organizer(user: dict = Depends(get_current_user)):
    """Check if user is train organizer or admin"""
    if user.get("role") not in ["train_organizer", "admin"]:
        raise HTTPException(status_code=403, detail="Acces organisateur train requis")
    return user


async def get_transport_organizer(user: dict = Depends(get_current_user)):
    """Check if user is any transport organizer or admin"""
    if user.get("role") not in ["ferry_organizer", "train_organizer", "admin"]:
        raise HTTPException(status_code=403, detail="Acces organisateur transport requis")
    return user


def _parse_iso_datetime(value: Optional[str]):
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    if "T" not in normalized:
        normalized = f"{normalized}T23:59:59+00:00"
    elif "+" not in normalized and not normalized.endswith("Z"):
        normalized = f"{normalized}+00:00"
    return datetime.fromisoformat(normalized)


def _transport_type_from_user(user: dict, requested_transport_type: str) -> str:
    transport_type = requested_transport_type.lower().strip()
    if transport_type not in VALID_TRANSPORT_TYPES:
        raise HTTPException(status_code=400, detail="Type de transport invalide")

    role = user.get("role")
    if role == "admin":
        return transport_type
    if role == "ferry_organizer" and transport_type != "ferry":
        raise HTTPException(status_code=403, detail="Acces ferry requis")
    if role == "train_organizer" and transport_type != "train":
        raise HTTPException(status_code=403, detail="Acces train requis")
    return transport_type


def _transport_scope_query(user: dict, transport_type: str):
    query = {"transport_type": transport_type}
    if user.get("role") != "admin":
        query["organizer_id"] = user["id"]
    return query


async def _ensure_agency_access(agency_id: str, user: dict, transport_type: str):
    agency = await db.transport_agencies.find_one(
        {**_transport_scope_query(user, transport_type), "id": agency_id},
        {"_id": 0},
    )
    if not agency:
        raise HTTPException(status_code=404, detail="Agence non trouvee")
    return agency


async def _ensure_staff_access(staff_id: str, user: dict, transport_type: str):
    staff = await db.transport_staff.find_one(
        {**_transport_scope_query(user, transport_type), "id": staff_id},
        {"_id": 0, "password_hash": 0},
    )
    if not staff:
        raise HTTPException(status_code=404, detail="Compte staff non trouve")
    return staff


async def _compute_operations_summary(user: dict, transport_type: str):
    base_query = _transport_scope_query(user, transport_type)
    agencies = await db.transport_agencies.find(base_query, {"_id": 0}).to_list(200)
    staff_list = await db.transport_staff.find(base_query, {"_id": 0, "password_hash": 0}).to_list(500)
    announcements = await db.transport_announcements.find(base_query, {"_id": 0}).to_list(200)
    promo_codes = await db.promo_codes.find(
        {**base_query, "scope": "transport"},
        {"_id": 0},
    ).to_list(500)

    return {
        "agencies": {
            "total": len(agencies),
            "active": sum(1 for agency in agencies if agency.get("active", True)),
        },
        "staff": {
            "total": len(staff_list),
            "active": sum(1 for staff in staff_list if staff.get("active", True)),
        },
        "announcements": {
            "total": len(announcements),
            "active": sum(1 for item in announcements if item.get("active", True)),
        },
        "promo_codes": {
            "total": len(promo_codes),
            "active": sum(1 for promo in promo_codes if promo.get("active", True)),
            "uses": sum(int(promo.get("uses", 0) or 0) for promo in promo_codes),
            "sales": sum(int(promo.get("total_sales", 0) or 0) for promo in promo_codes),
        },
    }


async def _build_transport_performance(user: dict, transport_type: str):
    agencies = await db.transport_agencies.find(
        _transport_scope_query(user, transport_type),
        {"_id": 0},
    ).to_list(200)
    staff_list = await db.transport_staff.find(
        _transport_scope_query(user, transport_type),
        {"_id": 0, "password_hash": 0},
    ).to_list(500)
    promo_codes = await db.promo_codes.find(
        {**_transport_scope_query(user, transport_type), "scope": "transport"},
        {"_id": 0},
    ).to_list(500)

    agencies_by_id = {}
    for agency in agencies:
        agencies_by_id[agency["id"]] = {
            **agency,
            "staff_count": 0,
            "active_staff": 0,
            "promo_codes_count": 0,
            "bookings_count": 0,
            "uses": 0,
            "total_sales": 0,
            "goal_progress": 0,
        }

    staff_by_id = {}
    for staff in staff_list:
        staff_entry = {
            **staff,
            "promo_codes_count": 0,
            "bookings_count": 0,
            "uses": 0,
            "total_sales": 0,
        }
        staff_by_id[staff["id"]] = staff_entry
        agency_id = staff.get("agency_id")
        if agency_id in agencies_by_id:
            agencies_by_id[agency_id]["staff_count"] += 1
            if staff.get("active", True):
                agencies_by_id[agency_id]["active_staff"] += 1

    for promo in promo_codes:
        promo_uses = int(promo.get("uses", 0) or 0)
        promo_sales = int(promo.get("total_sales", 0) or 0)
        promo_bookings = int(promo.get("bookings_count", promo_uses) or 0)
        agency_id = promo.get("agency_id")
        staff_id = promo.get("staff_id")

        if staff_id in staff_by_id:
            staff_by_id[staff_id]["promo_codes_count"] += 1
            staff_by_id[staff_id]["uses"] += promo_uses
            staff_by_id[staff_id]["bookings_count"] += promo_bookings
            staff_by_id[staff_id]["total_sales"] += promo_sales
            if not agency_id:
                agency_id = staff_by_id[staff_id].get("agency_id")

        if agency_id in agencies_by_id:
            agencies_by_id[agency_id]["promo_codes_count"] += 1
            agencies_by_id[agency_id]["uses"] += promo_uses
            agencies_by_id[agency_id]["bookings_count"] += promo_bookings
            agencies_by_id[agency_id]["total_sales"] += promo_sales

    for agency in agencies_by_id.values():
        target = int(agency.get("target_bookings", 0) or 0)
        if target > 0:
            agency["goal_progress"] = min(100, round((agency["bookings_count"] / target) * 100))

    agencies_ranked = sorted(
        agencies_by_id.values(),
        key=lambda agency: (agency.get("total_sales", 0), agency.get("bookings_count", 0)),
        reverse=True,
    )
    staff_ranked = sorted(
        staff_by_id.values(),
        key=lambda staff: (staff.get("total_sales", 0), staff.get("bookings_count", 0)),
        reverse=True,
    )

    return {
        "totals": {
            "agencies": len(agencies_ranked),
            "staff": len(staff_ranked),
            "promo_codes": len(promo_codes),
            "bookings": sum(item.get("bookings_count", 0) for item in agencies_ranked),
            "sales": sum(item.get("total_sales", 0) for item in agencies_ranked),
        },
        "agencies": agencies_ranked,
        "staff": staff_ranked,
    }


# ============== FERRY ORGANIZER DASHBOARD ==============

@router.get("/ferry/dashboard")
async def get_ferry_dashboard(user: dict = Depends(get_ferry_organizer)):
    """Get ferry organizer dashboard with stats and settings"""
    settings = await db.settings.find_one({"type": "transport"}, {"_id": 0})
    ferry_settings = settings.get("ferry", {}) if settings else {}

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)

    today_tickets = await db.tickets.count_documents({
        "type": "ferry",
        "created_at": {"$gte": today.isoformat(), "$lt": tomorrow.isoformat()},
    })
    today_vehicles = await db.ferry_vehicles.count_documents({
        "created_at": {"$gte": today.isoformat(), "$lt": tomorrow.isoformat()},
    })

    week_start = today - timedelta(days=today.weekday())
    week_tickets = await db.tickets.count_documents({
        "type": "ferry",
        "created_at": {"$gte": week_start.isoformat()},
    })
    week_vehicles = await db.ferry_vehicles.count_documents({
        "created_at": {"$gte": week_start.isoformat()},
    })

    passenger_price = ferry_settings.get("passenger_price", 1100)
    commission_rate = ferry_settings.get("commission_rate", 10)

    all_tickets = await db.tickets.find({"type": "ferry"}, {"_id": 0, "price": 1}).to_list(10000)
    total_passenger_revenue = sum(int(ticket.get("price", 0) or 0) for ticket in all_tickets)

    all_vehicles = await db.ferry_vehicles.find({}, {"_id": 0, "price": 1}).to_list(10000)
    total_vehicle_revenue = sum(int(vehicle.get("price", 0) or 0) for vehicle in all_vehicles)
    total_revenue = total_passenger_revenue + total_vehicle_revenue

    commission = int(total_revenue * commission_rate / 100)
    net_revenue = total_revenue - commission

    upcoming_dates = []
    for i in range(7):
        date_value = today + timedelta(days=i)
        date_str = date_value.strftime("%Y-%m-%d")

        passengers_booked = await db.tickets.count_documents({
            "type": "ferry",
            "event_date": date_str,
            "status": {"$ne": "cancelled"},
        })
        vehicles_booked = await db.ferry_vehicles.count_documents({
            "date": date_str,
            "status": {"$ne": "cancelled"},
        })

        upcoming_dates.append({
            "date": date_str,
            "day_name": date_value.strftime("%A"),
            "passengers_booked": passengers_booked,
            "vehicles_booked": vehicles_booked,
        })

    return {
        "organizer": {
            "id": user["id"],
            "name": user.get("full_name"),
            "company": user.get("company_name"),
            "role": user.get("role"),
        },
        "stats": {
            "today": {
                "passengers": today_tickets,
                "vehicles": today_vehicles,
            },
            "this_week": {
                "passengers": week_tickets,
                "vehicles": week_vehicles,
            },
            "total": {
                "passengers": len(all_tickets),
                "vehicles": len(all_vehicles),
            },
        },
        "revenue": {
            "total": total_revenue,
            "passenger_revenue": total_passenger_revenue,
            "vehicle_revenue": total_vehicle_revenue,
            "commission_rate": commission_rate,
            "commission": commission,
            "net_revenue": net_revenue,
        },
        "settings": {
            "passenger_price": passenger_price,
            "child_free_age": ferry_settings.get("child_free_age", 10),
            "max_passengers_per_trip": ferry_settings.get("max_passengers_per_trip", 150),
            "max_vehicles_per_trip": ferry_settings.get("max_vehicles_per_trip", 20),
            "vehicle_types": ferry_settings.get("vehicle_types", []),
        },
        "operations": await _compute_operations_summary(user, "ferry"),
        "upcoming_trips": upcoming_dates,
    }


@router.get("/ferry/vehicle-prices")
async def get_ferry_vehicle_prices(user: dict = Depends(get_ferry_organizer)):
    """Get all vehicle types with prices"""
    settings = await db.settings.find_one({"type": "transport"}, {"_id": 0})
    ferry_settings = settings.get("ferry", {}) if settings else {}
    vehicle_types = ferry_settings.get("vehicle_types", [])

    return {
        "vehicle_types": vehicle_types,
        "total_types": len(vehicle_types),
    }


@router.put("/ferry/vehicle-prices")
async def update_ferry_vehicle_prices(
    prices: list[VehiclePriceUpdate],
    user: dict = Depends(get_ferry_organizer),
):
    """Update vehicle prices"""
    settings = await db.settings.find_one({"type": "transport"})
    if not settings:
        raise HTTPException(status_code=404, detail="Parametres transport non trouves")

    vehicle_types = settings.get("ferry", {}).get("vehicle_types", [])
    updated_count = 0
    for price_update in prices:
        for vehicle_type in vehicle_types:
            if vehicle_type["type"] == price_update.vehicle_type:
                vehicle_type["price"] = price_update.price
                updated_count += 1
                break

    await db.settings.update_one(
        {"type": "transport"},
        {"$set": {"ferry.vehicle_types": vehicle_types}},
    )

    return {
        "message": f"{updated_count} prix de vehicules mis a jour",
        "vehicle_types": vehicle_types,
    }


@router.put("/ferry/settings")
async def update_ferry_settings(
    settings_data: TransportSettings,
    user: dict = Depends(get_ferry_organizer),
):
    """Update ferry settings (prices, capacity)"""
    update_data = {}
    if settings_data.passenger_price is not None:
        update_data["ferry.passenger_price"] = settings_data.passenger_price
    if settings_data.child_free_age is not None:
        update_data["ferry.child_free_age"] = settings_data.child_free_age
    if settings_data.max_passengers_per_trip is not None:
        update_data["ferry.max_passengers_per_trip"] = settings_data.max_passengers_per_trip
    if settings_data.max_vehicles_per_trip is not None:
        update_data["ferry.max_vehicles_per_trip"] = settings_data.max_vehicles_per_trip

    if update_data:
        await db.settings.update_one(
            {"type": "transport"},
            {"$set": update_data},
            upsert=True,
        )

    return {"message": "Parametres ferry mis a jour", "updated": list(update_data.keys())}


@router.get("/ferry/bookings")
async def get_ferry_bookings(
    user: dict = Depends(get_ferry_organizer),
    date: Optional[str] = None,
    destination: Optional[str] = None,
    limit: int = 100,
):
    """Get ferry bookings with filters"""
    query = {"type": "ferry"}
    if date:
        query["event_date"] = date
    if destination:
        query["destination"] = destination

    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)

    vehicle_query = {}
    if date:
        vehicle_query["date"] = date
    if destination:
        vehicle_query["destination"] = destination

    vehicles = await db.ferry_vehicles.find(vehicle_query, {"_id": 0}).sort("created_at", -1).to_list(limit)

    return {
        "passengers": tickets,
        "vehicles": vehicles,
        "total_passengers": len(tickets),
        "total_vehicles": len(vehicles),
        "total_revenue": sum(int(ticket.get("price", 0) or 0) for ticket in tickets) + sum(int(vehicle.get("price", 0) or 0) for vehicle in vehicles),
    }


@router.get("/ferry/bookings/{date}/manifest")
async def get_ferry_manifest(date: str, user: dict = Depends(get_ferry_organizer)):
    """Get complete manifest for a specific date (for printing/export)"""
    passengers = await db.tickets.find(
        {"type": "ferry", "event_date": date, "status": {"$ne": "cancelled"}},
        {"_id": 0},
    ).sort("destination", 1).to_list(1000)
    vehicles = await db.ferry_vehicles.find(
        {"date": date, "status": {"$ne": "cancelled"}},
        {"_id": 0},
    ).sort("destination", 1).to_list(100)

    by_destination = {}
    for passenger in passengers:
        destination = passenger.get("destination", "Unknown")
        if destination not in by_destination:
            by_destination[destination] = {"passengers": [], "vehicles": []}
        by_destination[destination]["passengers"].append({
            "name": passenger.get("passenger_name"),
            "phone": passenger.get("passenger_phone"),
            "id_number": passenger.get("passenger_id"),
            "ticket_type": passenger.get("ticket_type"),
            "trip_type": passenger.get("trip_type"),
            "price": passenger.get("price"),
        })

    for vehicle in vehicles:
        destination = vehicle.get("destination", "Unknown")
        if destination not in by_destination:
            by_destination[destination] = {"passengers": [], "vehicles": []}
        by_destination[destination]["vehicles"].append({
            "type": vehicle.get("vehicle_name"),
            "plate": vehicle.get("plate_number"),
            "passengers": vehicle.get("passenger_names", []),
            "price": vehicle.get("price"),
        })

    total_revenue = sum(int(passenger.get("price", 0) or 0) for passenger in passengers) + sum(int(vehicle.get("price", 0) or 0) for vehicle in vehicles)

    return {
        "date": date,
        "manifest": by_destination,
        "totals": {
            "passengers": len(passengers),
            "vehicles": len(vehicles),
            "revenue": total_revenue,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ============== TRAIN ORGANIZER DASHBOARD ==============

@router.get("/train/dashboard")
async def get_train_dashboard(user: dict = Depends(get_train_organizer)):
    """Get train organizer dashboard with stats"""
    settings = await db.settings.find_one({"type": "transport"}, {"_id": 0})
    train_settings = settings.get("train", {}) if settings else {}

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)

    today_tickets = await db.tickets.count_documents({
        "type": "train",
        "created_at": {"$gte": today.isoformat(), "$lt": tomorrow.isoformat()},
    })
    week_start = today - timedelta(days=today.weekday())
    week_tickets = await db.tickets.count_documents({
        "type": "train",
        "created_at": {"$gte": week_start.isoformat()},
    })

    ticket_price = train_settings.get("price", 500)
    commission_rate = train_settings.get("commission_rate", 10)
    all_tickets = await db.tickets.find({"type": "train"}, {"_id": 0, "price": 1}).to_list(10000)

    total_revenue = sum(int(ticket.get("price", 0) or 0) for ticket in all_tickets)
    commission = int(total_revenue * commission_rate / 100)
    net_revenue = total_revenue - commission

    upcoming_dates = []
    for i in range(7):
        date_value = today + timedelta(days=i)
        date_str = date_value.strftime("%Y-%m-%d")
        is_odd = date_value.day % 2 == 1
        direction = "Djibouti -> Ali Sabieh" if is_odd else "Ali Sabieh -> Djibouti"

        passengers_booked = await db.tickets.count_documents({
            "type": "train",
            "event_date": date_str,
            "status": {"$ne": "cancelled"},
        })
        upcoming_dates.append({
            "date": date_str,
            "day_name": date_value.strftime("%A"),
            "direction": direction,
            "passengers_booked": passengers_booked,
        })

    return {
        "organizer": {
            "id": user["id"],
            "name": user.get("full_name"),
            "company": user.get("company_name"),
            "role": user.get("role"),
        },
        "stats": {
            "today": today_tickets,
            "this_week": week_tickets,
            "total": len(all_tickets),
        },
        "revenue": {
            "total": total_revenue,
            "commission_rate": commission_rate,
            "commission": commission,
            "net_revenue": net_revenue,
        },
        "settings": {
            "ticket_price": ticket_price,
            "departure_time": train_settings.get("departure_time", "06:00"),
            "active": train_settings.get("active", True),
        },
        "operations": await _compute_operations_summary(user, "train"),
        "upcoming_trips": upcoming_dates,
    }


@router.put("/train/settings")
async def update_train_settings(
    settings_data: TrainSettingsUpdate,
    user: dict = Depends(get_train_organizer),
):
    """Update train settings"""
    update_data = {}
    if settings_data.price is not None:
        update_data["train.price"] = settings_data.price
    if settings_data.departure_time is not None:
        update_data["train.departure_time"] = settings_data.departure_time
    if settings_data.active is not None:
        update_data["train.active"] = settings_data.active

    if update_data:
        await db.settings.update_one(
            {"type": "transport"},
            {"$set": update_data},
            upsert=True,
        )

    return {"message": "Parametres train mis a jour", "updated": list(update_data.keys())}


@router.get("/train/bookings")
async def get_train_bookings(
    user: dict = Depends(get_train_organizer),
    date: Optional[str] = None,
    limit: int = 100,
):
    """Get train bookings"""
    query = {"type": "train"}
    if date:
        query["event_date"] = date

    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {
        "bookings": tickets,
        "total": len(tickets),
        "total_revenue": sum(int(ticket.get("price", 0) or 0) for ticket in tickets),
    }


# ============== ANNOUNCEMENTS ==============

@router.get("/{transport_type}/announcements")
async def get_transport_announcements(
    transport_type: str,
    active_only: bool = False,
    user: dict = Depends(get_transport_organizer),
):
    transport_type = _transport_type_from_user(user, transport_type)
    query = _transport_scope_query(user, transport_type)
    if active_only:
        query["active"] = True

    announcements = await db.transport_announcements.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return announcements


@router.post("/{transport_type}/announcements")
async def create_transport_announcement(
    transport_type: str,
    data: TransportAnnouncementCreate,
    user: dict = Depends(get_transport_organizer),
):
    transport_type = _transport_type_from_user(user, transport_type)
    announcement_type = data.announcement_type.lower().strip()
    if announcement_type not in VALID_ANNOUNCEMENT_TYPES:
        raise HTTPException(status_code=400, detail="Type d'annonce invalide")

    now = datetime.now(timezone.utc).isoformat()
    announcement = {
        "id": str(uuid.uuid4()),
        "organizer_id": user["id"],
        "transport_type": transport_type,
        "title": data.title.strip(),
        "message": data.message.strip(),
        "announcement_type": announcement_type,
        "travel_date": data.travel_date,
        "destination": data.destination,
        "active": data.active,
        "created_at": now,
        "updated_at": now,
    }
    await db.transport_announcements.insert_one({**announcement})
    return announcement


@router.put("/{transport_type}/announcements/{announcement_id}")
async def update_transport_announcement(
    transport_type: str,
    announcement_id: str,
    data: TransportAnnouncementUpdate,
    user: dict = Depends(get_transport_organizer),
):
    transport_type = _transport_type_from_user(user, transport_type)
    existing = await db.transport_announcements.find_one(
        {**_transport_scope_query(user, transport_type), "id": announcement_id},
        {"_id": 0},
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Annonce non trouvee")

    update_data = {}
    for field, value in data.model_dump().items():
        if value is None:
            continue
        if field == "announcement_type":
            value = value.lower().strip()
            if value not in VALID_ANNOUNCEMENT_TYPES:
                raise HTTPException(status_code=400, detail="Type d'annonce invalide")
        update_data[field] = value

    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.transport_announcements.update_one(
            {"id": announcement_id},
            {"$set": update_data},
        )

    return await db.transport_announcements.find_one({"id": announcement_id}, {"_id": 0})


@router.delete("/{transport_type}/announcements/{announcement_id}")
async def delete_transport_announcement(
    transport_type: str,
    announcement_id: str,
    user: dict = Depends(get_transport_organizer),
):
    transport_type = _transport_type_from_user(user, transport_type)
    result = await db.transport_announcements.delete_one(
        {**_transport_scope_query(user, transport_type), "id": announcement_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Annonce non trouvee")
    return {"message": "Annonce supprimee"}


# ============== AGENCIES & STAFF ==============

@router.get("/{transport_type}/agencies")
async def get_transport_agencies(
    transport_type: str,
    user: dict = Depends(get_transport_organizer),
):
    transport_type = _transport_type_from_user(user, transport_type)
    agencies = await db.transport_agencies.find(
        _transport_scope_query(user, transport_type),
        {"_id": 0},
    ).sort("created_at", -1).to_list(200)
    return agencies


@router.post("/{transport_type}/agencies")
async def create_transport_agency(
    transport_type: str,
    data: TransportAgencyCreate,
    user: dict = Depends(get_transport_organizer),
):
    transport_type = _transport_type_from_user(user, transport_type)
    now = datetime.now(timezone.utc).isoformat()
    agency = {
        "id": str(uuid.uuid4()),
        "organizer_id": user["id"],
        "transport_type": transport_type,
        "name": data.name.strip(),
        "contact_name": data.contact_name,
        "phone": data.phone,
        "email": data.email,
        "target_bookings": data.target_bookings,
        "notes": data.notes,
        "active": data.active,
        "created_at": now,
        "updated_at": now,
    }
    await db.transport_agencies.insert_one({**agency})
    return agency


@router.put("/{transport_type}/agencies/{agency_id}")
async def update_transport_agency(
    transport_type: str,
    agency_id: str,
    data: TransportAgencyUpdate,
    user: dict = Depends(get_transport_organizer),
):
    transport_type = _transport_type_from_user(user, transport_type)
    await _ensure_agency_access(agency_id, user, transport_type)

    update_data = {key: value for key, value in data.model_dump().items() if value is not None}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.transport_agencies.update_one({"id": agency_id}, {"$set": update_data})

    return await db.transport_agencies.find_one({"id": agency_id}, {"_id": 0})


@router.delete("/{transport_type}/agencies/{agency_id}")
async def delete_transport_agency(
    transport_type: str,
    agency_id: str,
    user: dict = Depends(get_transport_organizer),
):
    transport_type = _transport_type_from_user(user, transport_type)
    await _ensure_agency_access(agency_id, user, transport_type)

    staff_to_update = await db.transport_staff.find(
        {**_transport_scope_query(user, transport_type), "agency_id": agency_id},
        {"_id": 0, "id": 1},
    ).to_list(500)
    for staff in staff_to_update:
        await db.transport_staff.update_one({"id": staff["id"]}, {"$set": {"agency_id": None}})

    promo_to_update = await db.promo_codes.find(
        {**_transport_scope_query(user, transport_type), "scope": "transport", "agency_id": agency_id},
        {"_id": 0, "id": 1},
    ).to_list(500)
    for promo in promo_to_update:
        await db.promo_codes.update_one({"id": promo["id"]}, {"$set": {"agency_id": None}})

    result = await db.transport_agencies.delete_one({"id": agency_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Agence non trouvee")

    return {"message": "Agence supprimee"}


@router.get("/{transport_type}/staff")
async def get_transport_staff_accounts(
    transport_type: str,
    user: dict = Depends(get_transport_organizer),
):
    transport_type = _transport_type_from_user(user, transport_type)
    staff_list = await db.transport_staff.find(
        _transport_scope_query(user, transport_type),
        {"_id": 0, "password_hash": 0},
    ).sort("created_at", -1).to_list(500)
    return staff_list


@router.post("/{transport_type}/staff")
async def create_transport_staff_account(
    transport_type: str,
    data: TransportOrganizerStaffCreate,
    user: dict = Depends(get_transport_organizer),
):
    transport_type = _transport_type_from_user(user, transport_type)

    existing = await db.transport_staff.find_one({"username": data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Ce nom d'utilisateur est deja pris")

    if data.agency_id:
        await _ensure_agency_access(data.agency_id, user, transport_type)

    password = generate_staff_password()
    now = datetime.now(timezone.utc).isoformat()
    staff_doc = {
        "id": str(uuid.uuid4()),
        "organizer_id": user["id"],
        "transport_type": transport_type,
        "username": data.username.strip().lower(),
        "password_hash": hash_password(password),
        "full_name": data.full_name.strip(),
        "role": data.role,
        "agency_id": data.agency_id,
        "phone": data.phone,
        "email": data.email,
        "active": data.active,
        "created_at": now,
        "updated_at": now,
    }
    await db.transport_staff.insert_one(staff_doc)

    return {
        "id": staff_doc["id"],
        "username": staff_doc["username"],
        "password": password,
        "full_name": staff_doc["full_name"],
        "role": staff_doc["role"],
        "agency_id": staff_doc.get("agency_id"),
        "active": staff_doc["active"],
        "message": "Compte cree! Notez bien le mot de passe, il ne sera plus affiche.",
    }


@router.put("/{transport_type}/staff/{staff_id}")
async def update_transport_staff_account(
    transport_type: str,
    staff_id: str,
    data: TransportOrganizerStaffUpdate,
    user: dict = Depends(get_transport_organizer),
):
    transport_type = _transport_type_from_user(user, transport_type)
    await _ensure_staff_access(staff_id, user, transport_type)

    if data.agency_id:
        await _ensure_agency_access(data.agency_id, user, transport_type)

    update_data = {key: value for key, value in data.model_dump().items() if value is not None}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.transport_staff.update_one({"id": staff_id}, {"$set": update_data})

    return await db.transport_staff.find_one({"id": staff_id}, {"_id": 0, "password_hash": 0})


@router.delete("/{transport_type}/staff/{staff_id}")
async def delete_transport_staff_account(
    transport_type: str,
    staff_id: str,
    user: dict = Depends(get_transport_organizer),
):
    transport_type = _transport_type_from_user(user, transport_type)
    await _ensure_staff_access(staff_id, user, transport_type)

    promo_to_update = await db.promo_codes.find(
        {**_transport_scope_query(user, transport_type), "scope": "transport", "staff_id": staff_id},
        {"_id": 0, "id": 1},
    ).to_list(500)
    for promo in promo_to_update:
        await db.promo_codes.update_one({"id": promo["id"]}, {"$set": {"staff_id": None}})
    result = await db.transport_staff.delete_one({"id": staff_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Compte staff non trouve")
    return {"message": "Compte staff supprime"}


@router.post("/{transport_type}/staff/{staff_id}/reset-password")
async def reset_transport_staff_account_password(
    transport_type: str,
    staff_id: str,
    user: dict = Depends(get_transport_organizer),
):
    transport_type = _transport_type_from_user(user, transport_type)
    staff = await _ensure_staff_access(staff_id, user, transport_type)

    new_password = generate_staff_password()
    await db.transport_staff.update_one(
        {"id": staff_id},
        {"$set": {"password_hash": hash_password(new_password), "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    return {
        "message": "Mot de passe reinitialise",
        "new_password": new_password,
        "username": staff["username"],
    }


@router.get("/{transport_type}/performance")
async def get_transport_performance(
    transport_type: str,
    user: dict = Depends(get_transport_organizer),
):
    transport_type = _transport_type_from_user(user, transport_type)
    return await _build_transport_performance(user, transport_type)


# ============== PROMO CODES ==============

@router.get("/{transport_type}/promo-codes")
async def get_transport_promo_codes(
    transport_type: str,
    user: dict = Depends(get_transport_organizer),
):
    transport_type = _transport_type_from_user(user, transport_type)
    promo_codes = await db.promo_codes.find(
        {**_transport_scope_query(user, transport_type), "scope": "transport"},
        {"_id": 0},
    ).sort("created_at", -1).to_list(500)
    return promo_codes


@router.post("/{transport_type}/promo-codes")
async def create_transport_promo_code(
    transport_type: str,
    data: TransportPromoCodeCreate,
    user: dict = Depends(get_transport_organizer),
):
    transport_type = _transport_type_from_user(user, transport_type)
    discount_type = data.discount_type.lower().strip()
    if discount_type not in VALID_PROMO_TYPES:
        raise HTTPException(status_code=400, detail="Type de reduction invalide")

    existing = await db.promo_codes.find_one({"code": data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Ce code existe deja")

    agency_id = data.agency_id
    if agency_id:
        await _ensure_agency_access(agency_id, user, transport_type)

    staff_id = data.staff_id
    if staff_id:
        staff = await _ensure_staff_access(staff_id, user, transport_type)
        if not agency_id:
            agency_id = staff.get("agency_id")

    now = datetime.now(timezone.utc).isoformat()
    promo_doc = {
        "id": str(uuid.uuid4()),
        "code": data.code.upper().strip(),
        "title": data.title or data.code.upper().strip(),
        "discount_type": discount_type,
        "discount_value": data.discount_value,
        "max_uses": data.max_uses,
        "uses": 0,
        "valid_until": data.valid_until,
        "organizer_id": user["id"],
        "scope": "transport",
        "transport_type": transport_type,
        "agency_id": agency_id,
        "staff_id": staff_id,
        "active": data.active,
        "total_sales": 0,
        "bookings_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    await db.promo_codes.insert_one({**promo_doc})
    return promo_doc


@router.put("/{transport_type}/promo-codes/{promo_id}")
async def update_transport_promo_code(
    transport_type: str,
    promo_id: str,
    data: TransportPromoCodeUpdate,
    user: dict = Depends(get_transport_organizer),
):
    transport_type = _transport_type_from_user(user, transport_type)
    promo = await db.promo_codes.find_one(
        {**_transport_scope_query(user, transport_type), "scope": "transport", "id": promo_id},
        {"_id": 0},
    )
    if not promo:
        raise HTTPException(status_code=404, detail="Code promo non trouve")

    update_data = {key: value for key, value in data.model_dump().items() if value is not None}
    if "agency_id" in update_data and update_data["agency_id"]:
        await _ensure_agency_access(update_data["agency_id"], user, transport_type)
    if "staff_id" in update_data and update_data["staff_id"]:
        staff = await _ensure_staff_access(update_data["staff_id"], user, transport_type)
        if not update_data.get("agency_id"):
            update_data["agency_id"] = staff.get("agency_id")

    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.promo_codes.update_one({"id": promo_id}, {"$set": update_data})

    return await db.promo_codes.find_one({"id": promo_id}, {"_id": 0})


@router.delete("/{transport_type}/promo-codes/{promo_id}")
async def delete_transport_promo_code(
    transport_type: str,
    promo_id: str,
    user: dict = Depends(get_transport_organizer),
):
    transport_type = _transport_type_from_user(user, transport_type)
    result = await db.promo_codes.delete_one(
        {**_transport_scope_query(user, transport_type), "scope": "transport", "id": promo_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Code promo non trouve")
    return {"message": "Code promo supprime"}
