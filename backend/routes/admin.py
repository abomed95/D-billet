"""
Admin routes (Dashboard, Users, Events, Transactions, Payouts, Settings, Transport)
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid

from config import db, DAY_TO_WEEKDAY
from models import OrganizerCreate, OrganizerResponse, TransportStaffCreate, TransportStaffUpdate
from services import get_admin_user, hash_password, generate_staff_password

router = APIRouter(prefix="/admin", tags=["Admin"])


# ============== ADMIN DASHBOARD ==============

@router.get("/stats")
async def get_admin_stats(admin: dict = Depends(get_admin_user)):
    """Get platform-wide statistics"""
    total_users = await db.users.count_documents({})
    total_organizers = await db.users.count_documents(
        {"role": {"$in": ["organizer", "ferry_organizer", "train_organizer"]}}
    )
    total_events = await db.events.count_documents({})
    
    # Only fetch ticket_types field for revenue calculation (optimized projection)
    all_events = await db.events.find({}, {"_id": 0, "ticket_types": 1}).to_list(1000)
    total_revenue = 0
    total_tickets_sold = 0
    
    for event in all_events:
        for tt in event.get("ticket_types", []):
            sold = tt.get("sold", 0)
            total_tickets_sold += sold
            total_revenue += sold * tt.get("price", 0)
    
    commission_rate = 8.0
    settings = await db.settings.find_one({"type": "platform"}, {"_id": 0})
    if settings:
        raw_commission_rate = settings.get("commission_rate", 8)
        try:
            commission_rate = float(raw_commission_rate)
        except (TypeError, ValueError):
            commission_rate = 8.0
    
    platform_revenue = int(total_revenue * commission_rate / 100)
    
    return {
        "total_users": total_users,
        "total_organizers": total_organizers,
        "total_events": total_events,
        "total_revenue": total_revenue,
        "platform_revenue": platform_revenue,
        "commission": platform_revenue,
        "commission_rate": commission_rate,
        "total_tickets_sold": total_tickets_sold
    }


@router.get("/alerts")
async def get_admin_alerts(admin: dict = Depends(get_admin_user)):
    """Get urgent alerts for admin dashboard"""
    pending_events = await db.events.count_documents({"status": "pending"})
    pending_payouts = await db.payouts.count_documents({"status": "pending"})
    pending_refunds = await db.refunds.count_documents({"status": "pending"}) if "refunds" in await db.list_collection_names() else 0
    
    return {
        "pending_events": pending_events,
        "pending_payouts": pending_payouts,
        "pending_refunds": pending_refunds,
        "total_alerts": pending_events + pending_payouts + pending_refunds
    }


# ============== ORGANIZER MANAGEMENT ==============

@router.post("/organizers", response_model=OrganizerResponse)
async def create_organizer(data: OrganizerCreate, admin: dict = Depends(get_admin_user)):
    """Admin creates organizer account"""
    existing = await db.users.find_one({"$or": [{"email": data.email}, {"phone": data.phone}]})
    if existing:
        raise HTTPException(status_code=400, detail="Email ou telephone deja utilise")
    
    org_id = str(uuid.uuid4())
    org_doc = {
        "id": org_id,
        "email": data.email,
        "phone": data.phone,
        "full_name": data.full_name,
        "company_name": data.company_name,
        "hashed_password": hash_password(data.password),
        "role": "organizer",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(org_doc)
    
    return OrganizerResponse(**{k: v for k, v in org_doc.items() if k != "hashed_password"})


@router.get("/organizers", response_model=List[OrganizerResponse])
async def list_organizers(admin: dict = Depends(get_admin_user)):
    """List all organizers"""
    organizers = await db.users.find({"role": "organizer"}, {"_id": 0, "hashed_password": 0}).to_list(100)
    return [OrganizerResponse(**o) for o in organizers]


@router.delete("/organizers/{organizer_id}")
async def delete_organizer(organizer_id: str, admin: dict = Depends(get_admin_user)):
    """Delete organizer"""
    result = await db.users.delete_one({"id": organizer_id, "role": "organizer"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Organisateur non trouve")
    return {"message": "Organisateur supprime"}


# ============== EVENT MANAGEMENT ==============

@router.get("/events")
async def get_all_events(
    admin: dict = Depends(get_admin_user),
    status: Optional[str] = None,
    featured: Optional[bool] = None
):
    """Get all events with optional filters"""
    query = {}
    if status:
        query["status"] = status
    if featured is not None:
        query["featured"] = featured
    
    events = await db.events.find(query, {"_id": 0}).to_list(1000)
    
    # Batch fetch all organizers to avoid N+1 query problem
    organizer_ids = list(set(e.get("organizer_id") for e in events if e.get("organizer_id")))
    organizers_list = await db.users.find(
        {"id": {"$in": organizer_ids}}, 
        {"_id": 0, "id": 1, "full_name": 1, "company_name": 1}
    ).to_list(1000)
    organizers = {o["id"]: o for o in organizers_list}
    
    result = []
    for event in events:
        total = sum(tt["quantity"] for tt in event.get("ticket_types", []))
        sold = sum(tt.get("sold", 0) for tt in event.get("ticket_types", []))
        revenue = sum(tt.get("sold", 0) * tt["price"] for tt in event.get("ticket_types", []))
        
        organizer = organizers.get(event.get("organizer_id"))
        
        result.append({
            **event,
            "total_tickets": total,
            "sold_tickets": sold,
            "revenue": revenue,
            "organizer_name": organizer.get("company_name") or organizer.get("full_name") if organizer else "N/A"
        })
    
    return result


@router.put("/events/{event_id}/status")
async def update_event_status(event_id: str, status: str = Query(...), admin: dict = Depends(get_admin_user)):
    """Update event status (approved, pending, blocked)"""
    if status not in ["approved", "pending", "blocked"]:
        raise HTTPException(status_code=400, detail="Statut invalide")
    
    result = await db.events.update_one({"id": event_id}, {"$set": {"status": status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Evenement non trouve")
    
    return {"message": f"Statut mis a jour: {status}"}


@router.put("/events/{event_id}/featured")
async def toggle_event_featured(event_id: str, featured: bool = Query(...), admin: dict = Depends(get_admin_user)):
    """Toggle event featured status"""
    result = await db.events.update_one({"id": event_id}, {"$set": {"featured": featured}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Evenement non trouve")
    
    return {"message": f"Mise a la une: {featured}"}


# ============== USER MANAGEMENT ==============

@router.get("/users")
async def get_all_users(
    admin: dict = Depends(get_admin_user),
    role: Optional[str] = None,
    search: Optional[str] = None
):
    """Get all users with optional filters"""
    query = {}
    if role:
        query["role"] = role
    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    
    users = await db.users.find(query, {"_id": 0, "hashed_password": 0}).to_list(1000)
    return users


@router.get("/users/{user_id}")
async def get_user_details(user_id: str, admin: dict = Depends(get_admin_user)):
    """Get user details with purchase history"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouve")
    
    tickets = await db.tickets.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    
    total_spent = sum(t.get("price", 0) for t in tickets)
    
    return {
        **user,
        "tickets_count": len(tickets),
        "total_spent": total_spent,
        "recent_tickets": tickets[:10]
    }


