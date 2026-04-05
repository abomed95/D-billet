"""
Authentication services - Secure implementation
"""
import secrets
import string
from datetime import datetime, timezone, timedelta
from jose import JWTError, jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from config import (
    db, pwd_context, SECRET_KEY, ALGORITHM,
    ACCESS_TOKEN_EXPIRE_DAYS, STAFF_TOKEN_EXPIRE_HOURS
)

security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_staff_token(data: dict) -> str:
    """Create JWT token for staff with 24h expiration"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=STAFF_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire, "type": "staff"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def generate_otp() -> str:
    """Generate secure 6-digit OTP using secrets module"""
    return str(secrets.randbelow(900000) + 100000)


def generate_staff_password() -> str:
    """Generate a secure random 8-character password using secrets module"""
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(8))


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
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
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
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
