"""
Transport routes (Train & Ferry) with vehicle support
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional, List
import uuid

from config import db, TRAIN_PRICE, DAY_TO_WEEKDAY
from models import TrainBookingRequest
from services import get_current_user

router = APIRouter(tags=["Transport"])

# Default ferry passenger price
FERRY_PASSENGER_PRICE = 1100
CHILD_FREE_AGE = 10


# ============== FERRY MODELS ==============

class FerryPassenger(BaseModel):
    full_name: str
    phone: str
    passport_or_cni: str
    age: Optional[int] = None  # For child free policy


class FerryVehicle(BaseModel):
    vehicle_type: str
    plate_number: str
    passenger_names: List[str] = []  # Additional passengers in vehicle


class FerryBookingRequest(BaseModel):
    date: str
    destination: str  # Tadjoura or Obock
    trip_type: str  # aller or retour
    passengers: List[FerryPassenger]
    vehicles: List[FerryVehicle] = []
    payment_method: str
    promo_code: Optional[str] = None


# ============== FERRY HELPER ==============

async def get_ferry_settings():
    """Get ferry settings from database"""
    settings = await db.settings.find_one({"type": "transport"}, {"_id": 0})
    if not settings or "ferry" not in settings:
        return {
            "passenger_price": FERRY_PASSENGER_PRICE,
            "child_free_age": CHILD_FREE_AGE,
            "max_passengers_per_trip": 150,
            "max_vehicles_per_trip": 20,
            "vehicle_types": [],
            "commission_rate": 10
        }
    return settings.get("ferry", {})


async def get_dynamic_ferry_schedule():
    """Get ferry schedule from database"""
    settings = await db.settings.find_one({"type": "transport"}, {"_id": 0})
    if not settings or "ferry" not in settings:
        return None, None
    
    ferry = settings.get("ferry", {})
    detailed_schedule = ferry.get("detailed_schedule")
    
    if not detailed_schedule:
        return None, None
    
    schedule_by_weekday = {}
    for day_info in detailed_schedule:
        day_key = day_info.get("day", "").lower()
        weekday_num = DAY_TO_WEEKDAY.get(day_key)
        if weekday_num is not None:
            schedule_by_weekday[weekday_num] = day_info
    
    return detailed_schedule, schedule_by_weekday


# ============== FERRY PUBLIC ROUTES ==============

@router.get("/ferry/schedule")
async def get_public_ferry_schedule():
    """Public endpoint to get ferry weekly schedule"""
    detailed_schedule, _ = await get_dynamic_ferry_schedule()
    ferry_settings = await get_ferry_settings()
    
    if detailed_schedule:
        return {
            "schedule": detailed_schedule,
            "passenger_price": ferry_settings.get("passenger_price", FERRY_PASSENGER_PRICE),
            "child_free_age": ferry_settings.get("child_free_age", CHILD_FREE_AGE),
            "vehicle_types": ferry_settings.get("vehicle_types", []),
            "source": "database"
        }
    
    # Fallback schedule
    fallback_schedule = [
        {"day": "monday", "day_label": "Lundi", "active": False, "destination": None},
        {"day": "tuesday", "day_label": "Mardi", "active": True, "destination": "Tadjoura", "departure_time": "08:00", "return_time": "12:00"},
        {"day": "wednesday", "day_label": "Mercredi", "active": False, "destination": None},
        {"day": "thursday", "day_label": "Jeudi", "active": True, "destination": "Tadjoura/Obock", "departure_time": "09:00", "return_time": "14:00",
         "routes": [
             {"destination": "Tadjoura", "departure_time": "13:00", "return_time": "15:00"},
             {"destination": "Obock", "departure_time": "09:00", "return_time": "14:00"}
         ]},
        {"day": "friday", "day_label": "Vendredi", "active": True, "destination": "Tadjoura", "departure_time": "08:00", "return_time": "13:00"},
        {"day": "saturday", "day_label": "Samedi", "active": True, "destination": "Tadjoura/Obock", "departure_time": "08:00", "return_time": "12:00",
         "routes": [
             {"destination": "Tadjoura", "departure_time": "08:00", "return_time": "12:00"},
             {"destination": "Obock", "departure_time": "08:00", "return_time": "13:00"}
         ]},
        {"day": "sunday", "day_label": "Dimanche", "active": False, "destination": None},
    ]
    
    return {
        "schedule": fallback_schedule,
        "passenger_price": FERRY_PASSENGER_PRICE,
        "child_free_age": CHILD_FREE_AGE,
        "vehicle_types": [],
        "source": "default"
    }


@router.get("/ferry/trips")
async def get_ferry_trips(date: str, destination: Optional[str] = None):
    """Get available ferry trips for a specific date"""
    try:
        trip_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide")
    
    weekday = trip_date.weekday()
    _, schedule_by_weekday = await get_dynamic_ferry_schedule()
    ferry_settings = await get_ferry_settings()
    passenger_price = ferry_settings.get("passenger_price", FERRY_PASSENGER_PRICE)
    
    if not schedule_by_weekday or weekday not in schedule_by_weekday:
        return {"date": date, "has_service": False, "message": "Pas de service ce jour", "trips": []}
    
    day_schedule = schedule_by_weekday[weekday]
    
    if not day_schedule.get("active"):
        return {"date": date, "has_service": False, "message": "Pas de service ce jour", "trips": []}
    
    # Check if day has multiple routes (Tadjoura and Obock)
    routes = day_schedule.get("routes", [])
    trips = []
    
    if routes:
        # Multiple destinations available
        for route in routes:
            if destination and route["destination"].lower() != destination.lower():
                continue
            trips.append({
                "destination": route["destination"],
                "departure": "Djibouti",
                "arrival": route["destination"],
                "trip_type": "aller",
                "departure_time": route["departure_time"],
                "price": passenger_price
            })
            trips.append({
                "destination": route["destination"],
                "departure": route["destination"],
                "arrival": "Djibouti",
                "trip_type": "retour",
                "departure_time": route["return_time"],
                "price": passenger_price
            })
    else:
        # Single destination
        dest = day_schedule.get("destination")
        if dest and (not destination or dest.lower() == destination.lower()):
            trips = [
                {
                    "destination": dest,
                    "departure": "Djibouti",
                    "arrival": dest,
                    "trip_type": "aller",
                    "departure_time": day_schedule.get("departure_time", "08:00"),
                    "price": passenger_price
                },
                {
                    "destination": dest,
                    "departure": dest,
                    "arrival": "Djibouti",
                    "trip_type": "retour",
                    "departure_time": day_schedule.get("return_time", "12:00"),
                    "price": passenger_price
                }
            ]
    
    # Get remaining capacity
    booked_passengers = await db.tickets.count_documents({
        "type": "ferry",
        "event_date": date,
        "status": {"$ne": "cancelled"}
    })
    booked_vehicles = await db.ferry_vehicles.count_documents({
        "date": date,
        "status": {"$ne": "cancelled"}
    })
    
    max_passengers = ferry_settings.get("max_passengers_per_trip", 150)
    max_vehicles = ferry_settings.get("max_vehicles_per_trip", 20)
    
    return {
        "date": date,
        "has_service": len(trips) > 0,
        "day": day_schedule.get("day_label"),
        "trips": trips,
        "capacity": {
            "passengers_remaining": max(0, max_passengers - booked_passengers),
            "vehicles_remaining": max(0, max_vehicles - booked_vehicles),
            "max_passengers": max_passengers,
            "max_vehicles": max_vehicles
        },
        "vehicle_types": ferry_settings.get("vehicle_types", []),
        "child_free_age": ferry_settings.get("child_free_age", CHILD_FREE_AGE)
    }


@router.post("/ferry/book")
async def book_ferry(booking: FerryBookingRequest, user: dict = Depends(get_current_user)):
    """Book ferry tickets for passengers and vehicles"""
    try:
        trip_date = datetime.strptime(booking.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide")
    
    weekday = trip_date.weekday()
    _, schedule_by_weekday = await get_dynamic_ferry_schedule()
    ferry_settings = await get_ferry_settings()
    
    # Validate day has service
    if not schedule_by_weekday or weekday not in schedule_by_weekday:
        raise HTTPException(status_code=400, detail="Pas de service ce jour")
    
    day_schedule = schedule_by_weekday[weekday]
    if not day_schedule.get("active"):
        raise HTTPException(status_code=400, detail="Pas de service ce jour")
    
    # Validate destination
    valid_destinations = []
    routes = day_schedule.get("routes", [])
    if routes:
        valid_destinations = [r["destination"].lower() for r in routes]
    elif day_schedule.get("destination"):
        if "/" in day_schedule["destination"]:
            valid_destinations = [d.strip().lower() for d in day_schedule["destination"].split("/")]
        else:
            valid_destinations = [day_schedule["destination"].lower()]
    
    if booking.destination.lower() not in valid_destinations:
        raise HTTPException(status_code=400, detail=f"Destination non disponible ce jour. Disponibles: {', '.join(valid_destinations)}")
    
    # Get departure time for selected destination
    departure_time = day_schedule.get("departure_time", "08:00")
    return_time = day_schedule.get("return_time", "12:00")
    if routes:
        for route in routes:
            if route["destination"].lower() == booking.destination.lower():
                departure_time = route["departure_time"]
                return_time = route["return_time"]
                break
    
    trip_time = departure_time if booking.trip_type == "aller" else return_time
    
    # Check capacity
    booked_passengers = await db.tickets.count_documents({
        "type": "ferry",
        "event_date": booking.date,
        "destination": booking.destination,
        "status": {"$ne": "cancelled"}
    })
    booked_vehicles = await db.ferry_vehicles.count_documents({
        "date": booking.date,
        "destination": booking.destination,
        "status": {"$ne": "cancelled"}
    })
    
    max_passengers = ferry_settings.get("max_passengers_per_trip", 150)
    max_vehicles = ferry_settings.get("max_vehicles_per_trip", 20)
    
    if booked_passengers + len(booking.passengers) > max_passengers:
        remaining = max_passengers - booked_passengers
        raise HTTPException(status_code=400, detail=f"Capacite insuffisante. Places restantes: {remaining}")
    
    if booked_vehicles + len(booking.vehicles) > max_vehicles:
        remaining = max_vehicles - booked_vehicles
        raise HTTPException(status_code=400, detail=f"Capacite vehicules insuffisante. Places restantes: {remaining}")
    
    passenger_price = ferry_settings.get("passenger_price", FERRY_PASSENGER_PRICE)
    child_free_age = ferry_settings.get("child_free_age", CHILD_FREE_AGE)
    vehicle_types = {vt["type"]: vt for vt in ferry_settings.get("vehicle_types", [])}
    
    # Calculate total
    passenger_total = 0
    for p in booking.passengers:
        if p.age and p.age < child_free_age:
            continue  # Free for children
        passenger_total += passenger_price
    
    vehicle_total = 0
    for v in booking.vehicles:
        vt = vehicle_types.get(v.vehicle_type, {})
        vehicle_total += vt.get("price", 0)
    
    total_price = passenger_total + vehicle_total
    
    # Apply promo code if any
    discount = 0
    if booking.promo_code:
        promo = await db.promo_codes.find_one({"code": booking.promo_code.upper()})
        if promo and promo["uses"] < promo["max_uses"]:
            if promo["discount_type"] == "percentage":
                discount = int(total_price * promo["discount_value"] / 100)
            else:
                discount = min(promo["discount_value"], total_price)
            await db.promo_codes.update_one(
                {"code": booking.promo_code.upper()},
                {"$inc": {"uses": 1}}
            )
    
    final_total = total_price - discount
    
    # Create tickets
    tickets_created = []
    for passenger in booking.passengers:
        ticket_id = str(uuid.uuid4())
        qr_data = f"FERRY-{ticket_id}"
        
        is_child = passenger.age and passenger.age < child_free_age
        ticket_price = 0 if is_child else passenger_price
        
        ticket_doc = {
            "id": ticket_id,
            "type": "ferry",
            "event_id": "ferry",
            "event_title": f"Ferry Djibouti - {booking.destination}",
            "event_date": booking.date,
            "event_time": trip_time,
            "event_venue": "Port de Djibouti",
            "destination": booking.destination,
            "ticket_type": "Enfant" if is_child else "Adulte",
            "trip_type": booking.trip_type,
            "passenger_name": passenger.full_name,
            "passenger_phone": passenger.phone,
            "passenger_id": passenger.passport_or_cni,
            "passenger_age": passenger.age,
            "user_id": user["id"],
            "qr_code_data": qr_data,
            "status": "valid",
            "price": ticket_price,
            "payment_method": booking.payment_method,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.tickets.insert_one(ticket_doc)
        tickets_created.append({
            "id": ticket_id,
            "passenger": passenger.full_name,
            "type": "Enfant (Gratuit)" if is_child else "Adulte",
            "price": ticket_price
        })
    
    # Create vehicle bookings
    vehicles_created = []
    for vehicle in booking.vehicles:
        vehicle_id = str(uuid.uuid4())
        qr_data = f"FERRY-VEH-{vehicle_id}"
        vt = vehicle_types.get(vehicle.vehicle_type, {})
        
        vehicle_doc = {
            "id": vehicle_id,
            "date": booking.date,
            "destination": booking.destination,
            "trip_type": booking.trip_type,
            "vehicle_type": vehicle.vehicle_type,
            "vehicle_name": vt.get("name", vehicle.vehicle_type),
            "plate_number": vehicle.plate_number,
            "passenger_names": vehicle.passenger_names,
            "user_id": user["id"],
            "qr_code_data": qr_data,
            "status": "valid",
            "price": vt.get("price", 0),
            "payment_method": booking.payment_method,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.ferry_vehicles.insert_one(vehicle_doc)
        vehicles_created.append({
            "id": vehicle_id,
            "type": vt.get("name", vehicle.vehicle_type),
            "plate": vehicle.plate_number,
            "price": vt.get("price", 0)
        })
    
    return {
        "message": "Reservation confirmee",
        "tickets": tickets_created,
        "vehicles": vehicles_created,
        "passenger_total": passenger_total,
        "vehicle_total": vehicle_total,
        "discount": discount,
        "final_total": final_total,
        "trip": {
            "date": booking.date,
            "destination": booking.destination,
            "time": trip_time,
            "type": booking.trip_type
        },
        "remaining_capacity": {
            "passengers": max_passengers - booked_passengers - len(booking.passengers),
            "vehicles": max_vehicles - booked_vehicles - len(booking.vehicles)
        }
    }


@router.get("/ferry/vehicle-types")
async def get_vehicle_types():
    """Get available vehicle types and prices"""
    ferry_settings = await get_ferry_settings()
    return {
        "vehicle_types": ferry_settings.get("vehicle_types", []),
        "message": "Prix a configurer par l'organisateur" if not any(vt.get("price", 0) > 0 for vt in ferry_settings.get("vehicle_types", [])) else None
    }


# ============== TRAIN ROUTES ==============

@router.get("/train/trips")
async def get_train_trips(date: str):
    try:
        trip_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide")
    
    day = trip_date.day
    is_odd = day % 2 == 1
    direction = "Djibouti-Ali Sabieh" if is_odd else "Ali Sabieh-Djibouti"
    
    settings = await db.settings.find_one({"type": "transport"}, {"_id": 0})
    train_settings = settings.get("train", {}) if settings else {}
    
    if not train_settings.get("active", True):
        return {"date": date, "has_service": False, "message": "Service train suspendu", "trips": []}
    
    departure_time = train_settings.get("departure_time", "06:00")
    price = train_settings.get("price", TRAIN_PRICE)
    
    if is_odd:
        trips = [{"departure": "Djibouti", "arrival": "Ali Sabieh", "departure_time": departure_time, "price": price}]
    else:
        trips = [{"departure": "Ali Sabieh", "arrival": "Djibouti", "departure_time": departure_time, "price": price}]
    
    return {
        "date": date,
        "has_service": True,
        "direction": direction,
        "rule": "Jours impairs: Djibouti -> Ali Sabieh | Jours pairs: Ali Sabieh -> Djibouti",
        "trips": trips
    }


@router.post("/train/book")
async def book_train(booking: TrainBookingRequest, user: dict = Depends(get_current_user)):
    try:
        trip_date = datetime.strptime(booking.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide")
    
    day = trip_date.day
    is_odd = day % 2 == 1
    
    expected_departure = "Djibouti" if is_odd else "Ali Sabieh"
    expected_arrival = "Ali Sabieh" if is_odd else "Djibouti"
    
    if booking.departure != expected_departure or booking.arrival != expected_arrival:
        raise HTTPException(
            status_code=400, 
            detail=f"Le {booking.date}, le train circule uniquement de {expected_departure} a {expected_arrival}"
        )
    
    settings = await db.settings.find_one({"type": "transport"}, {"_id": 0})
    train_settings = settings.get("train", {}) if settings else {}
    departure_time = train_settings.get("departure_time", "06:00")
    price = train_settings.get("price", TRAIN_PRICE)
    
    total_price = price * len(booking.passengers)
    
    tickets_created = []
    for passenger in booking.passengers:
        ticket_id = str(uuid.uuid4())
        qr_data = f"TRAIN-{ticket_id}"
        
        ticket_doc = {
            "id": ticket_id,
            "type": "train",
            "event_id": "train",
            "event_title": f"Train {booking.departure} - {booking.arrival}",
            "event_date": booking.date,
            "event_time": departure_time,
            "event_venue": f"Gare de {booking.departure}",
            "ticket_type": "Train",
            "passenger_name": passenger.full_name,
            "passenger_phone": passenger.phone,
            "passenger_id": passenger.passport_or_cni,
            "user_id": user["id"],
            "qr_code_data": qr_data,
            "status": "valid",
            "price": price,
            "payment_method": booking.payment_method,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.tickets.insert_one(ticket_doc)
        tickets_created.append({"id": ticket_id, "passenger": passenger.full_name})
    
    return {
        "message": "Reservation confirmee",
        "tickets": tickets_created,
        "total": total_price,
        "trip": {
            "date": booking.date,
            "departure": booking.departure,
            "arrival": booking.arrival,
            "time": departure_time
        }
    }
