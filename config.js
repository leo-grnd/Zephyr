// config.js — ZÉPHYR : référentiels & réglages. Point d'édition unique.
// Aucune dépendance, aucun DOM.

/* ===========================================================================
   Codes météo WMO → libellé FR + clé d'icône (voir icons.js).
   Les icônes "clear/mainly-clear/partly-cloudy" ont une variante nuit.
   =========================================================================== */
export const WMO = {
  0:  { label: "Ciel clair",            icon: "clear" },
  1:  { label: "Plutôt clair",          icon: "mainly-clear" },
  2:  { label: "Partiellement nuageux", icon: "partly-cloudy" },
  3:  { label: "Couvert",               icon: "overcast" },
  45: { label: "Brouillard",            icon: "fog" },
  48: { label: "Brouillard givrant",    icon: "fog" },
  51: { label: "Bruine légère",         icon: "drizzle" },
  53: { label: "Bruine",                icon: "drizzle" },
  55: { label: "Bruine dense",          icon: "drizzle" },
  56: { label: "Bruine verglaçante",    icon: "freezing-rain" },
  57: { label: "Bruine verglaçante",    icon: "freezing-rain" },
  61: { label: "Pluie faible",          icon: "rain" },
  63: { label: "Pluie",                 icon: "rain" },
  65: { label: "Pluie forte",           icon: "rain" },
  66: { label: "Pluie verglaçante",     icon: "freezing-rain" },
  67: { label: "Pluie verglaçante",     icon: "freezing-rain" },
  71: { label: "Neige faible",          icon: "snow" },
  73: { label: "Neige",                 icon: "snow" },
  75: { label: "Neige forte",           icon: "snow" },
  77: { label: "Grains de neige",       icon: "snow" },
  80: { label: "Averses faibles",       icon: "showers" },
  81: { label: "Averses",               icon: "showers" },
  82: { label: "Averses violentes",     icon: "showers" },
  85: { label: "Averses de neige",      icon: "snow" },
  86: { label: "Averses de neige",      icon: "snow" },
  95: { label: "Orage",                 icon: "thunder" },
  96: { label: "Orage, grêle",          icon: "thunder" },
  99: { label: "Orage, grêle",          icon: "thunder" },
};
export function wmo(code) { return WMO[code] || { label: "—", icon: "overcast" }; }

/* ===========================================================================
   Unités (passées à Open-Meteo + format heure côté client).
   =========================================================================== */
export const UNIT_OPTIONS = {
  temp: [{ id: "celsius", label: "°C", sym: "°C" }, { id: "fahrenheit", label: "°F", sym: "°F" }],
  wind: [
    { id: "kmh", label: "km/h", sym: "km/h" },
    { id: "ms", label: "m/s", sym: "m/s" },
    { id: "kn", label: "nœuds", sym: "kt" },
    { id: "mph", label: "mph", sym: "mph" },
  ],
  precip: [{ id: "mm", label: "mm", sym: "mm" }, { id: "inch", label: "pouces", sym: "in" }],
  clock: [{ id: "24h", label: "24 h" }, { id: "12h", label: "12 h" }],
};
export const DEFAULT_UNITS = { temp: "celsius", wind: "kmh", precip: "mm", clock: "24h" };

/* ===========================================================================
   Modèles de prévision (comparaison). couleur = trait du graphe.
   =========================================================================== */
export const MODELS = [
  { id: "ecmwf_ifs025",         label: "ECMWF",        color: "#ff6b00" },
  { id: "gfs_seamless",         label: "GFS",          color: "#3b82f6" },
  { id: "icon_seamless",        label: "ICON",         color: "#4ade80" },
  { id: "meteofrance_seamless", label: "Météo-France", color: "#a855f7" },
  { id: "meteofrance_arome_france_hd", label: "AROME-HD", color: "#ec4899" },
];

/* ===========================================================================
   Échelle de Beaufort (vitesse en km/h → force + libellé).
   =========================================================================== */
export const BEAUFORT = [
  { max: 1, f: 0, label: "Calme" },
  { max: 5, f: 1, label: "Très légère brise" },
  { max: 11, f: 2, label: "Légère brise" },
  { max: 19, f: 3, label: "Petite brise" },
  { max: 28, f: 4, label: "Jolie brise" },
  { max: 38, f: 5, label: "Bonne brise" },
  { max: 49, f: 6, label: "Vent frais" },
  { max: 61, f: 7, label: "Grand frais" },
  { max: 74, f: 8, label: "Coup de vent" },
  { max: 88, f: 9, label: "Fort coup de vent" },
  { max: 102, f: 10, label: "Tempête" },
  { max: 117, f: 11, label: "Violente tempête" },
  { max: Infinity, f: 12, label: "Ouragan" },
];
export function beaufort(kmh) {
  if (kmh == null) return null;
  return BEAUFORT.find((b) => kmh < b.max) || BEAUFORT[BEAUFORT.length - 1];
}
export const WIND_DIRS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
export function cardinal(deg) {
  if (deg == null) return "";
  return WIND_DIRS[Math.round(deg / 22.5) % 16];
}

/* ===========================================================================
   Alertes "maison" (calculées depuis Open-Meteo si pas de vigilance officielle).
   Seuils en unités SI (°C, km/h rafales, mm/24 h). level: jaune|orange|rouge.
   =========================================================================== */
