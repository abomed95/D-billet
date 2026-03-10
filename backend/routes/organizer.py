"""
Organizer routes (Dashboard, Stats, Live Dashboard)
"""
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid
import base64
import os
from pathlib import Path

from config import db, UPLOAD_DIR
from services import get_organizer_user

router = APIRouter(prefix="/organizer", tags=["Organizer"])


@router.get("/stats")
async def get_organizer_stats(user: dict = Depends(get_organizer_user)):
    """Get real-time stats for organizer"""
    query = {} if user.get("role") == "admin" else {"organizer_id": user["id"]}
    
    events = await db.events.find(query, {"_id": 0}).to_list(100)
    
    total_revenue = 0
    total_tickets_sold = 0
    total_tickets_available = 0
    events_stats = []
    
    for event in events:
        event_revenue = 0
        event_sold = 0
        event_total = 0
        
        for tt in event.get("ticket_types", []):
            sold = tt.get("sold", 0)
            event_sold += sold
            event_total += tt["quantity"]
            event_revenue += sold * tt["price"]
        
        total_revenue += event_revenue
        total_tickets_sold += event_sold
        total_tickets_available += event_total
        
        events_stats.append({
            "id": event["id"],
            "title": event["title"],
            "date": event["date"],
            "sold": event_sold,
            "total": event_total,
            "revenue": event_revenue,
            "percentage": int(event_sold / event_total * 100) if event_total > 0 else 0
        })
    
    promo_query = {} if user.get("role") == "admin" else {"organizer_id": user["id"]}
    promo_codes = await db.promo_codes.find(promo_query, {"_id": 0}).to_list(100)
    
    promo_stats = []
    for promo in promo_codes:
        promo_stats.append({
            "code": promo["code"],
            "uses": promo["uses"],
            "max_uses": promo["max_uses"],
            "total_sales": promo.get("total_sales", 0)
        })
    
    commission = int(total_revenue * 0.08)
    
    return {
        "total_revenue": total_revenue,
        "commission": commission,
        "net_revenue": total_revenue - commission,
        "total_tickets_sold": total_tickets_sold,
        "total_tickets_available": total_tickets_available,
        "events_count": len(events),
        "events": events_stats,
        "promo_codes": promo_stats
    }


@router.get("/events")
async def get_organizer_events(user: dict = Depends(get_organizer_user)):
    """Get all events for organizer - each organizer sees ONLY their own events"""
    if user.get("role") == "admin":
        query = {}
    else:
        query = {"organizer_id": user["id"]}
    
    events = await db.events.find(query, {"_id": 0}).to_list(100)
    
    result = []
    for event in events:
        total = sum(tt["quantity"] for tt in event.get("ticket_types", []))
        sold = sum(tt.get("sold", 0) for tt in event.get("ticket_types", []))
        result.append({
            **event,
            "total_tickets": total,
            "sold_tickets": sold,
            "available_tickets": total - sold
        })
    
    return result


@router.get("/events/{event_id}/entry-stats")
async def get_event_entry_stats(event_id: str, organizer: dict = Depends(get_organizer_user)):
    """Get real-time entry statistics for an event"""
    event = await db.events.find_one({"id": event_id, "organizer_id": organizer["id"]})
    if not event:
        raise HTTPException(status_code=404, detail="Evenement non trouve")
    
    total_tickets = await db.tickets.count_documents({"event_id": event_id})
    used_tickets = await db.tickets.count_documents({"event_id": event_id, "status": "used"})
    valid_tickets = await db.tickets.count_documents({"event_id": event_id, "status": "valid"})
    
    recent_scans = await db.scan_logs.find(
        {"event_id": event_id, "status": "valid"},
        {"_id": 0}
    ).sort("scanned_at", -1).to_list(10)
    
    return {
        "event_id": event_id,
        "event_title": event["title"],
        "total_tickets": total_tickets,
        "entries": used_tickets,
        "remaining": valid_tickets,
        "entry_rate": round((used_tickets / total_tickets * 100) if total_tickets > 0 else 0, 1),
        "recent_entries": recent_scans
    }


