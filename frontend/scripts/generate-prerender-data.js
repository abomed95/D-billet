const fs = require("fs/promises");
const path = require("path");

const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");
const siteUrl = trimTrailingSlash(process.env.REACT_APP_SITE_URL || "https://d-billet.com");
const backendUrl = trimTrailingSlash(process.env.REACT_APP_BACKEND_URL || siteUrl);
const apiBase = `${backendUrl}/api`;
const outputDir = path.join(__dirname, "..", "public", "prerender-data");

const DEFAULT_TESTIMONIALS = [
  {
    author: "Amina H.",
    role: "Cliente D-BILLET",
    content: "J'ai reserve mon billet en quelques minutes et tout s'est deroule sans attente a l'entree.",
    rating: 5,
  },
  {
    author: "Moussa A.",
    role: "Voyageur ferry",
    content: "La reservation en ligne m'a permis d'organiser mon depart plus sereinement, avec mon billet deja pret.",
    rating: 5,
  },
  {
    author: "Noura S.",
    role: "Participante evenement",
    content: "Le paiement etait simple, les informations etaient claires et le QR code a ete recu immediatement.",
    rating: 5,
  },
];

const DEFAULT_NEWS = [
  {
    title: "Billetterie en ligne a Djibouti",
    excerpt: "D-Billet simplifie la reservation d'evenements, de ferry et de train depuis une seule plateforme.",
    content: "D-Billet centralise la reservation des billets pour les principaux services de mobilite et de sortie a Djibouti.",
    image_url: null,
  },
];

const DEFAULT_TERMS = {
  title: "Conditions d'utilisation",
  content: `# Conditions d'utilisation
## 1. Objet
D-Billet est la plateforme officielle de reservation en ligne pour les evenements, le train et le ferry a Djibouti.

## 2. Acces a la plateforme
L'acces a certains services peut necessiter la creation d'un compte ou l'identification de l'utilisateur. L'utilisateur s'engage a fournir des informations exactes et a jour.

## 3. Reservation et disponibilite
Les billets, places et traversees sont proposes sous reserve de disponibilite. Une reservation n'est consideree comme valide qu'apres confirmation du paiement et emission du billet.

## 4. Paiement
Le paiement s'effectue avec les moyens proposes sur la plateforme, notamment Waafi, D-Money et CAC Bank selon le service disponible.

## 5. Billet numerique et QR code
Chaque billet emis contient les informations essentielles de la reservation ainsi qu'un QR code unique. Le billet doit etre conserve et presente lors du controle ou de l'embarquement.

## 6. Annulation, modification et remboursement
Les conditions d'annulation, de modification ou de remboursement dependent du service reserve et des regles appliquees par l'organisateur ou l'operateur concerne.

## 7. Support client
Pour toute question relative a une reservation, un paiement ou un billet, contactez D-Billet a contact@d-billet.com ou au +253 77 69 48 12.`,
};

const DEFAULT_LEGAL_PAGES = {
  mentions: {
    title: "Mentions légales",
    content: `# Mentions légales
## Éditeur
D-Billet exploite une plateforme officielle de billetterie et de réservation en ligne à Djibouti.

## Contact
Email : contact@d-billet.com
Téléphone : +253 77 69 48 12

## Responsabilité
D-Billet met en oeuvre les moyens raisonnables pour assurer la disponibilité du service et la fiabilité des informations publiées.`,
  },
  cgv: {
    title: "Conditions générales de vente",
    content: `# Conditions générales de vente
## Tarifs
Les prix sont affichés avant confirmation de la commande.

## Confirmation
Le billet est émis une fois le paiement validé.

## Contrôle
Le billet et le justificatif d'identité peuvent être demandés lors du contrôle d'accès ou de l'embarquement.`,
  },
  privacy: {
    title: "Politique de confidentialité",
    content: `# Politique de confidentialité
## Données collectées
Les données demandées servent à gérer la réservation, le billet et le support client.

## Finalités
Les informations collectées permettent de confirmer la commande, sécuriser le paiement et assurer le suivi client.`,
  },
  support: {
    title: "Support client",
    content: `# Support client
## Assistance
Le support D-Billet accompagne les clients pour les réservations, paiements et billets.

## Coordonnées
Email : contact@d-billet.com
Téléphone : +253 77 69 48 12`,
  },
};

