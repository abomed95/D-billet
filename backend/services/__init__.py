"""
Services package for D-Billet API
"""
from .auth import (
    verify_password, hash_password, create_access_token, create_staff_token,
    generate_otp, generate_staff_password,
    get_current_user, get_admin_user, get_organizer_user, get_current_staff, decode_token,
    security
)
from .pdf import generate_ticket_pdf
from .seed import seed_demo_data
from .seo import slugify, generate_unique_event_slug, ensure_event_slug, event_public_url
from .rate_limit import rate_limited
from .indexes import ensure_indexes

__all__ = [
    'verify_password', 'hash_password', 'create_access_token', 'create_staff_token',
    'generate_otp', 'generate_staff_password',
    'get_current_user', 'get_admin_user', 'get_organizer_user', 'get_current_staff', 'decode_token',
    'security', 'generate_ticket_pdf',
    'seed_demo_data',
    'slugify', 'generate_unique_event_slug', 'ensure_event_slug', 'event_public_url',
    'rate_limited',
    'ensure_indexes',
]
