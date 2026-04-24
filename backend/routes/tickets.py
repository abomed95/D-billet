"""
Tickets routes
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
import uuid
import qrcode
import base64
from io import BytesIO

from config import APP_URL, db
from services import get_current_user, generate_ticket_pdf

router = APIRouter(tags=["Tickets"])


@router.get("/tickets")
async def get_my_tickets(user: dict = Depends(get_current_user)):
    tickets = await db.tickets.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return tickets


@router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Billet non trouve")
    if ticket["user_id"] != user["id"] and ticket.get("organizer_id") != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acces refuse")
    return ticket


@router.get("/tickets/{ticket_id}/view")
async def get_ticket_view(ticket_id: str):
    """Public ticket view with QR code"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Billet non trouve")
    
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(ticket["qr_code_data"])
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="white", back_color="#0A0A0F")
    
    buffer = BytesIO()
    qr_img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    share_url = f"{APP_URL}/ticket/{ticket_id}"
    whatsapp_text = f"Mon billet D-Billet - {ticket['event_title']} - {ticket['event_date']} a {ticket['event_time']} - {ticket['event_venue']} - {share_url}"
    encoded_text = whatsapp_text.replace(' ', '%20')
    whatsapp_url = f"https://wa.me/?text={encoded_text}"
    
    return {
        **ticket,
        "qr_code_image": f"data:image/png;base64,{qr_base64}",
        "share_url": share_url,
        "whatsapp_url": whatsapp_url
    }


@router.get("/tickets/{ticket_id}/pdf")
async def download_ticket_pdf(ticket_id: str, user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Billet non trouve")
    if ticket["user_id"] != user["id"] and user.get("role") not in ["admin", "organizer"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    
    pdf_buffer = generate_ticket_pdf(ticket)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=billet-{ticket_id[:8]}.pdf"}
    )


# ============== SCANNER ROUTES ==============

@router.post("/scanner/validate")
async def scanner_validate_ticket(qr_data: str = Query(...)):
    """Public scanner endpoint for security personnel"""
    ticket_id = qr_data
    if qr_data.startswith("DBILLET-") or qr_data.startswith("TRAIN-") or qr_data.startswith("FERRY-"):
        ticket_id = qr_data.split("-", 1)[1]
    
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        return {
            "valid": False,
            "status": "not_found",
            "message": "Billet non trouve",
            "color": "red"
        }
    
    if ticket["status"] == "used":
        return {
            "valid": False,
            "status": "already_used",
            "message": "Billet deja utilise",
            "ticket": {
                "id": ticket["id"],
                "event_title": ticket["event_title"],
                "ticket_type": ticket.get("ticket_type", "Standard"),
                "used_at": ticket.get("used_at")
            },
            "color": "red"
        }
    
    await db.tickets.update_one(
        {"id": ticket_id}, 
        {"$set": {"status": "used", "used_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "valid": True,
        "status": "validated",
        "message": "Billet valide avec succes!",
        "ticket": {
            "id": ticket["id"],
            "event_title": ticket["event_title"],
            "event_date": ticket["event_date"],
            "event_time": ticket["event_time"],
            "ticket_type": ticket.get("ticket_type", "Standard"),
            "passenger_name": ticket.get("passenger_name"),
            "price": ticket["price"]
        },
        "color": "green"
    }


@router.get("/scanner/check/{qr_data}")
async def scanner_check_ticket(qr_data: str):
    """Check ticket without marking as used"""
    ticket_id = qr_data
    if qr_data.startswith("DBILLET-") or qr_data.startswith("TRAIN-") or qr_data.startswith("FERRY-"):
        ticket_id = qr_data.split("-", 1)[1]
    
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        return {"valid": False, "message": "Billet non trouve"}
    
    return {
        "valid": ticket["status"] == "valid",
        "status": ticket["status"],
        "ticket": {
            "id": ticket["id"],
            "event_title": ticket["event_title"],
            "event_date": ticket["event_date"],
            "ticket_type": ticket.get("ticket_type", "Standard"),
            "passenger_name": ticket.get("passenger_name")
        }
    }
