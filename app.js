// app.js — ZÉPHYR : orchestration. Vanilla ES module, zéro dépendance (sauf
// Leaflet via CDN pour le radar). Données : Open-Meteo / RainViewer / Météo-France.
import {
  wmo, UNIT_OPTIONS, DEFAULT_UNITS, MODELS, beaufort, cardinal,
  HOME_ALERTS, VIGILANCE_COLORS, PHENOMENONS,
} from "./config.js";
import { weatherIcon } from "./icons.js";
import { meteogram, nowcastBars, multiLine, windRose, anomalyBar } from "./charts.js";
import {
  fetchForecast, fetchModels, fetchNormals, geocode, reverseGeocode, fetchRadar, fetchVigilance, fetchDept, fetchElevation,
} from "./api.js";

const K = { loc: "zephyr-loc", favs: "zephyr-favs", units: "zephyr-units", theme: "zephyr-theme" };

const $ = (id) => document.getElementById(id);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (_) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

let units = { ...DEFAULT_UNITS, ...load(K.units, {}) };
let loc = load(K.loc, null);
let favs = load(K.favs, []);
let data = null; // { fc, models, normals, savedAt }

// --- format ----------------------------------------------------------------
const sym = (g) => (UNIT_OPTIONS[g].find((o) => o.id === units[g]) || {}).sym || "";
const fmt = (v, d = 0) => (v == null || Number.isNaN(v) ? "—" : Number(v.toFixed(d)).toLocaleString("fr-FR"));
function fmtHour(iso) {
  if (!iso) return "";
  const h = Number(iso.slice(11, 13)), m = iso.slice(14, 16);
  if (units.clock === "12h") {
    const ap = h < 12 ? "am" : "pm"; const h12 = ((h + 11) % 12) + 1;
    return m === "00" ? `${h12}${ap}` : `${h12}:${m}${ap}`;
  }
  return m === "00" ? `${h} h` : `${h}:${m}`;
}
const DAYFMT = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric" });
function frDay(iso) { const [y, m, d] = iso.split("-").map(Number); return DAYFMT.format(new Date(y, m - 1, d)); }
function hourLabel(iso) { return fmtHour(iso); }
function clock(iso) { // "HH:MM" affichage
  const h = Number(iso.slice(11, 13)), m = iso.slice(14, 16);
  if (units.clock === "12h") { const ap = h < 12 ? "am" : "pm"; return `${((h + 11) % 12) + 1}:${m}${ap}`; }
  return `${String(h).padStart(2, "0")}:${m}`;
}

// conversions vers SI pour les seuils d'alerte (config en °C / km/h / mm)
const toC = (v) => (units.temp === "fahrenheit" ? (v - 32) * 5 / 9 : v);
const toKmh = (v) => v * ({ kmh: 1, ms: 3.6, mph: 1.60934, kn: 1.852 }[units.wind] || 1);
const toMm = (v) => v * (units.precip === "inch" ? 25.4 : 1);

function idxAtOrAfter(times, anchor) {
  if (!times?.length) return 0;
  const a = anchor.slice(0, 16);
  for (let i = 0; i < times.length; i++) if (times[i].slice(0, 16) >= a) return i;
  return 0;
}
function nowIndex(fc) {
  const t = fc?.hourly?.time; if (!t) return 0;
  const cur = fc?.current?.time?.slice(0, 13);
  if (cur) { const i = t.findIndex((x) => x.slice(0, 13) === cur); if (i >= 0) return i; }
  return 0;
}

// ===========================================================================
// RENDU
// ===========================================================================
function renderPlace() {
  $("place-name").textContent = loc?.place?.name || "—";
  $("place-sub").textContent = loc?.place ? [loc.place.admin1, loc.place.country].filter(Boolean).join(" · ") : "";
  renderFavs();
}

