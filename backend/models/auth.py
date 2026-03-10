"""
Pydantic models for authentication
"""
from pydantic import BaseModel
from typing import Optional


class UserRegister(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    full_name: str


class UserLogin(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None


class PhoneOTPRequest(BaseModel):
    phone: str


class PhoneOTPVerify(BaseModel):
    phone: str
    otp: str


class UserResponse(BaseModel):
    id: str
    email: Optional[str] = None
    phone: Optional[str] = None
    full_name: str
    role: str = "user"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class OrganizerCreate(BaseModel):
    email: str
    phone: str
    password: str
    full_name: str
    company_name: str


class OrganizerResponse(BaseModel):
    id: str
    email: str
    phone: str
    full_name: str
    company_name: str
    role: str = "organizer"
    created_at: str
