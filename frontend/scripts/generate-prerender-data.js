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
    role: "Cliente D-Billet",
    content: "J'ai reserve mon billet en quelques minutes et le QR code a fonctionne sans attente.",
    rating: 5,
  },
  {
    author: "Moussa A.",
    role: "Voyageur ferry",
    content: "La reservation en ligne m'a permis d'organiser mon depart pour Tadjoura plus facilement.",
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
## Objet
D-Billet facilite la reservation de billets pour les evenements, le train et le ferry a Djibouti.

## Reservation
Une reservation est confirmee apres validation du paiement et emission d'un billet ou d'un QR code.

## Contact
Pour toute question, contactez contact@d-billet.com ou le +253 77 69 48 12.`,
};

const DEFAULT_LEGAL_PAGES = {
  mentions: {
    title: "Mentions legales",
    content: `# Mentions legales
## Editeur
D-Billet opere une plateforme de billetterie et de reservation en ligne a Djibouti.

## Contact
Email: contact@d-billet.com
Telephone: +253 77 69 48 12`,
  },
  cgv: {
    title: "Conditions generales de vente",
    content: `# Conditions generales de vente
## Tarifs
Les prix sont affiches avant confirmation de la commande.

## Confirmation
Le billet est emis une fois le paiement valide.`,
  },
  privacy: {
    title: "Politique de confidentialite",
    content: `# Politique de confidentialite
## Donnees
Les donnees demandees servent a gerer la reservation, le billet et le support client.`,
  },
  support: {
    title: "Support client",
    content: `# Support client
## Assistance
Le support D-Billet accompagne les clients pour les reservations, paiements et billets.

Email: contact@d-billet.com
Telephone: +253 77 69 48 12`,
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
