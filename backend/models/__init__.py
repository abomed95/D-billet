"""
Models package for D-Billet API
"""
from .auth import (
    UserRegister, UserLogin, PhoneOTPRequest, PhoneOTPVerify,
    UserResponse, TokenResponse, OrganizerCreate, OrganizerResponse
)
from .events import (
    TicketTypeCreate, TicketType, EventCreate, EventUpdate, EventResponse,
    PromoCodeCreate, PromoCodeResponse
)
from .tickets import CartItemAdd, CheckoutRequest, TicketResponse
from .transport import (
    TrainPassenger, TrainBookingRequest, FerryPassenger, 
    FerryBookingRequest, FerryDaySchedule
)
from .staff import (
    StaffCreate, StaffUpdate, StaffLogin, StaffResponse, StaffTokenResponse,
    ScanRequest, ScanLogEntry, TransportStaffCreate, TransportStaffUpdate, 
    TransportStaffResponse
)
from .admin import TestimonialCreate, NewsCreate

__all__ = [
    # Auth
    'UserRegister', 'UserLogin', 'PhoneOTPRequest', 'PhoneOTPVerify',
    'UserResponse', 'TokenResponse', 'OrganizerCreate', 'OrganizerResponse',
    # Events
    'TicketTypeCreate', 'TicketType', 'EventCreate', 'EventUpdate', 'EventResponse',
    'PromoCodeCreate', 'PromoCodeResponse',
    # Tickets
    'CartItemAdd', 'CheckoutRequest', 'TicketResponse',
    # Transport
    'TrainPassenger', 'TrainBookingRequest', 'FerryPassenger', 
    'FerryBookingRequest', 'FerryDaySchedule',
    # Staff
    'StaffCreate', 'StaffUpdate', 'StaffLogin', 'StaffResponse', 'StaffTokenResponse',
    'ScanRequest', 'ScanLogEntry', 'TransportStaffCreate', 'TransportStaffUpdate', 
    'TransportStaffResponse',
    # Admin
    'TestimonialCreate', 'NewsCreate',
]