export const HOME_ALERTS = [
  { id: "wind", icon: "💨", name: "Vent violent", metric: "gust",
    levels: [{ min: 100, level: "rouge" }, { min: 80, level: "orange" }, { min: 60, level: "jaune" }],
    msg: (v) => `Rafales jusqu'à ${Math.round(v)} km/h` },
  { id: "rain", icon: "🌧️", name: "Fortes pluies", metric: "precip",
    levels: [{ min: 100, level: "rouge" }, { min: 70, level: "orange" }, { min: 40, level: "jaune" }],
    msg: (v) => `Jusqu'à ${Math.round(v)} mm sur 24 h` },
  { id: "heat", icon: "🌡️", name: "Canicule", metric: "tmax",
    levels: [{ min: 40, level: "rouge" }, { min: 35, level: "orange" }, { min: 32, level: "jaune" }],
    msg: (v) => `Jusqu'à ${Math.round(v)} °C` },
  { id: "cold", icon: "❄️", name: "Grand froid", metric: "tmin_neg",
    levels: [{ min: 10, level: "orange" }, { min: 5, level: "jaune" }],
    msg: (v) => `Jusqu'à -${Math.round(v)} °C` },
];

/* ===========================================================================
   Vigilance Météo-France (officielle). REMPLIR LE TOKEN pour l'activer.
   Sans token (ou en cas d'échec), ZÉPHYR bascule sur les alertes maison.
   Token : créer un compte sur https://portail-api.meteofrance.fr/ →
   application "Vigilance météorologique" → coller la clé ci-dessous.
   ⚠️ La clé sera visible dans le code client (site statique).
   =========================================================================== */
export const MF_TOKEN = "eyJ4NXQiOiJZV0kxTTJZNE1qWTNOemsyTkRZeU5XTTRPV014TXpjek1UVmhNbU14T1RSa09ETXlOVEE0Tnc9PSIsImtpZCI6ImdhdGV3YXlfY2VydGlmaWNhdGVfYWxpYXMiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJsZW8uZ2FybmF1ZDFAY2FyYm9uLnN1cGVyIiwiYXBwbGljYXRpb24iOnsib3duZXIiOiJsZW8uZ2FybmF1ZDEiLCJ0aWVyUXVvdGFUeXBlIjpudWxsLCJ0aWVyIjoiVW5saW1pdGVkIiwibmFtZSI6IkRlZmF1bHRBcHBsaWNhdGlvbiIsImlkIjo0MjUxOSwidXVpZCI6ImFiNjk2MjY2LWI3NmUtNDg5My1hZTE4LTkxNTFiM2YyNGE2MSJ9LCJpc3MiOiJodHRwczpcL1wvcG9ydGFpbC1hcGkubWV0ZW9mcmFuY2UuZnI6NDQzXC9vYXV0aDJcL3Rva2VuIiwidGllckluZm8iOnsiNjBSZXFQYXJNaW4iOnsidGllclF1b3RhVHlwZSI6InJlcXVlc3RDb3VudCIsImdyYXBoUUxNYXhDb21wbGV4aXR5IjowLCJncmFwaFFMTWF4RGVwdGgiOjAsInN0b3BPblF1b3RhUmVhY2giOnRydWUsInNwaWtlQXJyZXN0TGltaXQiOjAsInNwaWtlQXJyZXN0VW5pdCI6InNlYyJ9fSwia2V5dHlwZSI6IlBST0RVQ1RJT04iLCJzdWJzY3JpYmVkQVBJcyI6W3sic3Vic2NyaWJlclRlbmFudERvbWFpbiI6ImNhcmJvbi5zdXBlciIsIm5hbWUiOiJEb25uZWVzUHVibGlxdWVzVmlnaWxhbmNlIiwiY29udGV4dCI6IlwvcHVibGljXC9EUFZpZ2lsYW5jZVwvdjEiLCJwdWJsaXNoZXIiOiJhZG1pbiIsInZlcnNpb24iOiJ2MSIsInN1YnNjcmlwdGlvblRpZXIiOiI2MFJlcVBhck1pbiJ9XSwiZXhwIjoxNzg0NTQ5OTI2LCJ0b2tlbl90eXBlIjoiYXBpS2V5IiwiaWF0IjoxNzgxOTU3OTI2LCJqdGkiOiI2MjBhZjAxYi1iN2UyLTRiODAtYThlMC0wY2JkODI3NjY2OWMifQ==.e2uKdvugUXE21A-1kNKhAHfpSN_3MP6FrxC6HnCY9IsmO-3MDyASwkDEOCZNTIIMQYnoiUGcSq0pJmr5aC57AyVnVp55PfL1f-xYmzbD9Cj4LHVDubdVFAGFYY81XaREoMRqnjGoUxz8ouMyREHRmTaZRV4VeMY6JUOetITzs8QZYpK555PIt3Ej0l88O4dOnrn1Z6hSCIEaaOcIua7TUZaTX_OzKoNcAoAI7i_PHQ50uQy-QtsrU_sLkjnDXR9dpUIw0tBj9oOp6a9caWo3U2HrduZ7ZKgW4TLY3vuMQC97v5aMhHtN6X6dN01PlFUoWuHVw5wLbHlYqL8SnLlTjw==";
export const MF_VIGILANCE_URL = "https://public-api.meteofrance.fr/public/DPVigilance/v1/cartevigilance/encours";
export const VIGILANCE_COLORS = { 1: "vert", 2: "jaune", 3: "orange", 4: "rouge" };
export const PHENOMENONS = {
  "1": "Vent violent", "2": "Pluie-inondation", "3": "Orages", "4": "Inondation",
  "5": "Neige-verglas", "6": "Canicule", "7": "Grand froid", "8": "Avalanches", "9": "Vagues-submersion",
};

/* ===========================================================================
   Divers
   =========================================================================== */
export const FORECAST_DAYS = 14;
export const RAINVIEWER_URL = "https://api.rainviewer.com/public/weather-maps.json";
