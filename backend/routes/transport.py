"""
Transport routes (Train & Ferry)
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional
import uuid

from config import db, FERRY_PRICE, TRAIN_PRICE, DAY_TO_WEEKDAY, DEFAULT_FERRY_SCHEDULE
from models import TrainBookingRequest, FerryBookingRequest
from services import get_current_user

router = APIRouter(tags=["Transport"])


# ============== FERRY HELPER ==============

async def get_dynamic_ferry_schedule():
    """Get ferry schedule from database or return default"""
    settings = await db.settings.find_one({"type": "transport"}, {"_id": 0})
    if not settings or "ferry" not in settings:
        return None, None
    
    ferry = settings.get("ferry", {})
    detailed_schedule = ferry.get("detailed_schedule")
    default_departure = ferry.get("departure_time", "09:00")
    default_return = ferry.get("return_time", "14:00")
    
    if not detailed_schedule:
        return None, None
    
    schedule_by_weekday = {}
    for day_info in detailed_schedule:
        day_key = day_info.get("day", "").lower()
        weekday_num = DAY_TO_WEEKDAY.get(day_key)
        if weekday_num is not None:
            schedule_by_weekday[weekday_num] = {
                "active": day_info.get("active", False),
                "destination": day_info.get("destination"),
                "departure_time": day_info.get("departure_time") or default_departure,
                "return_time": day_info.get("return_time") or default_return
            }
    
    return detailed_schedule, schedule_by_weekday


# ============== FERRY PUBLIC ROUTES ==============

@router.get("/ferry/schedule")
async def get_public_ferry_schedule():
    """Public endpoint to get ferry weekly schedule for customers"""
    detailed_schedule, _ = await get_dynamic_ferry_schedule()
    
    if detailed_schedule:
        return {"schedule": detailed_schedule, "source": "database"}
    
    # Fallback to default schedule (Obock only: Jeudi 9h/14h, Samedi 8h/13h)
    fallback_schedule = [
        {"day": "monday", "day_label": "Lundi", "active": False, "destination": None, "departure_time": None, "return_time": None},
        {"day": "tuesday", "day_label": "Mardi", "active": False, "destination": None, "departure_time": None, "return_time": None},
        {"day": "wednesday", "day_label": "Mercredi", "active": False, "destination": None, "departure_time": None, "return_time": None},
        {"day": "thursday", "day_label": "Jeudi", "active": True, "destination": "Obock", "departure_time": "09:00", "return_time": "14:00"},
        {"day": "friday", "day_label": "Vendredi", "active": False, "destination": None, "departure_time": None, "return_time": None},
        {"day": "saturday", "day_label": "Samedi", "active": True, "destination": "Obock", "departure_time": "08:00", "return_time": "13:00"},
        {"day": "sunday", "day_label": "Dimanche", "active": False, "destination": None, "departure_time": None, "return_time": None},
    ]
    
    return {"schedule": fallback_schedule, "source": "default"}


@router.get("/ferry/trips")
async def get_ferry_trips(date: str):
    try:
        trip_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide")
    
    weekday = trip_date.weekday()
    _, schedule_by_weekday = await get_dynamic_ferry_schedule()
    
    if schedule_by_weekday and weekday in schedule_by_weekday:
        day_schedule = schedule_by_weekday[weekday]
        
        if not day_schedule.get("active"):
            return {"date": date, "has_service": False, "message": "Pas de service ce jour", "trips": []}
        
        destination = day_schedule.get("destination")
        if not destination:
            return {"date": date, "has_service": False, "message": "Destination non configuree", "trips": []}
        
        departure_time = day_schedule.get("departure_time", "09:00")
        return_time = day_schedule.get("return_time", "14:00")
        
        trips = [
            {"departure": "Djibouti", "arrival": destination, "trip_type": "aller", "departure_time": departure_time, "price": FERRY_PRICE},
            {"departure": destination, "arrival": "Djibouti", "trip_type": "retour", "departure_time": return_time, "price": FERRY_PRICE}
        ]
        
        return {"date": date, "has_service": True, "route": f"Djibouti-{destination}", "trips": trips}
    
    # Fallback - Only Thursday and Saturday have service
    if weekday == 3:  # Thursday
        trips = [
            {"departure": "Djibouti", "arrival": "Obock", "trip_type": "aller", "departure_time": "09:00", "price": FERRY_PRICE},
            {"departure": "Obock", "arrival": "Djibouti", "trip_type": "retour", "departure_time": "14:00", "price": FERRY_PRICE}
        ]
        return {"date": date, "has_service": True, "route": "Djibouti-Obock", "trips": trips}
    elif weekday == 5:  # Saturday
        trips = [
            {"departure": "Djibouti", "arrival": "Obock", "trip_type": "aller", "departure_time": "08:00", "price": FERRY_PRICE},
            {"departure": "Obock", "arrival": "Djibouti", "trip_type": "retour", "departure_time": "13:00", "price": FERRY_PRICE}
        ]
        return {"date": date, "has_service": True, "route": "Djibouti-Obock", "trips": trips}
    
    return {"date": date, "has_service": False, "message": "Pas de service ce jour", "trips": []}


@router.post("/ferry/book")
async def book_ferry(booking: FerryBookingRequest, user: dict = Depends(get_current_user)):
    try:
        trip_date = datetime.strptime(booking.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide")
    
    weekday = trip_date.weekday()
    _, schedule_by_weekday = await get_dynamic_ferry_schedule()
    
    if schedule_by_weekday and weekday in schedule_by_weekday:
        day_schedule = schedule_by_weekday[weekday]
        if not day_schedule.get("active"):
            raise HTTPException(status_code=400, detail="Pas de service ce jour")
        departure_time = day_schedule.get("departure_time", "09:00") if booking.trip_type == "aller" else day_schedule.get("return_time", "14:00")
    else:
        # Fallback - Only Thursday (3) and Saturday (5)
        if weekday not in [3, 5]:
            raise HTTPException(status_code=400, detail="Pas de service ce jour")
        if weekday == 3:
            departure_time = "09:00" if booking.trip_type == "aller" else "14:00"
        else:
            departure_time = "08:00" if booking.trip_type == "aller" else "13:00"
    
    total_price = FERRY_PRICE * len(booking.passengers)
    
    tickets_created = []
    for passenger in booking.passengers:
        ticket_id = str(uuid.uuid4())
        qr_data = f"FERRY-{ticket_id}"
        
        ticket_doc = {
            "id": ticket_id,
            "type": "ferry",
            "event_id": "ferry",
            "event_title": f"Ferry {booking.departure} - {booking.arrival}",
            "event_date": booking.date,
            "event_time": departure_time,
            "event_venue": f"Port de {booking.departure}",
            "ticket_type": booking.trip_type.capitalize(),
            "passenger_name": passenger.full_name,
            "passenger_phone": passenger.phone,
            "passenger_id": passenger.passport_or_cni,
            "user_id": user["id"],
            "qr_code_data": qr_data,
            "status": "valid",
            "price": FERRY_PRICE,
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
            "time": departure_time,
            "type": booking.trip_type
        }
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
    
    if is_odd:
        trips = [{"departure": "Djibouti", "arrival": "Ali Sabieh", "departure_time": departure_time, "price": TRAIN_PRICE}]
    else:
        trips = [{"departure": "Ali Sabieh", "arrival": "Djibouti", "departure_time": departure_time, "price": TRAIN_PRICE}]
    
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
    
    total_price = TRAIN_PRICE * len(booking.passengers)
    
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
            "price": TRAIN_PRICE,
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