function renderFavs() {
  const wrap = $("favs"); wrap.innerHTML = "";
  favs.forEach((f, i) => {
    const b = document.createElement("button");
    b.className = "fav" + (loc && f.coords.lat === loc.coords.lat && f.coords.lon === loc.coords.lon ? " active" : "");
    b.innerHTML = `${f.place.name}<span class="fav-x" title="Retirer">×</span>`;
    b.addEventListener("click", (e) => {
      if (e.target.classList.contains("fav-x")) { favs.splice(i, 1); save(K.favs, favs); renderFavs(); return; }
      setLocation(f.coords, f.place);
    });
    wrap.appendChild(b);
  });
  const isFav = loc && favs.some((f) => f.coords.lat === loc.coords.lat && f.coords.lon === loc.coords.lon);
  $("fav-add").hidden = !loc || isFav;
}

function renderUnitsBar() {
  const wrap = $("units"); wrap.innerHTML = "";
  for (const g of ["temp", "wind", "precip", "clock"]) {
    const grp = document.createElement("div"); grp.className = "unit-grp";
    UNIT_OPTIONS[g].forEach((o) => {
      const b = document.createElement("button");
      b.className = "unit-opt" + (units[g] === o.id ? " on" : "");
      b.textContent = o.label;
      b.addEventListener("click", () => {
        if (units[g] === o.id) return;
        units[g] = o.id; save(K.units, units);
        renderUnitsBar();
        if (g === "clock") renderAll(); else if (loc) refresh(loc); // re-fetch si unité API
      });
      grp.appendChild(b);
    });
    wrap.appendChild(grp);
  }
}

function renderCurrent(fc) {
  const c = fc.current, h = fc.hourly, i = nowIndex(fc), d = fc.daily;
  const code = c.weather_code, isDay = c.is_day;
  const w = wmo(code);
  $("cur-icon").innerHTML = weatherIcon(w.icon, isDay);
  $("cur-temp").innerHTML = `${fmt(c.temperature_2m)}<span class="deg">${sym("temp")}</span>`;
  $("cur-label").textContent = w.label;
  $("cur-feels").textContent = `Ressenti ${fmt(c.apparent_temperature)} ${sym("temp")}`;
  $("cur-hilo").textContent = `↑ ${fmt(d.temperature_2m_max[0])}°  ↓ ${fmt(d.temperature_2m_min[0])}°`;
  const bf = beaufort(toKmh(c.wind_speed_10m));
  $("cur-wind").innerHTML = `<span class="ci">💨</span>${fmt(c.wind_speed_10m)} ${sym("wind")} <span class="dir">${cardinal(c.wind_direction_10m)}</span> · raf. ${fmt(c.wind_gusts_10m)}${bf ? ` · F${bf.f}` : ""}`;
  $("cur-humidity").textContent = `${fmt(c.relative_humidity_2m)} %`;
  $("cur-dewpoint").textContent = `${fmt(h.dew_point_2m?.[i])} ${sym("temp")}`;
  $("cur-pressure").textContent = `${fmt(c.pressure_msl)} hPa`;
  $("cur-cloud").textContent = `${fmt(c.cloud_cover)} %`;
  $("cur-visibility").textContent = `${fmt((h.visibility?.[i] ?? 0) / 1000, 1)} km`;
  $("cur-uv").textContent = fmt(h.uv_index?.[i], 1);
}

function renderNowcast(fc) {
  const m = fc.minutely_15; const card = $("nowcast-card");
  if (!m?.time) { card.hidden = true; return; }
  const start = idxAtOrAfter(m.time, fc.current.time);
  const slice = m.precipitation.slice(start, start + 8); // ~2 h
  const times = m.time.slice(start, start + 8);
  if (!slice.length) { card.hidden = true; return; }
  card.hidden = false;
  $("nowcast-chart").innerHTML = nowcastBars({ values: slice, labels: times, fmtHour });
  const first = slice.findIndex((v) => v > 0.05);
  const next1h = slice.slice(0, 4).some((v) => v > 0.05);
  $("nowcast-phrase").textContent = first < 0 || !next1h
    ? "Pas de pluie attendue dans l'heure."
    : first === 0 ? "Pluie en cours." : `Pluie attendue vers ${clock(times[first])}.`;
}

