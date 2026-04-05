"""
Authentication routes - Phone login + Google OAuth (no OTP)
"""
from fastapi import APIRouter, HTTPException, Depends, Response, Request, Cookie
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import httpx

from config import db
from models import (
    UserRegister, UserLogin,
    UserResponse, TokenResponse
)
from services import (
    verify_password, hash_password, create_access_token,
    get_current_user
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


class PhoneLoginRequest(BaseModel):
    phone: str
    full_name: Optional[str] = None


class GuestCheckoutRequest(BaseModel):
    phone: str
    full_name: str


class GoogleSessionRequest(BaseModel):
    session_id: str


# ============== STANDARD AUTH ==============

@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    """Register with email/phone and password"""
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
    """Login with email/phone and password"""
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


@router.post("/phone-login", response_model=TokenResponse)
async def phone_login(data: PhoneLoginRequest):
    """Quick login/register with phone number only (no OTP)"""
    user = await db.users.find_one({"phone": data.phone})
    
    if not user:
        user_id = str(uuid.uuid4())
        full_name = data.full_name or f"Utilisateur {data.phone[-4:]}"
        user = {
            "id": user_id,
            "phone": data.phone,
            "full_name": full_name,
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


# ============== GUEST CHECKOUT ==============

@router.post("/guest-session")
async def create_guest_session(data: GuestCheckoutRequest):
    """Create a guest session for checkout without full registration"""
    existing = await db.users.find_one({"phone": data.phone})
    
    if existing:
        token = create_access_token({"sub": existing["id"], "guest": False})
        return {
            "token": token,
            "user_id": existing["id"],
            "full_name": existing["full_name"],
            "phone": data.phone,
            "is_new": False,
            "message": "Compte existant trouve"
        }
    
    guest_id = str(uuid.uuid4())
    guest_doc = {
        "id": guest_id,
        "phone": data.phone,
        "full_name": data.full_name,
        "role": "guest",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(guest_doc)
    
    token = create_access_token({"sub": guest_id, "guest": True})
    return {
        "token": token,
        "user_id": guest_id,
        "full_name": data.full_name,
        "phone": data.phone,
        "is_new": True,
        "message": "Session invitee creee"
    }


# ============== GOOGLE OAUTH ==============

@router.post("/google/session")
async def exchange_google_session(data: GoogleSessionRequest, response: Response):
    """
    Exchange Google OAuth session_id for user data and set session cookie.
    REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    """
    try:
        async with httpx.AsyncClient() as client:
            result = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": data.session_id}
            )
            
            if result.status_code != 200:
                raise HTTPException(status_code=401, detail="Session Google invalide")
            
            google_data = result.json()
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Erreur authentification Google: {str(e)}")
    
    # Extract user data from Google
    email = google_data.get("email")
    name = google_data.get("name", "Utilisateur")
    picture = google_data.get("picture")
    session_token = google_data.get("session_token")
    
    if not email or not session_token:
        raise HTTPException(status_code=400, detail="Donnees Google incompletes")
    
    # Find or create user
    user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if not user:
        user_id = str(uuid.uuid4())
        user = {
            "id": user_id,
            "email": email,
            "full_name": name,
            "picture": picture,
            "role": "user",
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user)
    else:
        user_id = user["id"]
        # Update name and picture if changed
        if user.get("full_name") != name or user.get("picture") != picture:
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"full_name": name, "picture": picture}}
            )
            user["full_name"] = name
            user["picture"] = picture
    
    # Store session in database
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    # Set httpOnly cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60  # 7 days
    )
    
    # Also create JWT token for compatibility
    jwt_token = create_access_token({"sub": user_id})
    
    return {
        "message": "Connexion Google reussie",
        "token": jwt_token,
        "user": {
            "id": user_id,
            "email": email,
            "full_name": name,
            "picture": picture,
            "role": user.get("role", "user")
        }
    }


@router.get("/me")
async def get_me(
    request: Request,
    session_token: Optional[str] = Cookie(default=None)
):
    """Get current user from session cookie or Authorization header"""
    # Try session cookie first
    if session_token:
        session = await db.user_sessions.find_one(
            {"session_token": session_token},
            {"_id": 0}
        )
        
        if session:
            expires_at = session.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            if expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one(
                    {"id": session["user_id"]},
                    {"_id": 0, "hashed_password": 0}
                )
                if user:
                    return UserResponse(
                        id=user["id"],
                        email=user.get("email"),
                        phone=user.get("phone"),
                        full_name=user["full_name"],
                        role=user.get("role", "user")
                    )
    
    # Try Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            from jose import jwt
            from config import SECRET_KEY, ALGORITHM
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            if user_id:
                user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
                if user:
                    return UserResponse(
                        id=user["id"],
                        email=user.get("email"),
                        phone=user.get("phone"),
                        full_name=user["full_name"],
                        role=user.get("role", "user")
                    )
        except Exception:
            pass
    
    raise HTTPException(status_code=401, detail="Non authentifie")


@router.post("/logout")
async def logout(
    response: Response,
    session_token: Optional[str] = Cookie(default=None)
):
    """Logout and clear session"""
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )
    
    return {"message": "Deconnexion reussie"}
