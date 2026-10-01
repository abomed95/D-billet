"""
Staff routes (Event Staff Management & Scanning)
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import logging
import uuid

from config import db
from models import (
    BatchScanRequest,
    StaffCreate, StaffUpdate, StaffLogin, StaffResponse, StaffTokenResponse,
    ScanRequest
)
from services import (
    parse_qr_payload,
    ticket_public_key,
    verify_password, hash_password, create_staff_token,
    generate_staff_password, get_current_staff, get_organizer_user
)

logger = logging.getLogger(__name__)

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


# ============== OFFLINE CONTROL ==============
# Tickets are checked on the train and the ferry, where there is no network, so
# the controller device has to decide on its own. These two endpoints bracket
# that: one hands the device everything it needs before departure, the other
# takes back what it recorded once a connection returns.


@router.get("/staff/manifest/{event_id}")
async def staff_manifest(
    event_id: str,
    date: str | None = None,
    staff: dict = Depends(get_current_staff),
):
    """
    Everything a controller device needs to check tickets offline.

    Call it while still connected. The device stores the result and can then
    verify, with no network: the QR signature (against `public_key`), that the
    ticket belongs to this event or trip, and whether it was already used
    before the device went offline.

    `date` narrows a ferry or train manifest to one departure; event tickets do
    not need it.

    Holder names are only included where the ticket itself carries one, which is
    the transport case where the name is checked against an ID. Event tickets
    keep the buyer's name on the server: a manifest sits on a phone, so it
    should hold no more than the check actually requires.
    """
    if event_id not in staff.get("assigned_events", []):
        raise HTTPException(status_code=403, detail="Vous n'etes pas assigne a cet evenement")

    query: dict = {
        "event_id": event_id,
        # `used` is included so a device knows what was already scanned before
        # it lost the network, instead of waving through a second entry.
        "status": {"$in": ["valid", "used"]},
    }
    if date:
        query["event_date"] = date

    tickets = await db.tickets.find(
        query,
        {
            "_id": 0,
            "id": 1,
            "ticket_type": 1,
            "status": 1,
            "passenger_name": 1,
            "event_title": 1,
            "event_date": 1,
        },
    ).to_list(50000)

    entries = [
        {
            "ticket_id": ticket["id"],
            "ticket_type": ticket.get("ticket_type", "Standard"),
            "status": ticket.get("status", "valid"),
            **({"holder": ticket["passenger_name"]} if ticket.get("passenger_name") else {}),
        }
        for ticket in tickets
    ]

    first = tickets[0] if tickets else {}
    return {
        "event_id": event_id,
        "event_title": first.get("event_title", ""),
        "date": date or first.get("event_date", ""),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        # Lets the device verify signatures without a second round trip.
        "public_key": ticket_public_key(),
        "count": len(entries),
        "tickets": entries,
    }


@router.post("/staff/scans/batch")
async def staff_scans_batch(
    data: BatchScanRequest,
    staff: dict = Depends(get_current_staff),
):
    """
    Take back the scans a device recorded offline.

    Idempotent on `scan_id`: re-sending a queue that was already accepted
    records nothing twice, so a device may safely retry after a dropped
    connection.

    Per scan, `status` is one of:
      recorded   - the ticket was valid and is now marked used
      duplicate  - this exact scan was already synced, nothing changed
      conflict   - the ticket had already been used, by another device or agent
      wrong_event, invalid, not_found, forbidden
    """
    results = []
    now = datetime.now(timezone.utc).isoformat()

    for scan in data.scans:
        def outcome(status: str, message: str, **extra):
            return {"scan_id": scan.scan_id, "ticket_id": scan.ticket_id,
                    "status": status, "message": message, **extra}

        if scan.event_id not in staff.get("assigned_events", []):
            results.append(outcome("forbidden", "Non assigne a cet evenement"))
            continue

        # Already synced? Report what it did the first time and move on.
        existing = await db.scan_logs.find_one({"scan_id": scan.scan_id}, {"_id": 0})
        if existing:
            results.append(outcome(
                "duplicate",
                "Scan deja synchronise",
                first_status=existing.get("status"),
            ))
            continue

        ticket = await db.tickets.find_one({"id": scan.ticket_id}, {"_id": 0})
        if not ticket:
            results.append(outcome("not_found", "Billet inconnu"))
            await _record_offline_scan(scan, staff, ticket, "not_found", now)
            continue

        if ticket.get("event_id") != scan.event_id:
            results.append(outcome("wrong_event", "Billet pour un autre evenement"))
            await _record_offline_scan(scan, staff, ticket, "wrong_event", now)
            continue

        if ticket.get("status") not in ("valid", "used"):
            message = (
                "Billet non paye" if ticket.get("status") == "pending"
                else "Billet annule" if ticket.get("status") == "cancelled"
                else "Billet invalide"
            )
            results.append(outcome("invalid", message))
            await _record_offline_scan(scan, staff, ticket, "invalid", now)
            continue

        # Claim the ticket only while it is still valid. Two devices syncing the
        # same ticket at the same time must not both come back "recorded": the
        # loser of this conditional update is reported as a conflict.
        claimed = await db.tickets.update_one(
            {"id": scan.ticket_id, "status": "valid"},
            {"$set": {
                "status": "used",
                "scanned_at": scan.scanned_at,
                "scanned_by": staff["id"],
                "scanned_by_name": staff["full_name"],
                "scanned_by_device": scan.device_id,
                "synced_at": now,
            }},
        )

        if claimed.matched_count == 1:
            results.append(outcome("recorded", "Scan enregistre"))
            await _record_offline_scan(scan, staff, ticket, "valid", now)
            continue

        # Someone got there first.
        current = await db.tickets.find_one({"id": scan.ticket_id}, {"_id": 0}) or {}
        other_device = current.get("scanned_by_device")
        same_device = other_device == scan.device_id
        results.append(outcome(
            "duplicate" if same_device else "conflict",
            "Scan deja enregistre par cet appareil" if same_device
            else "ALERTE: billet deja scanne sur un autre appareil",
            first_scanned_at=current.get("scanned_at"),
            first_scanned_by=current.get("scanned_by_name"),
            first_device=other_device,
        ))
        await _record_offline_scan(
            scan, staff, current,
            "already_scanned" if not same_device else "duplicate",
            now,
        )

    counts: dict = {}
    for result in results:
        counts[result["status"]] = counts.get(result["status"], 0) + 1

    return {"synced": len(results), "counts": counts, "results": results}


async def _record_offline_scan(scan, staff: dict, ticket: dict | None, status: str, now: str):
    """Write the scan log for one synced offline scan, keyed by scan_id."""
    try:
        await db.scan_logs.insert_one({
            "id": str(uuid.uuid4()),
            "scan_id": scan.scan_id,
            "staff_id": staff["id"],
            "staff_name": staff["full_name"],
            "event_id": scan.event_id,
            "ticket_id": scan.ticket_id,
            "device_id": scan.device_id,
            "offline": True,
            "qr_code": "",
            "event_title": (ticket or {}).get("event_title", ""),
            "client_name": (ticket or {}).get("passenger_name") or "",
            "ticket_type": (ticket or {}).get("ticket_type", ""),
            "status": status,
            "message": "Synchronise depuis un appareil hors ligne",
            "scanned_at": scan.scanned_at,
            "synced_at": now,
        })
    except Exception as exc:  # noqa: BLE001
        # The unique index on scan_id rejects a replay that slipped past the
        # lookup above; that is the idempotency guarantee doing its job.
        logger.info("Offline scan %s already recorded: %s", scan.scan_id, exc)


@router.post("/staff/scan")
async def staff_scan_ticket(data: ScanRequest, staff: dict = Depends(get_current_staff)):
    """Scan a ticket QR code - returns validation result"""
    if data.event_id not in staff.get("assigned_events", []):
        raise HTTPException(status_code=403, detail="Vous n'etes pas assigne a cet evenement")
    
    claims = parse_qr_payload(data.qr_code)
    if claims["signed"] and not claims["valid_signature"]:
        # Forged QR: never look it up, and never mark anything as used.
        raise HTTPException(status_code=400, detail="Billet non authentique")

    # Match on the ticket id carried by the QR; fall back to the stored payload
    # so tickets issued before signing keep scanning.
    ticket = None
    if claims["ticket_id"]:
        ticket = await db.tickets.find_one({"id": claims["ticket_id"]}, {"_id": 0})
    if not ticket:
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
    
    if ticket.get("status") != "valid":
        message = (
            "Billet non paye" if ticket.get("status") == "pending"
            else "Billet annule" if ticket.get("status") == "cancelled"
            else "Billet invalide"
        )
        scan_log.update({
            "ticket_id": ticket["id"],
            "event_title": ticket.get("event_title", ""),
            "client_name": ticket.get("passenger_name") or ticket.get("user_name", ""),
            "ticket_type": ticket.get("ticket_type", ""),
            "status": "invalid",
            "message": message,
        })
        await db.scan_logs.insert_one(scan_log)
        return {
            "status": "invalid",
            "message": message,
            "details": "Ce billet n'est pas valide pour l'entree",
            "vibration": "error"
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
