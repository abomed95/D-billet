"""
D-Billet API - Billetterie Djibouti
Main application entry point with full OpenAPI documentation
"""
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from pathlib import Path
import time

from routes import (
    auth_router,
    events_router,
    cart_router,
    tickets_router,
    transport_router,
    staff_router,
    organizer_router,
    admin_router
)
from routes.transport_organizer import router as transport_organizer_router

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
- Google OAuth via Emergent Auth
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
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    contact={
        "name": "D-Billet Support",
        "email": "contact@d-billet.com",
    },
    license_info={
        "name": "Proprietary",
    }
)


# ============== MIDDLEWARE ==============

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(round(process_time * 1000, 2)) + "ms"
    return response


# Global error handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Une erreur interne s'est produite",
            "error": str(exc) if app.debug else None
        }
    )


# ============== STATIC FILES ==============

UPLOAD_DIR = Path("/app/frontend/public/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
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
app.include_router(transport_organizer_router, prefix="/api")


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
