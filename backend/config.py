"""
Configuration module for D-Billet API
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Security
SECRET_KEY = os.environ.get('JWT_SECRET', 'dbillet-secret-key-2025-djibouti')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30
STAFF_TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OTP Storage (in-memory for simulation)
otp_storage = {}

# Upload directory
UPLOAD_DIR = Path("/app/frontend/public/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

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
