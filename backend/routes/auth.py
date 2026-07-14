"""
Authentication routes - Phone login + Google OAuth (no OTP)
"""
from fastapi import APIRouter, HTTPException, Depends, Response, Request, Cookie
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import httpx
from urllib.parse import urlencode, urlsplit, urlunsplit

try:
    from google.auth.transport.requests import Request as GoogleRequest
    from google.oauth2 import id_token as google_id_token
except ImportError:
    GoogleRequest = None
    google_id_token = None

from fastapi.responses import RedirectResponse

from config import db, FRONTEND_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
from models import (
    UserRegister, UserLogin,
    UserResponse, TokenResponse
)
from services import (
    verify_password, hash_password, create_access_token, decode_token,
    get_current_user, rate_limited,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


class PhoneLoginRequest(BaseModel):
    phone: str
    full_name: Optional[str] = None


class GuestCheckoutRequest(BaseModel):
    phone: str
    full_name: str


# ============== STANDARD AUTH ==============

GOOGLE_SCOPES = "openid email profile"
GOOGLE_STATE_TTL_MINUTES = 10


def _is_google_auth_enabled() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)


def _default_auth_redirect() -> str:
    return f"{FRONTEND_URL}/auth"


def _normalize_frontend_redirect(redirect_to: Optional[str]) -> str:
    default_redirect = _default_auth_redirect()
    if not redirect_to:
        return default_redirect

    target = urlsplit(redirect_to)
    frontend = urlsplit(FRONTEND_URL)

    if not target.scheme or not target.netloc:
        return default_redirect

    if (target.scheme, target.netloc) != (frontend.scheme, frontend.netloc):
        return default_redirect

    return urlunsplit((
        target.scheme,
        target.netloc,
        target.path or "/auth",
        target.query,
        "",
    ))


def _redirect_with_fragment(redirect_to: str, **fragment_values: str) -> str:
    clean_values = {
        key: value
        for key, value in fragment_values.items()
        if value is not None and value != ""
    }
    parsed = urlsplit(redirect_to)
    return urlunsplit((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.query,
        urlencode(clean_values),
    ))


async def _upsert_google_user(email: str, name: str, picture: Optional[str]):
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
        return user

    updates = {}
    if user.get("full_name") != name:
        updates["full_name"] = name
    if user.get("picture") != picture:
        updates["picture"] = picture
    if user.get("auth_provider") != "google":
        updates["auth_provider"] = "google"

    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
        user.update(updates)

    return user

@router.post(
    "/register",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limited("register", max_calls=5, period_seconds=300))],
)
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


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limited("login", max_calls=10, period_seconds=60))],
)
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


@router.post(
    "/phone-login",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limited("phone-login", max_calls=10, period_seconds=60))],
)
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

@router.get("/google/status")
async def google_auth_status():
    """Expose whether Google OAuth is configured for the current environment."""
    return {"enabled": _is_google_auth_enabled()}


@router.get("/google/login")
async def start_google_login(request: Request, redirect_to: Optional[str] = None):
    """Start a standard Google OAuth 2.0 login flow."""
    if not _is_google_auth_enabled():
        raise HTTPException(
            status_code=503,
            detail="Connexion Google non configuree pour cet environnement",
        )

    callback_url = str(request.url_for("google_callback"))
    redirect_target = _normalize_frontend_redirect(redirect_to)
    state_id = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=GOOGLE_STATE_TTL_MINUTES)

    await db.oauth_states.insert_one({
        "id": state_id,
        "provider": "google",
        "redirect_to": redirect_target,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat(),
    })

    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": GOOGLE_SCOPES,
        "state": state_id,
        "prompt": "select_account",
    })

    return RedirectResponse(auth_url, status_code=302)


@router.get("/google/callback", name="google_callback")
async def google_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
):
    """Finish the Google OAuth flow, mint a JWT, and redirect back to the frontend."""
    redirect_target = _default_auth_redirect()

    if state:
        state_doc = await db.oauth_states.find_one({"id": state}, {"_id": 0})
        if state_doc:
            await db.oauth_states.delete_one({"id": state})
            redirect_target = _normalize_frontend_redirect(state_doc.get("redirect_to"))
            expires_at = state_doc.get("expires_at")
            if expires_at:
                expires_at_dt = datetime.fromisoformat(expires_at)
                if expires_at_dt.tzinfo is None:
                    expires_at_dt = expires_at_dt.replace(tzinfo=timezone.utc)
                if expires_at_dt <= datetime.now(timezone.utc):
                    return RedirectResponse(
                        _redirect_with_fragment(
                            redirect_target,
                            google_error="state_expired",
                        ),
                        status_code=302,
                    )
        else:
            return RedirectResponse(
                _redirect_with_fragment(
                    redirect_target,
                    google_error="invalid_state",
                ),
                status_code=302,
            )

    if error:
        return RedirectResponse(
            _redirect_with_fragment(redirect_target, google_error=error),
            status_code=302,
        )

    if not state:
        return RedirectResponse(
            _redirect_with_fragment(redirect_target, google_error="missing_state"),
            status_code=302,
        )

    if not code:
        return RedirectResponse(
            _redirect_with_fragment(redirect_target, google_error="missing_code"),
            status_code=302,
        )

    if not _is_google_auth_enabled() or GoogleRequest is None or google_id_token is None:
        return RedirectResponse(
            _redirect_with_fragment(
                redirect_target,
                google_error="google_not_configured",
            ),
            status_code=302,
        )

    callback_url = str(request.url_for("google_callback"))

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": callback_url,
                    "grant_type": "authorization_code",
                },
            )
    except Exception:
        return RedirectResponse(
            _redirect_with_fragment(
                redirect_target,
                google_error="token_exchange_failed",
            ),
            status_code=302,
        )

    if token_response.status_code != 200:
        return RedirectResponse(
            _redirect_with_fragment(
                redirect_target,
                google_error="token_exchange_failed",
            ),
            status_code=302,
        )

    token_data = token_response.json()
    raw_id_token = token_data.get("id_token")
    if not raw_id_token:
        return RedirectResponse(
            _redirect_with_fragment(
                redirect_target,
                google_error="missing_id_token",
            ),
            status_code=302,
        )

    try:
        google_data = google_id_token.verify_oauth2_token(
            raw_id_token,
            GoogleRequest(),
            GOOGLE_CLIENT_ID,
        )
    except Exception:
        return RedirectResponse(
            _redirect_with_fragment(
                redirect_target,
                google_error="invalid_google_token",
            ),
            status_code=302,
        )

    email = google_data.get("email")
    email_verified = google_data.get("email_verified", False)
    name = google_data.get("name", "Utilisateur")
    picture = google_data.get("picture")

    if not email or not email_verified:
        return RedirectResponse(
            _redirect_with_fragment(
                redirect_target,
                google_error="google_email_not_verified",
            ),
            status_code=302,
        )

    user = await _upsert_google_user(email, name, picture)
    user_id = user["id"]

    session_token = str(uuid.uuid4())
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

    jwt_token = create_access_token({"sub": user_id})
    redirect_response = RedirectResponse(
        _redirect_with_fragment(
            redirect_target,
            token=jwt_token,
            provider="google",
        ),
        status_code=302,
    )

    secure_cookie = request.url.scheme == "https"
    redirect_response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=secure_cookie,
        samesite="none" if secure_cookie else "lax",
        path="/",
        max_age=7 * 24 * 60 * 60,
    )

    return redirect_response


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
            payload = decode_token(token)
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
