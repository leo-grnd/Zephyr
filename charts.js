// charts.js — graphiques inline-SVG, zéro dépendance. Chaque fonction renvoie
// une chaîne <svg>. Couleurs via variables CSS (héritées du document).

const num = (v) => (v == null || Number.isNaN(v) ? null : v);
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

function extent(vals, pad = 1) {
  const v = vals.filter((x) => x != null);
  if (!v.length) return [0, 1];
  let lo = Math.min(...v), hi = Math.max(...v);
  if (lo === hi) { lo -= 1; hi += 1; }
  return [lo - pad, hi + pad];
}

function linePath(pts) {
  return pts.map((p, i) => (i ? "L" : "M") + round(p[0], 2) + " " + round(p[1], 2)).join(" ");
}

/* Curseur interactif : barre verticale + points + infobulle au survol.
   Renvoie attach(container) à appeler après insertion du <svg>. */
function attachCrosshair({ W, padL, innerW, padT, ih, n, times, series, fmtHour, valueSym = "", extra = null }) {
  return function attach(container) {
    if (!container) return;
    const svg = container.querySelector("svg");
    if (!svg || n < 2) return;
    const NS = "http://www.w3.org/2000/svg";
    const line = document.createElementNS(NS, "line");
    line.setAttribute("class", "cursor-line");
    line.setAttribute("y1", padT); line.setAttribute("y2", padT + ih);
    line.style.display = "none";
    svg.appendChild(line);
    const dots = series.map((s) => {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("class", "cursor-dot"); c.setAttribute("r", "3.2"); c.setAttribute("fill", s.color);
      c.style.display = "none"; svg.appendChild(c); return c;
    });
    const tip = document.createElement("div");
    tip.className = "chart-tip"; tip.hidden = true; container.appendChild(tip);
    const xAt = (i) => padL + (i / (n - 1)) * innerW;
    function move(e) {
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const fx = (e.clientX - rect.left) / rect.width;
      let i = Math.round(((fx * W) - padL) / innerW * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      const lx = xAt(i);
      line.setAttribute("x1", lx); line.setAttribute("x2", lx); line.style.display = "";
      let rows = "";
      series.forEach((s, k) => {
        const v = s.values[i];
        if (v == null) { dots[k].style.display = "none"; return; }
        dots[k].setAttribute("cx", lx); dots[k].setAttribute("cy", round(s.toY(v), 2)); dots[k].style.display = "";
        rows += `<div class="tip-row"><span class="tip-c" style="background:${s.color}"></span>${s.label ? s.label + " " : ""}<b>${round(v, 1)}${valueSym}</b></div>`;
      });
      if (extra) rows += extra(i);
      tip.innerHTML = `<div class="tip-h">${fmtHour(times[i])}</div>${rows}`;
      tip.hidden = false;
      const px = Math.max(44, Math.min(rect.width - 44, (lx / W) * rect.width));
      tip.style.left = px + "px";
    }
    function leave() { line.style.display = "none"; dots.forEach((d) => (d.style.display = "none")); tip.hidden = true; }
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerleave", leave);
    svg.style.cursor = "crosshair";
  };
}

/* Méteogramme : courbe de température (accent) + barres de précipitation (sky)
   + axe horaire. times = ISO[], temp = number[], precip = number[].
   fmtHour(iso) → libellé ; showEvery = pas d'étiquettes. */
export function meteogram({ times, temp, precip, fmtHour, tempSym = "°", precipSym = "mm" }) {
  const W = 640, H = 190, padL = 8, padR = 8, padT = 14, padB = 28;
  const n = temp.length;
  if (!n) return { html: "", attach() {} };
  const iw = W - padL - padR, ih = H - padT - padB;
  const x = (i) => padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const [lo, hi] = extent(temp, 1.5);
  const ty = (v) => padT + ih - ((v - lo) / (hi - lo)) * ih;
  const pmax = Math.max(2, ...precip.map((p) => p || 0));

  const pts = temp.map((v, i) => [x(i), ty(num(v) == null ? lo : v)]);
  const line = linePath(pts);
  const area = `${line} L${round(x(n - 1), 2)} ${padT + ih} L${round(x(0), 2)} ${padT + ih} Z`;

  const bw = Math.max(1, (iw / n) * 0.62);
  let bars = "";
  precip.forEach((p, i) => {
    if (!p) return;
    const h = (p / pmax) * (ih * 0.55);
    bars += `<rect x="${round(x(i) - bw / 2, 2)}" y="${round(padT + ih - h, 2)}" width="${round(bw, 2)}" height="${round(h, 2)}" fill="var(--sky)" opacity="0.7"/>`;
  });

  let labels = "", grid = "";
  const step = Math.max(1, Math.round(n / 8));
  for (let i = 0; i < n; i += step) {
    grid += `<line x1="${round(x(i), 2)}" y1="${padT}" x2="${round(x(i), 2)}" y2="${padT + ih}" stroke="var(--border)" stroke-width="1" opacity="0.5"/>`;
    labels += `<text x="${round(x(i), 2)}" y="${H - 9}" text-anchor="middle" font-size="10" fill="var(--ink-dim)">${fmtHour(times[i])}</text>`;
  }
  // étiquettes min/max température
  const tmaxV = Math.max(...temp.filter((v) => v != null));
  const tminV = Math.min(...temp.filter((v) => v != null));

  const html = `<svg viewBox="0 0 ${W} ${H}" class="chart" preserveAspectRatio="none" role="img">
    ${grid}${bars}
    <path d="${area}" fill="var(--accent)" opacity="0.10"/>
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
    <text x="${padL}" y="${ty(tmaxV) - 5}" font-size="10" fill="var(--ink)">${round(tmaxV)}${tempSym}</text>
    <text x="${padL}" y="${Math.min(H - padB, ty(tminV) + 12)}" font-size="10" fill="var(--ink-dim)">${round(tminV)}${tempSym}</text>
    ${labels}
  </svg>`;
  const attach = attachCrosshair({
    W, padL, innerW: iw, padT, ih, n, times, fmtHour, valueSym: tempSym,
    series: [{ color: "var(--accent)", label: "", values: temp, toY: ty }],
    extra: (i) => (precip[i] > 0 ? `<div class="tip-row"><span class="tip-c" style="background:var(--sky)"></span><b>${round(precip[i], 1)} ${precipSym}</b></div>` : ""),
  });
  return { html, attach };
}

/* Barres de pluie minute (nowcast 15 min). values en mm. */
export function nowcastBars({ values, labels, fmtHour }) {
  const W = 640, H = 110, padL = 8, padR = 8, padT = 12, padB = 22;
  const n = values.length;
  if (!n) return "";
  const iw = W - padL - padR, ih = H - padT - padB;
  const pmax = Math.max(1, ...values.map((v) => v || 0));
  const bw = (iw / n) * 0.7;
  const x = (i) => padL + (i / n) * iw + (iw / n - bw) / 2;
  let bars = "", lab = "";
  values.forEach((v, i) => {
    const h = ((v || 0) / pmax) * ih;
    const dry = !v;
    bars += `<rect x="${round(x(i), 2)}" y="${round(padT + ih - Math.max(h, dry ? 1 : 2), 2)}" width="${round(bw, 2)}" height="${round(Math.max(h, dry ? 1 : 2), 2)}" fill="${dry ? "var(--border)" : "var(--sky)"}" rx="1"/>`;
  });
  const step = Math.max(1, Math.round(n / 6));
  for (let i = 0; i < n; i += step) {
    lab += `<text x="${round(x(i) + bw / 2, 2)}" y="${H - 6}" text-anchor="middle" font-size="9" fill="var(--ink-dim)">${fmtHour(labels[i])}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" preserveAspectRatio="none" role="img">${bars}${lab}</svg>`;
}

/* Multi-courbes (comparaison de modèles). series = [{label,color,values}]. */
export function multiLine({ times, series, fmtHour, sym = "°" }) {
  const W = 640, H = 200, padL = 8, padR = 8, padT = 14, padB = 28;
  const all = series.flatMap((s) => s.values).filter((v) => v != null);
  if (!all.length) return { html: "", attach() {} };
  const n = Math.max(...series.map((s) => s.values.length));
  const iw = W - padL - padR, ih = H - padT - padB;
  const x = (i) => padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  let lo = Math.min(...all) - 1.5, hi = Math.max(...all) + 1.5;
  const y = (v) => padT + ih - ((v - lo) / (hi - lo)) * ih;
  let paths = "";
  series.forEach((s) => {
    const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    if (pts.length) paths += `<path d="${linePath(pts)}" fill="none" stroke="${s.color}" stroke-width="1.8" stroke-linejoin="round" opacity="0.9"/>`;
  });
  let labels = "", grid = "";
  const step = Math.max(1, Math.round(n / 7));
  for (let i = 0; i < n; i += step) {
    grid += `<line x1="${round(x(i), 2)}" y1="${padT}" x2="${round(x(i), 2)}" y2="${padT + ih}" stroke="var(--border)" stroke-width="1" opacity="0.4"/>`;
    labels += `<text x="${round(x(i), 2)}" y="${H - 9}" text-anchor="middle" font-size="10" fill="var(--ink-dim)">${fmtHour(times[i])}</text>`;
  }
  const html = `<svg viewBox="0 0 ${W} ${H}" class="chart" preserveAspectRatio="none" role="img">${grid}${paths}<text x="${padL}" y="${y(hi - 1.5) + 4}" font-size="10" fill="var(--ink-dim)">${round(hi - 1.5)}${sym}</text><text x="${padL}" y="${y(lo + 1.5)}" font-size="10" fill="var(--ink-dim)">${round(lo + 1.5)}${sym}</text></svg>`;
  const attach = attachCrosshair({
    W, padL, innerW: iw, padT, ih, n, times, fmtHour, valueSym: sym,
    series: series.map((s) => ({ color: s.color, label: s.label, values: s.values, toY: y })),
  });
  return { html, attach };
}

/* Rose des vents : bins = number[16] (vitesse moyenne ou fréquence par secteur,
   N=0). Pétales orientés, longueur ∝ valeur. */
export function windRose({ bins, sym = "km/h" }) {
  const W = 220, H = 220, cx = 110, cy = 110, R = 86;
  const max = Math.max(1, ...bins.filter((v) => v != null));
  let petals = "";
  bins.forEach((v, i) => {
    if (!v) return;
    const ang = (i * 22.5 - 90) * Math.PI / 180;
    const len = (v / max) * R;
    const w = 9;
    const ax = cx + Math.cos(ang) * len, ay = cy + Math.sin(ang) * len;
    const px = cx + Math.cos(ang + Math.PI / 2) * w, py = cy + Math.sin(ang + Math.PI / 2) * w;
    const qx = cx + Math.cos(ang - Math.PI / 2) * w, qy = cy + Math.sin(ang - Math.PI / 2) * w;
    const op = 0.35 + 0.65 * (v / max);
    petals += `<path d="M${round(px,1)} ${round(py,1)} L${round(ax,1)} ${round(ay,1)} L${round(qx,1)} ${round(qy,1)} Z" fill="var(--accent)" opacity="${round(op,2)}"/>`;
  });
  const rings = [R, R * 0.66, R * 0.33].map((r) => `<circle cx="${cx}" cy="${cy}" r="${round(r,1)}" fill="none" stroke="var(--border)" stroke-width="1"/>`).join("");
  const ticks = ["N", "E", "S", "O"].map((t, i) => {
    const a = (i * 90 - 90) * Math.PI / 180;
    return `<text x="${round(cx + Math.cos(a) * (R + 12),1)}" y="${round(cy + Math.sin(a) * (R + 12) + 4,1)}" text-anchor="middle" font-size="11" fill="var(--ink-dim)">${t}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="rose" role="img">${rings}${ticks}${petals}<circle cx="${cx}" cy="${cy}" r="2.5" fill="var(--ink-dim)"/></svg>`;
}

/* Anomalie climatique : barre divergente value vs normal. */
export function anomalyBar({ value, normal, sym = "°" }) {
  if (value == null || normal == null) return "";
  const d = value - normal;
  const W = 320, H = 56, mid = W / 2, scale = 8; // px par degré
  const len = Math.max(-mid + 10, Math.min(mid - 10, d * scale));
  const col = d >= 0 ? "var(--accent)" : "var(--sky)";
  const x = d >= 0 ? mid : mid + len;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">
    <line x1="${mid}" y1="6" x2="${mid}" y2="${H - 18}" stroke="var(--border)" stroke-width="1"/>
    <rect x="${round(x,1)}" y="14" width="${round(Math.abs(len),1)}" height="16" fill="${col}" rx="2"/>
    <text x="${mid}" y="${H - 4}" text-anchor="middle" font-size="10" fill="var(--ink-dim)">normale ${round(normal)}${sym}</text>
    <text x="${d >= 0 ? mid + Math.abs(len) + 5 : mid - Math.abs(len) - 5}" y="26" text-anchor="${d >= 0 ? "start" : "end"}" font-size="12" fill="${col}" font-weight="bold">${d >= 0 ? "+" : ""}${round(d)}${sym}</text>
  </svg>`;
}
