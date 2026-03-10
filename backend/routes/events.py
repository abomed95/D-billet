"""
Events routes
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from typing import Optional, List
import uuid

from config import db
from models import EventCreate, EventUpdate, TicketTypeCreate, PromoCodeCreate, PromoCodeResponse
from services import get_organizer_user

router = APIRouter(tags=["Events"])


@router.get("/events")
async def get_events(category: Optional[str] = None, search: Optional[str] = None):
    query = {}
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    events = await db.events.find(query, {"_id": 0}).sort("date", 1).to_list(100)
    
    result = []
    for event in events:
        total_tickets = sum(tt.get("quantity", 0) for tt in event.get("ticket_types", []))
        sold_tickets = sum(tt.get("sold", 0) for tt in event.get("ticket_types", []))
        available = total_tickets - sold_tickets
        low_stock = available > 0 and available <= total_tickets * 0.1
        prices = [tt.get("price", 0) for tt in event.get("ticket_types", [])]
        min_price = min(prices) if prices else 0
        
        result.append({
            **event,
            "total_tickets": total_tickets,
            "sold_tickets": sold_tickets,
            "available_tickets": available,
            "min_price": min_price,
            "low_stock": low_stock,
            "low_stock_count": available if low_stock else None
        })
    
    return result


@router.get("/events/{event_id}")
async def get_event(event_id: str):
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Evenement non trouve")
    
    total_tickets = sum(tt.get("quantity", 0) for tt in event.get("ticket_types", []))
    sold_tickets = sum(tt.get("sold", 0) for tt in event.get("ticket_types", []))
    available = total_tickets - sold_tickets
    low_stock = available > 0 and available <= total_tickets * 0.1
    
    return {
        **event,
        "total_tickets": total_tickets,
        "sold_tickets": sold_tickets,
        "available_tickets": available,
        "low_stock": low_stock,
        "low_stock_count": available if low_stock else None
    }


@router.post("/events")
async def create_event(event_data: EventCreate, user: dict = Depends(get_organizer_user)):
    """Create event (Organizer or Admin)"""
    event_id = str(uuid.uuid4())
    
    ticket_types = []
    for tt in event_data.ticket_types:
        ticket_types.append({
            "id": str(uuid.uuid4()),
            "name": tt.name,
            "price": tt.price,
            "quantity": tt.quantity,
            "sold": 0,
            "description": tt.description,
            "max_per_order": tt.max_per_order,
            "group_size": tt.group_size
        })
    
    event_doc = {
        "id": event_id,
        "title": event_data.title,
        "description": event_data.description,
        "category": event_data.category,
        "venue": event_data.venue,
        "date": event_data.date,
        "time": event_data.time,
        "image_url": event_data.image_url,
        "ticket_types": ticket_types,
        "organizer_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.events.insert_one(event_doc)
    
    return {**event_doc, "total_tickets": sum(tt["quantity"] for tt in ticket_types), "sold_tickets": 0}


@router.put("/events/{event_id}")
async def update_event(event_id: str, event_data: EventUpdate, user: dict = Depends(get_organizer_user)):
    event = await db.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Evenement non trouve")
    
    if user.get("role") != "admin" and event.get("organizer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Vous ne pouvez modifier que vos evenements")
    
    update_data = {k: v for k, v in event_data.model_dump().items() if v is not None}
    if update_data:
        await db.events.update_one({"id": event_id}, {"$set": update_data})
    
    updated = await db.events.find_one({"id": event_id}, {"_id": 0})
    return updated


@router.delete("/events/{event_id}")
async def delete_event(event_id: str, user: dict = Depends(get_organizer_user)):
    event = await db.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Evenement non trouve")
    
    if user.get("role") != "admin" and event.get("organizer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Vous ne pouvez supprimer que vos evenements")
    
    await db.events.delete_one({"id": event_id})
    return {"message": "Evenement supprime"}


@router.post("/events/{event_id}/ticket-types")
async def add_ticket_type(event_id: str, tt_data: TicketTypeCreate, user: dict = Depends(get_organizer_user)):
    """Add a new ticket type to an event"""
    event = await db.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Evenement non trouve")
    
    if user.get("role") != "admin" and event.get("organizer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorise")
    
    new_tt = {
        "id": str(uuid.uuid4()),
        "name": tt_data.name,
        "price": tt_data.price,
        "quantity": tt_data.quantity,
        "sold": 0,
        "description": tt_data.description,
        "max_per_order": tt_data.max_per_order,
        "group_size": tt_data.group_size
    }
    
    await db.events.update_one({"id": event_id}, {"$push": {"ticket_types": new_tt}})
    return new_tt


# ============== PROMO CODES ==============

@router.post("/promo-codes", response_model=PromoCodeResponse)
async def create_promo_code(data: PromoCodeCreate, user: dict = Depends(get_organizer_user)):
    """Create a promo code"""
    existing = await db.promo_codes.find_one({"code": data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Ce code existe deja")
    
    if data.event_id:
        event = await db.events.find_one({"id": data.event_id})
        if not event:
            raise HTTPException(status_code=404, detail="Evenement non trouve")
        if user.get("role") != "admin" and event.get("organizer_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Non autorise")
    
    promo_id = str(uuid.uuid4())
    promo_doc = {
        "id": promo_id,
        "code": data.code.upper(),
        "discount_type": data.discount_type,
        "discount_value": data.discount_value,
        "max_uses": data.max_uses,
        "uses": 0,
        "event_id": data.event_id,
        "valid_until": data.valid_until,
        "organizer_id": user["id"],
        "total_sales": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.promo_codes.insert_one(promo_doc)
    
    return PromoCodeResponse(**promo_doc)


@router.get("/promo-codes")
async def get_my_promo_codes(user: dict = Depends(get_organizer_user)):
    """Get promo codes for organizer"""
    query = {} if user.get("role") == "admin" else {"organizer_id": user["id"]}
    codes = await db.promo_codes.find(query, {"_id": 0}).to_list(100)
    return codes


@router.get("/promo-codes/{code}/validate")
async def validate_promo_code(code: str, event_id: Optional[str] = None):
    """Validate a promo code"""
    promo = await db.promo_codes.find_one({"code": code.upper()}, {"_id": 0})
    if not promo:
        raise HTTPException(status_code=404, detail="Code promo invalide")
    
    if promo["uses"] >= promo["max_uses"]:
        raise HTTPException(status_code=400, detail="Code promo epuise")
    
    if promo.get("valid_until"):
        valid_date = datetime.fromisoformat(promo["valid_until"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > valid_date:
            raise HTTPException(status_code=400, detail="Code promo expire")
    
    if promo.get("event_id") and event_id and promo["event_id"] != event_id:
        raise HTTPException(status_code=400, detail="Code non valide pour cet evenement")
    
    return {
        "valid": True,
        "discount_type": promo["discount_type"],
        "discount_value": promo["discount_value"],
        "code": promo["code"]
    }


@router.delete("/promo-codes/{promo_id}")
async def delete_promo_code(promo_id: str, user: dict = Depends(get_organizer_user)):
    promo = await db.promo_codes.find_one({"id": promo_id})
    if not promo:
        raise HTTPException(status_code=404, detail="Code promo non trouve")
    
    if user.get("role") != "admin" and promo.get("organizer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorise")
    
    await db.promo_codes.delete_one({"id": promo_id})
    return {"message": "Code promo supprime"}