function renderAlerts(fc, vigil) {
  const list = $("alerts-list"); list.innerHTML = "";
  const d = fc.daily;
  let items = [];
  if (vigil && vigil.length) {
    items = vigil; $("alerts-source").textContent = "Vigilance Météo-France";
  } else {
    $("alerts-source").textContent = "Alertes calculées (Open-Meteo)";
    // calcule sur aujourd'hui + demain
    for (let day = 0; day < 2; day++) {
      const metrics = {
        gust: toKmh(d.wind_gusts_10m_max?.[day]),
        precip: toMm(d.precipitation_sum?.[day]),
        tmax: toC(d.temperature_2m_max?.[day]),
        tmin_neg: -toC(d.temperature_2m_min?.[day]),
      };
      for (const a of HOME_ALERTS) {
        const v = metrics[a.metric]; if (v == null) continue;
        const hit = a.levels.find((l) => v >= l.min);
        if (hit && !items.some((it) => it.id === a.id)) {
          items.push({ id: a.id, level: hit.level, icon: a.icon, name: a.name, msg: a.msg(metrics[a.metric === "tmin_neg" ? "tmin_neg" : a.metric]), when: day === 0 ? "aujourd'hui" : "demain" });
        }
      }
    }
  }
  if (!items.length) {
    list.innerHTML = `<div class="alert ok"><span class="ci">✓</span>Aucune alerte — conditions calmes.</div>`;
    return;
  }
  for (const it of items) {
    const el = document.createElement("div");
    el.className = "alert"; el.dataset.level = it.level;
    el.innerHTML = `<span class="ci">${it.icon || "⚠️"}</span><b>${it.name}</b> ${it.msg || ""} ${it.when ? `<span class="when">${it.when}</span>` : ""}`;
    list.appendChild(el);
  }
}

function renderHourly(fc) {
  const h = fc.hourly, i = nowIndex(fc), end = i + 48;
  const times = h.time.slice(i, end);
  const c = meteogram({
    times, temp: h.temperature_2m.slice(i, end), precip: h.precipitation.slice(i, end),
    fmtHour, tempSym: sym("temp"), precipSym: sym("precip"),
  });
  const el = $("hourly-chart"); el.innerHTML = c.html; c.attach(el);
}

function renderDaily(fc) {
  const d = fc.daily, wrap = $("daily-list"); wrap.innerHTML = "";
  for (let k = 0; k < d.time.length; k++) {
    const w = wmo(d.weather_code[k]);
    const row = document.createElement("div"); row.className = "day-row";
    row.innerHTML = `
      <span class="day-name">${k === 0 ? "Auj." : frDay(d.time[k])}</span>
      <span class="day-ico">${weatherIcon(w.icon, 1)}</span>
      <span class="day-prec">${d.precipitation_sum[k] > 0 ? `<span class="ci">💧</span>${fmt(d.precipitation_sum[k], 1)}${sym("precip")}` : ""}</span>
      <span class="day-temps"><b>${fmt(d.temperature_2m_max[k])}°</b> <span class="lo">${fmt(d.temperature_2m_min[k])}°</span></span>`;
    row.title = `${w.label} · vent ${fmt(d.wind_speed_10m_max[k])} ${sym("wind")} · ${clock(d.sunrise[k])}→${clock(d.sunset[k])}`;
    wrap.appendChild(row);
  }
}

function renderDetails(fc) {
  const c = fc.current, h = fc.hourly, i = nowIndex(fc);
  const cells = [
    ["Humidité", `${fmt(c.relative_humidity_2m)} %`],
    ["Point de rosée", `${fmt(h.dew_point_2m?.[i])} ${sym("temp")}`],
    ["Pression", `${fmt(c.pressure_msl)} hPa`],
    ["Visibilité", `${fmt((h.visibility?.[i] ?? 0) / 1000, 1)} km`],
    ["Nébulosité", `${fmt(c.cloud_cover)} %`],
    ["Nuages bas/moy/haut", `${fmt(h.cloud_cover_low?.[i])}/${fmt(h.cloud_cover_mid?.[i])}/${fmt(h.cloud_cover_high?.[i])} %`],
    ["Indice UV", fmt(h.uv_index?.[i], 1)],
    ["CAPE", `${fmt(h.cape?.[i])} J/kg`],
    ["Iso 0 °C", `${fmt(h.freezing_level_height?.[i])} m`],
  ];
  $("details-grid").innerHTML = cells.map(([l, v]) => `<div class="det"><div class="det-l">${l}</div><div class="det-v">${v}</div></div>`).join("");
}

