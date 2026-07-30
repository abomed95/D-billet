"""
D-Billet API - Billetterie Djibouti
Main application entry point with full OpenAPI documentation
"""
import logging
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
import time

from routes import (
    auth_router,
    events_router,
    cart_router,
    tickets_router,
    transport_router,
    staff_router,
    organizer_router,
    admin_router,
    content_router,
    seo_router,
    setup_router,
    payments_router,
)
from routes.transport_organizer import router as transport_organizer_router
from config import (
    AUTO_SEED_DEMO_DATA,
    BACKEND_CORS_ORIGINS,
    UPLOAD_DIR,
    IS_PRODUCTION,
)
from services import seed_demo_data, ensure_indexes

# Configure root logger (production-safe defaults)
logging.basicConfig(
    level=logging.INFO if IS_PRODUCTION else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)

# API Description for Swagger
API_DESCRIPTION = """
## D-Billet API - Plateforme de Billetterie Djibouti

### 🎫 Fonctionnalités principales:
- **Événements**: Création, gestion et vente de billets
- **Train**: Réservation Djibouti ↔ Ali Sabieh
- **Ferry**: Réservation Djibouti ↔ Tadjoura/Obock avec véhicules

### 🔐 Authentification:
- Login par email/mot de passe
- Login par téléphone (sans OTP)
- Google OAuth 2.0 standard
- Session invitée pour achat rapide

### 👥 Rôles:
- **user**: Client standard
- **organizer**: Organisateur d'événements
- **ferry_organizer**: Organisateur transport ferry
- **train_organizer**: Organisateur transport train
- **admin**: Administrateur plateforme

### 📞 Contact:
- **Téléphone**: +253 77 69 48 12
- **Email**: contact@d-billet.com
"""

API_TAGS = [
    {"name": "Authentication", "description": "Connexion, inscription, sessions"},
    {"name": "Events", "description": "Gestion des événements"},
    {"name": "Cart", "description": "Panier et checkout"},
    {"name": "Payments", "description": "Paiement WaafiPay (Hosted Payment Page)"},
    {"name": "Tickets", "description": "Billets et scanner QR"},
    {"name": "Transport", "description": "Train et Ferry - Routes publiques"},
    {"name": "Transport Organizer", "description": "Dashboard organisateur transport"},
    {"name": "Staff", "description": "Gestion du personnel sécurité"},
    {"name": "Organizer", "description": "Dashboard organisateur événements"},
    {"name": "Admin", "description": "Administration plateforme"},
]

app = FastAPI(
    title="D-Billet API",
    description=API_DESCRIPTION,
    version="2.1.0",
    openapi_tags=API_TAGS,
    docs_url=None if IS_PRODUCTION else "/api/docs",
    redoc_url=None if IS_PRODUCTION else "/api/redoc",
    openapi_url=None if IS_PRODUCTION else "/api/openapi.json",
    contact={
        "name": "D-Billet Support",
        "email": "contact@d-billet.com",
    },
    license_info={
        "name": "Proprietary",
    }
)


# ============== MIDDLEWARE ==============

# CORS Middleware - restricted methods/headers in production
_ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
_ALLOWED_HEADERS = [
    "Accept",
    "Accept-Language",
    "Content-Language",
    "Content-Type",
    "Authorization",
    "X-Requested-With",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=_ALLOWED_METHODS if IS_PRODUCTION else ["*"],
    allow_headers=_ALLOWED_HEADERS if IS_PRODUCTION else ["*"],
    expose_headers=["X-Process-Time"],
    max_age=86400,
)


# Security headers middleware (defense in depth on top of Nginx)
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    if IS_PRODUCTION:
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        )
    return response


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(round(process_time * 1000, 2)) + "ms"
    return response


# Global error handler - never leak internals in production
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(
        "Unhandled exception on %s %s",
        request.method,
        request.url.path,
    )
    payload = {"detail": "Une erreur interne s'est produite"}
    if not IS_PRODUCTION:
        payload["error"] = str(exc)
        payload["type"] = exc.__class__.__name__
    return JSONResponse(status_code=500, content=payload)


# ============== STATIC FILES ==============

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


# ============== ROUTERS ==============

app.include_router(auth_router, prefix="/api")
app.include_router(events_router, prefix="/api")
app.include_router(cart_router, prefix="/api")
app.include_router(tickets_router, prefix="/api")
app.include_router(transport_router, prefix="/api")
app.include_router(staff_router, prefix="/api")
app.include_router(organizer_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(content_router, prefix="/api")
app.include_router(transport_organizer_router, prefix="/api")
app.include_router(seo_router, prefix="/api")
app.include_router(setup_router, prefix="/api")
app.include_router(payments_router, prefix="/api")


@app.on_event("startup")
async def on_startup():
    """
    Bootstrap routine:
    - Create MongoDB indexes (idempotent, no-op on local-json backend).
    - Seed demo accounts only in development/test environments.
    """
    try:
        await ensure_indexes()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not ensure MongoDB indexes: %s", exc)

    if AUTO_SEED_DEMO_DATA:
        try:
            await seed_demo_data()
            logger.info("Demo accounts ensured successfully")
        except Exception as exc:
            logger.warning(
                "Demo seed skipped because MongoDB is unreachable or not ready: %s",
                exc,
            )


# ============== ROOT ENDPOINTS ==============

@app.get("/", tags=["Health"])
async def root():
    """API Root - Basic info"""
    return {
        "name": "D-Billet API",
        "version": "2.1.0",
        "description": "Plateforme de billetterie Djibouti",
        "docs": "/api/docs",
        "contact": {
            "phone": "+253 77 69 48 12",
            "email": "contact@d-billet.com"
        }
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "D-Billet API", "version": "2.1.0"}


@app.get("/api", tags=["Health"])
async def api_info():
    """API information"""
    return {
        "name": "D-Billet API",
        "version": "2.1.0",
        "endpoints": {
            "docs": "/api/docs",
            "redoc": "/api/redoc",
            "openapi": "/api/openapi.json"
        }
    }
