"""
Pydantic models for transport (Train & Ferry)
"""
from pydantic import BaseModel
from typing import List, Optional


class TrainPassenger(BaseModel):
    full_name: str
    phone: str
    passport_or_cni: str


class TrainBookingRequest(BaseModel):
    date: str
    departure: str
    arrival: str
    passengers: List[TrainPassenger]
    payment_method: str
    promo_code: Optional[str] = None


class FerryPassenger(BaseModel):
    full_name: str
    phone: str
    passport_or_cni: str


class FerryBookingRequest(BaseModel):
    date: str
    departure: str
    arrival: str
    trip_type: str
    passengers: List[FerryPassenger]
    payment_method: str
    promo_code: Optional[str] = None


class FerryDaySchedule(BaseModel):
    day: str
    day_label: str
    active: bool = False
    destination: Optional[str] = None
    departure_time: Optional[str] = None
    return_time: Optional[str] = None
