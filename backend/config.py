"""
Configuration module for D-Billet API
"""
import logging
import os
from pathlib import Path
from dotenv import load_dotenv

try:
    from motor.motor_asyncio import AsyncIOMotorClient
except ImportError:
    AsyncIOMotorClient = None

try:
    from passlib.context import CryptContext
except ImportError:
    CryptContext = None

from localdb import LocalAsyncDatabase

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
logger = logging.getLogger(__name__)


def _env_flag(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _csv_env(name: str, default: list[str]) -> list[str]:
    value = os.environ.get(name)
    if value is None:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://127.0.0.1:27017')
DB_NAME = os.environ.get('DB_NAME', 'dbillet_local')
MONGO_SERVER_SELECTION_TIMEOUT_MS = int(
    os.environ.get('MONGO_SERVER_SELECTION_TIMEOUT_MS', '3000')
)
APP_URL = os.environ.get('APP_URL', 'https://d-billet.com').rstrip('/')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://127.0.0.1:3000').rstrip('/')
APP_ENV = os.environ.get('APP_ENV', 'development').strip().lower()
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '').strip()
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '').strip()
BACKEND_CORS_ORIGINS = list(
    dict.fromkeys(
        _csv_env(
            "BACKEND_CORS_ORIGINS",
            [
                FRONTEND_URL,
                APP_URL,
                "http://127.0.0.1:3000",
                "http://localhost:3000",
            ],
        )
    )
)

client = AsyncIOMotorClient(
    MONGO_URL,
    serverSelectionTimeoutMS=MONGO_SERVER_SELECTION_TIMEOUT_MS,
) if AsyncIOMotorClient else None
db = client[DB_NAME] if client else LocalAsyncDatabase(ROOT_DIR / ".localdb.json")
DB_BACKEND = "mongo" if client else "local-json"

logger.info(
    "Database configuration loaded for backend '%s', database '%s' on '%s'",
    DB_BACKEND,
    DB_NAME,
    MONGO_URL,
)

# Security
_DEFAULT_DEV_SECRET = 'dbillet-secret-key-2025-djibouti'
SECRET_KEY = os.environ.get('JWT_SECRET', _DEFAULT_DEV_SECRET)
IS_PRODUCTION = APP_ENV in {"production", "prod"}

if IS_PRODUCTION:
    if not SECRET_KEY or SECRET_KEY == _DEFAULT_DEV_SECRET:
        raise RuntimeError(
            "JWT_SECRET must be defined with a strong random value in production. "
            "Generate one with: openssl rand -hex 64"
        )
    if len(SECRET_KEY) < 32:
        raise RuntimeError(
            "JWT_SECRET is too short for production (minimum 32 characters)."
        )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30
STAFF_TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto") if CryptContext else None

# OTP Storage (in-memory for simulation)
otp_storage = {}

# Upload directory
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", str(ROOT_DIR / "uploads"))).resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ============== WaafiPay payment gateway ==============
# Production endpoint: https://api.waafipay.net/asm
# Sandbox endpoint:    https://sandbox.waafipay.com/asm
WAAFIPAY_BASE_URL = os.environ.get(
    'WAAFIPAY_BASE_URL', 'https://api.waafipay.net/asm'
).strip().rstrip('/')
WAAFIPAY_MERCHANT_UID = os.environ.get('WAAFIPAY_MERCHANT_UID', '').strip()
WAAFIPAY_STORE_ID = os.environ.get('WAAFIPAY_STORE_ID', '').strip()
WAAFIPAY_HPP_KEY = os.environ.get('WAAFIPAY_HPP_KEY', '').strip()
WAAFIPAY_API_USER_ID = os.environ.get('WAAFIPAY_API_USER_ID', '').strip()
WAAFIPAY_API_KEY = os.environ.get('WAAFIPAY_API_KEY', '').strip()
WAAFIPAY_CURRENCY = os.environ.get('WAAFIPAY_CURRENCY', 'DJF').strip() or 'DJF'
try:
    WAAFIPAY_TIMEOUT = int(os.environ.get('WAAFIPAY_TIMEOUT', '30'))
except ValueError:
    WAAFIPAY_TIMEOUT = 30
# The frontend method id that routes through WaafiPay
WAAFIPAY_PAYMENT_METHOD_ID = os.environ.get('WAAFIPAY_PAYMENT_METHOD_ID', 'waafi').strip()

# Transport constants
FERRY_PRICE = 700
TRAIN_PRICE = 500

# Day name to weekday number mapping
DAY_TO_WEEKDAY = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6
}

# Default ferry schedule (used as fallback)
DEFAULT_FERRY_SCHEDULE = {
    4: {"route": "Djibouti-Obock", "destinations": ["Djibouti", "Obock"]},  # Thursday
    6: {"route": "Djibouti-Obock", "destinations": ["Djibouti", "Obock"]},  # Saturday
}

# Demo/bootstrap data
# In production, both flags are always disabled regardless of the env value
AUTO_SEED_DEMO_DATA = (
    False if IS_PRODUCTION
    else _env_flag(
        "AUTO_SEED_DEMO_DATA",
        APP_ENV in {"development", "dev", "local", "test"}
    )
)
ALLOW_PUBLIC_SEED_ROUTE = (
    False if IS_PRODUCTION
    else _env_flag(
        "ALLOW_PUBLIC_SEED_ROUTE",
        APP_ENV in {"development", "dev", "local", "test"}
    )
)

if IS_PRODUCTION and os.environ.get("ALLOW_PUBLIC_SEED_ROUTE", "").strip().lower() in {"1", "true", "yes", "on"}:
    logger.warning(
        "ALLOW_PUBLIC_SEED_ROUTE was requested in production - ignored for safety."
    )
