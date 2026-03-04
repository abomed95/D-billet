from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.responses import StreamingResponse
import os
import logging
import random
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import qrcode
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = os.environ.get('JWT_SECRET', 'dbillet-secret-key-2025-djibouti')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# OTP Storage (in-memory for simulation)
otp_storage = {}

app = FastAPI(title="D-Billet API - Billetterie Djibouti")
api_router = APIRouter(prefix="/api")

# ============== MODELS ==============

# Auth Models
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
    role: str = "user"  # user, organizer, admin

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Organizer Models
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

# Ticket Type Models
class TicketTypeCreate(BaseModel):
    name: str  # Standard, VIP, Early Bird, Groupe
    price: int
    quantity: int
    description: Optional[str] = None
    max_per_order: int = 10
    group_size: int = 1  # For group tickets

class TicketType(BaseModel):
    id: str
    name: str
    price: int
    quantity: int
    sold: int = 0
    description: Optional[str] = None
    max_per_order: int = 10
    group_size: int = 1

# Event Models (Updated)
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

# Promo Code Models
class PromoCodeCreate(BaseModel):
    code: str
    discount_type: str  # percentage, fixed
    discount_value: int  # percentage (0-100) or fixed amount
    max_uses: int = 100
    event_id: Optional[str] = None  # None = all events
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

# Cart & Checkout Models
class CartItemAdd(BaseModel):
    event_id: str
    ticket_type_id: str
    quantity: int
    promo_code: Optional[str] = None

class CheckoutRequest(BaseModel):
    payment_method: str
    promo_code: Optional[str] = None

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

# Train Models
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

# Ferry Models
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

# Testimonial & News Models
class TestimonialCreate(BaseModel):
    author_name: str
    author_role: str
    content: str
    rating: int = 5
    avatar_url: Optional[str] = None

class NewsCreate(BaseModel):
    title: str
    excerpt: str
    content: str
    image_url: Optional[str] = None

# ============== STAFF MODELS ==============

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
    status: str  # valid, invalid, already_scanned
    scanned_at: str
    message: str

# Staff token expiration (24 hours for security)
STAFF_TOKEN_EXPIRE_HOURS = 24

# ============== AUTH HELPERS ==============

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def hash_password(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def generate_otp():
    return str(random.randint(100000, 999999))

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token invalide")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide")