const DEFAULT_FERRY_SCHEDULE = {
  schedule: [
    { day: "monday", day_label: "Lundi", active: false, destination: null },
    {
      day: "tuesday",
      day_label: "Mardi",
      active: true,
      destination: "Tadjoura",
      departure_time: "08:00",
      return_time: "12:00",
    },
    { day: "wednesday", day_label: "Mercredi", active: false, destination: null },
    {
      day: "thursday",
      day_label: "Jeudi",
      active: true,
      destination: "Tadjoura/Obock",
      routes: [
        { destination: "Tadjoura", departure_time: "13:00", return_time: "15:00" },
        { destination: "Obock", departure_time: "09:00", return_time: "14:00" },
      ],
    },
    {
      day: "friday",
      day_label: "Vendredi",
      active: true,
      destination: "Tadjoura",
      departure_time: "08:00",
      return_time: "13:00",
    },
    {
      day: "saturday",
      day_label: "Samedi",
      active: true,
      destination: "Tadjoura/Obock",
      routes: [
        { destination: "Tadjoura", departure_time: "08:00", return_time: "12:00" },
        { destination: "Obock", departure_time: "08:00", return_time: "13:00" },
      ],
    },
    { day: "sunday", day_label: "Dimanche", active: false, destination: null },
  ],
  passenger_price: 1100,
  child_free_age: 10,
  vehicle_types: [],
};

function slugify(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchJson(pathname, fallback) {
  const url = `${apiBase}${pathname}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.warn(`[prerender] fallback for ${pathname}: ${error.message}`);
    return fallback;
  }
}

async function writeJson(relativePath, data) {
  const filePath = path.join(outputDir, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main() {
  await fs.rm(outputDir, { recursive: true, force: true });

  const [events, testimonials, news, ferrySchedule, terms, legalMentions, legalCgv, legalPrivacy, legalSupport] =
    await Promise.all([
      fetchJson("/events", []),
      fetchJson("/testimonials", DEFAULT_TESTIMONIALS),
      fetchJson("/news", DEFAULT_NEWS),
      fetchJson("/ferry/schedule", DEFAULT_FERRY_SCHEDULE),
      fetchJson("/terms", DEFAULT_TERMS),
      fetchJson("/legal/mentions", DEFAULT_LEGAL_PAGES.mentions),
      fetchJson("/legal/cgv", DEFAULT_LEGAL_PAGES.cgv),
      fetchJson("/legal/privacy", DEFAULT_LEGAL_PAGES.privacy),
      fetchJson("/legal/support", DEFAULT_LEGAL_PAGES.support),
    ]);

  const normalizedEvents = Array.isArray(events) ? events : [];

  await writeJson("home.json", {
    events: normalizedEvents,
    testimonials: Array.isArray(testimonials) ? testimonials : DEFAULT_TESTIMONIALS,
    news: Array.isArray(news) ? news : DEFAULT_NEWS,
    generated_at: new Date().toISOString(),
  });

  await Promise.all(
    normalizedEvents.map(async (event) => {
      const detail = await fetchJson(`/events/${event.id}`, event);
      await writeJson(path.join("events", `${event.id}.json`), detail);
    })
  );

  await writeJson("routes.json", normalizedEvents.map((event) => `/events/${event.id}/${event.slug || slugify(event.title)}`));
  await writeJson("ferry-schedule.json", ferrySchedule);
  await writeJson("terms.json", terms);
  await writeJson("legal-mentions.json", legalMentions);
  await writeJson("legal-cgv.json", legalCgv);
  await writeJson("legal-privacy.json", legalPrivacy);
  await writeJson("legal-support.json", legalSupport);

  console.log(`[prerender] prepared ${normalizedEvents.length} event pages`);
}

main().catch((error) => {
  console.error("[prerender] generation failed", error);
  process.exitCode = 1;
});
