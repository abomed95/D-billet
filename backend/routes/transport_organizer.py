"""
Transport Organizer routes (Ferry & Train Dashboard)
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid

from config import db
from services import get_current_user

router = APIRouter(prefix="/transport-organizer", tags=["Transport Organizer"])


# ============== MODELS ==============

class VehiclePriceUpdate(BaseModel):
    vehicle_type: str
    price: int


class TripCapacityUpdate(BaseModel):
    max_passengers: int
    max_vehicles: int


class TransportSettings(BaseModel):
    passenger_price: Optional[int] = None
    child_free_age: Optional[int] = None
    max_passengers_per_trip: Optional[int] = None
    max_vehicles_per_trip: Optional[int] = None


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


# ============== FERRY ORGANIZER DASHBOARD ==============

@router.get("/ferry/dashboard")
async def get_ferry_dashboard(user: dict = Depends(get_ferry_organizer)):
    """Get ferry organizer dashboard with stats and settings"""
    
    # Get settings
    settings = await db.settings.find_one({"type": "transport"}, {"_id": 0})
    ferry_settings = settings.get("ferry", {}) if settings else {}
    
    # Get today's date range
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    
    # Stats: Today's bookings
    today_tickets = await db.tickets.count_documents({
        "type": "ferry",
        "created_at": {"$gte": today.isoformat(), "$lt": tomorrow.isoformat()}
    })
    
    today_vehicles = await db.ferry_vehicles.count_documents({
        "created_at": {"$gte": today.isoformat(), "$lt": tomorrow.isoformat()}
    })
    
    # Stats: This week
    week_start = today - timedelta(days=today.weekday())
    week_tickets = await db.tickets.count_documents({
        "type": "ferry",
        "created_at": {"$gte": week_start.isoformat()}
    })
    
    week_vehicles = await db.ferry_vehicles.count_documents({
        "created_at": {"$gte": week_start.isoformat()}
    })
    
    # Revenue calculation
    passenger_price = ferry_settings.get("passenger_price", 1100)
    commission_rate = ferry_settings.get("commission_rate", 10)
    
    # Get all ferry tickets for revenue
    all_tickets = await db.tickets.find(
        {"type": "ferry"},
        {"_id": 0, "price": 1}
    ).to_list(10000)
    
    total_passenger_revenue = sum(t.get("price", 0) for t in all_tickets)
    
    # Get all vehicle bookings for revenue
    all_vehicles = await db.ferry_vehicles.find(
        {},
        {"_id": 0, "price": 1}
    ).to_list(10000)
    
    total_vehicle_revenue = sum(v.get("price", 0) for v in all_vehicles)
    total_revenue = total_passenger_revenue + total_vehicle_revenue
    
    commission = int(total_revenue * commission_rate / 100)
    net_revenue = total_revenue - commission
    
    # Upcoming trips (next 7 days)
    upcoming_dates = []
    for i in range(7):
        date = today + timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")
        
        passengers_booked = await db.tickets.count_documents({
            "type": "ferry",
            "event_date": date_str,
            "status": {"$ne": "cancelled"}
        })
        
        vehicles_booked = await db.ferry_vehicles.count_documents({
            "date": date_str,
            "status": {"$ne": "cancelled"}
        })
        
        upcoming_dates.append({
            "date": date_str,
            "day_name": date.strftime("%A"),
            "passengers_booked": passengers_booked,
            "vehicles_booked": vehicles_booked
        })
    
    return {
        "organizer": {
            "id": user["id"],
            "name": user.get("full_name"),
            "company": user.get("company_name"),
            "role": user.get("role")
        },
        "stats": {
            "today": {
                "passengers": today_tickets,
                "vehicles": today_vehicles
            },
            "this_week": {
                "passengers": week_tickets,
                "vehicles": week_vehicles
            },
            "total": {
                "passengers": len(all_tickets),
                "vehicles": len(all_vehicles)
            }
        },
        "revenue": {
            "total": total_revenue,
            "passenger_revenue": total_passenger_revenue,
            "vehicle_revenue": total_vehicle_revenue,
            "commission_rate": commission_rate,
            "commission": commission,
            "net_revenue": net_revenue
        },
        "settings": {
            "passenger_price": passenger_price,
            "child_free_age": ferry_settings.get("child_free_age", 10),
            "max_passengers_per_trip": ferry_settings.get("max_passengers_per_trip", 150),
            "max_vehicles_per_trip": ferry_settings.get("max_vehicles_per_trip", 20),
            "vehicle_types": ferry_settings.get("vehicle_types", [])
        },
        "upcoming_trips": upcoming_dates
    }


@router.get("/ferry/vehicle-prices")
async def get_ferry_vehicle_prices(user: dict = Depends(get_ferry_organizer)):
    """Get all vehicle types with prices"""
    settings = await db.settings.find_one({"type": "transport"}, {"_id": 0})
    ferry_settings = settings.get("ferry", {}) if settings else {}
    
    vehicle_types = ferry_settings.get("vehicle_types", [])
    
    return {
        "vehicle_types": vehicle_types,
        "total_types": len(vehicle_types)
    }


@router.put("/ferry/vehicle-prices")
async def update_ferry_vehicle_prices(
    prices: List[VehiclePriceUpdate],
    user: dict = Depends(get_ferry_organizer)
):
    """Update vehicle prices"""
    settings = await db.settings.find_one({"type": "transport"})
    
    if not settings:
        raise HTTPException(status_code=404, detail="Parametres transport non trouves")
    
    vehicle_types = settings.get("ferry", {}).get("vehicle_types", [])
    
    # Update prices
    updated_count = 0
    for price_update in prices:
        for vt in vehicle_types:
            if vt["type"] == price_update.vehicle_type:
                vt["price"] = price_update.price
                updated_count += 1
                break
    
    # Save
    await db.settings.update_one(
        {"type": "transport"},
        {"$set": {"ferry.vehicle_types": vehicle_types}}
    )
    
    return {
        "message": f"{updated_count} prix de vehicules mis a jour",
        "vehicle_types": vehicle_types
    }


@router.put("/ferry/settings")
async def update_ferry_settings(
    settings_data: TransportSettings,
    user: dict = Depends(get_ferry_organizer)
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
            upsert=True
        )
    
    return {"message": "Parametres ferry mis a jour", "updated": list(update_data.keys())}


@router.get("/ferry/bookings")
async def get_ferry_bookings(
    user: dict = Depends(get_ferry_organizer),
    date: Optional[str] = None,
    destination: Optional[str] = None,
    limit: int = 100
):
    """Get ferry bookings with filters"""
    query = {"type": "ferry"}
    
    if date:
        query["event_date"] = date
    
    if destination:
        query["destination"] = destination
    
    # Get passenger tickets
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    # Get vehicle bookings
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
        "total_vehicles": len(vehicles)
    }


@router.get("/ferry/bookings/{date}/manifest")
async def get_ferry_manifest(date: str, user: dict = Depends(get_ferry_organizer)):
    """Get complete manifest for a specific date (for printing/export)"""
    
    # Get all passengers for the date
    passengers = await db.tickets.find(
        {"type": "ferry", "event_date": date, "status": {"$ne": "cancelled"}},
        {"_id": 0}
    ).sort("destination", 1).to_list(1000)
    
    # Get all vehicles for the date
    vehicles = await db.ferry_vehicles.find(
        {"date": date, "status": {"$ne": "cancelled"}},
        {"_id": 0}
    ).sort("destination", 1).to_list(100)
    
    # Group by destination
    by_destination = {}
    for p in passengers:
        dest = p.get("destination", "Unknown")
        if dest not in by_destination:
            by_destination[dest] = {"passengers": [], "vehicles": []}
        by_destination[dest]["passengers"].append({
            "name": p.get("passenger_name"),
            "phone": p.get("passenger_phone"),
            "id_number": p.get("passenger_id"),
            "ticket_type": p.get("ticket_type"),
            "trip_type": p.get("trip_type"),
            "price": p.get("price")
        })
    
    for v in vehicles:
        dest = v.get("destination", "Unknown")
        if dest not in by_destination:
            by_destination[dest] = {"passengers": [], "vehicles": []}
        by_destination[dest]["vehicles"].append({
            "type": v.get("vehicle_name"),
            "plate": v.get("plate_number"),
            "passengers": v.get("passenger_names", []),
            "price": v.get("price")
        })
    
    # Calculate totals
    total_passengers = len(passengers)
    total_vehicles = len(vehicles)
    total_revenue = sum(p.get("price", 0) for p in passengers) + sum(v.get("price", 0) for v in vehicles)
    
    return {
        "date": date,
        "manifest": by_destination,
        "totals": {
            "passengers": total_passengers,
            "vehicles": total_vehicles,
            "revenue": total_revenue
        },
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


# ============== TRAIN ORGANIZER DASHBOARD ==============

@router.get("/train/dashboard")
async def get_train_dashboard(user: dict = Depends(get_train_organizer)):
    """Get train organizer dashboard with stats"""
    
    # Get settings
    settings = await db.settings.find_one({"type": "transport"}, {"_id": 0})
    train_settings = settings.get("train", {}) if settings else {}
    
    # Get today's date range
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    
    # Stats: Today's bookings
    today_tickets = await db.tickets.count_documents({
        "type": "train",
        "created_at": {"$gte": today.isoformat(), "$lt": tomorrow.isoformat()}
    })
    
    # Stats: This week
    week_start = today - timedelta(days=today.weekday())
    week_tickets = await db.tickets.count_documents({
        "type": "train",
        "created_at": {"$gte": week_start.isoformat()}
    })
    
    # Revenue calculation
    ticket_price = train_settings.get("price", 500)
    commission_rate = train_settings.get("commission_rate", 10)
    
    # Get all train tickets
    all_tickets = await db.tickets.find(
        {"type": "train"},
        {"_id": 0, "price": 1}
    ).to_list(10000)
    
    total_revenue = sum(t.get("price", 0) for t in all_tickets)
    commission = int(total_revenue * commission_rate / 100)
    net_revenue = total_revenue - commission
    
    # Upcoming trips (next 7 days)
    upcoming_dates = []
    for i in range(7):
        date = today + timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")
        day_num = date.day
        
        # Direction based on odd/even day
        is_odd = day_num % 2 == 1
        direction = "Djibouti → Ali Sabieh" if is_odd else "Ali Sabieh → Djibouti"
        
        passengers_booked = await db.tickets.count_documents({
            "type": "train",
            "event_date": date_str,
            "status": {"$ne": "cancelled"}
        })
        
        upcoming_dates.append({
            "date": date_str,
            "day_name": date.strftime("%A"),
            "direction": direction,
            "passengers_booked": passengers_booked
        })
    
    return {
        "organizer": {
            "id": user["id"],
            "name": user.get("full_name"),
            "company": user.get("company_name"),
            "role": user.get("role")
        },
        "stats": {
            "today": today_tickets,
            "this_week": week_tickets,
            "total": len(all_tickets)
        },
        "revenue": {
            "total": total_revenue,
            "commission_rate": commission_rate,
            "commission": commission,
            "net_revenue": net_revenue
        },
        "settings": {
            "ticket_price": ticket_price,
            "departure_time": train_settings.get("departure_time", "06:00"),
            "active": train_settings.get("active", True)
        },
        "upcoming_trips": upcoming_dates
    }


@router.put("/train/settings")
async def update_train_settings(
    price: Optional[int] = None,
    departure_time: Optional[str] = None,
    active: Optional[bool] = None,
    user: dict = Depends(get_train_organizer)
):
    """Update train settings"""
    update_data = {}
    
    if price is not None:
        update_data["train.price"] = price
    
    if departure_time is not None:
        update_data["train.departure_time"] = departure_time
    
    if active is not None:
        update_data["train.active"] = active
    
    if update_data:
        await db.settings.update_one(
            {"type": "transport"},
            {"$set": update_data},
            upsert=True
        )
    
    return {"message": "Parametres train mis a jour", "updated": list(update_data.keys())}


@router.get("/train/bookings")
async def get_train_bookings(
    user: dict = Depends(get_train_organizer),
    date: Optional[str] = None,
    limit: int = 100
):
    """Get train bookings"""
    query = {"type": "train"}
    
    if date:
        query["event_date"] = date
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    return {
        "bookings": tickets,
        "total": len(tickets)
    }
