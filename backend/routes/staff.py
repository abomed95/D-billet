"""
Staff routes (Event Staff Management & Scanning)
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid

from config import db
from models import (
    StaffCreate, StaffUpdate, StaffLogin, StaffResponse, StaffTokenResponse,
    ScanRequest
)
from services import (
    verify_password, hash_password, create_staff_token,
    generate_staff_password, get_current_staff, get_organizer_user
)

router = APIRouter(tags=["Staff"])


# ============== STAFF AUTH ==============

@router.post("/staff/login", response_model=StaffTokenResponse)
async def staff_login(data: StaffLogin):
    """Staff member login - returns JWT token with 24h expiration"""
    staff = await db.staff_accounts.find_one({"username": data.username}, {"_id": 0})
    
    if not staff:
        raise HTTPException(status_code=401, detail="Identifiant incorrect")
    
    if not verify_password(data.password, staff["password_hash"]):
        raise HTTPException(status_code=401, detail="Mot de passe incorrect")
    
    if not staff.get("active", True):
        raise HTTPException(status_code=403, detail="Compte desactive par l'organisateur")
    
    token = create_staff_token({"sub": staff["id"]})
    
    return StaffTokenResponse(
        access_token=token,
        staff=StaffResponse(
            id=staff["id"],
            organizer_id=staff["organizer_id"],
            username=staff["username"],
            full_name=staff["full_name"],
            assigned_events=staff.get("assigned_events", []),
            active=staff.get("active", True),
            created_at=staff["created_at"]
        )
    )


@router.get("/staff/me")
async def get_staff_me(staff: dict = Depends(get_current_staff)):
    """Get current staff member info"""
    return StaffResponse(
        id=staff["id"],
        organizer_id=staff["organizer_id"],
        username=staff["username"],
        full_name=staff["full_name"],
        assigned_events=staff.get("assigned_events", []),
        active=staff.get("active", True),
        created_at=staff["created_at"]
    )


@router.get("/staff/events")
async def get_staff_events(staff: dict = Depends(get_current_staff)):
    """Get events assigned to staff member"""
    assigned_ids = staff.get("assigned_events", [])
    
    if not assigned_ids:
        return []
    
    events = await db.events.find(
        {"id": {"$in": assigned_ids}},
        {"_id": 0, "id": 1, "title": 1, "date": 1, "time": 1, "venue": 1, "image_url": 1}
    ).to_list(100)
    
    for event in events:
        total_tickets = await db.tickets.count_documents({"event_id": event["id"]})
        scanned_tickets = await db.tickets.count_documents({
            "event_id": event["id"],
            "status": "used"
        })
        event["total_tickets"] = total_tickets
        event["scanned_tickets"] = scanned_tickets
    
    return events


@router.post("/staff/scan")
async def staff_scan_ticket(data: ScanRequest, staff: dict = Depends(get_current_staff)):
    """Scan a ticket QR code - returns validation result"""
    if data.event_id not in staff.get("assigned_events", []):
        raise HTTPException(status_code=403, detail="Vous n'etes pas assigne a cet evenement")
    
    ticket = await db.tickets.find_one({"qr_code_data": data.qr_code}, {"_id": 0})
    
    scan_log = {
        "id": str(uuid.uuid4()),
        "staff_id": staff["id"],
        "staff_name": staff["full_name"],
        "event_id": data.event_id,
        "qr_code": data.qr_code,
        "scanned_at": datetime.now(timezone.utc).isoformat()
    }
    
    if not ticket:
        scan_log.update({
            "ticket_id": None,
            "event_title": "",
            "client_name": "",
            "ticket_type": "",
            "status": "invalid",
            "message": "QR code invalide - Billet non trouve"
        })
        await db.scan_logs.insert_one(scan_log)
        return {
            "status": "invalid",
            "message": "QR code invalide",
            "details": "Ce billet n'existe pas dans le systeme",
            "vibration": "error"
        }
    
    if ticket.get("event_id") != data.event_id:
        scan_log.update({
            "ticket_id": ticket["id"],
            "event_title": ticket.get("event_title", ""),
            "client_name": ticket.get("passenger_name") or "",
            "ticket_type": ticket.get("ticket_type", ""),
            "status": "invalid",
            "message": "Billet pour un autre evenement"
        })
        await db.scan_logs.insert_one(scan_log)
        return {
            "status": "invalid",
            "message": "Mauvais evenement",
            "details": f"Ce billet est pour: {ticket.get('event_title', 'Autre evenement')}",
            "vibration": "error"
        }
    
    if ticket.get("status") == "used":
        first_scan_time = ticket.get("scanned_at", "Heure inconnue")
        first_scanner = ticket.get("scanned_by_name", "Agent inconnu")
        
        scan_log.update({
            "ticket_id": ticket["id"],
            "event_title": ticket.get("event_title", ""),
            "client_name": ticket.get("passenger_name") or ticket.get("user_name", ""),
            "ticket_type": ticket.get("ticket_type", ""),
            "status": "already_scanned",
            "message": f"Deja scanne a {first_scan_time} par {first_scanner}"
        })
        await db.scan_logs.insert_one(scan_log)
        return {
            "status": "already_scanned",
            "message": "ALERTE: Billet deja utilise!",
            "details": f"Scanne le {first_scan_time}",
            "scanned_by": first_scanner,
            "client_name": ticket.get("passenger_name") or ticket.get("user_name", "Client"),
            "ticket_type": ticket.get("ticket_type", "Standard"),
            "vibration": "warning"
        }
    
    await db.tickets.update_one(
        {"id": ticket["id"]},
        {"$set": {
            "status": "used",
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "scanned_by": staff["id"],
            "scanned_by_name": staff["full_name"]
        }}
    )
    
    client_name = ticket.get("passenger_name")
    if not client_name:
        user = await db.users.find_one({"id": ticket.get("user_id")}, {"full_name": 1})
        client_name = user.get("full_name", "Client") if user else "Client"
    
    scan_log.update({
        "ticket_id": ticket["id"],
        "event_title": ticket.get("event_title", ""),
        "client_name": client_name,
        "ticket_type": ticket.get("ticket_type", "Standard"),
        "status": "valid",
        "message": "Billet valide avec succes"
    })
    await db.scan_logs.insert_one(scan_log)
    
    return {
        "status": "valid",
        "message": "Billet Valide",
        "client_name": client_name,
        "ticket_type": ticket.get("ticket_type", "Standard"),
        "event_title": ticket.get("event_title", ""),
        "vibration": "success"
    }


# ============== ORGANIZER STAFF MANAGEMENT ==============

@router.get("/organizer/staff")
async def get_organizer_staff(organizer: dict = Depends(get_organizer_user)):
    """Get all staff accounts for organizer"""
    staff_list = await db.staff_accounts.find(
        {"organizer_id": organizer["id"]},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    return staff_list


@router.post("/organizer/staff")
async def create_staff_account(data: StaffCreate, organizer: dict = Depends(get_organizer_user)):
    """Create a new staff account for organizer"""
    existing = await db.staff_accounts.find_one({"username": data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Ce nom d'utilisateur est deja pris")
    
    for event_id in data.assigned_events:
        event = await db.events.find_one({"id": event_id, "organizer_id": organizer["id"]})
        if not event:
            raise HTTPException(status_code=400, detail=f"Evenement {event_id} non trouve ou non autorise")
    
    password = generate_staff_password()
    
    staff_id = str(uuid.uuid4())
    staff_doc = {
        "id": staff_id,
        "organizer_id": organizer["id"],
        "username": data.username,
        "password_hash": hash_password(password),
        "full_name": data.full_name,
        "assigned_events": data.assigned_events,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.staff_accounts.insert_one(staff_doc)
    
    return {
        "id": staff_id,
        "username": data.username,
        "password": password,
        "full_name": data.full_name,
        "assigned_events": data.assigned_events,
        "active": True,
        "message": "Compte cree! Notez bien le mot de passe, il ne sera plus affiche."
    }


@router.put("/organizer/staff/{staff_id}")
async def update_staff_account(staff_id: str, data: StaffUpdate, organizer: dict = Depends(get_organizer_user)):
    """Update staff account (assign events, activate/deactivate)"""
    staff = await db.staff_accounts.find_one({"id": staff_id, "organizer_id": organizer["id"]})
    if not staff:
        raise HTTPException(status_code=404, detail="Compte staff non trouve")
    
    update_data = {}
    
    if data.full_name is not None:
        update_data["full_name"] = data.full_name
    
    if data.assigned_events is not None:
        for event_id in data.assigned_events:
            event = await db.events.find_one({"id": event_id, "organizer_id": organizer["id"]})
            if not event:
                raise HTTPException(status_code=400, detail=f"Evenement {event_id} non autorise")
        update_data["assigned_events"] = data.assigned_events
    
    if data.active is not None:
        update_data["active"] = data.active
    
    if update_data:
        await db.staff_accounts.update_one({"id": staff_id}, {"$set": update_data})
    
    updated = await db.staff_accounts.find_one({"id": staff_id}, {"_id": 0, "password_hash": 0})
    return updated


@router.delete("/organizer/staff/{staff_id}")
async def delete_staff_account(staff_id: str, organizer: dict = Depends(get_organizer_user)):
    """Delete a staff account"""
    result = await db.staff_accounts.delete_one({"id": staff_id, "organizer_id": organizer["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Compte staff non trouve")
    return {"message": "Compte staff supprime"}


@router.post("/organizer/staff/{staff_id}/reset-password")
async def reset_staff_password(staff_id: str, organizer: dict = Depends(get_organizer_user)):
    """Reset staff password - generates new password"""
    staff = await db.staff_accounts.find_one({"id": staff_id, "organizer_id": organizer["id"]})
    if not staff:
        raise HTTPException(status_code=404, detail="Compte staff non trouve")
    
    new_password = generate_staff_password()
    await db.staff_accounts.update_one(
        {"id": staff_id},
        {"$set": {"password_hash": hash_password(new_password)}}
    )
    
    return {
        "message": "Mot de passe reinitialise",
        "new_password": new_password,
        "username": staff["username"]
    }


@router.get("/organizer/staff/scan-logs")
async def get_scan_logs(
    organizer: dict = Depends(get_organizer_user),
    event_id: Optional[str] = None,
    limit: int = 100
):
    """Get scan logs for organizer's events"""
    events = await db.events.find(
        {"organizer_id": organizer["id"]},
        {"id": 1}
    ).to_list(1000)
    event_ids = [e["id"] for e in events]
    
    query = {"event_id": {"$in": event_ids}}
    if event_id:
        query["event_id"] = event_id
    
    logs = await db.scan_logs.find(query, {"_id": 0}).sort("scanned_at", -1).to_list(limit)
    return logs