async def get_admin_user(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès administrateur requis")
    return user

async def get_organizer_user(user: dict = Depends(get_current_user)):
    if user.get("role") not in ["organizer", "admin"]:
        raise HTTPException(status_code=403, detail="Accès organisateur requis")
    return user

def create_staff_token(data: dict):
    """Create JWT token for staff with 24h expiration"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=STAFF_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire, "type": "staff"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_staff(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Authenticate staff member from JWT token"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        staff_id = payload.get("sub")
        token_type = payload.get("type")
        
        if staff_id is None or token_type != "staff":
            raise HTTPException(status_code=401, detail="Token staff invalide")
        
        staff = await db.staff_accounts.find_one({"id": staff_id}, {"_id": 0})
        if staff is None:
            raise HTTPException(status_code=401, detail="Compte staff non trouvé")
        
        if not staff.get("active", True):
            raise HTTPException(status_code=403, detail="Compte staff désactivé")
        
        return staff
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    # Check for existing user
    query = {}
    if user_data.email:
        query["email"] = user_data.email
    elif user_data.phone:
        query["phone"] = user_data.phone
    else:
        raise HTTPException(status_code=400, detail="Email ou téléphone requis")
    
    existing = await db.users.find_one(query)
    if existing:
        raise HTTPException(status_code=400, detail="Cet identifiant est déjà utilisé")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "phone": user_data.phone,
        "full_name": user_data.full_name,
        "hashed_password": hash_password(user_data.password) if user_data.password else None,
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_access_token({"sub": user_id})
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id, 
            email=user_data.email, 
            phone=user_data.phone,
            full_name=user_data.full_name,
            role="user"
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    query = {}
    if user_data.email:
        query["email"] = user_data.email
    elif user_data.phone:
        query["phone"] = user_data.phone
    else:
        raise HTTPException(status_code=400, detail="Email ou téléphone requis")
    
    user = await db.users.find_one(query)
    if not user:
        raise HTTPException(status_code=401, detail="Identifiant incorrect")
    
    if user_data.password and user.get("hashed_password"):
        if not verify_password(user_data.password, user["hashed_password"]):
            raise HTTPException(status_code=401, detail="Mot de passe incorrect")
    
    token = create_access_token({"sub": user["id"]})
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user.get("email"),
            phone=user.get("phone"),
            full_name=user["full_name"],
            role=user.get("role", "user")
        )
    )

@api_router.post("/auth/otp/send")
async def send_otp(data: PhoneOTPRequest):
    """Send OTP to phone number (SIMULATED)"""
    otp = generate_otp()
    otp_storage[data.phone] = {
        "otp": otp,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=5)
    }
    
    # SIMULATION: Return OTP in response (in production, send via SMS)
    return {
        "message": "Code OTP envoyé",
        "phone": data.phone,
        "otp_simulation": otp,  # Remove in production!
        "expires_in": 300
    }

@api_router.post("/auth/otp/verify", response_model=TokenResponse)
async def verify_otp(data: PhoneOTPVerify):
    """Verify OTP and login/register user"""
    stored = otp_storage.get(data.phone)
    if not stored:
        raise HTTPException(status_code=400, detail="Code OTP non trouvé. Demandez un nouveau code.")
    
    if datetime.now(timezone.utc) > stored["expires"]:
        del otp_storage[data.phone]
        raise HTTPException(status_code=400, detail="Code OTP expiré")
    
    if stored["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Code OTP invalide")
    
    # Clear OTP
    del otp_storage[data.phone]
    
    # Find or create user
    user = await db.users.find_one({"phone": data.phone})
    if not user:
        # Create new user
        user_id = str(uuid.uuid4())
        user = {
            "id": user_id,
            "phone": data.phone,
            "full_name": f"Utilisateur {data.phone[-4:]}",
            "role": "user",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user)
    
    token = create_access_token({"sub": user["id"]})
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            phone=user.get("phone"),
            email=user.get("email"),
            full_name=user["full_name"],
            role=user.get("role", "user")
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        email=user.get("email"),
        phone=user.get("phone"),
        full_name=user["full_name"],
        role=user.get("role", "user")
    )

# ============== STAFF ROUTES ==============

def generate_staff_password():
    """Generate a random 8-character password"""
    import string
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(8))

@api_router.post("/staff/login", response_model=StaffTokenResponse)
async def staff_login(data: StaffLogin):
    """Staff member login - returns JWT token with 24h expiration"""
    staff = await db.staff_accounts.find_one({"username": data.username}, {"_id": 0})
    
    if not staff:
        raise HTTPException(status_code=401, detail="Identifiant incorrect")
    
    if not verify_password(data.password, staff["password_hash"]):
        raise HTTPException(status_code=401, detail="Mot de passe incorrect")
    
    if not staff.get("active", True):
        raise HTTPException(status_code=403, detail="Compte désactivé par l'organisateur")
    
    token = create_staff_token({"sub": staff["id"]})
    
    return StaffTokenResponse(
        access_token=token,
        staff=StaffResponse(
            id=staff["id"],
            organizer_id=staff["organizer_id"],
            username=staff["username"],
            full_name=staff["full_name"],
            assigned_events=staff.get("assigned_events", []),
            active=staff.get("active", True),
            created_at=staff["created_at"]
        )
    )

@api_router.get("/staff/me")
async def get_staff_me(staff: dict = Depends(get_current_staff)):
    """Get current staff member info"""
    return StaffResponse(
        id=staff["id"],
        organizer_id=staff["organizer_id"],
        username=staff["username"],
        full_name=staff["full_name"],
        assigned_events=staff.get("assigned_events", []),
        active=staff.get("active", True),
        created_at=staff["created_at"]
    )

@api_router.get("/staff/events")
async def get_staff_events(staff: dict = Depends(get_current_staff)):
    """Get events assigned to staff member"""
    assigned_ids = staff.get("assigned_events", [])
    
    if not assigned_ids:
        return []
    
    events = await db.events.find(
        {"id": {"$in": assigned_ids}},
        {"_id": 0, "id": 1, "title": 1, "date": 1, "time": 1, "venue": 1, "image_url": 1}
    ).to_list(100)
    
    # Add ticket stats for each event
    for event in events:
        total_tickets = await db.tickets.count_documents({"event_id": event["id"]})
        scanned_tickets = await db.tickets.count_documents({
            "event_id": event["id"],
            "status": "used"
        })
        event["total_tickets"] = total_tickets
        event["scanned_tickets"] = scanned_tickets
    
    return events

@api_router.post("/staff/scan")
async def staff_scan_ticket(data: ScanRequest, staff: dict = Depends(get_current_staff)):
    """Scan a ticket QR code - returns validation result"""
    # Check if staff has access to this event
    if data.event_id not in staff.get("assigned_events", []):
        raise HTTPException(status_code=403, detail="Vous n'êtes pas assigné à cet événement")
    
    # Find ticket by QR code
    ticket = await db.tickets.find_one({"qr_code_data": data.qr_code}, {"_id": 0})
    
    scan_log = {
        "id": str(uuid.uuid4()),
        "staff_id": staff["id"],
        "staff_name": staff["full_name"],
        "event_id": data.event_id,
        "qr_code": data.qr_code,
        "scanned_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Case 1: Ticket not found (invalid QR)
    if not ticket:
        scan_log.update({
            "ticket_id": None,
            "event_title": "",
            "client_name": "",
            "ticket_type": "",
            "status": "invalid",
            "message": "QR code invalide - Billet non trouvé"
        })
        await db.scan_logs.insert_one(scan_log)
        return {
            "status": "invalid",
            "message": "QR code invalide",
            "details": "Ce billet n'existe pas dans le système",
            "vibration": "error"
        }
    
    # Case 2: Ticket belongs to different event
    if ticket.get("event_id") != data.event_id:
        scan_log.update({
            "ticket_id": ticket["id"],
            "event_title": ticket.get("event_title", ""),
            "client_name": ticket.get("passenger_name") or "",
            "ticket_type": ticket.get("ticket_type", ""),
            "status": "invalid",
            "message": "Billet pour un autre événement"
        })
        await db.scan_logs.insert_one(scan_log)
        return {
            "status": "invalid",
            "message": "Mauvais événement",
            "details": f"Ce billet est pour: {ticket.get('event_title', 'Autre événement')}",
            "vibration": "error"
        }
    
    # Case 3: Ticket already scanned
    if ticket.get("status") == "used":
        first_scan_time = ticket.get("scanned_at", "Heure inconnue")
        first_scanner = ticket.get("scanned_by_name", "Agent inconnu")
        
        scan_log.update({
            "ticket_id": ticket["id"],
            "event_title": ticket.get("event_title", ""),
            "client_name": ticket.get("passenger_name") or ticket.get("user_name", ""),
            "ticket_type": ticket.get("ticket_type", ""),
            "status": "already_scanned",
            "message": f"Déjà scanné à {first_scan_time} par {first_scanner}"
        })
        await db.scan_logs.insert_one(scan_log)
        return {
            "status": "already_scanned",
            "message": "ALERTE: Billet déjà utilisé!",
            "details": f"Scanné le {first_scan_time}",
            "scanned_by": first_scanner,
            "client_name": ticket.get("passenger_name") or ticket.get("user_name", "Client"),
            "ticket_type": ticket.get("ticket_type", "Standard"),
            "vibration": "warning"
        }
    
    # Case 4: Valid ticket - Mark as used
    await db.tickets.update_one(
        {"id": ticket["id"]},
        {"$set": {
            "status": "used",
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "scanned_by": staff["id"],
            "scanned_by_name": staff["full_name"]
        }}
    )
    
    # Get client name
    client_name = ticket.get("passenger_name")  # For transport tickets
    if not client_name:
        user = await db.users.find_one({"id": ticket.get("user_id")}, {"full_name": 1})
        client_name = user.get("full_name", "Client") if user else "Client"
    
    scan_log.update({
        "ticket_id": ticket["id"],
        "event_title": ticket.get("event_title", ""),
        "client_name": client_name,
        "ticket_type": ticket.get("ticket_type", "Standard"),
        "status": "valid",
        "message": "Billet validé avec succès"
    })
    await db.scan_logs.insert_one(scan_log)
    
    return {
        "status": "valid",
        "message": "Billet Validé ✓",
        "client_name": client_name,
        "ticket_type": ticket.get("ticket_type", "Standard"),
        "event_title": ticket.get("event_title", ""),
        "vibration": "success"
    }

# ============== ORGANIZER STAFF MANAGEMENT ==============

@api_router.get("/organizer/staff")
async def get_organizer_staff(organizer: dict = Depends(get_organizer_user)):
    """Get all staff accounts for organizer"""
    staff_list = await db.staff_accounts.find(
        {"organizer_id": organizer["id"]},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    return staff_list

@api_router.post("/organizer/staff")
async def create_staff_account(data: StaffCreate, organizer: dict = Depends(get_organizer_user)):
    """Create a new staff account for organizer"""
    # Check if username already exists
    existing = await db.staff_accounts.find_one({"username": data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Ce nom d'utilisateur est déjà pris")
    
    # Validate assigned events belong to organizer
    for event_id in data.assigned_events:
        event = await db.events.find_one({"id": event_id, "organizer_id": organizer["id"]})
        if not event:
            raise HTTPException(status_code=400, detail=f"Événement {event_id} non trouvé ou non autorisé")
    
    # Generate password
    password = generate_staff_password()
    
    staff_id = str(uuid.uuid4())
    staff_doc = {
        "id": staff_id,
        "organizer_id": organizer["id"],
        "username": data.username,
        "password_hash": hash_password(password),
        "full_name": data.full_name,
        "assigned_events": data.assigned_events,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.staff_accounts.insert_one(staff_doc)
    
    # Return with generated password (only shown once!)
    return {
        "id": staff_id,
        "username": data.username,
        "password": password,  # Only returned on creation!
        "full_name": data.full_name,
        "assigned_events": data.assigned_events,
        "active": True,
        "message": "Compte créé! Notez bien le mot de passe, il ne sera plus affiché."
    }

@api_router.put("/organizer/staff/{staff_id}")
async def update_staff_account(staff_id: str, data: StaffUpdate, organizer: dict = Depends(get_organizer_user)):
    """Update staff account (assign events, activate/deactivate)"""
    staff = await db.staff_accounts.find_one({"id": staff_id, "organizer_id": organizer["id"]})
    if not staff:
        raise HTTPException(status_code=404, detail="Compte staff non trouvé")
    
    update_data = {}
    
    if data.full_name is not None:
        update_data["full_name"] = data.full_name
    
    if data.assigned_events is not None:
        # Validate events belong to organizer
        for event_id in data.assigned_events:
            event = await db.events.find_one({"id": event_id, "organizer_id": organizer["id"]})
            if not event:
                raise HTTPException(status_code=400, detail=f"Événement {event_id} non autorisé")
        update_data["assigned_events"] = data.assigned_events
    
    if data.active is not None:
        update_data["active"] = data.active
    
    if update_data:
        await db.staff_accounts.update_one({"id": staff_id}, {"$set": update_data})
    
    updated = await db.staff_accounts.find_one({"id": staff_id}, {"_id": 0, "password_hash": 0})
    return updated

@api_router.delete("/organizer/staff/{staff_id}")
async def delete_staff_account(staff_id: str, organizer: dict = Depends(get_organizer_user)):
    """Delete a staff account"""
    result = await db.staff_accounts.delete_one({"id": staff_id, "organizer_id": organizer["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Compte staff non trouvé")
    return {"message": "Compte staff supprimé"}

@api_router.post("/organizer/staff/{staff_id}/reset-password")
async def reset_staff_password(staff_id: str, organizer: dict = Depends(get_organizer_user)):
    """Reset staff password - generates new password"""
    staff = await db.staff_accounts.find_one({"id": staff_id, "organizer_id": organizer["id"]})
    if not staff:
        raise HTTPException(status_code=404, detail="Compte staff non trouvé")
    
    new_password = generate_staff_password()
    await db.staff_accounts.update_one(
        {"id": staff_id},
        {"$set": {"password_hash": hash_password(new_password)}}
    )
    
    return {
        "message": "Mot de passe réinitialisé",
        "new_password": new_password,
        "username": staff["username"]
    }

@api_router.get("/organizer/staff/scan-logs")
async def get_scan_logs(
    organizer: dict = Depends(get_organizer_user),
    event_id: Optional[str] = None,
    limit: int = 100
):
    """Get scan logs for organizer's events"""
    # Get organizer's event IDs
    events = await db.events.find(
        {"organizer_id": organizer["id"]},
        {"id": 1}
    ).to_list(1000)
    event_ids = [e["id"] for e in events]
    
    query = {"event_id": {"$in": event_ids}}
    if event_id:
        query["event_id"] = event_id
    
    logs = await db.scan_logs.find(query, {"_id": 0}).sort("scanned_at", -1).to_list(limit)
    return logs

@api_router.get("/organizer/events/{event_id}/entry-stats")
async def get_event_entry_stats(event_id: str, organizer: dict = Depends(get_organizer_user)):
    """Get real-time entry statistics for an event"""
    event = await db.events.find_one({"id": event_id, "organizer_id": organizer["id"]})
    if not event:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    total_tickets = await db.tickets.count_documents({"event_id": event_id})
    used_tickets = await db.tickets.count_documents({"event_id": event_id, "status": "used"})
    valid_tickets = await db.tickets.count_documents({"event_id": event_id, "status": "valid"})
    
    # Get recent scans
    recent_scans = await db.scan_logs.find(
        {"event_id": event_id, "status": "valid"},
        {"_id": 0}
    ).sort("scanned_at", -1).to_list(10)
    
    return {
        "event_id": event_id,
        "event_title": event["title"],
        "total_tickets": total_tickets,
        "entries": used_tickets,
        "remaining": valid_tickets,
        "entry_rate": round((used_tickets / total_tickets * 100) if total_tickets > 0 else 0, 1),
        "recent_entries": recent_scans
    }


@api_router.get("/organizer/events/{event_id}/live-dashboard")
async def get_live_event_dashboard(event_id: str, organizer: dict = Depends(get_organizer_user)):
    """Get comprehensive real-time dashboard data for an event"""
    event = await db.events.find_one({"id": event_id, "organizer_id": organizer["id"]})
    if not event:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    # Basic stats
    total_tickets = await db.tickets.count_documents({"event_id": event_id})
    used_tickets = await db.tickets.count_documents({"event_id": event_id, "status": "used"})
    valid_tickets = await db.tickets.count_documents({"event_id": event_id, "status": "valid"})
    
    # Ticket type breakdown
    ticket_types = await db.tickets.aggregate([
        {"$match": {"event_id": event_id}},
        {"$group": {
            "_id": "$ticket_type",
            "total": {"$sum": 1},
            "scanned": {"$sum": {"$cond": [{"$eq": ["$status", "used"]}, 1, 0]}}
        }}
    ]).to_list(100)
    
    type_breakdown = [
        {
            "type": t["_id"] or "Standard",
            "total": t["total"],
            "scanned": t["scanned"],
            "remaining": t["total"] - t["scanned"]
        }
        for t in ticket_types
    ]
    
    # Hourly entries (last 12 hours)
    now = datetime.now(timezone.utc)
    hourly_data = []
    for i in range(12):
        hour_start = now - timedelta(hours=11-i)
        hour_end = hour_start + timedelta(hours=1)
        
        count = await db.scan_logs.count_documents({
            "event_id": event_id,
            "status": "valid",
            "scanned_at": {
                "$gte": hour_start.isoformat(),
                "$lt": hour_end.isoformat()
            }
        })
        
        hourly_data.append({
            "hour": hour_start.strftime("%H:00"),
            "entries": count
        })
    
    # Recent entries (last 20)
    recent_entries = await db.scan_logs.find(
        {"event_id": event_id, "status": "valid"},
        {"_id": 0, "staff_name": 1, "client_name": 1, "ticket_type": 1, "scanned_at": 1}
    ).sort("scanned_at", -1).to_list(20)
    
    # Duplicate alerts (already_scanned attempts)
    duplicate_alerts = await db.scan_logs.find(
        {"event_id": event_id, "status": "already_scanned"},
        {"_id": 0}
    ).sort("scanned_at", -1).to_list(10)
    
    # Staff performance
    staff_stats = await db.scan_logs.aggregate([
        {"$match": {"event_id": event_id, "status": "valid"}},
        {"$group": {
            "_id": {"staff_id": "$staff_id", "staff_name": "$staff_name"},
            "scan_count": {"$sum": 1}
        }},
        {"$sort": {"scan_count": -1}}
    ]).to_list(20)
    
    staff_performance = [
        {"staff_name": s["_id"]["staff_name"], "scans": s["scan_count"]}
        for s in staff_stats
    ]
    
    # Entry rate per minute (last 10 minutes)
    entries_last_10min = await db.scan_logs.count_documents({
        "event_id": event_id,
        "status": "valid",
        "scanned_at": {"$gte": (now - timedelta(minutes=10)).isoformat()}
    })
    entry_rate_per_min = round(entries_last_10min / 10, 1)
    
    return {
        "event": {
            "id": event_id,
            "title": event["title"],
            "date": event.get("date"),
            "time": event.get("time"),
            "venue": event.get("venue")
        },
        "stats": {
            "total_tickets": total_tickets,
            "entries": used_tickets,
            "remaining": valid_tickets,
            "entry_rate_percent": round((used_tickets / total_tickets * 100) if total_tickets > 0 else 0, 1),
            "entry_rate_per_min": entry_rate_per_min
        },
        "type_breakdown": type_breakdown,
        "hourly_entries": hourly_data,
        "recent_entries": recent_entries,
        "duplicate_alerts": duplicate_alerts,
        "alert_count": len(duplicate_alerts),
        "staff_performance": staff_performance,
        "last_updated": now.isoformat()
    }


# ============== ORGANIZER ROUTES (Admin only) ==============

@api_router.post("/admin/organizers", response_model=OrganizerResponse)
async def create_organizer(data: OrganizerCreate, admin: dict = Depends(get_admin_user)):
    """Admin creates organizer account"""
    existing = await db.users.find_one({"$or": [{"email": data.email}, {"phone": data.phone}]})
    if existing:
        raise HTTPException(status_code=400, detail="Email ou téléphone déjà utilisé")
    
    org_id = str(uuid.uuid4())
    org_doc = {
        "id": org_id,
        "email": data.email,
        "phone": data.phone,
        "full_name": data.full_name,
        "company_name": data.company_name,
        "hashed_password": hash_password(data.password),
        "role": "organizer",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(org_doc)
    
    return OrganizerResponse(**{k: v for k, v in org_doc.items() if k != "hashed_password"})

@api_router.get("/admin/organizers", response_model=List[OrganizerResponse])
async def list_organizers(admin: dict = Depends(get_admin_user)):
    """List all organizers"""
    organizers = await db.users.find({"role": "organizer"}, {"_id": 0, "hashed_password": 0}).to_list(100)
    return [OrganizerResponse(**o) for o in organizers]

@api_router.delete("/admin/organizers/{organizer_id}")
async def delete_organizer(organizer_id: str, admin: dict = Depends(get_admin_user)):
    """Delete organizer"""
    result = await db.users.delete_one({"id": organizer_id, "role": "organizer"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Organisateur non trouvé")
    return {"message": "Organisateur supprimé"}

# ============== EVENTS ROUTES ==============

@api_router.get("/events")
async def get_events(category: Optional[str] = None, search: Optional[str] = None):
    query = {}
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    events = await db.events.find(query, {"_id": 0}).sort("date", 1).to_list(100)
    
    # Calculate availability and add badges
    result = []
    for event in events:
        total_tickets = sum(tt.get("quantity", 0) for tt in event.get("ticket_types", []))
        sold_tickets = sum(tt.get("sold", 0) for tt in event.get("ticket_types", []))
        available = total_tickets - sold_tickets
        
        # Low stock badge (< 10%)
        low_stock = available > 0 and available <= total_tickets * 0.1
        
        # Get min price
        prices = [tt.get("price", 0) for tt in event.get("ticket_types", [])]
        min_price = min(prices) if prices else 0
        
        result.append({
            **event,
            "total_tickets": total_tickets,
            "sold_tickets": sold_tickets,
            "available_tickets": available,
            "min_price": min_price,
            "low_stock": low_stock,
            "low_stock_count": available if low_stock else None
        })
    
    return result

@api_router.get("/events/{event_id}")
async def get_event(event_id: str):
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    total_tickets = sum(tt.get("quantity", 0) for tt in event.get("ticket_types", []))
    sold_tickets = sum(tt.get("sold", 0) for tt in event.get("ticket_types", []))
    available = total_tickets - sold_tickets
    low_stock = available > 0 and available <= total_tickets * 0.1
    
    return {
        **event,
        "total_tickets": total_tickets,
        "sold_tickets": sold_tickets,
        "available_tickets": available,
        "low_stock": low_stock,
        "low_stock_count": available if low_stock else None
    }

@api_router.post("/events")
async def create_event(event_data: EventCreate, user: dict = Depends(get_organizer_user)):
    """Create event (Organizer or Admin)"""
    event_id = str(uuid.uuid4())
    
    # Create ticket types with IDs
    ticket_types = []
    for tt in event_data.ticket_types:
        ticket_types.append({
            "id": str(uuid.uuid4()),
            "name": tt.name,
            "price": tt.price,
            "quantity": tt.quantity,
            "sold": 0,
            "description": tt.description,
            "max_per_order": tt.max_per_order,
            "group_size": tt.group_size
        })
    
    event_doc = {
        "id": event_id,
        "title": event_data.title,
        "description": event_data.description,
        "category": event_data.category,
        "venue": event_data.venue,
        "date": event_data.date,
        "time": event_data.time,
        "image_url": event_data.image_url,
        "ticket_types": ticket_types,
        "organizer_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.events.insert_one(event_doc)
    
    return {**event_doc, "total_tickets": sum(tt["quantity"] for tt in ticket_types), "sold_tickets": 0}

@api_router.put("/events/{event_id}")
async def update_event(event_id: str, event_data: EventUpdate, user: dict = Depends(get_organizer_user)):
    event = await db.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    # Check ownership (admin can edit any)
    if user.get("role") != "admin" and event.get("organizer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Vous ne pouvez modifier que vos événements")
    
    update_data = {k: v for k, v in event_data.model_dump().items() if v is not None}
    if update_data:
        await db.events.update_one({"id": event_id}, {"$set": update_data})
    
    updated = await db.events.find_one({"id": event_id}, {"_id": 0})
    return updated

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, user: dict = Depends(get_organizer_user)):
    event = await db.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    if user.get("role") != "admin" and event.get("organizer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Vous ne pouvez supprimer que vos événements")
    
    await db.events.delete_one({"id": event_id})
    return {"message": "Événement supprimé"}

# ============== TICKET TYPES ROUTES ==============

@api_router.post("/events/{event_id}/ticket-types")
async def add_ticket_type(event_id: str, tt_data: TicketTypeCreate, user: dict = Depends(get_organizer_user)):
    """Add a new ticket type to an event"""
    event = await db.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    if user.get("role") != "admin" and event.get("organizer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorisé")
    
    new_tt = {
        "id": str(uuid.uuid4()),
        "name": tt_data.name,
        "price": tt_data.price,
        "quantity": tt_data.quantity,
        "sold": 0,
        "description": tt_data.description,
        "max_per_order": tt_data.max_per_order,
        "group_size": tt_data.group_size
    }
    
    await db.events.update_one({"id": event_id}, {"$push": {"ticket_types": new_tt}})
    return new_tt

# ============== PROMO CODES ROUTES ==============

@api_router.post("/promo-codes", response_model=PromoCodeResponse)
async def create_promo_code(data: PromoCodeCreate, user: dict = Depends(get_organizer_user)):
    """Create a promo code (Organizer creates for their events)"""
    # Check if code already exists
    existing = await db.promo_codes.find_one({"code": data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Ce code existe déjà")
    
    # If event_id provided, verify ownership
    if data.event_id:
        event = await db.events.find_one({"id": data.event_id})
        if not event:
            raise HTTPException(status_code=404, detail="Événement non trouvé")
        if user.get("role") != "admin" and event.get("organizer_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Non autorisé")
    
    promo_id = str(uuid.uuid4())
    promo_doc = {
        "id": promo_id,
        "code": data.code.upper(),
        "discount_type": data.discount_type,
        "discount_value": data.discount_value,
        "max_uses": data.max_uses,
        "uses": 0,
        "event_id": data.event_id,
        "valid_until": data.valid_until,
        "organizer_id": user["id"],
        "total_sales": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.promo_codes.insert_one(promo_doc)
    
    return PromoCodeResponse(**promo_doc)

@api_router.get("/promo-codes")
async def get_my_promo_codes(user: dict = Depends(get_organizer_user)):
    """Get promo codes for organizer"""
    query = {} if user.get("role") == "admin" else {"organizer_id": user["id"]}
    codes = await db.promo_codes.find(query, {"_id": 0}).to_list(100)
    return codes

@api_router.get("/promo-codes/{code}/validate")
async def validate_promo_code(code: str, event_id: Optional[str] = None):
    """Validate a promo code"""
    promo = await db.promo_codes.find_one({"code": code.upper()}, {"_id": 0})
    if not promo:
        raise HTTPException(status_code=404, detail="Code promo invalide")
    
    # Check uses
    if promo["uses"] >= promo["max_uses"]:
        raise HTTPException(status_code=400, detail="Code promo épuisé")
    
    # Check validity date
    if promo.get("valid_until"):
        valid_date = datetime.fromisoformat(promo["valid_until"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > valid_date:
            raise HTTPException(status_code=400, detail="Code promo expiré")
    
    # Check event restriction
    if promo.get("event_id") and event_id and promo["event_id"] != event_id:
        raise HTTPException(status_code=400, detail="Code non valide pour cet événement")
    
    return {
        "valid": True,
        "discount_type": promo["discount_type"],
        "discount_value": promo["discount_value"],
        "code": promo["code"]
    }

@api_router.delete("/promo-codes/{promo_id}")
async def delete_promo_code(promo_id: str, user: dict = Depends(get_organizer_user)):
    promo = await db.promo_codes.find_one({"id": promo_id})
    if not promo:
        raise HTTPException(status_code=404, detail="Code promo non trouvé")
    
    if user.get("role") != "admin" and promo.get("organizer_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorisé")
    
    await db.promo_codes.delete_one({"id": promo_id})
    return {"message": "Code promo supprimé"}

# ============== CART ROUTES ==============

@api_router.get("/cart")
async def get_cart(user: dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart:
        return {"items": [], "total": 0, "discount": 0, "final_total": 0}
    
    items_with_details = []
    total = 0
    
    for item in cart.get("items", []):
        event = await db.events.find_one({"id": item["event_id"]}, {"_id": 0})
        if event:
            ticket_type = next((tt for tt in event.get("ticket_types", []) if tt["id"] == item["ticket_type_id"]), None)
            if ticket_type:
                item_total = ticket_type["price"] * item["quantity"]
                items_with_details.append({
                    "event_id": item["event_id"],
                    "ticket_type_id": item["ticket_type_id"],
                    "quantity": item["quantity"],
                    "event": event,
                    "ticket_type": ticket_type,
                    "subtotal": item_total
                })
                total += item_total
    
    # Apply promo code if any
    discount = 0
    promo_code = cart.get("promo_code")
    if promo_code:
        promo = await db.promo_codes.find_one({"code": promo_code}, {"_id": 0})
        if promo:
            if promo["discount_type"] == "percentage":
                discount = int(total * promo["discount_value"] / 100)
            else:
                discount = min(promo["discount_value"], total)
    
    return {
        "items": items_with_details, 
        "total": total, 
        "discount": discount,
        "promo_code": promo_code,
        "final_total": total - discount
    }

@api_router.post("/cart/add")
async def add_to_cart(cart_item: CartItemAdd, user: dict = Depends(get_current_user)):
    event = await db.events.find_one({"id": cart_item.event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    ticket_type = next((tt for tt in event.get("ticket_types", []) if tt["id"] == cart_item.ticket_type_id), None)
    if not ticket_type:
        raise HTTPException(status_code=404, detail="Type de billet non trouvé")
    
    available = ticket_type["quantity"] - ticket_type.get("sold", 0)
    if available < cart_item.quantity:
        raise HTTPException(status_code=400, detail="Pas assez de billets disponibles")
    
    if cart_item.quantity > ticket_type.get("max_per_order", 10):
        raise HTTPException(status_code=400, detail=f"Maximum {ticket_type['max_per_order']} billets par commande")
    
    cart = await db.carts.find_one({"user_id": user["id"]})
    new_item = {
        "event_id": cart_item.event_id, 
        "ticket_type_id": cart_item.ticket_type_id,
        "quantity": cart_item.quantity
    }
    
    if not cart:
        cart_doc = {"user_id": user["id"], "items": [new_item]}
        if cart_item.promo_code:
            cart_doc["promo_code"] = cart_item.promo_code.upper()
        await db.carts.insert_one(cart_doc)
    else:
        # Check if same item exists
        existing_item = next(
            (i for i in cart["items"] if i["event_id"] == cart_item.event_id and i["ticket_type_id"] == cart_item.ticket_type_id), 
            None
        )
        if existing_item:
            existing_item["quantity"] = cart_item.quantity
            await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": cart["items"]}})
        else:
            await db.carts.update_one({"user_id": user["id"]}, {"$push": {"items": new_item}})
        
        if cart_item.promo_code:
            await db.carts.update_one({"user_id": user["id"]}, {"$set": {"promo_code": cart_item.promo_code.upper()}})
    
    return {"message": "Ajouté au panier"}

@api_router.post("/cart/promo")
async def apply_promo_code(promo_code: str = Query(...), user: dict = Depends(get_current_user)):
    """Apply promo code to cart"""
    promo = await db.promo_codes.find_one({"code": promo_code.upper()})
    if not promo:
        raise HTTPException(status_code=404, detail="Code promo invalide")
    
    if promo["uses"] >= promo["max_uses"]:
        raise HTTPException(status_code=400, detail="Code promo épuisé")
    
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"promo_code": promo_code.upper()}})
    return {"message": "Code promo appliqué", "code": promo_code.upper()}

@api_router.delete("/cart/{event_id}/{ticket_type_id}")
async def remove_from_cart(event_id: str, ticket_type_id: str, user: dict = Depends(get_current_user)):
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$pull": {"items": {"event_id": event_id, "ticket_type_id": ticket_type_id}}}
    )
    return {"message": "Retiré du panier"}

@api_router.delete("/cart")
async def clear_cart(user: dict = Depends(get_current_user)):
    await db.carts.delete_one({"user_id": user["id"]})
    return {"message": "Panier vidé"}

# ============== CHECKOUT & TICKETS ==============

@api_router.post("/checkout")
async def checkout(checkout_data: CheckoutRequest, user: dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Le panier est vide")
    
    tickets_created = []
    total = 0
    discount = 0
    promo_code = cart.get("promo_code") or checkout_data.promo_code
    
    # Calculate total first
    for item in cart["items"]:
        event = await db.events.find_one({"id": item["event_id"]})
        if not event:
            continue
        ticket_type = next((tt for tt in event.get("ticket_types", []) if tt["id"] == item["ticket_type_id"]), None)
        if ticket_type:
            total += ticket_type["price"] * item["quantity"]
    
    # Apply promo code
    if promo_code:
        promo = await db.promo_codes.find_one({"code": promo_code.upper()})
        if promo and promo["uses"] < promo["max_uses"]:
            if promo["discount_type"] == "percentage":
                discount = int(total * promo["discount_value"] / 100)
            else:
                discount = min(promo["discount_value"], total)
            # Update promo usage
            await db.promo_codes.update_one(
                {"code": promo_code.upper()},
                {"$inc": {"uses": 1, "total_sales": total - discount}}
            )
    
    final_total = total - discount
    
    # Create tickets
    for item in cart["items"]:
        event = await db.events.find_one({"id": item["event_id"]})
        if not event:
            continue
        
        ticket_type = next((tt for tt in event.get("ticket_types", []) if tt["id"] == item["ticket_type_id"]), None)
        if not ticket_type:
            continue
        
        available = ticket_type["quantity"] - ticket_type.get("sold", 0)
        if available < item["quantity"]:
            raise HTTPException(status_code=400, detail=f"Pas assez de billets pour {event['title']} ({ticket_type['name']})")
        
        for _ in range(item["quantity"]):
            ticket_id = str(uuid.uuid4())
            qr_data = f"DBILLET-{ticket_id}"
            
            ticket_doc = {
                "id": ticket_id,
                "event_id": event["id"],
                "event_title": event["title"],
                "event_date": event["date"],
                "event_time": event["time"],
                "event_venue": event["venue"],
                "ticket_type": ticket_type["name"],
                "ticket_type_id": ticket_type["id"],
                "user_id": user["id"],
                "organizer_id": event.get("organizer_id"),
                "qr_code_data": qr_data,
                "status": "valid",
                "price": ticket_type["price"],
                "promo_code": promo_code,
                "payment_method": checkout_data.payment_method,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.tickets.insert_one(ticket_doc)
            tickets_created.append(ticket_doc)
        
        # Update sold count
        ticket_types = event.get("ticket_types", [])
        for tt in ticket_types:
            if tt["id"] == item["ticket_type_id"]:
                tt["sold"] = tt.get("sold", 0) + item["quantity"]
                break
        await db.events.update_one({"id": event["id"]}, {"$set": {"ticket_types": ticket_types}})
    
    await db.carts.delete_one({"user_id": user["id"]})
    
    return {
        "message": "Paiement réussi",
        "tickets": [{"id": t["id"], "event_title": t["event_title"], "ticket_type": t["ticket_type"]} for t in tickets_created],
        "total": total,
        "discount": discount,
        "final_total": final_total,
        "payment_method": checkout_data.payment_method
    }

@api_router.get("/tickets")
async def get_my_tickets(user: dict = Depends(get_current_user)):
    tickets = await db.tickets.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return tickets

@api_router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Billet non trouvé")
    # Allow ticket owner, organizer, or admin
    if ticket["user_id"] != user["id"] and ticket.get("organizer_id") != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé")
    return ticket

@api_router.get("/tickets/{ticket_id}/view")
async def get_ticket_view(ticket_id: str):
    """Public ticket view with QR code"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Billet non trouvé")
    
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(ticket["qr_code_data"])
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="white", back_color="#0A0A0F")
    
    buffer = BytesIO()
    qr_img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    # Generate WhatsApp share URL
    share_url = f"https://dbillet.dj/ticket/{ticket_id}"
    whatsapp_text = f"Mon billet D-Billet - {ticket['event_title']} - {ticket['event_date']} a {ticket['event_time']} - {ticket['event_venue']} - {share_url}"
    encoded_text = whatsapp_text.replace(' ', '%20')
    whatsapp_url = f"https://wa.me/?text={encoded_text}"
    
    return {
        **ticket,
        "qr_code_image": f"data:image/png;base64,{qr_base64}",
        "share_url": share_url,
        "whatsapp_url": whatsapp_url
    }

@api_router.get("/tickets/{ticket_id}/pdf")
async def download_ticket_pdf(ticket_id: str, user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Billet non trouvé")
    if ticket["user_id"] != user["id"] and user.get("role") not in ["admin", "organizer"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    from reportlab.lib.utils import ImageReader
    from reportlab.lib.units import mm
    
    buffer = BytesIO()
    # Use a ticket-sized format (similar to mobile screen)
    ticket_width = 100 * mm
    ticket_height = 200 * mm
    p = canvas.Canvas(buffer, pagesize=(ticket_width, ticket_height))
    
    # Colors
    primary_green = HexColor("#00A651")
    dark_bg = HexColor("#0A0A0F")
    light_green_bg = HexColor("#E8F5E9")
    text_dark = HexColor("#1A1A1A")
    text_gray = HexColor("#666666")
    
    # ===== GREEN HEADER =====
    p.setFillColor(primary_green)
    p.rect(0, ticket_height - 25*mm, ticket_width, 25*mm, fill=True, stroke=False)
    
    # D-BILLET Logo text
    p.setFillColor(HexColor("#FFFFFF"))
    p.setFont("Helvetica-Bold", 18)
    p.drawString(10*mm, ticket_height - 16*mm, "D-BILLET")
    p.setFont("Helvetica", 8)
    p.drawString(10*mm, ticket_height - 21*mm, "Billetterie Djibouti")
    
    # ===== WHITE CONTENT AREA =====
    p.setFillColor(HexColor("#FFFFFF"))
    p.rect(5*mm, 10*mm, ticket_width - 10*mm, ticket_height - 40*mm, fill=True, stroke=False)
    
    # Add subtle border
    p.setStrokeColor(HexColor("#E0E0E0"))
    p.setLineWidth(0.5)
    p.rect(5*mm, 10*mm, ticket_width - 10*mm, ticket_height - 40*mm, fill=False, stroke=True)
    
    # ===== TICKET SUMMARY TITLE =====
    p.setFillColor(text_dark)
    p.setFont("Helvetica-Bold", 14)
    p.drawCentredString(ticket_width/2, ticket_height - 45*mm, "Ticket Summary")
    
    # ===== TICKET DETAILS =====
    y_pos = ticket_height - 60*mm
    line_height = 12*mm
    
    # Helper function to draw info row
    def draw_info_row(label, value, y):
        p.setFillColor(text_gray)
        p.setFont("Helvetica", 9)
        p.drawString(12*mm, y, label)
        p.setFillColor(text_dark)
        p.setFont("Helvetica-Bold", 10)
        p.drawString(12*mm, y - 4*mm, str(value))
        return y - line_height
    
    # Event Title
    p.setFillColor(text_dark)
    p.setFont("Helvetica-Bold", 11)
    event_title = ticket["event_title"]
    if len(event_title) > 35:
        event_title = event_title[:32] + "..."
    p.drawString(12*mm, y_pos, event_title)
    y_pos -= 8*mm
    
    # Ticket Type
    y_pos = draw_info_row("Type de billet:", ticket.get('ticket_type', 'Standard'), y_pos)
    
    # Date
    y_pos = draw_info_row("Date:", ticket['event_date'], y_pos)
    
    # Time
    y_pos = draw_info_row("Heure:", ticket['event_time'], y_pos)
    
    # Venue
    venue = ticket['event_venue']
    if len(venue) > 30:
        venue = venue[:27] + "..."
    y_pos = draw_info_row("Lieu:", venue, y_pos)
    
    # Passenger name (if exists - for train/ferry)
    if ticket.get('passenger_name'):
        y_pos = draw_info_row("Passager:", ticket['passenger_name'], y_pos)
    
    # Price
    y_pos = draw_info_row("Prix:", f"{ticket['price']} DJF", y_pos)
    
    # ===== QR CODE SECTION =====
    qr_y = 45*mm
    
    # "Scan to verify" text
    p.setFillColor(text_gray)
    p.setFont("Helvetica", 8)
    p.drawCentredString(ticket_width/2, qr_y + 38*mm, "Scan to verify")
    
    # QR Code
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(ticket["qr_code_data"])
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    
    qr_buffer = BytesIO()
    qr_img.save(qr_buffer, format="PNG")
    qr_buffer.seek(0)
    
    qr_image = ImageReader(qr_buffer)
    qr_size = 30*mm
    p.drawImage(qr_image, (ticket_width - qr_size)/2, qr_y, qr_size, qr_size)
    
    # "Scan QR Code" instruction
    p.setFillColor(text_dark)
    p.setFont("Helvetica-Bold", 10)
    p.drawCentredString(ticket_width/2, qr_y - 6*mm, "Scan QR Code")
    
    # ===== PAYMENT REFERENCE (Light green box) =====
    p.setFillColor(light_green_bg)
    p.roundRect(10*mm, 12*mm, ticket_width - 20*mm, 12*mm, 2*mm, fill=True, stroke=False)
    
    p.setFillColor(text_gray)
    p.setFont("Helvetica", 8)
    p.drawString(15*mm, 19*mm, "Payment Reference No.:")
    p.setFillColor(text_dark)
    p.setFont("Helvetica-Bold", 9)
    # Use first 13 chars of ticket ID as reference
    ref_number = ticket['id'].replace('-', '')[:13]
    p.drawString(55*mm, 19*mm, ref_number)
    
    p.showPage()
    p.save()
    
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=billet-{ticket_id[:8]}.pdf"}
    )

# ============== SCANNER ROUTES (Security Personnel) ==============

@api_router.post("/scanner/validate")
async def scanner_validate_ticket(qr_data: str = Query(...)):
    """Public scanner endpoint for security personnel"""
    # Handle QR code format
    ticket_id = qr_data
    if qr_data.startswith("DBILLET-") or qr_data.startswith("TRAIN-") or qr_data.startswith("FERRY-"):
        ticket_id = qr_data.split("-", 1)[1]
    
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        return {
            "valid": False,
            "status": "not_found",
            "message": "Billet non trouvé",
            "color": "red"
        }
    
    if ticket["status"] == "used":
        return {
            "valid": False,
            "status": "already_used",
            "message": "Billet déjà utilisé",
            "ticket": {
                "id": ticket["id"],
                "event_title": ticket["event_title"],
                "ticket_type": ticket.get("ticket_type", "Standard"),
                "used_at": ticket.get("used_at")
            },
            "color": "red"
        }
    
    # Mark as used
    await db.tickets.update_one(
        {"id": ticket_id}, 
        {"$set": {"status": "used", "used_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "valid": True,
        "status": "validated",
        "message": "Billet validé avec succès!",
        "ticket": {
            "id": ticket["id"],
            "event_title": ticket["event_title"],
            "event_date": ticket["event_date"],
            "event_time": ticket["event_time"],
            "ticket_type": ticket.get("ticket_type", "Standard"),
            "passenger_name": ticket.get("passenger_name"),
            "price": ticket["price"]
        },
        "color": "green"
    }

@api_router.get("/scanner/check/{qr_data}")
async def scanner_check_ticket(qr_data: str):
    """Check ticket without marking as used"""
    ticket_id = qr_data
    if qr_data.startswith("DBILLET-") or qr_data.startswith("TRAIN-") or qr_data.startswith("FERRY-"):
        ticket_id = qr_data.split("-", 1)[1]
    
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        return {"valid": False, "message": "Billet non trouvé"}
    
    return {
        "valid": ticket["status"] == "valid",
        "status": ticket["status"],
        "ticket": {
            "id": ticket["id"],
            "event_title": ticket["event_title"],
            "event_date": ticket["event_date"],
            "ticket_type": ticket.get("ticket_type", "Standard"),
            "passenger_name": ticket.get("passenger_name")
        }
    }

# ============== ORGANIZER DASHBOARD ==============

@api_router.get("/organizer/stats")
async def get_organizer_stats(user: dict = Depends(get_organizer_user)):
    """Get real-time stats for organizer"""
    query = {} if user.get("role") == "admin" else {"organizer_id": user["id"]}
    
    # Get all events for organizer
    events = await db.events.find(query, {"_id": 0}).to_list(100)
    
    # Calculate totals
    total_revenue = 0
    total_tickets_sold = 0
    total_tickets_available = 0
    events_stats = []
    
    for event in events:
        event_revenue = 0
        event_sold = 0
        event_total = 0
        
        for tt in event.get("ticket_types", []):
            sold = tt.get("sold", 0)
            event_sold += sold
            event_total += tt["quantity"]
            event_revenue += sold * tt["price"]
        
        total_revenue += event_revenue
        total_tickets_sold += event_sold
        total_tickets_available += event_total
        
        events_stats.append({
            "id": event["id"],
            "title": event["title"],
            "date": event["date"],
            "sold": event_sold,
            "total": event_total,
            "revenue": event_revenue,
            "percentage": int(event_sold / event_total * 100) if event_total > 0 else 0
        })
    
    # Get promo codes stats
    promo_query = {} if user.get("role") == "admin" else {"organizer_id": user["id"]}
    promo_codes = await db.promo_codes.find(promo_query, {"_id": 0}).to_list(100)
    
    promo_stats = []
    for promo in promo_codes:
        promo_stats.append({
            "code": promo["code"],
            "uses": promo["uses"],
            "max_uses": promo["max_uses"],
            "total_sales": promo.get("total_sales", 0)
        })
    
    commission = int(total_revenue * 0.08)
    
    return {
        "total_revenue": total_revenue,
        "commission": commission,
        "net_revenue": total_revenue - commission,
        "total_tickets_sold": total_tickets_sold,
        "total_tickets_available": total_tickets_available,
        "events_count": len(events),
        "events": events_stats,
        "promo_codes": promo_stats
    }

@api_router.get("/organizer/events")
async def get_organizer_events(user: dict = Depends(get_organizer_user)):
    """Get all events for organizer"""
    query = {} if user.get("role") == "admin" else {"organizer_id": user["id"]}
    events = await db.events.find(query, {"_id": 0}).to_list(100)
    
    result = []
    for event in events:
        total = sum(tt["quantity"] for tt in event.get("ticket_types", []))
        sold = sum(tt.get("sold", 0) for tt in event.get("ticket_types", []))
        result.append({
            **event,
            "total_tickets": total,
            "sold_tickets": sold,
            "available_tickets": total - sold
        })
    
    return result

# ============== ORGANIZER PARTICIPANTS (GUESTLIST) ==============

@api_router.get("/organizer/participants")
async def get_organizer_participants(
    user: dict = Depends(get_organizer_user),
    event_id: Optional[str] = None,
    search: Optional[str] = None
):
    """Get all participants (ticket buyers) for organizer's events"""
    # Get organizer's events
    events_query = {} if user.get("role") == "admin" else {"organizer_id": user["id"]}
    events = await db.events.find(events_query, {"id": 1, "_id": 0}).to_list(100)
    event_ids = [e["id"] for e in events]
    
    # Build tickets query
    tickets_query = {"event_id": {"$in": event_ids}}
    if event_id:
        tickets_query["event_id"] = event_id
    
    tickets = await db.tickets.find(tickets_query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrich with user info and filter by search
    participants = []
    for ticket in tickets:
        user_doc = await db.users.find_one({"id": ticket["user_id"]}, {"_id": 0, "hashed_password": 0})
        
        participant = {
            "ticket_id": ticket["id"],
            "event_id": ticket["event_id"],
            "event_title": ticket["event_title"],
            "event_date": ticket["event_date"],
            "ticket_type": ticket.get("ticket_type", "Standard"),
            "price": ticket["price"],
            "status": ticket["status"],
            "purchased_at": ticket["created_at"],
            "buyer_name": ticket.get("passenger_name") or (user_doc["full_name"] if user_doc else "Inconnu"),
            "buyer_email": user_doc.get("email") if user_doc else None,
            "buyer_phone": ticket.get("passenger_phone") or (user_doc.get("phone") if user_doc else None),
            "passenger_id": ticket.get("passenger_id")
        }
        
        # Apply search filter
        if search:
            search_lower = search.lower()
            if not (
                search_lower in participant["buyer_name"].lower() or
                (participant["buyer_email"] and search_lower in participant["buyer_email"].lower()) or
                (participant["buyer_phone"] and search_lower in participant["buyer_phone"]) or
                search_lower in participant["event_title"].lower()
            ):
                continue
        
        participants.append(participant)
    
    return {
        "total": len(participants),
        "participants": participants
    }

@api_router.get("/organizer/participants/export")
async def export_participants_csv(
    user: dict = Depends(get_organizer_user),
    event_id: Optional[str] = None
):
    """Export participants list as CSV"""
    import csv
    from io import StringIO
    
    # Get participants
    events_query = {} if user.get("role") == "admin" else {"organizer_id": user["id"]}
    events = await db.events.find(events_query, {"id": 1, "_id": 0}).to_list(100)
    event_ids = [e["id"] for e in events]
    
    tickets_query = {"event_id": {"$in": event_ids}}
    if event_id:
        tickets_query["event_id"] = event_id
    
    tickets = await db.tickets.find(tickets_query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Create CSV
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["Nom", "Email", "Téléphone", "Événement", "Date", "Type Billet", "Prix (DJF)", "Statut", "Date Achat"])
    
    for ticket in tickets:
        user_doc = await db.users.find_one({"id": ticket["user_id"]}, {"_id": 0})
        writer.writerow([
            ticket.get("passenger_name") or (user_doc["full_name"] if user_doc else "Inconnu"),
            user_doc.get("email") if user_doc else "",
            ticket.get("passenger_phone") or (user_doc.get("phone") if user_doc else ""),
            ticket["event_title"],
            ticket["event_date"],
            ticket.get("ticket_type", "Standard"),
            ticket["price"],
            "Utilisé" if ticket["status"] == "used" else "Valide",
            ticket["created_at"][:10]
        ])
    
    output.seek(0)
    
    from fastapi.responses import Response
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=participants-{datetime.now().strftime('%Y%m%d')}.csv"}
    )

# ============== ORGANIZER SALES CHART DATA ==============

@api_router.get("/organizer/sales-chart")
async def get_sales_chart_data(
    user: dict = Depends(get_organizer_user),
    days: int = 7
):
    """Get daily sales data for chart (last N days)"""
    # Get organizer's events
    events_query = {} if user.get("role") == "admin" else {"organizer_id": user["id"]}
    events = await db.events.find(events_query, {"id": 1, "_id": 0}).to_list(100)
    event_ids = [e["id"] for e in events]
    
    # Calculate date range
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # Get all tickets in range
    tickets = await db.tickets.find({
        "event_id": {"$in": event_ids},
        "created_at": {"$gte": start_date.isoformat()}
    }, {"_id": 0, "created_at": 1, "price": 1}).to_list(10000)
    
    # Group by day
    daily_sales = {}
    for i in range(days):
        day = (end_date - timedelta(days=days-1-i)).strftime("%Y-%m-%d")
        daily_sales[day] = {"date": day, "tickets": 0, "revenue": 0}
    
    for ticket in tickets:
        day = ticket["created_at"][:10]
        if day in daily_sales:
            daily_sales[day]["tickets"] += 1
            daily_sales[day]["revenue"] += ticket["price"]
    
    return {
        "period": f"{days} derniers jours",
        "data": list(daily_sales.values())
    }

# ============== ORGANIZER FINANCES & WITHDRAWALS ==============

class WithdrawalRequest(BaseModel):
    amount: int
    payment_method: str  # dmoney, waafi, bank_transfer
    account_info: str  # Phone number or bank account

@api_router.get("/organizer/finances")
async def get_organizer_finances(user: dict = Depends(get_organizer_user)):
    """Get financial summary for organizer"""
    # Get organizer's events
    events_query = {} if user.get("role") == "admin" else {"organizer_id": user["id"]}
    events = await db.events.find(events_query, {"_id": 0}).to_list(100)
    
    # Calculate total revenue
    total_revenue = 0
    for event in events:
        for tt in event.get("ticket_types", []):
            sold = tt.get("sold", 0)
            total_revenue += sold * tt["price"]
    
    commission = int(total_revenue * 0.08)
    net_revenue = total_revenue - commission
    
    # Get withdrawal history
    withdrawal_query = {} if user.get("role") == "admin" else {"organizer_id": user["id"]}
    withdrawals = await db.withdrawals.find(withdrawal_query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    total_withdrawn = sum(w["amount"] for w in withdrawals if w["status"] == "completed")
    pending_withdrawals = sum(w["amount"] for w in withdrawals if w["status"] == "pending")
    
    available_balance = net_revenue - total_withdrawn - pending_withdrawals
    
    return {
        "total_revenue": total_revenue,
        "commission": commission,
        "commission_rate": "8%",
        "net_revenue": net_revenue,
        "total_withdrawn": total_withdrawn,
        "pending_withdrawals": pending_withdrawals,
        "available_balance": available_balance,
        "withdrawals": withdrawals
    }

@api_router.post("/organizer/withdrawals")
async def request_withdrawal(data: WithdrawalRequest, user: dict = Depends(get_organizer_user)):
    """Request a withdrawal"""
    # Get available balance
    finances = await get_organizer_finances(user)
    
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Montant invalide")
    
    if data.amount > finances["available_balance"]:
        raise HTTPException(status_code=400, detail=f"Solde insuffisant. Disponible: {finances['available_balance']} DJF")
    
    if data.amount < 1000:
        raise HTTPException(status_code=400, detail="Retrait minimum: 1000 DJF")
    
    withdrawal_id = str(uuid.uuid4())
    withdrawal_doc = {
        "id": withdrawal_id,
        "organizer_id": user["id"],
        "organizer_name": user.get("full_name", ""),
        "amount": data.amount,
        "payment_method": data.payment_method,
        "account_info": data.account_info,
        "status": "pending",  # pending, processing, completed, rejected
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": None
    }
    await db.withdrawals.insert_one(withdrawal_doc)
    
    return {
        "message": "Demande de retrait soumise",
        "withdrawal_id": withdrawal_id,
        "amount": data.amount,
        "status": "pending",
        "estimated_processing": "24-48h"
    }

@api_router.get("/organizer/withdrawals")
async def get_withdrawals(user: dict = Depends(get_organizer_user)):
    """Get withdrawal history"""
    query = {} if user.get("role") == "admin" else {"organizer_id": user["id"]}
    withdrawals = await db.withdrawals.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return withdrawals

# ============== TRAIN BOOKING ==============

TRAIN_PRICES = {
    ("Nagad", "Holl-Holl"): 400,
    ("Nagad", "Ali-Sabieh"): 800,
    ("Nagad", "Dire-Dawa"): 3200,
    ("Holl-Holl", "Ali-Sabieh"): 400,
    ("Ali-Sabieh", "Holl-Holl"): 400,
    ("Ali-Sabieh", "Nagad"): 800,
    ("Holl-Holl", "Nagad"): 400,
}

@api_router.get("/train/trips")
async def get_train_trips(date: str):
    try:
        trip_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide")
    
    day_of_month = trip_date.day
    
    if day_of_month == 1:
        return {"date": date, "is_holiday": True, "message": "Jour férié - Pas de service", "trips": []}
    
    is_even_day = day_of_month % 2 == 0
    
    if is_even_day:
        trips = [
            {"departure": "Nagad", "arrival": "Holl-Holl", "price": 400, "departure_time": "06:00"},
            {"departure": "Nagad", "arrival": "Ali-Sabieh", "price": 800, "departure_time": "06:00"},
            {"departure": "Nagad", "arrival": "Dire-Dawa", "price": 3200, "departure_time": "06:00"},
            {"departure": "Holl-Holl", "arrival": "Ali-Sabieh", "price": 400, "departure_time": "08:00"},
        ]
    else:
        trips = [
            {"departure": "Ali-Sabieh", "arrival": "Holl-Holl", "price": 400, "departure_time": "06:00"},
            {"departure": "Ali-Sabieh", "arrival": "Nagad", "price": 800, "departure_time": "06:00"},
            {"departure": "Holl-Holl", "arrival": "Nagad", "price": 400, "departure_time": "08:00"},
        ]
    
    return {
        "date": date,
        "is_holiday": False,
        "is_even_day": is_even_day,
        "direction": "Nagad → Est" if is_even_day else "Ali-Sabieh → Ouest",
        "trips": trips
    }

@api_router.post("/train/book")
async def book_train(booking: TrainBookingRequest, user: dict = Depends(get_current_user)):
    try:
        trip_date = datetime.strptime(booking.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide")
    
    if trip_date.day == 1:
        raise HTTPException(status_code=400, detail="Jour férié - Pas de service")
    
    route_key = (booking.departure, booking.arrival)
    if route_key not in TRAIN_PRICES:
        raise HTTPException(status_code=400, detail="Trajet non disponible")
    
    price_per_person = TRAIN_PRICES[route_key]
    total_price = price_per_person * len(booking.passengers)
    
    tickets_created = []
    for passenger in booking.passengers:
        ticket_id = str(uuid.uuid4())
        qr_data = f"TRAIN-{ticket_id}"
        
        ticket_doc = {
            "id": ticket_id,
            "type": "train",
            "event_id": "train",
            "event_title": f"Train {booking.departure} → {booking.arrival}",
            "event_date": booking.date,
            "event_time": "06:00",
            "event_venue": f"Gare de {booking.departure}",
            "ticket_type": "Standard",
            "user_id": user["id"],
            "passenger_name": passenger.full_name,
            "passenger_phone": passenger.phone,
            "passenger_id": passenger.passport_or_cni,
            "qr_code_data": qr_data,
            "status": "valid",
            "price": price_per_person,
            "payment_method": booking.payment_method,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.tickets.insert_one(ticket_doc)
        tickets_created.append(ticket_doc)
    
    return {
        "message": "Réservation confirmée",
        "tickets": [{"id": t["id"], "passenger": t["passenger_name"]} for t in tickets_created],
        "total": total_price
    }

# ============== FERRY BOOKING ==============

# Default ferry schedule (used as fallback)
DEFAULT_FERRY_SCHEDULE = {
    1: {"route": "Djibouti-Tadjoura", "destinations": ["Djibouti", "Tadjoura"]},
    3: {"route": "Djibouti-Tadjoura", "destinations": ["Djibouti", "Tadjoura"]},
    4: {"route": "Djibouti-Tadjoura", "destinations": ["Djibouti", "Tadjoura"]},
    5: {"route": "Djibouti-Tadjoura", "destinations": ["Djibouti", "Tadjoura"]},
    6: {"route": "Djibouti-Obock", "destinations": ["Djibouti", "Obock"]},
    2: {"route": "Djibouti-Obock", "destinations": ["Djibouti", "Obock"]},
}

FERRY_PRICE = 700

# Day name to weekday number mapping
DAY_TO_WEEKDAY = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6
}

async def get_dynamic_ferry_schedule():
    """Get ferry schedule from database or return default"""
    settings = await db.settings.find_one({"type": "transport"}, {"_id": 0})
    if not settings or "ferry" not in settings:
        return None, None
    
    ferry = settings.get("ferry", {})
    detailed_schedule = ferry.get("detailed_schedule")
    default_departure = ferry.get("departure_time", "08:00")
    default_return = ferry.get("return_time", "12:00")
    
    if not detailed_schedule:
        return None, None
    
    # Convert detailed schedule to a lookup by weekday number
    schedule_by_weekday = {}
    for day_info in detailed_schedule:
        day_key = day_info.get("day", "").lower()
        weekday_num = DAY_TO_WEEKDAY.get(day_key)
        if weekday_num is not None:
            schedule_by_weekday[weekday_num] = {
                "active": day_info.get("active", False),
                "destination": day_info.get("destination"),
                "departure_time": day_info.get("departure_time") or default_departure,
                "return_time": day_info.get("return_time") or default_return
            }
    
    return detailed_schedule, schedule_by_weekday


@api_router.get("/ferry/schedule")
async def get_public_ferry_schedule():
    """Public endpoint to get ferry weekly schedule for customers"""
    detailed_schedule, _ = await get_dynamic_ferry_schedule()
    
    if detailed_schedule:
        return {"schedule": detailed_schedule, "source": "database"}
    
    # Fallback to default schedule
    day_labels = {
        "monday": "Lundi", "tuesday": "Mardi", "wednesday": "Mercredi",
        "thursday": "Jeudi", "friday": "Vendredi", "saturday": "Samedi", "sunday": "Dimanche"
    }
    
    fallback_schedule = [
        {"day": "monday", "day_label": "Lundi", "active": False, "destination": None, "departure_time": None, "return_time": None},
        {"day": "tuesday", "day_label": "Mardi", "active": True, "destination": "Tadjoura", "departure_time": "08:00", "return_time": "12:00"},
        {"day": "wednesday", "day_label": "Mercredi", "active": True, "destination": "Obock", "departure_time": "08:00", "return_time": "12:00"},
        {"day": "thursday", "day_label": "Jeudi", "active": True, "destination": "Tadjoura", "departure_time": "08:00", "return_time": "12:00"},
        {"day": "friday", "day_label": "Vendredi", "active": True, "destination": "Tadjoura", "departure_time": "08:00", "return_time": "12:00"},
        {"day": "saturday", "day_label": "Samedi", "active": True, "destination": "Tadjoura", "departure_time": "08:00", "return_time": "12:00"},
        {"day": "sunday", "day_label": "Dimanche", "active": True, "destination": "Obock", "departure_time": "08:00", "return_time": "12:00"},
    ]
    
    return {"schedule": fallback_schedule, "source": "default"}


@api_router.get("/ferry/trips")
async def get_ferry_trips(date: str):
    try:
        trip_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide")
    
    weekday = trip_date.weekday()
    _, schedule_by_weekday = await get_dynamic_ferry_schedule()
    
    # Use dynamic schedule if available
    if schedule_by_weekday and weekday in schedule_by_weekday:
        day_schedule = schedule_by_weekday[weekday]
        
        if not day_schedule.get("active"):
            return {"date": date, "has_service": False, "message": "Pas de service ce jour", "trips": []}
        
        destination = day_schedule.get("destination")
        if not destination:
            return {"date": date, "has_service": False, "message": "Destination non configurée", "trips": []}
        
        departure_time = day_schedule.get("departure_time", "08:00")
        return_time = day_schedule.get("return_time", "12:00")
        
        trips = [
            {"departure": "Djibouti", "arrival": destination, "trip_type": "aller", "departure_time": departure_time, "price": FERRY_PRICE},
            {"departure": destination, "arrival": "Djibouti", "trip_type": "retour", "departure_time": return_time, "price": FERRY_PRICE}
        ]
        
        return {"date": date, "has_service": True, "route": f"Djibouti-{destination}", "trips": trips}
    
    # Fallback to hardcoded schedule
    if weekday == 0:
        return {"date": date, "has_service": False, "message": "Pas de service le lundi", "trips": []}
    
    schedule = DEFAULT_FERRY_SCHEDULE.get(weekday)
    if not schedule:
        return {"date": date, "has_service": False, "message": "Pas de service", "trips": []}
    
    destinations = schedule["destinations"]
    trips = [
        {"departure": destinations[0], "arrival": destinations[1], "trip_type": "aller", "departure_time": "08:00", "price": FERRY_PRICE},
        {"departure": destinations[1], "arrival": destinations[0], "trip_type": "retour", "departure_time": "12:00", "price": FERRY_PRICE}
    ]
    
    return {"date": date, "has_service": True, "route": schedule["route"], "trips": trips}

@api_router.post("/ferry/book")
async def book_ferry(booking: FerryBookingRequest, user: dict = Depends(get_current_user)):
    try:
        trip_date = datetime.strptime(booking.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide")
    
    weekday = trip_date.weekday()
    _, schedule_by_weekday = await get_dynamic_ferry_schedule()
    
    # Check if day has service using dynamic schedule
    if schedule_by_weekday and weekday in schedule_by_weekday:
        day_schedule = schedule_by_weekday[weekday]
        if not day_schedule.get("active"):
            raise HTTPException(status_code=400, detail="Pas de service ce jour")
        departure_time = day_schedule.get("departure_time", "08:00") if booking.trip_type == "aller" else day_schedule.get("return_time", "12:00")
    else:
        # Fallback
        if weekday == 0 or weekday not in DEFAULT_FERRY_SCHEDULE:
            raise HTTPException(status_code=400, detail="Pas de service ce jour")
        departure_time = "08:00" if booking.trip_type == "aller" else "12:00"
    
    total_price = FERRY_PRICE * len(booking.passengers)
    
    tickets_created = []
    for passenger in booking.passengers:
        ticket_id = str(uuid.uuid4())
        qr_data = f"FERRY-{ticket_id}"
        
        ticket_doc = {
            "id": ticket_id,
            "type": "ferry",
            "event_id": "ferry",
            "event_title": f"Ferry {booking.departure} → {booking.arrival}",
            "event_date": booking.date,
            "event_time": departure_time,
            "event_venue": f"Port de {booking.departure}",
            "ticket_type": "Standard",
            "user_id": user["id"],
            "passenger_name": passenger.full_name,
            "passenger_phone": passenger.phone,
            "passenger_id": passenger.passport_or_cni,
            "qr_code_data": qr_data,
            "status": "valid",
            "price": FERRY_PRICE,
            "payment_method": booking.payment_method,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.tickets.insert_one(ticket_doc)
        tickets_created.append(ticket_doc)
    
    return {
        "message": "Réservation confirmée",
        "tickets": [{"id": t["id"], "passenger": t["passenger_name"]} for t in tickets_created],
        "total": total_price
    }

# ============== ADMIN ROUTES ==============

@api_router.get("/admin/stats")
async def get_admin_stats(admin: dict = Depends(get_admin_user)):
    total_tickets = await db.tickets.count_documents({})
    total_events = await db.events.count_documents({})
    total_users = await db.users.count_documents({"role": "user"})
    total_organizers = await db.users.count_documents({"role": "organizer"})
    
    tickets = await db.tickets.find({}, {"price": 1, "_id": 0}).to_list(10000)
    total_revenue = sum(t.get("price", 0) for t in tickets)
    commission = int(total_revenue * 0.08)
    
    pipeline = [
        {"$group": {"_id": "$event_title", "revenue": {"$sum": "$price"}, "count": {"$sum": 1}}}
    ]
    revenue_by_event = await db.tickets.aggregate(pipeline).to_list(100)
    
    return {
        "total_revenue": total_revenue,
        "commission": commission,
        "net_revenue": total_revenue - commission,
        "total_tickets_sold": total_tickets,
        "total_events": total_events,
        "total_users": total_users,
        "total_organizers": total_organizers,
        "revenue_by_event": revenue_by_event
    }

@api_router.post("/admin/scan")
async def admin_scan_ticket(qr_data: str, admin: dict = Depends(get_admin_user)):
    ticket_id = qr_data
    if qr_data.startswith("DBILLET-") or qr_data.startswith("TRAIN-") or qr_data.startswith("FERRY-"):
        ticket_id = qr_data.split("-", 1)[1]
    
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Billet non trouvé")
    
    if ticket["status"] == "used":
        raise HTTPException(status_code=400, detail="Ce billet a déjà été utilisé")
    
    await db.tickets.update_one({"id": ticket_id}, {"$set": {"status": "used", "used_at": datetime.now(timezone.utc).isoformat()}})
    
    return {
        "message": "Billet validé avec succès",
        "ticket": {
            "id": ticket["id"],
            "event_title": ticket["event_title"],
            "ticket_type": ticket.get("ticket_type", "Standard"),
            "passenger_name": ticket.get("passenger_name"),
            "status": "used"
        }
    }

# ============== ADMIN DASHBOARD ALERTS ==============

@api_router.get("/admin/alerts")
async def get_admin_alerts(admin: dict = Depends(get_admin_user)):
    """Get urgent alerts for admin dashboard"""
    # Pending event approvals
    pending_events = await db.events.count_documents({"status": "pending"})
    
    # Pending withdrawal requests
    pending_withdrawals = await db.withdrawals.count_documents({"status": "pending"})
    pending_withdrawals_amount = 0
    withdrawals = await db.withdrawals.find({"status": "pending"}, {"amount": 1, "_id": 0}).to_list(100)
    pending_withdrawals_amount = sum(w["amount"] for w in withdrawals)
    
    # Pending refund requests
    pending_refunds = await db.refunds.count_documents({"status": "pending"})
    
    return {
        "pending_events": pending_events,
        "pending_withdrawals": pending_withdrawals,
        "pending_withdrawals_amount": pending_withdrawals_amount,
        "pending_refunds": pending_refunds,
        "total_alerts": pending_events + pending_withdrawals + pending_refunds
    }

# ============== ADMIN EVENT MANAGEMENT ==============

@api_router.put("/admin/events/{event_id}/status")
async def update_event_status(
    event_id: str, 
    status: str = Query(..., regex="^(approved|pending|blocked)$"),
    admin: dict = Depends(get_admin_user)
):
    """Approve, block or set event to pending"""
    event = await db.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    await db.events.update_one(
        {"id": event_id}, 
        {"$set": {"status": status, "status_updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"Événement {status}", "event_id": event_id, "status": status}

@api_router.put("/admin/events/{event_id}/featured")
async def toggle_event_featured(
    event_id: str,
    featured: bool,
    admin: dict = Depends(get_admin_user)
):
    """Set event as featured (À la une) on homepage"""
    event = await db.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    await db.events.update_one({"id": event_id}, {"$set": {"featured": featured}})
    
    return {"message": "Événement mis à la une" if featured else "Événement retiré de la une", "event_id": event_id}

@api_router.get("/admin/events")
async def get_all_events_admin(admin: dict = Depends(get_admin_user)):
    """Get all events with admin details"""
    events = await db.events.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    result = []
    for event in events:
        # Get organizer info
        organizer = None
        if event.get("organizer_id"):
            organizer = await db.users.find_one({"id": event["organizer_id"]}, {"_id": 0, "hashed_password": 0})
        
        # Calculate tickets sold
        total = sum(tt["quantity"] for tt in event.get("ticket_types", []))
        sold = sum(tt.get("sold", 0) for tt in event.get("ticket_types", []))
        revenue = sum(tt.get("sold", 0) * tt["price"] for tt in event.get("ticket_types", []))
        
        result.append({
            **event,
            "total_tickets": total,
            "sold_tickets": sold,
            "revenue": revenue,
            "status": event.get("status", "approved"),
            "featured": event.get("featured", False),
            "organizer": organizer
        })
    
    return result

# ============== ADMIN USER MANAGEMENT ==============

@api_router.get("/admin/users")
async def get_all_users(
    admin: dict = Depends(get_admin_user),
    role: Optional[str] = None,
    search: Optional[str] = None
):
    """Get all users with filters"""
    query = {}
    if role:
        query["role"] = role
    
    users = await db.users.find(query, {"_id": 0, "hashed_password": 0}).sort("created_at", -1).to_list(1000)
    
    result = []
    for user in users:
        # Get user stats
        tickets_count = await db.tickets.count_documents({"user_id": user["id"]})
        tickets_total = 0
        user_tickets = await db.tickets.find({"user_id": user["id"]}, {"price": 1, "_id": 0}).to_list(1000)
        tickets_total = sum(t["price"] for t in user_tickets)
        
        user_data = {
            **user,
            "tickets_purchased": tickets_count,
            "total_spent": tickets_total
        }
        
        # Apply search filter
        if search:
            search_lower = search.lower()
            if not (
                search_lower in user.get("full_name", "").lower() or
                search_lower in user.get("email", "").lower() or
                search_lower in user.get("phone", "").lower() or
                search_lower in user.get("company_name", "").lower()
            ):
                continue
        
        result.append(user_data)
    
    return result

@api_router.get("/admin/users/{user_id}")
async def get_user_detail(user_id: str, admin: dict = Depends(get_admin_user)):
    """Get detailed user info with purchase history"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Get purchase history
    tickets = await db.tickets.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Get events if organizer
    events = []
    if user.get("role") == "organizer":
        events = await db.events.find({"organizer_id": user_id}, {"_id": 0}).to_list(100)
    
    return {
        **user,
        "purchase_history": tickets,
        "events": events
    }

@api_router.put("/admin/users/{user_id}/commission")
async def set_custom_commission(
    user_id: str,
    commission_rate: float = Query(..., ge=0, le=50),
    admin: dict = Depends(get_admin_user)
):
    """Set custom commission rate for an organizer"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    if user.get("role") != "organizer":
        raise HTTPException(status_code=400, detail="Seuls les organisateurs peuvent avoir une commission personnalisée")
    
    await db.users.update_one(
        {"id": user_id}, 
        {"$set": {"custom_commission": commission_rate}}
    )
    
    return {"message": f"Commission personnalisée définie à {commission_rate}%", "user_id": user_id}

# ============== ADMIN TRANSACTIONS ==============

@api_router.get("/admin/transactions")
async def get_all_transactions(
    admin: dict = Depends(get_admin_user),
    payment_method: Optional[str] = None,
    days: int = 30
):
    """Get all transactions/payments"""
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    query = {"created_at": {"$gte": start_date}}
    if payment_method:
        query["payment_method"] = payment_method
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrich with user info
    transactions = []
    for ticket in tickets:
        user = await db.users.find_one({"id": ticket["user_id"]}, {"_id": 0, "hashed_password": 0, "full_name": 1, "email": 1})
        transactions.append({
            "id": ticket["id"],
            "type": "ticket_purchase",
            "amount": ticket["price"],
            "payment_method": ticket.get("payment_method", "unknown"),
            "event_title": ticket["event_title"],
            "ticket_type": ticket.get("ticket_type", "Standard"),
            "buyer_name": user.get("full_name") if user else ticket.get("passenger_name", "Inconnu"),
            "buyer_email": user.get("email") if user else None,
            "status": ticket["status"],
            "created_at": ticket["created_at"]
        })
    
    # Get totals by payment method
    totals = {}
    for t in transactions:
        method = t["payment_method"]
        if method not in totals:
            totals[method] = {"count": 0, "amount": 0}
        totals[method]["count"] += 1
        totals[method]["amount"] += t["amount"]
    
    return {
        "transactions": transactions,
        "totals_by_method": totals,
        "total_count": len(transactions),
        "total_amount": sum(t["amount"] for t in transactions)
    }

# ============== ADMIN PAYOUTS (Withdrawal Management) ==============

@api_router.get("/admin/payouts")
async def get_all_payouts(
    admin: dict = Depends(get_admin_user),
    status: Optional[str] = None
):
    """Get all withdrawal requests"""
    query = {}
    if status:
        query["status"] = status
    
    withdrawals = await db.withdrawals.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Enrich with organizer info
    result = []
    for w in withdrawals:
        organizer = await db.users.find_one({"id": w["organizer_id"]}, {"_id": 0, "hashed_password": 0})
        result.append({
            **w,
            "organizer": organizer
        })
    
    return result

@api_router.put("/admin/payouts/{payout_id}/status")
async def update_payout_status(
    payout_id: str,
    status: str = Query(..., regex="^(pending|processing|completed|rejected)$"),
    admin: dict = Depends(get_admin_user),
    notes: Optional[str] = None
):
    """Approve or reject a withdrawal request"""
    withdrawal = await db.withdrawals.find_one({"id": payout_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Demande de retrait non trouvée")
    
    update_data = {
        "status": status,
        "processed_by": admin["id"],
        "processed_at": datetime.now(timezone.utc).isoformat()
    }
    if notes:
        update_data["admin_notes"] = notes
    
    await db.withdrawals.update_one({"id": payout_id}, {"$set": update_data})
    
    return {"message": f"Statut mis à jour: {status}", "payout_id": payout_id}

# ============== ADMIN REFUNDS ==============

@api_router.get("/admin/refunds")
async def get_refund_requests(admin: dict = Depends(get_admin_user)):
    """Get all refund requests"""
    refunds = await db.refunds.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return refunds

@api_router.post("/admin/refunds")
async def create_refund(
    ticket_id: str,
    reason: str,
    admin: dict = Depends(get_admin_user)
):
    """Create a refund for a ticket"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Billet non trouvé")
    
    refund_id = str(uuid.uuid4())
    refund_doc = {
        "id": refund_id,
        "ticket_id": ticket_id,
        "user_id": ticket["user_id"],
        "amount": ticket["price"],
        "reason": reason,
        "status": "completed",
        "processed_by": admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.refunds.insert_one(refund_doc)
    
    # Mark ticket as refunded
    await db.tickets.update_one({"id": ticket_id}, {"$set": {"status": "refunded"}})
    
    return {"message": "Remboursement effectué", "refund_id": refund_id, "amount": ticket["price"]}

# ============== ADMIN SETTINGS ==============

@api_router.get("/admin/settings")
async def get_platform_settings(admin: dict = Depends(get_admin_user)):
    """Get platform settings"""
    settings = await db.settings.find_one({"type": "platform"}, {"_id": 0})
    
    if not settings:
        # Default settings
        default_settings = {
            "type": "platform",
            "commission_rate": 8.0,
            "min_withdrawal": 1000,
            "categories": [
                {"id": "cinema", "name": "Cinéma", "color": "#FF0055", "active": True},
                {"id": "football", "name": "Football", "color": "#00FF94", "active": True},
                {"id": "concerts", "name": "Concerts", "color": "#7000FF", "active": True},
                {"id": "conferences", "name": "Conférences", "color": "#FF5C00", "active": True},
                {"id": "theatre", "name": "Théâtre", "color": "#00D4FF", "active": True},
                {"id": "formations", "name": "Formations", "color": "#FFD700", "active": True}
            ],
            "terms_content": "",
            "legal_content": "",
            "banner_text": "",
            "banner_active": False
        }
        await db.settings.insert_one(default_settings)
        settings = await db.settings.find_one({"type": "platform"}, {"_id": 0})
    
    return settings

@api_router.put("/admin/settings")
async def update_platform_settings(
    admin: dict = Depends(get_admin_user),
    commission_rate: Optional[float] = None,
    min_withdrawal: Optional[int] = None,
    terms_content: Optional[str] = None,
    legal_content: Optional[str] = None,
    banner_text: Optional[str] = None,
    banner_active: Optional[bool] = None
):
    """Update platform settings"""
    update_data = {}
    if commission_rate is not None:
        update_data["commission_rate"] = commission_rate
    if min_withdrawal is not None:
        update_data["min_withdrawal"] = min_withdrawal
    if terms_content is not None:
        update_data["terms_content"] = terms_content
    if legal_content is not None:
        update_data["legal_content"] = legal_content
    if banner_text is not None:
        update_data["banner_text"] = banner_text
    if banner_active is not None:
        update_data["banner_active"] = banner_active
    
    if update_data:
        await db.settings.update_one(
            {"type": "platform"},
            {"$set": update_data},
            upsert=True
        )
    
    return await get_platform_settings(admin)

@api_router.post("/admin/settings/categories")
async def add_category(
    name: str,
    color: str = "#00FF94",
    admin: dict = Depends(get_admin_user)
):
    """Add a new event category"""
    cat_id = name.lower().replace(" ", "_")
    
    await db.settings.update_one(
        {"type": "platform"},
        {"$push": {"categories": {"id": cat_id, "name": name, "color": color, "active": True}}},
        upsert=True
    )
    
    return {"message": "Catégorie ajoutée", "id": cat_id}

@api_router.delete("/admin/settings/categories/{cat_id}")
async def delete_category(cat_id: str, admin: dict = Depends(get_admin_user)):
    """Delete an event category"""
    await db.settings.update_one(
        {"type": "platform"},
        {"$pull": {"categories": {"id": cat_id}}}
    )
    return {"message": "Catégorie supprimée"}

# ============== ADMIN TRANSPORT SETTINGS (Train & Ferry) ==============

@api_router.get("/admin/transport/settings")
async def get_transport_settings(admin: dict = Depends(get_admin_user)):
    """Get train and ferry settings"""
    settings = await db.settings.find_one({"type": "transport"}, {"_id": 0})
    
    if not settings:
        default_transport = {
            "type": "transport",
            "train": {
                "active": True,
                "routes": [
                    {"from": "Nagad", "to": "Holl-Holl", "price": 400, "duration": "1h30"},
                    {"from": "Nagad", "to": "Ali-Sabieh", "price": 800, "duration": "3h"},
                    {"from": "Nagad", "to": "Dire-Dawa", "price": 3200, "duration": "8h"},
                    {"from": "Ali-Sabieh", "to": "Holl-Holl", "price": 400, "duration": "1h30"},
                    {"from": "Ali-Sabieh", "to": "Nagad", "price": 800, "duration": "3h"}
                ],
                "schedule": {
                    "even_days": {"departure": "Nagad", "destinations": ["Holl-Holl", "Ali-Sabieh", "Dire-Dawa"]},
                    "odd_days": {"departure": "Ali-Sabieh", "destinations": ["Holl-Holl", "Nagad"]},
                    "first_of_month": "holiday"
                },
                "departure_time": "06:00"
            },
            "ferry": {
                "active": True,
                "routes": [
                    {"from": "Djibouti", "to": "Tadjoura", "price": 700, "duration": "2h30"},
                    {"from": "Djibouti", "to": "Obock", "price": 700, "duration": "3h"},
                    {"from": "Tadjoura", "to": "Djibouti", "price": 700, "duration": "2h30"},
                    {"from": "Obock", "to": "Djibouti", "price": 700, "duration": "3h"}
                ],
                "schedule": {
                    "tuesday": "Tadjoura",
                    "wednesday": "Obock",
                    "thursday": "Tadjoura",
                    "friday": "Tadjoura",
                    "saturday": "Tadjoura",
                    "sunday": "Obock",
                    "monday": "closed"
                },
                "departure_time": "08:00",
                "return_time": "12:00"
            }
        }
        await db.settings.insert_one(default_transport)
        settings = await db.settings.find_one({"type": "transport"}, {"_id": 0})
    
    return settings

@api_router.put("/admin/transport/train")
async def update_train_settings(
    admin: dict = Depends(get_admin_user),
    active: Optional[bool] = None,
    departure_time: Optional[str] = None,
    routes: Optional[List[dict]] = None
):
    """Update train settings"""
    update_data = {}
    if active is not None:
        update_data["train.active"] = active
    if departure_time:
        update_data["train.departure_time"] = departure_time
    if routes:
        update_data["train.routes"] = routes
    
    if update_data:
        await db.settings.update_one(
            {"type": "transport"},
            {"$set": update_data},
            upsert=True
        )
    
    return await get_transport_settings(admin)

@api_router.put("/admin/transport/ferry")
async def update_ferry_settings(
    admin: dict = Depends(get_admin_user),
    active: Optional[bool] = None,
    departure_time: Optional[str] = None,
    return_time: Optional[str] = None,
    routes: Optional[List[dict]] = None
):
    """Update ferry settings"""
    update_data = {}
    if active is not None:
        update_data["ferry.active"] = active
    if departure_time:
        update_data["ferry.departure_time"] = departure_time
    if return_time:
        update_data["ferry.return_time"] = return_time
    if routes:
        update_data["ferry.routes"] = routes
    
    if update_data:
        await db.settings.update_one(
            {"type": "transport"},
            {"$set": update_data},
            upsert=True
        )
    
    return await get_transport_settings(admin)


# ============== FERRY WEEKLY SCHEDULE MANAGEMENT ==============

class FerryDaySchedule(BaseModel):
    day: str  # monday, tuesday, etc.
    active: bool
    destination: Optional[str] = None  # Tadjoura, Obock, or None if closed
    departure_time: Optional[str] = None  # e.g., "08:00"
    return_time: Optional[str] = None  # e.g., "12:00"

class FerryWeeklyScheduleUpdate(BaseModel):
    schedule: List[FerryDaySchedule]

@api_router.get("/admin/transport/ferry/schedule")
async def get_ferry_schedule(admin: dict = Depends(get_admin_user)):
    """Get the detailed weekly ferry schedule"""
    settings = await db.settings.find_one({"type": "transport"}, {"_id": 0})
    if not settings:
        await get_transport_settings(admin)
        settings = await db.settings.find_one({"type": "transport"}, {"_id": 0})
    
    ferry = settings.get("ferry", {})
    old_schedule = ferry.get("schedule", {})
    default_departure = ferry.get("departure_time", "08:00")
    default_return = ferry.get("return_time", "12:00")
    
    # Check if we have the new detailed schedule format
    detailed_schedule = ferry.get("detailed_schedule", None)
    
    if detailed_schedule:
        return {"schedule": detailed_schedule}
    
    # Convert old format to new detailed format
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    day_labels = {
        "monday": "Lundi", "tuesday": "Mardi", "wednesday": "Mercredi",
        "thursday": "Jeudi", "friday": "Vendredi", "saturday": "Samedi", "sunday": "Dimanche"
    }
    
    converted_schedule = []
    for day in days:
        dest = old_schedule.get(day, "closed")
        is_closed = dest == "closed"
        converted_schedule.append({
            "day": day,
            "day_label": day_labels[day],
            "active": not is_closed,
            "destination": None if is_closed else dest,
            "departure_time": None if is_closed else default_departure,
            "return_time": None if is_closed else default_return
        })
    
    return {"schedule": converted_schedule}

@api_router.put("/admin/transport/ferry/schedule")
async def update_ferry_schedule(
    data: FerryWeeklyScheduleUpdate,
    admin: dict = Depends(get_admin_user)
):
    """Update the detailed weekly ferry schedule"""
    day_labels = {
        "monday": "Lundi", "tuesday": "Mardi", "wednesday": "Mercredi",
        "thursday": "Jeudi", "friday": "Vendredi", "saturday": "Samedi", "sunday": "Dimanche"
    }
    
    # Build the detailed schedule with labels
    detailed_schedule = []
    old_format_schedule = {}
    
    for item in data.schedule:
        detailed_schedule.append({
            "day": item.day,
            "day_label": day_labels.get(item.day, item.day),
            "active": item.active,
            "destination": item.destination if item.active else None,
            "departure_time": item.departure_time if item.active else None,
            "return_time": item.return_time if item.active else None
        })
        # Also update old format for backward compatibility
        old_format_schedule[item.day] = item.destination if item.active and item.destination else "closed"
    
    await db.settings.update_one(
        {"type": "transport"},
        {"$set": {
            "ferry.detailed_schedule": detailed_schedule,
            "ferry.schedule": old_format_schedule
        }},
        upsert=True
    )
    
    return {"message": "Planning Ferry mis à jour", "schedule": detailed_schedule}

# ============== TRAIN ROUTE MANAGEMENT ==============

class RouteCreate(BaseModel):
    from_station: str
    to_station: str
    price: int
    duration: str

@api_router.post("/admin/transport/train/routes")
async def add_train_route(route: RouteCreate, admin: dict = Depends(get_admin_user)):
    """Add a new train route"""
    settings = await db.settings.find_one({"type": "transport"})
    if not settings:
        await get_transport_settings(admin)  # Initialize settings
        settings = await db.settings.find_one({"type": "transport"})
    
    new_route = {
        "from": route.from_station,
        "to": route.to_station,
        "price": route.price,
        "duration": route.duration
    }
    
    await db.settings.update_one(
        {"type": "transport"},
        {"$push": {"train.routes": new_route}}
    )
    
    return {"message": "Trajet ajouté", "route": new_route}

@api_router.delete("/admin/transport/train/routes/{route_index}")
async def delete_train_route(route_index: int, admin: dict = Depends(get_admin_user)):
    """Delete a train route by index"""
    settings = await db.settings.find_one({"type": "transport"})
    if not settings or "train" not in settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    
    routes = settings["train"].get("routes", [])
    if route_index < 0 or route_index >= len(routes):
        raise HTTPException(status_code=400, detail="Index de trajet invalide")
    
    deleted_route = routes[route_index]
    routes.pop(route_index)
    
    await db.settings.update_one(
        {"type": "transport"},
        {"$set": {"train.routes": routes}}
    )
    
    return {"message": "Trajet supprimé", "deleted": deleted_route}

@api_router.put("/admin/transport/train/routes/{route_index}")
async def update_train_route(
    route_index: int, 
    route: RouteCreate, 
    admin: dict = Depends(get_admin_user)
):
    """Update a train route by index"""
    settings = await db.settings.find_one({"type": "transport"})
    if not settings or "train" not in settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    
    routes = settings["train"].get("routes", [])
    if route_index < 0 or route_index >= len(routes):
        raise HTTPException(status_code=400, detail="Index de trajet invalide")
    
    updated_route = {
        "from": route.from_station,
        "to": route.to_station,
        "price": route.price,
        "duration": route.duration
    }
    routes[route_index] = updated_route
    
    await db.settings.update_one(
        {"type": "transport"},
        {"$set": {"train.routes": routes}}
    )
    
    return {"message": "Trajet modifié", "route": updated_route}

# ============== FERRY ROUTE MANAGEMENT ==============

@api_router.post("/admin/transport/ferry/routes")
async def add_ferry_route(route: RouteCreate, admin: dict = Depends(get_admin_user)):
    """Add a new ferry route"""
    settings = await db.settings.find_one({"type": "transport"})
    if not settings:
        await get_transport_settings(admin)
        settings = await db.settings.find_one({"type": "transport"})
    
    new_route = {
        "from": route.from_station,
        "to": route.to_station,
        "price": route.price,
        "duration": route.duration
    }
    
    await db.settings.update_one(
        {"type": "transport"},
        {"$push": {"ferry.routes": new_route}}
    )
    
    return {"message": "Trajet ajouté", "route": new_route}

@api_router.delete("/admin/transport/ferry/routes/{route_index}")
async def delete_ferry_route(route_index: int, admin: dict = Depends(get_admin_user)):
    """Delete a ferry route by index"""
    settings = await db.settings.find_one({"type": "transport"})
    if not settings or "ferry" not in settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    
    routes = settings["ferry"].get("routes", [])
    if route_index < 0 or route_index >= len(routes):
        raise HTTPException(status_code=400, detail="Index de trajet invalide")
    
    deleted_route = routes[route_index]
    routes.pop(route_index)
    
    await db.settings.update_one(
        {"type": "transport"},
        {"$set": {"ferry.routes": routes}}
    )
    
    return {"message": "Trajet supprimé", "deleted": deleted_route}

@api_router.put("/admin/transport/ferry/routes/{route_index}")
async def update_ferry_route(
    route_index: int, 
    route: RouteCreate, 
    admin: dict = Depends(get_admin_user)
):
    """Update a ferry route by index"""
    settings = await db.settings.find_one({"type": "transport"})
    if not settings or "ferry" not in settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    
    routes = settings["ferry"].get("routes", [])
    if route_index < 0 or route_index >= len(routes):
        raise HTTPException(status_code=400, detail="Index de trajet invalide")
    
    updated_route = {
        "from": route.from_station,
        "to": route.to_station,
        "price": route.price,
        "duration": route.duration
    }
    routes[route_index] = updated_route
    
    await db.settings.update_one(
        {"type": "transport"},
        {"$set": {"ferry.routes": routes}}
    )
    
    return {"message": "Trajet modifié", "route": updated_route}

# ============== TESTIMONIALS & NEWS ==============

@api_router.get("/testimonials")
async def get_testimonials():
    testimonials = await db.testimonials.find({}, {"_id": 0}).to_list(20)
    if not testimonials:
        # Return default testimonials
        return [
            {
                "id": "1",
                "author_name": "Abdourahman Hassan",
                "author_role": "Fan de Football",
                "content": "J'ai acheté mes billets pour le match AS Djibouti en 2 minutes! Plus besoin de faire la queue au stade. Service excellent!",
                "rating": 5,
                "avatar_url": None
            },
            {
                "id": "2",
                "author_name": "Fatouma Ali",
                "author_role": "Mélomane",
                "content": "Le concert au Kempinski était incroyable et l'achat des billets sur D-Billet était super simple. Je recommande!",
                "rating": 5,
                "avatar_url": None
            },
            {
                "id": "3",
                "author_name": "Mohamed Ismail",
                "author_role": "Voyageur régulier",
                "content": "Pour mes trajets en train vers Ali-Sabieh, D-Billet m'a simplifié la vie. Le QR code fonctionne parfaitement.",
                "rating": 4,
                "avatar_url": None
            }
        ]
    return testimonials

@api_router.post("/testimonials")
async def create_testimonial(data: TestimonialCreate, admin: dict = Depends(get_admin_user)):
    testimonial_id = str(uuid.uuid4())
    doc = {
        "id": testimonial_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.testimonials.insert_one(doc)
    return doc

@api_router.get("/news")
async def get_news():
    news = await db.news.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)
    if not news:
        return [
            {
                "id": "1",
                "title": "Lancement de D-Billet",
                "excerpt": "La première plateforme de billetterie 100% djiboutienne est maintenant disponible!",
                "content": "D-Billet révolutionne l'achat de billets à Djibouti...",
                "image_url": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400",
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": "2",
                "title": "Nouveaux événements ce mois",
                "excerpt": "Découvrez les concerts et matchs de football à venir",
                "content": "Ce mois-ci, ne manquez pas les événements exceptionnels...",
                "image_url": "https://images.unsplash.com/photo-1639323252699-23cd48cccea6?w=400",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
    return news

@api_router.post("/news")
async def create_news(data: NewsCreate, admin: dict = Depends(get_admin_user)):
    news_id = str(uuid.uuid4())
    doc = {
        "id": news_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.news.insert_one(doc)
    return doc

# ============== TERMS ==============

@api_router.get("/terms")
async def get_terms():
    return {
        "title": "Conditions Générales d'Utilisation",
        "last_updated": "2025-02-01",
        "content": """
# Conditions Générales d'Utilisation de D-Billet

## 1. Objet
Les présentes conditions générales régissent l'utilisation de la plateforme D-Billet, service de billetterie en ligne pour les événements et transports à Djibouti.

## 2. Inscription et Compte
- L'utilisateur doit fournir des informations exactes lors de l'inscription.
- La vérification par OTP est requise pour les inscriptions par téléphone.
- L'utilisateur est responsable de la confidentialité de ses identifiants.

## 3. Achat de Billets
- Tous les prix sont exprimés en Francs Djiboutiens (DJF).
- Les billets sont nominatifs et non remboursables sauf annulation de l'événement.
- Un QR code unique est généré pour chaque billet.

## 4. Validation des Billets
- Présentez votre QR code à l'entrée de l'événement.
- Un billet ne peut être utilisé qu'une seule fois.
- Toute tentative de fraude entraînera l'annulation du billet.

## 5. Transport (Train et Ferry)
- Les réservations sont soumises aux horaires et disponibilités.
- Une pièce d'identité valide est requise pour le transport.
- Les conditions de chaque transporteur s'appliquent.

## 6. Codes Promo
- Les codes promotionnels sont soumis à conditions.
- Non cumulables sauf mention contraire.
- D-Billet se réserve le droit de modifier ou annuler les promotions.

## 7. Responsabilité
- D-Billet agit en tant qu'intermédiaire entre les organisateurs et les acheteurs.
- La responsabilité de l'organisation des événements incombe aux organisateurs.

## 8. Contact
Pour toute question: support@dbillet.dj | WhatsApp: +253 77 00 00 01
        """
    }

# ============== SEED DATA ==============

@api_router.post("/seed")
async def seed_database():
    existing = await db.events.count_documents({})
    if existing > 0:
        return {"message": "Base de données déjà initialisée"}
    
    # Create admin
    admin_id = str(uuid.uuid4())
    admin_doc = {
        "id": admin_id,
        "email": "admin@dbillet.dj",
        "phone": "+25377000001",
        "full_name": "Admin D-Billet",
        "hashed_password": hash_password("admin123"),
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin_doc)
    
    # Create sample organizer
    org_id = str(uuid.uuid4())
    org_doc = {
        "id": org_id,
        "email": "organizer@dbillet.dj",
        "phone": "+25377000002",
        "full_name": "Organisateur Demo",
        "company_name": "Events Djibouti",
        "hashed_password": hash_password("organizer123"),
        "role": "organizer",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(org_doc)
    
    # Sample events with multiple ticket types
    events = [
        {
            "id": str(uuid.uuid4()),
            "title": "Djibouti Music Festival 2025",
            "description": "Le plus grand festival de musique de Djibouti avec des artistes locaux et internationaux.",
            "category": "concerts",
            "venue": "Kempinski Palace Djibouti",
            "date": "2025-02-14",
            "time": "20:00",
            "image_url": "https://images.unsplash.com/photo-1639323252699-23cd48cccea6?w=800",
            "organizer_id": org_id,
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Early Bird", "price": 3500, "quantity": 100, "sold": 85, "description": "Tarif réduit - Offre limitée", "max_per_order": 4, "group_size": 1},
                {"id": str(uuid.uuid4()), "name": "Standard", "price": 5000, "quantity": 300, "sold": 150, "description": "Accès général", "max_per_order": 10, "group_size": 1},
                {"id": str(uuid.uuid4()), "name": "VIP", "price": 15000, "quantity": 50, "sold": 20, "description": "Zone VIP + Boissons incluses", "max_per_order": 4, "group_size": 1},
                {"id": str(uuid.uuid4()), "name": "Groupe (5 pers.)", "price": 20000, "quantity": 20, "sold": 5, "description": "Pack pour 5 personnes", "max_per_order": 2, "group_size": 5},
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "AS Djibouti vs Arta Solar - Finale",
            "description": "Match de championnat national - Grande Finale!",
            "category": "football",
            "venue": "Stade Hassan Gouled Aptidon",
            "date": "2025-02-20",
            "time": "16:00",
            "image_url": "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
            "organizer_id": org_id,
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Tribune", "price": 1000, "quantity": 3000, "sold": 2850, "description": "Places en tribune", "max_per_order": 10, "group_size": 1},
                {"id": str(uuid.uuid4()), "name": "Pelouse VIP", "price": 3000, "quantity": 200, "sold": 180, "description": "Vue premium au bord du terrain", "max_per_order": 6, "group_size": 1},
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Tech Summit Djibouti 2025",
            "description": "Conférence sur l'innovation numérique et l'entrepreneuriat.",
            "category": "conferences",
            "venue": "Djibouti Palace Kempinski",
            "date": "2025-03-15",
            "time": "09:00",
            "image_url": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800",
            "organizer_id": org_id,
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Standard", "price": 7500, "quantity": 150, "sold": 45, "description": "Accès conférence", "max_per_order": 5, "group_size": 1},
                {"id": str(uuid.uuid4()), "name": "Premium", "price": 15000, "quantity": 50, "sold": 10, "description": "Accès + Networking VIP", "max_per_order": 3, "group_size": 1},
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Avant-Première: Mission Impossible 8",
            "description": "Soyez les premiers à voir le nouveau Mission Impossible!",
            "category": "cinema",
            "venue": "Cinéma Le Paris",
            "date": "2025-02-28",
            "time": "19:30",
            "image_url": "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800",
            "organizer_id": org_id,
            "ticket_types": [
                {"id": str(uuid.uuid4()), "name": "Standard", "price": 2000, "quantity": 180, "sold": 160, "description": "Place standard", "max_per_order": 6, "group_size": 1},
                {"id": str(uuid.uuid4()), "name": "VIP Lounge", "price": 5000, "quantity": 20, "sold": 18, "description": "Sièges premium + Popcorn", "max_per_order": 4, "group_size": 1},
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.events.insert_many(events)
    
    # Create sample promo code
    promo_doc = {
        "id": str(uuid.uuid4()),
        "code": "DJIB20",
        "discount_type": "percentage",
        "discount_value": 20,
        "max_uses": 100,
        "uses": 0,
        "event_id": None,
        "organizer_id": org_id,
        "total_sales": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.promo_codes.insert_one(promo_doc)
    
    return {
        "message": "Base de données initialisée",
        "admin_email": "admin@dbillet.dj",
        "admin_password": "admin123",
        "organizer_email": "organizer@dbillet.dj",
        "organizer_password": "organizer123",
        "promo_code": "DJIB20"
    }

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
