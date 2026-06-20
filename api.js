// api.js — accès réseau ZÉPHYR. Open-Meteo (sans clé), RainViewer (sans clé),
// Météo-France Vigilance (token, optionnel). Repli corsproxy + cache localStorage.
import { MODELS, MF_TOKEN, MF_VIGILANCE_URL, RAINVIEWER_URL, FORECAST_DAYS } from "./config.js";

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const GEO = "https://geocoding-api.open-meteo.com/v1/search";
const REV = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const PROXY = "https://corsproxy.io/?url=";

const CURRENT = "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m";
const HOURLY = "temperature_2m,apparent_temperature,dew_point_2m,relative_humidity_2m,precipitation,precipitation_probability,weather_code,pressure_msl,surface_pressure,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,wind_speed_10m,wind_speed_80m,wind_speed_120m,wind_speed_180m,wind_direction_10m,wind_gusts_10m,uv_index,cape,freezing_level_height,is_day";
const DAILY = "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,daylight_duration,sunshine_duration,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant";
const MINUTELY = "precipitation,weather_code";

async function getJSON(url, { headers = {}, timeout = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: ctrl.signal });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (_) {
      const r = await fetch(PROXY + encodeURIComponent(url), { headers });
      if (!r.ok) throw new Error("proxy " + r.status);
      return await r.json();
    }
  } finally {
    clearTimeout(t);
  }
}

// Variables haute-résolution superposées depuis AROME (Météo-France) sur le court terme.
const AROME_HOURLY = "temperature_2m,apparent_temperature,dew_point_2m,relative_humidity_2m,precipitation,weather_code,pressure_msl,surface_pressure,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_speed_10m,wind_speed_80m,wind_speed_120m,wind_speed_180m,wind_direction_10m,wind_gusts_10m,cape,is_day";
const AROME_VARS = AROME_HOURLY.split(",");

// --- prévisions cœur -------------------------------------------------------
// Base = best_match (14 j complets + toutes variables) ; on superpose AROME-HD
// Météo-France sur les ~72 premières heures (haute résolution locale) + nowcast.
// cell_selection=nearest + altitude réelle pour mieux représenter le point.
export async function fetchForecast(lat, lon, units, elevation) {
  const base = {
    latitude: lat, longitude: lon, timezone: "auto", cell_selection: "nearest",
    temperature_unit: units.temp, wind_speed_unit: units.wind, precipitation_unit: units.precip,
  };
  if (elevation != null) base.elevation = elevation;
  const pPrimary = new URLSearchParams({ ...base, forecast_days: String(FORECAST_DAYS), current: CURRENT, hourly: HOURLY, daily: DAILY, minutely_15: MINUTELY });
  const pArome = new URLSearchParams({ ...base, forecast_days: "3", models: "meteofrance_seamless", current: CURRENT, hourly: AROME_HOURLY, minutely_15: MINUTELY });
  const [primary, arome] = await Promise.all([
    getJSON(`${FORECAST}?${pPrimary}`),
    getJSON(`${FORECAST}?${pArome}`).catch(() => null),
  ]);
  if (arome && arome.hourly && arome.hourly.time && primary.hourly && primary.hourly.time) {
    const n = arome.hourly.time.length;
    for (const k of AROME_VARS) {
      const a = arome.hourly[k], b = primary.hourly[k];
      if (!a || !b) continue;
      for (let i = 0; i < n && i < b.length; i++) if (a[i] != null) b[i] = a[i];
    }
    if (arome.current && arome.current.temperature_2m != null) primary.current = arome.current;
    if (arome.minutely_15 && arome.minutely_15.time) primary.minutely_15 = arome.minutely_15;
    primary.zephyr_hires = true;
  }
  return primary;
}

// --- comparaison de modèles (variables suffixées _<model>) -----------------
export function fetchModels(lat, lon, units) {
  const p = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: "auto", forecast_days: "5",
    hourly: "temperature_2m", models: MODELS.map((m) => m.id).join(","),
    temperature_unit: units.temp,
  });
  return getJSON(`${FORECAST}?${p}`);
}

// --- normales climatiques (≈10 ans de moyenne quotidienne) -----------------
export function fetchNormals(lat, lon, startISO, endISO, tempUnit = "celsius") {
  const p = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: "auto",
    start_date: startISO, end_date: endISO, daily: "temperature_2m_mean",
    temperature_unit: tempUnit,
  });
  return getJSON(`${ARCHIVE}?${p}`);
}

// --- géocodage -------------------------------------------------------------
export async function geocode(name) {
  const p = new URLSearchParams({ name, count: "6", language: "fr", format: "json" });
  const d = await getJSON(`${GEO}?${p}`);
  return d?.results || [];
}
export async function reverseGeocode(lat, lon) {
  try {
    const p = new URLSearchParams({ latitude: lat, longitude: lon, localityLanguage: "fr" });
    const d = await getJSON(`${REV}?${p}`);
    const name = d.city || d.locality || d.principalSubdivision;
    if (name) return { name, admin1: d.principalSubdivision || "", country: d.countryName || "" };
  } catch (_) {}
  return null;
}

// --- code département depuis des coordonnées (API Géo, sans clé) -----------
export async function fetchDept(lat, lon) {
  try {
    const p = new URLSearchParams({ lat, lon, fields: "codeDepartement", format: "json" });
    const d = await getJSON(`https://geo.api.gouv.fr/communes?${p}`);
    return Array.isArray(d) && d[0] ? d[0].codeDepartement : null;
  } catch (_) { return null; }
}

// --- altitude réelle du point (Open-Meteo, sans clé) -----------------------
export async function fetchElevation(lat, lon) {
  try {
    const d = await getJSON(`${FORECAST.replace("/forecast", "/elevation")}?latitude=${lat}&longitude=${lon}`);
    return Array.isArray(d && d.elevation) ? d.elevation[0] : null;
  } catch (_) { return null; }
}

// --- radar RainViewer ------------------------------------------------------
export function fetchRadar() {
  return getJSON(RAINVIEWER_URL);
}

// --- vigilance Météo-France (officielle, token requis) ---------------------
// Renvoie le JSON brut MF ou null (token absent / échec) → l'app bascule alors
// sur les alertes maison.
export async function fetchVigilance() {
  if (!MF_TOKEN) return null;
  try {
    return await getJSON(MF_VIGILANCE_URL, { headers: { apikey: MF_TOKEN } });
  } catch (_) {
    return null;
  }
}
