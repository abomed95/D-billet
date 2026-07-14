"""
Authentication services - Secure implementation
"""
import base64
import binascii
import hashlib
import hmac
import json
import secrets
import string
from datetime import datetime, timezone, timedelta
import bcrypt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

try:
    from jose import JWTError, jwt
except ImportError:
    jwt = None

    class JWTError(Exception):
        """Fallback JWT decode error when python-jose is unavailable."""

from config import (
    db, pwd_context, SECRET_KEY, ALGORITHM,
    ACCESS_TOKEN_EXPIRE_DAYS, STAFF_TOKEN_EXPIRE_HOURS
)

security = HTTPBearer()


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(raw: str) -> bytes:
    padding = "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode((raw + padding).encode("ascii"))


def _json_default(value):
    if isinstance(value, datetime):
        return int(value.timestamp())
    return value


def _fallback_jwt_encode(payload: dict) -> str:
    header = {"alg": ALGORITHM, "typ": "JWT"}
    encoded_header = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    encoded_payload = _b64url_encode(json.dumps(payload, separators=(",", ":"), default=_json_default).encode("utf-8"))
    signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")
    signature = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{encoded_header}.{encoded_payload}.{_b64url_encode(signature)}"


def _fallback_jwt_decode(token: str) -> dict:
    try:
        encoded_header, encoded_payload, encoded_signature = token.split(".")
        signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")
        expected_signature = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
        actual_signature = _b64url_decode(encoded_signature)
        if not hmac.compare_digest(expected_signature, actual_signature):
            raise JWTError("Signature invalide")

        header = json.loads(_b64url_decode(encoded_header).decode("utf-8"))
        if header.get("alg") != ALGORITHM:
            raise JWTError("Algorithme invalide")

        payload = json.loads(_b64url_decode(encoded_payload).decode("utf-8"))
        exp = payload.get("exp")
        if exp is not None:
            expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
            if expires_at <= datetime.now(timezone.utc):
                raise JWTError("Token expire")
        return payload
    except (ValueError, TypeError, json.JSONDecodeError, binascii.Error) as exc:
        raise JWTError("Token invalide") from exc


def decode_token(token: str) -> dict:
    if jwt is not None:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return _fallback_jwt_decode(token)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if pwd_context is not None:
        return pwd_context.verify(plain_password, hashed_password)
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def hash_password(password: str) -> str:
    if pwd_context is not None:
        return pwd_context.hash(password)
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    if jwt is not None:
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return _fallback_jwt_encode(to_encode)


def create_staff_token(data: dict) -> str:
    """Create JWT token for staff with 24h expiration"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=STAFF_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire, "type": "staff"})
    if jwt is not None:
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return _fallback_jwt_encode(to_encode)


def generate_otp() -> str:
    """Generate secure 6-digit OTP using secrets module"""
    return str(secrets.randbelow(900000) + 100000)


def generate_staff_password() -> str:
    """Generate a secure random 8-character password using secrets module"""
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(8))


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token invalide")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="Utilisateur non trouve")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide")


async def get_admin_user(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acces administrateur requis")
    return user


async def get_organizer_user(user: dict = Depends(get_current_user)):
    if user.get("role") not in ["organizer", "admin"]:
        raise HTTPException(status_code=403, detail="Acces organisateur requis")
    return user


async def get_current_staff(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Authenticate staff member from JWT token"""
    try:
        payload = decode_token(credentials.credentials)
        staff_id = payload.get("sub")
        token_type = payload.get("type")
        
        if staff_id is None or token_type != "staff":
            raise HTTPException(status_code=401, detail="Token staff invalide")
        
        staff = await db.staff_accounts.find_one({"id": staff_id}, {"_id": 0})
        if staff is None:
            raise HTTPException(status_code=401, detail="Compte staff non trouve")
        
        if not staff.get("active", True):
            raise HTTPException(status_code=403, detail="Compte staff desactive")
        
        return staff
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide ou expire")