@router.get("/events/{event_id}/live-dashboard")
async def get_live_event_dashboard(event_id: str, organizer: dict = Depends(get_organizer_user)):
    """Get comprehensive real-time dashboard data for an event"""
    event = await db.events.find_one({"id": event_id, "organizer_id": organizer["id"]})
    if not event:
        raise HTTPException(status_code=404, detail="Evenement non trouve")
    
    total_tickets = await db.tickets.count_documents({"event_id": event_id})
    used_tickets = await db.tickets.count_documents({"event_id": event_id, "status": "used"})
    valid_tickets = await db.tickets.count_documents({"event_id": event_id, "status": "valid"})
    
    ticket_types = await db.tickets.aggregate([
        {"$match": {"event_id": event_id}},
        {"$group": {
            "_id": "$ticket_type",
            "total": {"$sum": 1},
            "scanned": {"$sum": {"$cond": [{"$eq": ["$status", "used"]}, 1, 0]}}
        }}
    ]).to_list(100)
    
    type_breakdown = [
        {
            "type": t["_id"] or "Standard",
            "total": t["total"],
            "scanned": t["scanned"],
            "remaining": t["total"] - t["scanned"]
        }
        for t in ticket_types
    ]
    
    now = datetime.now(timezone.utc)
    hourly_data = []
    for i in range(12):
        hour_start = now - timedelta(hours=11-i)
        hour_end = hour_start + timedelta(hours=1)
        
        count = await db.scan_logs.count_documents({
            "event_id": event_id,
            "status": "valid",
            "scanned_at": {
                "$gte": hour_start.isoformat(),
                "$lt": hour_end.isoformat()
            }
        })
        
        hourly_data.append({
            "hour": hour_start.strftime("%H:00"),
            "entries": count
        })
    
    recent_entries = await db.scan_logs.find(
        {"event_id": event_id, "status": "valid"},
        {"_id": 0, "staff_name": 1, "client_name": 1, "ticket_type": 1, "scanned_at": 1}
    ).sort("scanned_at", -1).to_list(20)
    
    duplicate_alerts = await db.scan_logs.find(
        {"event_id": event_id, "status": "already_scanned"},
        {"_id": 0}
    ).sort("scanned_at", -1).to_list(10)
    
    staff_stats = await db.scan_logs.aggregate([
        {"$match": {"event_id": event_id, "status": "valid"}},
        {"$group": {
            "_id": {"staff_id": "$staff_id", "staff_name": "$staff_name"},
            "scan_count": {"$sum": 1}
        }},
        {"$sort": {"scan_count": -1}}
    ]).to_list(20)
    
    staff_performance = [
        {"staff_name": s["_id"]["staff_name"], "scans": s["scan_count"]}
        for s in staff_stats
    ]
    
    entries_last_10min = await db.scan_logs.count_documents({
        "event_id": event_id,
        "status": "valid",
        "scanned_at": {"$gte": (now - timedelta(minutes=10)).isoformat()}
    })
    entry_rate_per_min = round(entries_last_10min / 10, 1)
    
    return {
        "event": {
            "id": event_id,
            "title": event["title"],
            "date": event.get("date"),
            "time": event.get("time"),
            "venue": event.get("venue")
        },
        "stats": {
            "total_tickets": total_tickets,
            "entries": used_tickets,
            "remaining": valid_tickets,
            "entry_rate_percent": round((used_tickets / total_tickets * 100) if total_tickets > 0 else 0, 1),
            "entry_rate_per_min": entry_rate_per_min
        },
        "type_breakdown": type_breakdown,
        "hourly_entries": hourly_data,
        "recent_entries": recent_entries,
        "duplicate_alerts": duplicate_alerts,
        "alert_count": len(duplicate_alerts),
        "staff_performance": staff_performance,
        "last_updated": now.isoformat()
    }


@router.get("/events/{event_id}/guestlist")
async def get_event_guestlist(event_id: str, organizer: dict = Depends(get_organizer_user)):
    """Get guestlist for event with export data"""
    event = await db.events.find_one({"id": event_id, "organizer_id": organizer["id"]})
    if not event:
        raise HTTPException(status_code=404, detail="Evenement non trouve")
    
    tickets = await db.tickets.find(
        {"event_id": event_id},
        {"_id": 0}
    ).to_list(10000)
    
    guests = []
    for ticket in tickets:
        user = await db.users.find_one({"id": ticket.get("user_id")}, {"_id": 0, "full_name": 1, "phone": 1, "email": 1})
        guests.append({
            "ticket_id": ticket["id"],
            "ticket_type": ticket.get("ticket_type", "Standard"),
            "name": ticket.get("passenger_name") or (user.get("full_name") if user else "Inconnu"),
            "phone": ticket.get("passenger_phone") or (user.get("phone") if user else ""),
            "email": user.get("email") if user else "",
            "status": ticket["status"],
            "price": ticket["price"],
            "purchased_at": ticket["created_at"],
            "scanned_at": ticket.get("scanned_at"),
            "scanned_by": ticket.get("scanned_by_name")
        })
    
    return {
        "event_id": event_id,
        "event_title": event["title"],
        "total_guests": len(guests),
        "guests": guests
    }


# ============== IMAGE UPLOAD ==============

@router.post("/events/upload-image")
async def upload_event_image(file: UploadFile = File(...), organizer: dict = Depends(get_organizer_user)):
    """Upload an image for an event"""
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Le fichier doit etre une image")
    
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="L'image ne doit pas depasser 5MB")
    
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{uuid.uuid4()}.{ext}"
    
    file_path = UPLOAD_DIR / filename
    with open(file_path, 'wb') as f:
        f.write(content)
    
    image_url = f"/uploads/{filename}"
    
    return {
        "message": "Image uploadee avec succes",
        "image_url": image_url,
        "filename": filename
    }