function renderWind(fc) {
  const c = fc.current, h = fc.hourly, i = nowIndex(fc);
  // rose : 24 h à venir, vitesse moyenne par secteur (16)
  const sums = new Array(16).fill(0), cnt = new Array(16).fill(0);
  for (let k = i; k < Math.min(i + 24, h.time.length); k++) {
    const dir = h.wind_direction_10m[k], sp = h.wind_speed_10m[k];
    if (dir == null || sp == null) continue;
    const s = Math.round(dir / 22.5) % 16; sums[s] += sp; cnt[s]++;
  }
  const bins = sums.map((s, k) => (cnt[k] ? s / cnt[k] : 0));
  $("wind-rose").innerHTML = windRose({ bins, sym: sym("wind") });
  const bf = beaufort(toKmh(c.wind_speed_10m));
  $("wind-beaufort").innerHTML = `<b>${fmt(c.wind_speed_10m)}</b> ${sym("wind")} <span class="dir">${cardinal(c.wind_direction_10m)}</span><div class="bf">${bf ? `Force ${bf.f} — ${bf.label}` : ""} · rafales ${fmt(c.wind_gusts_10m)} ${sym("wind")}</div>`;
  const lv = [["10 m", h.wind_speed_10m], ["80 m", h.wind_speed_80m], ["120 m", h.wind_speed_120m], ["180 m", h.wind_speed_180m]];
  $("wind-levels").innerHTML = lv.map(([l, arr]) => `<div class="wl"><span>${l}</span><b>${fmt(arr?.[i])}</b> ${sym("wind")}</div>`).join("");
}

