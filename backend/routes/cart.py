"""
Cart and Checkout routes
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
import uuid

from config import db
from models import CartItemAdd, CheckoutRequest
from services import get_current_user, waafi

router = APIRouter(tags=["Cart"])


@router.get("/cart")
async def get_cart(user: dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart:
        return {"items": [], "total": 0, "discount": 0, "final_total": 0}
    
    items_with_details = []
    total = 0
    
    for item in cart.get("items", []):
        event = await db.events.find_one({"id": item["event_id"]}, {"_id": 0})
        if event:
            ticket_type = next((tt for tt in event.get("ticket_types", []) if tt["id"] == item["ticket_type_id"]), None)
            if ticket_type:
                item_total = ticket_type["price"] * item["quantity"]
                items_with_details.append({
                    "event_id": item["event_id"],
                    "ticket_type_id": item["ticket_type_id"],
                    "quantity": item["quantity"],
                    "event": event,
                    "ticket_type": ticket_type,
                    "subtotal": item_total
                })
                total += item_total
    
    discount = 0
    promo_code = cart.get("promo_code")
    if promo_code:
        promo = await db.promo_codes.find_one({"code": promo_code}, {"_id": 0})
        if promo:
            if promo["discount_type"] == "percentage":
                discount = int(total * promo["discount_value"] / 100)
            else:
                discount = min(promo["discount_value"], total)
    
    return {
        "items": items_with_details, 
        "total": total, 
        "discount": discount,
        "promo_code": promo_code,
        "final_total": total - discount
    }


@router.post("/cart/add")
async def add_to_cart(cart_item: CartItemAdd, user: dict = Depends(get_current_user)):
    event = await db.events.find_one({"id": cart_item.event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Evenement non trouve")
    
    ticket_type = next((tt for tt in event.get("ticket_types", []) if tt["id"] == cart_item.ticket_type_id), None)
    if not ticket_type:
        raise HTTPException(status_code=404, detail="Type de billet non trouve")
    
    available = ticket_type["quantity"] - ticket_type.get("sold", 0)
    if available < cart_item.quantity:
        raise HTTPException(status_code=400, detail="Pas assez de billets disponibles")
    
    if cart_item.quantity > ticket_type.get("max_per_order", 10):
        raise HTTPException(status_code=400, detail=f"Maximum {ticket_type['max_per_order']} billets par commande")
    
    cart = await db.carts.find_one({"user_id": user["id"]})
    new_item = {
        "event_id": cart_item.event_id, 
        "ticket_type_id": cart_item.ticket_type_id,
        "quantity": cart_item.quantity
    }
    
    if not cart:
        cart_doc = {"user_id": user["id"], "items": [new_item]}
        if cart_item.promo_code:
            cart_doc["promo_code"] = cart_item.promo_code.upper()
        await db.carts.insert_one(cart_doc)
    else:
        existing_item = next(
            (i for i in cart["items"] if i["event_id"] == cart_item.event_id and i["ticket_type_id"] == cart_item.ticket_type_id), 
            None
        )
        if existing_item:
            existing_item["quantity"] = cart_item.quantity
            await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": cart["items"]}})
        else:
            await db.carts.update_one({"user_id": user["id"]}, {"$push": {"items": new_item}})
        
        if cart_item.promo_code:
            await db.carts.update_one({"user_id": user["id"]}, {"$set": {"promo_code": cart_item.promo_code.upper()}})
    
    return {"message": "Ajoute au panier"}


@router.post("/cart/promo")
async def apply_promo_code(promo_code: str = Query(...), user: dict = Depends(get_current_user)):
    """Apply promo code to cart"""
    promo = await db.promo_codes.find_one({"code": promo_code.upper()})
    if not promo:
        raise HTTPException(status_code=404, detail="Code promo invalide")
    
    if promo["uses"] >= promo["max_uses"]:
        raise HTTPException(status_code=400, detail="Code promo epuise")
    
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"promo_code": promo_code.upper()}})
    return {"message": "Code promo applique", "code": promo_code.upper()}


@router.delete("/cart/{event_id}/{ticket_type_id}")
async def remove_from_cart(event_id: str, ticket_type_id: str, user: dict = Depends(get_current_user)):
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$pull": {"items": {"event_id": event_id, "ticket_type_id": ticket_type_id}}}
    )
    return {"message": "Retire du panier"}


@router.delete("/cart")
async def clear_cart(user: dict = Depends(get_current_user)):
    await db.carts.delete_one({"user_id": user["id"]})
    return {"message": "Panier vide"}


@router.post("/checkout")
async def checkout(checkout_data: CheckoutRequest, user: dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Le panier est vide")
    
    tickets_created = []
    total = 0
    discount = 0
    promo_code = cart.get("promo_code") or checkout_data.promo_code
    
    for item in cart["items"]:
        event = await db.events.find_one({"id": item["event_id"]})
        if not event:
            continue
        ticket_type = next((tt for tt in event.get("ticket_types", []) if tt["id"] == item["ticket_type_id"]), None)
        if ticket_type:
            total += ticket_type["price"] * item["quantity"]
    
    applied_promo_code = None
    if promo_code:
        promo = await db.promo_codes.find_one({"code": promo_code.upper()})
        if promo and promo["uses"] < promo["max_uses"]:
            if promo["discount_type"] == "percentage":
                discount = int(total * promo["discount_value"] / 100)
            else:
                discount = min(promo["discount_value"], total)
            # Defer the usage increment until the payment has succeeded.
            applied_promo_code = promo_code.upper()

    final_total = total - discount

    # Verify availability before charging so we never take money we can't fulfil.
    for item in cart["items"]:
        event = await db.events.find_one({"id": item["event_id"]})
        if not event:
            continue
        ticket_type = next((tt for tt in event.get("ticket_types", []) if tt["id"] == item["ticket_type_id"]), None)
        if not ticket_type:
            continue
        available = ticket_type["quantity"] - ticket_type.get("sold", 0)
        if available < item["quantity"]:
            raise HTTPException(status_code=400, detail=f"Pas assez de billets pour {event['title']} ({ticket_type['name']})")

    # Process the WaafiPay mobile-wallet payment before issuing any ticket.
    payment_reference = None
    if checkout_data.payment_method == "waafi":
        if not waafi.is_configured():
            raise HTTPException(status_code=503, detail="Le paiement Waafi n'est pas configure")
        if not checkout_data.payment_account:
            raise HTTPException(status_code=400, detail="Numero de compte Waafi requis")
        if final_total <= 0:
            raise HTTPException(status_code=400, detail="Montant de paiement invalide")

        reference_id = str(uuid.uuid4())[:12]
        try:
            payment = await waafi.purchase(
                account_no=checkout_data.payment_account,
                amount=final_total,
                reference_id=reference_id,
                description=f"D-Billet - {len(cart['items'])} article(s)",
            )
        except waafi.WaafiError as exc:
            raise HTTPException(status_code=502, detail=f"Erreur de paiement Waafi: {exc}")

        if not payment.get("success"):
            raise HTTPException(
                status_code=402,
                detail=payment.get("message") or "Paiement Waafi refuse",
            )
        payment_reference = payment.get("transaction_id") or reference_id

    # Payment succeeded (or method is simulated): now consume the promo code.
    if applied_promo_code:
        await db.promo_codes.update_one(
            {"code": applied_promo_code},
            {"$inc": {"uses": 1, "total_sales": final_total}}
        )

    for item in cart["items"]:
        event = await db.events.find_one({"id": item["event_id"]})
        if not event:
            continue

        ticket_type = next((tt for tt in event.get("ticket_types", []) if tt["id"] == item["ticket_type_id"]), None)
        if not ticket_type:
            continue

        available = ticket_type["quantity"] - ticket_type.get("sold", 0)
        if available < item["quantity"]:
            raise HTTPException(status_code=400, detail=f"Pas assez de billets pour {event['title']} ({ticket_type['name']})")
        
        for _ in range(item["quantity"]):
            ticket_id = str(uuid.uuid4())
            qr_data = f"DBILLET-{ticket_id}"
            
            ticket_doc = {
                "id": ticket_id,
                "event_id": event["id"],
                "event_title": event["title"],
                "event_date": event["date"],
                "event_time": event["time"],
                "event_venue": event["venue"],
                "ticket_type": ticket_type["name"],
                "ticket_type_id": ticket_type["id"],
                "user_id": user["id"],
                "organizer_id": event.get("organizer_id"),
                "qr_code_data": qr_data,
                "status": "valid",
                "price": ticket_type["price"],
                "promo_code": promo_code,
                "payment_method": checkout_data.payment_method,
                "payment_reference": payment_reference,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.tickets.insert_one(ticket_doc)
            tickets_created.append(ticket_doc)
        
        ticket_types = event.get("ticket_types", [])
        for tt in ticket_types:
            if tt["id"] == item["ticket_type_id"]:
                tt["sold"] = tt.get("sold", 0) + item["quantity"]
                break
        await db.events.update_one({"id": event["id"]}, {"$set": {"ticket_types": ticket_types}})
    
    await db.carts.delete_one({"user_id": user["id"]})
    
    return {
        "message": "Paiement reussi",
        "tickets": [{"id": t["id"], "event_title": t["event_title"], "ticket_type": t["ticket_type"]} for t in tickets_created],
        "total": total,
        "discount": discount,
        "final_total": final_total,
        "payment_method": checkout_data.payment_method,
        "payment_reference": payment_reference
    }