@router.put("/users/{user_id}/commission")
async def set_user_commission(user_id: str, commission_rate: float = Query(...), admin: dict = Depends(get_admin_user)):
    """Set custom commission rate for an organizer"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouve")
    if user.get("role") != "organizer":
        raise HTTPException(status_code=400, detail="Commission uniquement pour les organisateurs")
    
    await db.users.update_one({"id": user_id}, {"$set": {"custom_commission": commission_rate}})
    
    return {"message": f"Commission personnalisee: {commission_rate}%"}


# ============== TRANSACTIONS ==============

@router.get("/transactions")
async def get_transactions(
    admin: dict = Depends(get_admin_user),
    payment_method: Optional[str] = None,
    days: int = 30
):
    """Get transaction history"""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    
    query = {"created_at": {"$gte": cutoff.isoformat()}}
    if payment_method:
        query["payment_method"] = payment_method
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Group by payment method
    by_method = {}
    for ticket in tickets:
        method = ticket.get("payment_method", "unknown")
        if method not in by_method:
            by_method[method] = {"count": 0, "total": 0}
        by_method[method]["count"] += 1
        by_method[method]["total"] += ticket.get("price", 0)
    
    return {
        "transactions": tickets,
        "summary": by_method,
        "total_count": len(tickets),
        "total_amount": sum(t.get("price", 0) for t in tickets)
    }


# ============== PAYOUTS ==============

@router.get("/payouts")
async def get_payouts(
    admin: dict = Depends(get_admin_user),
    status: Optional[str] = None
):
    """Get payout requests"""
    query = {}
    if status:
        query["status"] = status
    
    payouts = await db.payouts.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for payout in payouts:
        organizer = await db.users.find_one({"id": payout.get("organizer_id")}, {"_id": 0, "full_name": 1, "company_name": 1})
        payout["organizer_name"] = organizer.get("company_name") or organizer.get("full_name") if organizer else "N/A"
    
    return payouts


@router.put("/payouts/{payout_id}/status")
async def update_payout_status(
    payout_id: str,
    status: str = Query(...),
    admin_note: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    """Update payout status (completed, rejected)"""
    if status not in ["completed", "rejected", "pending"]:
        raise HTTPException(status_code=400, detail="Statut invalide")
    
    update_data = {
        "status": status,
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "processed_by": admin["id"]
    }
    if admin_note:
        update_data["admin_note"] = admin_note
    
    result = await db.payouts.update_one({"id": payout_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Demande de retrait non trouvee")
    
    return {"message": f"Statut mis a jour: {status}"}


# ============== PLATFORM SETTINGS ==============

@router.get("/settings")
async def get_platform_settings(admin: dict = Depends(get_admin_user)):
    """Get platform settings"""
    settings = await db.settings.find_one({"type": "platform"}, {"_id": 0})
    
    if not settings:
        settings = {
            "type": "platform",
            "commission_rate": 8,
            "min_withdrawal": 1000,
            "terms": "",
            "legal": "",
            "banner_text": "",
            "banner_active": False,
            "categories": ["Concert", "Cinema", "Football", "Theatre", "Conference", "Soiree"]
        }
        await db.settings.insert_one(settings)

    if "terms_content" not in settings:
        settings["terms_content"] = settings.get("terms", "")
    if "legal_content" not in settings:
        settings["legal_content"] = settings.get("legal", "")
    
    return settings


@router.put("/settings")
async def update_platform_settings(
    admin: dict = Depends(get_admin_user),
    commission_rate: Optional[float] = None,
    min_withdrawal: Optional[int] = None,
    terms: Optional[str] = None,
    terms_content: Optional[str] = None,
    legal: Optional[str] = None,
    legal_content: Optional[str] = None,
    banner_text: Optional[str] = None,
    banner_active: Optional[bool] = None
):
    """Update platform settings"""
    update_data = {}
    if commission_rate is not None:
        update_data["commission_rate"] = commission_rate
    if min_withdrawal is not None:
        update_data["min_withdrawal"] = min_withdrawal
    if terms is not None or terms_content is not None:
        terms_value = terms_content if terms_content is not None else terms
        update_data["terms"] = terms_value
        update_data["terms_content"] = terms_value
    if legal is not None or legal_content is not None:
        legal_value = legal_content if legal_content is not None else legal
        update_data["legal"] = legal_value
        update_data["legal_content"] = legal_value
    if banner_text is not None:
        update_data["banner_text"] = banner_text
    if banner_active is not None:
        update_data["banner_active"] = banner_active
    
    if update_data:
        await db.settings.update_one(
            {"type": "platform"},
            {"$set": update_data},
            upsert=True
        )
    
    return {"message": "Parametres mis a jour"}


@router.post("/settings/categories")
async def add_category(category: str = Query(...), admin: dict = Depends(get_admin_user)):
    """Add event category"""
    await db.settings.update_one(
        {"type": "platform"},
        {"$addToSet": {"categories": category}},
        upsert=True
    )
    return {"message": f"Categorie ajoutee: {category}"}


@router.delete("/settings/categories/{category}")
async def delete_category(category: str, admin: dict = Depends(get_admin_user)):
    """Delete event category"""
    await db.settings.update_one(
        {"type": "platform"},
        {"$pull": {"categories": category}}
    )
    return {"message": f"Categorie supprimee: {category}"}


# ============== TRANSPORT SETTINGS ==============

@router.get("/transport/settings")
async def get_transport_settings(admin: dict = Depends(get_admin_user)):
    """Get transport settings (Train & Ferry)"""
    settings = await db.settings.find_one({"type": "transport"}, {"_id": 0})
    
    if not settings:
        settings = {
            "type": "transport",
            "train": {
                "active": True,
                "departure_time": "06:00",
                "routes": [
                    {"from": "Djibouti", "to": "Ali Sabieh", "price": 500},
                    {"from": "Ali Sabieh", "to": "Djibouti", "price": 500}
                ]
            },
            "ferry": {
                "active": True,
                "departure_time": "09:00",
                "return_time": "14:00",
                "routes": [
                    {"from": "Djibouti", "to": "Obock", "price": 700, "duration": "3h"},
                    {"from": "Obock", "to": "Djibouti", "price": 700, "duration": "3h"}
                ],
                "destinations": {
                    "thursday": "Obock",
                    "saturday": "Obock"
                }
            }
        }
        await db.settings.insert_one(settings)
    
    return settings


@router.put("/transport/train")
async def update_train_settings(
    admin: dict = Depends(get_admin_user),
    active: Optional[bool] = None,
    departure_time: Optional[str] = None
):
    """Update train settings"""
    update_data = {}
    if active is not None:
        update_data["train.active"] = active
    if departure_time is not None:
        update_data["train.departure_time"] = departure_time
    
    if update_data:
        await db.settings.update_one(
            {"type": "transport"},
            {"$set": update_data},
            upsert=True
        )
    
    return {"message": "Parametres train mis a jour"}


@router.put("/transport/ferry")
async def update_ferry_settings(
    admin: dict = Depends(get_admin_user),
    active: Optional[bool] = None,
    departure_time: Optional[str] = None,
    return_time: Optional[str] = None
):
    """Update ferry settings"""
    update_data = {}
    if active is not None:
        update_data["ferry.active"] = active
    if departure_time is not None:
        update_data["ferry.departure_time"] = departure_time
    if return_time is not None:
        update_data["ferry.return_time"] = return_time
    
    if update_data:
        await db.settings.update_one(
            {"type": "transport"},
            {"$set": update_data},
            upsert=True
        )
    
    return {"message": "Parametres ferry mis a jour"}


@router.get("/transport/ferry/schedule")
async def get_ferry_schedule(admin: dict = Depends(get_admin_user)):
    """Get ferry weekly schedule for admin management"""
    settings = await db.settings.find_one({"type": "transport"}, {"_id": 0})
    
    if settings and "ferry" in settings and "detailed_schedule" in settings["ferry"]:
        return {"schedule": settings["ferry"]["detailed_schedule"]}
    
    # Default schedule (Obock only: Jeudi 9h/14h, Samedi 8h/13h)
    default_schedule = [
        {"day": "monday", "day_label": "Lundi", "active": False, "destination": None, "departure_time": None, "return_time": None},
        {"day": "tuesday", "day_label": "Mardi", "active": False, "destination": None, "departure_time": None, "return_time": None},
        {"day": "wednesday", "day_label": "Mercredi", "active": False, "destination": None, "departure_time": None, "return_time": None},
        {"day": "thursday", "day_label": "Jeudi", "active": True, "destination": "Obock", "departure_time": "09:00", "return_time": "14:00"},
        {"day": "friday", "day_label": "Vendredi", "active": False, "destination": None, "departure_time": None, "return_time": None},
        {"day": "saturday", "day_label": "Samedi", "active": True, "destination": "Obock", "departure_time": "08:00", "return_time": "13:00"},
        {"day": "sunday", "day_label": "Dimanche", "active": False, "destination": None, "departure_time": None, "return_time": None},
    ]
    
    return {"schedule": default_schedule}


@router.put("/transport/ferry/schedule")
async def update_ferry_schedule(
    schedule: List[dict],
    admin: dict = Depends(get_admin_user)
):
    """Update ferry weekly schedule"""
    await db.settings.update_one(
        {"type": "transport"},
        {"$set": {"ferry.detailed_schedule": schedule}},
        upsert=True
    )
    
    return {"message": "Planning ferry mis a jour"}


# ============== TRANSPORT STAFF MANAGEMENT ==============

@router.get("/transport/staff")
async def get_transport_staff(admin: dict = Depends(get_admin_user)):
    """Get all transport staff accounts"""
    staff_list = await db.transport_staff.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return staff_list


@router.post("/transport/staff")
async def create_transport_staff(data: TransportStaffCreate, admin: dict = Depends(get_admin_user)):
    """Create a transport staff account"""
    existing = await db.transport_staff.find_one({"username": data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Ce nom d'utilisateur est deja pris")
    
    password = generate_staff_password()
    
    staff_id = str(uuid.uuid4())
    staff_doc = {
        "id": staff_id,
        "username": data.username,
        "password_hash": hash_password(password),
        "full_name": data.full_name,
        "role": data.role,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.transport_staff.insert_one(staff_doc)
    
    return {
        "id": staff_id,
        "username": data.username,
        "password": password,
        "full_name": data.full_name,
        "role": data.role,
        "active": True,
        "message": "Compte cree! Notez bien le mot de passe, il ne sera plus affiche."
    }


@router.put("/transport/staff/{staff_id}")
async def update_transport_staff(staff_id: str, data: TransportStaffUpdate, admin: dict = Depends(get_admin_user)):
    """Update transport staff account"""
    staff = await db.transport_staff.find_one({"id": staff_id})
    if not staff:
        raise HTTPException(status_code=404, detail="Compte staff non trouve")
    
    update_data = {}
    if data.full_name is not None:
        update_data["full_name"] = data.full_name
    if data.role is not None:
        update_data["role"] = data.role
    if data.active is not None:
        update_data["active"] = data.active
    
    if update_data:
        await db.transport_staff.update_one({"id": staff_id}, {"$set": update_data})
    
    updated = await db.transport_staff.find_one({"id": staff_id}, {"_id": 0, "password_hash": 0})
    return updated


@router.delete("/transport/staff/{staff_id}")
async def delete_transport_staff(staff_id: str, admin: dict = Depends(get_admin_user)):
    """Delete transport staff account"""
    result = await db.transport_staff.delete_one({"id": staff_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Compte staff non trouve")
    return {"message": "Compte staff supprime"}


@router.post("/transport/staff/{staff_id}/reset-password")
async def reset_transport_staff_password(staff_id: str, admin: dict = Depends(get_admin_user)):
    """Reset transport staff password"""
    staff = await db.transport_staff.find_one({"id": staff_id})
    if not staff:
        raise HTTPException(status_code=404, detail="Compte staff non trouve")
    
    new_password = generate_staff_password()
    await db.transport_staff.update_one(
        {"id": staff_id},
        {"$set": {"password_hash": hash_password(new_password)}}
    )
    
    return {
        "message": "Mot de passe reinitialise",
        "new_password": new_password,
        "username": staff["username"]
    }