function renderSun(fc) {
  const d = fc.daily;
  $("sun-rise").textContent = clock(d.sunrise[0]);
  $("sun-set").textContent = clock(d.sunset[0]);
  const dl = d.daylight_duration[0] / 3600, sh = d.sunshine_duration[0] / 3600;
  $("sun-daylight").textContent = `${Math.floor(dl)} h ${String(Math.round((dl % 1) * 60)).padStart(2, "0")}`;
  $("sun-sunshine").textContent = `${fmt(sh, 1)} h`;
  // golden / blue hour à partir du lever/coucher
  const sr = d.sunrise[0], ss = d.sunset[0];
  $("golden-am").textContent = `${clock(sr)} – ${addMin(sr, 60)}`;
  $("golden-pm").textContent = `${addMin(ss, -60)} – ${clock(ss)}`;
  $("blue-am").textContent = `${addMin(sr, -30)} – ${clock(sr)}`;
  $("blue-pm").textContent = `${clock(ss)} – ${addMin(ss, 30)}`;
  const mp = moonPhase(new Date());
  $("moon-icon").textContent = mp.emoji;
  $("moon-phase").textContent = `${mp.name} · ${Math.round(mp.illum * 100)} %`;
}
function addMin(iso, mins) {
  const [hh, mm] = [Number(iso.slice(11, 13)), Number(iso.slice(14, 16))];
  let t = hh * 60 + mm + mins; t = ((t % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60), m = t % 60;
  return clock(`0000-00-00T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
}
function moonPhase(date) {
  const syn = 29.530588853;
  const ref = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
  const now = date.getTime() / 86400000;
  const age = (((now - ref) % syn) + syn) % syn;
  const frac = age / syn;
  const illum = (1 - Math.cos(2 * Math.PI * frac)) / 2;
  const names = ["Nouvelle lune", "Premier croissant", "Premier quartier", "Gibbeuse croissante", "Pleine lune", "Gibbeuse décroissante", "Dernier quartier", "Dernier croissant"];
  const emojis = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
  const k = Math.round(frac * 8) % 8;
  return { name: names[k], emoji: emojis[k], illum };
}

function renderModels(md, fc) {
  if (!md?.hourly) { $("models-card").hidden = true; return; }
  $("models-card").hidden = false;
  const h = md.hourly, t = h.time;
  // fenêtre : à partir de maintenant, 96 h
  const start = idxAtOrAfter(t, fc.current.time);
  const end = start + 96;
  const series = MODELS.map((m) => ({
    label: m.label, color: m.color,
    values: (h["temperature_2m_" + m.id] || []).slice(start, end),
  })).filter((s) => s.values.some((v) => v != null));
  const out = multiLine({ times: t.slice(start, end), series, fmtHour, sym: sym("temp") });
  const mel = $("models-chart"); mel.innerHTML = out.html; out.attach(mel);
  $("models-legend").innerHTML = series.map((s) => `<span class="leg"><span class="leg-c" style="background:${s.color}"></span>${s.label}</span>`).join("");
}

function renderClimate(normals, fc) {
  const card = $("climate-card");
  if (!normals?.daily?.time) { card.hidden = true; return; }
  card.hidden = false;
  const t = normals.daily.time, means = normals.daily.temperature_2m_mean;
  const today = new Date();
  const mmdd = (s) => s.slice(5); // MM-DD
  const target = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  // fenêtre ±7 jours autour de la date (toutes années)
  const win = [];
  const td = today.getMonth() * 31 + today.getDate();
  for (let k = 0; k < t.length; k++) {
    const [Y, M, D] = t[k].split("-").map(Number);
    const dd = (M - 1) * 31 + D;
    if (Math.abs(dd - td) <= 7 && means[k] != null) win.push(means[k]);
  }
  if (!win.length) { card.hidden = true; return; }
  const normal = win.reduce((a, b) => a + b, 0) / win.length;
  const value = (fc.daily.temperature_2m_max[0] + fc.daily.temperature_2m_min[0]) / 2;
  $("climate-anomaly").innerHTML = anomalyBar({ value, normal, sym: sym("temp") });
  const d = value - normal;
  $("climate-text").textContent = Math.abs(d) < 0.5
    ? "Journée conforme à la normale de saison."
    : `Température du jour ${d > 0 ? "au-dessus" : "en dessous"} de la normale de saison (${win.length} relevés sur ~10 ans).`;
}

// --- radar Leaflet + RainViewer --------------------------------------------
let map = null, radarLayer = null, frames = [], frameIdx = 0, radarTimer = null, radarHost = "";
function ensureMap() {
  if (map || !window.L) return;
  map = L.map("radar-map", { attributionControl: true, zoomControl: true }).setView([loc.coords.lat, loc.coords.lon], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 12, attribution: "© OpenStreetMap · Radar © RainViewer",
  }).addTo(map);
  L.circleMarker([loc.coords.lat, loc.coords.lon], { radius: 5, color: "var(--accent)", fillColor: "#ff6b00", fillOpacity: 1, weight: 2 }).addTo(map);
}
function showFrame(k) {
  if (!frames.length || !map) return;
  frameIdx = (k + frames.length) % frames.length;
  const f = frames[frameIdx];
  const url = `${radarHost}${f.path}/256/{z}/{x}/{y}/2/1_1.png`;
  if (radarLayer) map.removeLayer(radarLayer);
  radarLayer = L.tileLayer(url, { opacity: 0.6, maxNativeZoom: 7, maxZoom: 12 }).addTo(map);
  const d = new Date(f.time * 1000);
  $("radar-time").textContent = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) + (f.nowcast ? " (prév.)" : "");
}
function playRadar(play) {
  $("radar-play").textContent = play ? "⏸" : "▶";
  if (radarTimer) { clearInterval(radarTimer); radarTimer = null; }
  if (play) radarTimer = setInterval(() => showFrame(frameIdx + 1), 700);
}
async function setupRadar() {
  if (!loc) return;
  ensureMap();
  if (map) map.setView([loc.coords.lat, loc.coords.lon], 7);
  try {
    const rv = await fetchRadar();
    radarHost = rv.host;
    const past = (rv.radar?.past || []).map((f) => ({ ...f, nowcast: false }));
    const now = (rv.radar?.nowcast || []).map((f) => ({ ...f, nowcast: true }));
    frames = [...past, ...now];
    if (frames.length) { showFrame(frames.length - 1); playRadar(true); }
  } catch (_) { $("radar-time").textContent = "radar indisponible"; }
}

// --- thème -----------------------------------------------------------------
function setupTheme() {
  const icon = $("themeIcon");
  const apply = (t) => {
    if (t === "light") { document.documentElement.setAttribute("data-theme", "light"); icon.textContent = "☀"; }
    else { document.documentElement.removeAttribute("data-theme"); icon.textContent = "☾"; }
  };
  apply(localStorage.getItem(K.theme) || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
  $("themeToggle").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    localStorage.setItem(K.theme, next); apply(next);
  });
}

function setStatus(s) {
  const el = $("status"); if (!el) return;
  el.dataset.state = s;
  el.innerHTML = '<span class="pulse" aria-hidden="true"></span>' + (s === "live" ? "Open-Meteo · en direct" : s === "cache" ? "données en cache" : "hors ligne");
}

// ===========================================================================
// ORCHESTRATION
// ===========================================================================
function renderAll() {
  if (!data?.fc) return;
  renderPlace();
  renderCurrent(data.fc);
  renderNowcast(data.fc);
  renderAlerts(data.fc, data.vigil);
  renderHourly(data.fc);
  renderDaily(data.fc);
  renderDetails(data.fc);
  renderWind(data.fc);
  renderSun(data.fc);
  renderModels(data.models, data.fc);
  renderClimate(data.normals, data.fc);
  $("updated").textContent = new Date(data.savedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

async function refresh(l) {
  setStatus("cache");
  try {
    if (l.elev === undefined) { l.elev = await fetchElevation(l.coords.lat, l.coords.lon); save(K.loc, loc); }
    const fc = await fetchForecast(l.coords.lat, l.coords.lon, units, l.elev);
    data = { fc, savedAt: Date.now() };
    renderAll();
    setStatus("live");
    // modules secondaires en parallèle (non bloquants)
    const today = new Date();
    const start = `${today.getFullYear() - 10}-01-01`;
    const end = today.toISOString().slice(0, 10);
    fetchModels(l.coords.lat, l.coords.lon, units).then((m) => { data.models = m; renderModels(m, fc); }).catch(() => {});
    fetchNormals(l.coords.lat, l.coords.lon, start, end, units.temp).then((n) => { data.normals = n; renderClimate(n, fc); }).catch(() => {});
    fetchVigilance().then(async (v) => {
      if (!v) return;
      const dept = await fetchDept(l.coords.lat, l.coords.lon).catch(() => null);
      data.vigil = parseVigilance(v, dept);
      if (data.vigil) renderAlerts(fc, data.vigil);
    }).catch(() => {});
    setupRadar();
  } catch (e) {
    if (!data) { setStatus("error"); $("alerts-source").textContent = "données indisponibles"; }
    console.warn("ZÉPHYR:", e);
  }
}

// Trouve, dans une période, le tableau des domaines (départements).
function findDomains(o, depth) {
  if (depth > 6 || !o || typeof o !== "object") return null;
  if (Array.isArray(o) && o.length && o[0] && typeof o[0] === "object" && "domain_id" in o[0] && "max_color_id" in o[0]) return o;
  for (const k in o) { const r = findDomains(o[k], depth + 1); if (r) return r; }
  return null;
}

// Parse la vigilance MF pour le département `dept` (sinon repli national).
// Renvoie un tableau d'items d'alerte (ou null → bascule alertes maison).
function parseVigilance(v, dept) {
  if (!v || !v.product) return null;
  const p = v.product;
  let maxColor = 0, found = false; const phenMax = {};
  for (const per of p.periods || []) {
    const domains = findDomains(per, 0) || [];
    const dom = dept ? domains.find((x) => x.domain_id === dept) : null;
    if (!dom) continue;
    found = true;
    maxColor = Math.max(maxColor, Number(dom.max_color_id) || 0);
    for (const ph of dom.phenomenon_items || []) {
      const c = Number(ph.phenomenon_max_color_id) || 0;
      phenMax[ph.phenomenon_id] = Math.max(phenMax[ph.phenomenon_id] || 0, c);
    }
  }
  if (found) {
    const col = maxColor || 1;
    const lvl = VIGILANCE_COLORS[col] || "jaune";
    if (col < 2) return [{ id: "mf", level: "vert", icon: "🛡️", name: "Vigilance verte", msg: "aucune vigilance en cours", when: "dépt " + dept }];
    const names = Object.entries(phenMax).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).map(([id]) => PHENOMENONS[id] || `Phéno ${id}`);
    return [{ id: "mf", level: lvl, icon: "🛡️", name: `Vigilance ${lvl}`, msg: names.join(", ") || `niveau ${lvl}`, when: "dépt " + dept }];
  }
  const g = Number(p.global_max_color_id) || 0;
  if (g < 2) return null;
  const lvl = VIGILANCE_COLORS[g] || "jaune";
  return [{ id: "mf", level: lvl, icon: "🛡️", name: `Vigilance ${lvl}`, msg: "niveau maximal en France", when: "national" }];
}

function setLocation(coords, place) {
  loc = { coords, place }; save(K.loc, loc);
  renderPlace();
  refresh(loc);
}

function setupControls() {
  // géoloc
  $("geo-btn").addEventListener("click", () => {
    if (!navigator.geolocation) return;
    const b = $("geo-btn"); b.disabled = true; b.textContent = "📍 …";
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const coords = { lat: +pos.coords.latitude.toFixed(4), lon: +pos.coords.longitude.toFixed(4) };
      const place = await reverseGeocode(coords.lat, coords.lon);
      setLocation(coords, place || { name: "Ma position", admin1: "", country: "" });
      b.disabled = false; b.textContent = "📍 Ma position";
    }, () => { b.disabled = false; b.textContent = "📍 Refusé"; }, { timeout: 10000, maximumAge: 6e5 });
  });
  // favoris
  $("fav-add").addEventListener("click", () => {
    if (!loc) return;
    if (!favs.some((f) => f.coords.lat === loc.coords.lat && f.coords.lon === loc.coords.lon)) {
      favs.push({ coords: loc.coords, place: loc.place }); save(K.favs, favs); renderFavs();
    }
  });
  // recherche
  const input = $("search-input"), results = $("search-results"); let timer = null;
  const close = () => { results.hidden = true; results.innerHTML = ""; };
  input.addEventListener("input", () => {
    clearTimeout(timer); const q = input.value.trim();
    if (q.length < 2) return close();
    timer = setTimeout(async () => {
      let list = []; try { list = await geocode(q); } catch (_) {}
      if (!list.length) return close();
      results.innerHTML = "";
      list.forEach((r) => {
        const li = document.createElement("li"); li.setAttribute("role", "option");
        li.innerHTML = `${r.name}<span class="sr-sub"> — ${[r.admin1, r.country].filter(Boolean).join(", ")}</span>`;
        li.addEventListener("click", () => { input.value = r.name; close(); setLocation({ lat: r.latitude, lon: r.longitude }, { name: r.name, admin1: r.admin1, country: r.country }); });
        results.appendChild(li);
      });
      results.hidden = false;
    }, 300);
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".search-wrap")) close(); });
}

function init() {
  setupTheme();
  setupControls();
  renderUnitsBar();
  if (loc) { renderPlace(); refresh(loc); } else { renderFavs(); }
  setInterval(() => { if (data?.fc) { renderCurrent(data.fc); renderNowcast(data.fc); } }, 60000);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
}
init();
