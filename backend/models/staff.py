"""
Pydantic models for staff management
"""
from pydantic import BaseModel
from typing import List, Optional


class StaffCreate(BaseModel):
    username: str
    full_name: str
    assigned_events: List[str] = []


class StaffUpdate(BaseModel):
    full_name: Optional[str] = None
    assigned_events: Optional[List[str]] = None
    active: Optional[bool] = None


class StaffLogin(BaseModel):
    username: str
    password: str


class StaffResponse(BaseModel):
    id: str
    organizer_id: str
    username: str
    full_name: str
    assigned_events: List[str] = []
    active: bool = True
    created_at: str


class StaffTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    staff: StaffResponse


class ScanRequest(BaseModel):
    qr_code: str
    event_id: str


class ScanLogEntry(BaseModel):
    id: str
    staff_id: str
    staff_name: str
    ticket_id: str
    event_id: str
    event_title: str
    client_name: str
    ticket_type: str
    status: str
    scanned_at: str
    message: str


# Transport Staff Models
class TransportStaffCreate(BaseModel):
    username: str
    full_name: str
    role: str = "transport_agent"


class TransportStaffUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None


class TransportStaffResponse(BaseModel):
    id: str
    username: str
    full_name: str
    role: str
    active: bool = True
    created_at: str
