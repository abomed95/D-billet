"""
Public content routes used by the marketing and SEO pages.
"""
from datetime import date

from fastapi import APIRouter, HTTPException

from config import db

router = APIRouter(tags=["Public Content"])

DEFAULT_TERMS_CONTENT = """# Conditions d'utilisation
## Objet
D-Billet facilite la reservation de billets pour les evenements, le train et le ferry a Djibouti.

## Reservation et paiement
Les reservations sont confirmees apres validation du paiement par le service choisi. Le billet emis contient les informations de voyage ou d'entree ainsi qu'un QR code unique.

## Utilisation des billets
Chaque billet est personnel sauf indication contraire sur le type de billet. Le client doit presenter un justificatif si l'organisateur ou l'operateur de transport le demande.

## Annulation et remboursement
Les conditions d'annulation dependent du service reserve et des regles de l'organisateur. Certaines reservations peuvent etre non remboursables apres validation.

## Contact
Pour toute question, contactez D-Billet a contact@d-billet.com ou au +253 77 69 48 12.
"""

DEFAULT_LEGAL_PAGES = {
    "mentions": {
        "title": "Mentions legales",
        "content": """# Mentions legales
## Editeur
Le site D-Billet est exploite pour la commercialisation de billets et de reservations en ligne a Djibouti.

## Contact
Email: contact@d-billet.com
Telephone: +253 77 69 48 12

## Responsabilite
D-Billet met en oeuvre les moyens raisonnables pour assurer la disponibilite du service et l'exactitude des informations diffusees par les organisateurs et operateurs partenaires.
""",
    },
    "cgv": {
        "title": "Conditions generales de vente",
        "content": """# Conditions generales de vente
## Tarifs
Les prix affiches sur D-Billet sont indiques en franc djiboutien sauf mention contraire.

## Confirmation de commande
Une commande est consideree comme validee une fois le paiement confirme et le billet emis.

## Controle
Le billet et le justificatif d'identite peuvent etre demandes lors du controle d'acces ou de l'embarquement.

## Litiges
Toute reclamation doit etre transmise au support D-Billet avec les references de la commande.
""",
    },
    "privacy": {
        "title": "Politique de confidentialite",
        "content": """# Politique de confidentialite
## Donnees collectees
D-Billet collecte les informations necessaires a la creation de compte, a la reservation et au support client.

## Finalites
Les donnees servent a emettre les billets, verifier les paiements, contacter les voyageurs ou participants, et assurer la securite de la plateforme.

## Conservation
Les donnees sont conservees pendant la duree necessaire aux obligations contractuelles, comptables et de support.

## Contact
Pour exercer vos droits ou poser une question sur vos donnees, contactez contact@d-billet.com.
""",
    },
    "support": {
        "title": "Support client",
        "content": """# Support client
## Assistance
L'equipe D-Billet accompagne les clients pour les billets, reservations, paiements et acces aux evenements.

## Horaires
Le support traite les demandes des que possible selon la disponibilite des equipes.

## Coordonnees
Email: contact@d-billet.com
Telephone: +253 77 69 48 12
""",
    },
}

DEFAULT_TESTIMONIALS = [
    {
        "author": "Amina H.",
        "role": "Cliente D-Billet",
        "content": "J'ai reserve mon billet en quelques minutes et le QR code a fonctionne tout de suite a l'entree.",
        "rating": 5,
    },
    {
        "author": "Moussa A.",
        "role": "Voyageur ferry",
        "content": "La reservation en ligne m'a fait gagner du temps avant le depart pour Tadjoura.",
        "rating": 5,
    },
    {
        "author": "Noura S.",
        "role": "Participante evenement",
        "content": "Les informations sur la date, le lieu et les billets etaient claires. Achat tres simple.",
        "rating": 5,
    },
]

DEFAULT_NEWS = [
    {
        "title": "Billetterie en ligne a Djibouti",
        "excerpt": "D-Billet centralise les reservations d'evenements, de ferry et de train sur une meme plateforme.",
        "content": "D-Billet propose une experience de reservation en ligne pour les principales sorties et mobilites du pays.",
        "image_url": None,
    }
]


def _read_platform_text(settings: dict, *keys: str) -> str | None:
    for key in keys:
        value = settings.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _normalize_testimonial(document: dict) -> dict:
    return {
        "author": document.get("author") or document.get("author_name") or "Client D-Billet",
        "role": document.get("role") or document.get("author_role") or "Utilisateur",
        "content": document.get("content") or "",
        "rating": document.get("rating") or 5,
        "avatar_url": document.get("avatar_url"),
    }


def _normalize_news(document: dict) -> dict:
    return {
        "title": document.get("title") or "Actualite D-Billet",
        "excerpt": document.get("excerpt") or document.get("content") or "",
        "content": document.get("content") or document.get("excerpt") or "",
        "image_url": document.get("image_url"),
    }


@router.get("/testimonials")
async def get_public_testimonials():
    testimonials = await db.testimonials.find({}, {"_id": 0}).sort("created_at", -1).to_list(6)
    if not testimonials:
        return DEFAULT_TESTIMONIALS
    return [_normalize_testimonial(testimonial) for testimonial in testimonials]


@router.get("/news")
async def get_public_news():
    news_items = await db.news.find({}, {"_id": 0}).sort("created_at", -1).to_list(6)
    if not news_items:
        return DEFAULT_NEWS
    return [_normalize_news(item) for item in news_items]


@router.get("/terms")
async def get_public_terms():
    settings = await db.settings.find_one({"type": "platform"}, {"_id": 0}) or {}
    content = _read_platform_text(settings, "terms_content", "terms") or DEFAULT_TERMS_CONTENT

    return {
        "title": "Conditions d'utilisation",
        "content": content,
        "last_updated": settings.get("updated_at") or date.today().isoformat(),
    }


@router.get("/legal/{page}")
async def get_public_legal_page(page: str):
    page_key = page.lower()
    if page_key not in DEFAULT_LEGAL_PAGES:
        raise HTTPException(status_code=404, detail="Page legale non trouvee")

    settings = await db.settings.find_one({"type": "platform"}, {"_id": 0}) or {}
    default_page = DEFAULT_LEGAL_PAGES[page_key]
    legal_pages = settings.get("legal_pages") if isinstance(settings.get("legal_pages"), dict) else {}
    stored_page = legal_pages.get(page_key) if isinstance(legal_pages.get(page_key), dict) else {}

    content = (
        stored_page.get("content")
        or (
            _read_platform_text(settings, "legal_content", "legal")
            if page_key == "mentions"
            else None
        )
        or default_page["content"]
    )
    title = stored_page.get("title") or default_page["title"]

    return {
        "title": title,
        "content": content,
        "last_updated": settings.get("updated_at") or date.today().isoformat(),
    }
