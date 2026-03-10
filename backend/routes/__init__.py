"""
Routes package for D-Billet API
"""
from .auth import router as auth_router
from .events import router as events_router
from .cart import router as cart_router
from .tickets import router as tickets_router
from .transport import router as transport_router
from .staff import router as staff_router
from .organizer import router as organizer_router
from .admin import router as admin_router

__all__ = [
    'auth_router',
    'events_router', 
    'cart_router',
    'tickets_router',
    'transport_router',
    'staff_router',
    'organizer_router',
    'admin_router'
]
