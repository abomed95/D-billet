"""
Pydantic models for events and ticket types
"""
from pydantic import BaseModel
from typing import List, Optional


class TicketTypeCreate(BaseModel):
    name: str
    price: int
    quantity: int
    description: Optional[str] = None
    max_per_order: int = 10
    group_size: int = 1


class TicketType(BaseModel):
    id: str
    name: str
    price: int
    quantity: int
    sold: int = 0
    description: Optional[str] = None
    max_per_order: int = 10
    group_size: int = 1


class EventCreate(BaseModel):
    title: str
    description: str
    category: str
    venue: str
    date: str
    time: str
    image_url: Optional[str] = None
    ticket_types: List[TicketTypeCreate]


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    venue: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    image_url: Optional[str] = None


class EventResponse(BaseModel):
    id: str
    title: str
    description: str
    category: str
    venue: str
    date: str
    time: str
    image_url: Optional[str] = None
    ticket_types: List[TicketType] = []
    organizer_id: Optional[str] = None
    total_tickets: int = 0
    sold_tickets: int = 0
    created_at: str


class PromoCodeCreate(BaseModel):
    code: str
    discount_type: str  # percentage, fixed
    discount_value: int
    max_uses: int = 100
    event_id: Optional[str] = None
    valid_until: Optional[str] = None


class PromoCodeResponse(BaseModel):
    id: str
    code: str
    discount_type: str
    discount_value: int
    max_uses: int
    uses: int = 0
    event_id: Optional[str] = None
    valid_until: Optional[str] = None
    organizer_id: str
    created_at: str
    total_sales: int = 0
