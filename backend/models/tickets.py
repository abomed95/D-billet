"""
Pydantic models for tickets and cart
"""
from pydantic import BaseModel
from typing import Optional


class CartItemAdd(BaseModel):
    event_id: str
    ticket_type_id: str
    quantity: int
    promo_code: Optional[str] = None


class CheckoutRequest(BaseModel):
    payment_method: str
    promo_code: Optional[str] = None
    payer_phone: Optional[str] = None  # Waafi wallet number for direct debit


class TicketResponse(BaseModel):
    id: str
    event_id: str
    event_title: str
    event_date: str
    event_time: str
    event_venue: str
    ticket_type: str
    qr_code_data: str
    status: str
    price: int
    created_at: str
