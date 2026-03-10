"""
Authentication routes
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
import uuid

from config import db, otp_storage
from models import (
    UserRegister, UserLogin, PhoneOTPRequest, PhoneOTPVerify,
    UserResponse, TokenResponse
)
from services import (
    verify_password, hash_password, create_access_token,
    generate_otp, get_current_user
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    query = {}
    if user_data.email:
        query["email"] = user_data.email
    elif user_data.phone:
        query["phone"] = user_data.phone
    else:
        raise HTTPException(status_code=400, detail="Email ou telephone requis")
    
    existing = await db.users.find_one(query)
    if existing:
        raise HTTPException(status_code=400, detail="Cet identifiant est deja utilise")
    
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


@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    query = {}
    if user_data.email:
        query["email"] = user_data.email
    elif user_data.phone:
        query["phone"] = user_data.phone
    else:
        raise HTTPException(status_code=400, detail="Email ou telephone requis")
    
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


@router.post("/otp/send")
async def send_otp(data: PhoneOTPRequest):
    """Send OTP to phone number (SIMULATED)"""
    otp = generate_otp()
    otp_storage[data.phone] = {
        "otp": otp,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=5)
    }
    
    return {
        "message": "Code OTP envoye",
        "phone": data.phone,
        "otp_simulation": otp,
        "expires_in": 300
    }


@router.post("/otp/verify", response_model=TokenResponse)
async def verify_otp(data: PhoneOTPVerify):
    """Verify OTP and login/register user"""
    stored = otp_storage.get(data.phone)
    if not stored:
        raise HTTPException(status_code=400, detail="Code OTP non trouve. Demandez un nouveau code.")
    
    if datetime.now(timezone.utc) > stored["expires"]:
        del otp_storage[data.phone]
        raise HTTPException(status_code=400, detail="Code OTP expire")
    
    if stored["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Code OTP invalide")
    
    del otp_storage[data.phone]
    
    user = await db.users.find_one({"phone": data.phone})
    if not user:
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


@router.get("/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        email=user.get("email"),
        phone=user.get("phone"),
        full_name=user["full_name"],
        role=user.get("role", "user")
    )
