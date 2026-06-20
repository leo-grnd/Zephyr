// icons.js — glyphes météo inline-SVG (monoline). Soleil/lune/éclair = var(--accent)
// ou currentColor ; nuages = currentColor. Variantes jour/nuit pour les ciels dégagés.

const SVG = (inner) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const RAYS = `<g stroke="var(--accent)"><line x1="12" y1="1.5" x2="12" y2="3.5"/><line x1="12" y1="20.5" x2="12" y2="22.5"/><line x1="1.5" y1="12" x2="3.5" y2="12"/><line x1="20.5" y1="12" x2="22.5" y2="12"/><line x1="4.6" y1="4.6" x2="6" y2="6"/><line x1="18" y1="18" x2="19.4" y2="19.4"/><line x1="4.6" y1="19.4" x2="6" y2="18"/><line x1="18" y1="6" x2="19.4" y2="4.6"/></g>`;
const SUN = `<circle cx="12" cy="12" r="4.5" stroke="var(--accent)"/>${RAYS}`;
const MOON = `<path d="M20 14.4A8 8 0 1 1 9.6 4 6.5 6.5 0 0 0 20 14.4z" stroke="var(--accent)"/>`;

const CLOUD = `<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" stroke="currentColor"/>`;
const CLOUD_HI = `<path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" stroke="currentColor"/>`;

const rain = (len) => `<g stroke="currentColor"><line x1="8" y1="19" x2="8" y2="${19 + len}"/><line x1="12" y1="20" x2="12" y2="${20 + len}"/><line x1="16" y1="19" x2="16" y2="${19 + len}"/></g>`;
const flakes = `<g stroke="currentColor"><line x1="8" y1="19.5" x2="8.01" y2="19.5"/><line x1="12" y1="21" x2="12.01" y2="21"/><line x1="16" y1="19.5" x2="16.01" y2="19.5"/><line x1="10" y1="22.5" x2="10.01" y2="22.5"/><line x1="14" y1="22.5" x2="14.01" y2="22.5"/></g>`;

const ICONS = {
  clear: SVG(SUN),
  "clear-night": SVG(MOON),
  "mainly-clear": SVG(SUN),
  "mainly-clear-night": SVG(MOON),
  "partly-cloudy": SVG(`<circle cx="8" cy="7" r="3" stroke="var(--accent)"/><g stroke="var(--accent)"><line x1="8" y1="1.7" x2="8" y2="3"/><line x1="2.7" y1="7" x2="4" y2="7"/><line x1="4.2" y1="3.2" x2="5.1" y2="4.1"/><line x1="11.8" y1="3.2" x2="10.9" y2="4.1"/></g>${CLOUD}`),
  "partly-cloudy-night": SVG(`<path d="M11 7.5A4.2 4.2 0 1 1 6.3 3 3.4 3.4 0 0 0 11 7.5z" stroke="var(--accent)"/>${CLOUD}`),
  overcast: SVG(`<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" stroke="currentColor" fill="currentColor" fill-opacity="0.12"/>`),
  fog: SVG(`${CLOUD_HI}<g stroke="currentColor"><line x1="6" y1="19.5" x2="18" y2="19.5"/><line x1="8" y1="22.5" x2="16" y2="22.5"/></g>`),
  drizzle: SVG(`${CLOUD_HI}${rain(1.5)}`),
  rain: SVG(`${CLOUD_HI}${rain(3)}`),
  "freezing-rain": SVG(`${CLOUD_HI}<g stroke="currentColor"><line x1="8" y1="19" x2="8" y2="21.5"/><line x1="16" y1="19" x2="16" y2="21.5"/><line x1="11" y1="21" x2="13" y2="23"/><line x1="13" y1="21" x2="11" y2="23"/></g>`),
  snow: SVG(`${CLOUD_HI}${flakes}`),
  showers: SVG(`${CLOUD_HI}<g stroke="currentColor"><line x1="8" y1="19" x2="6.8" y2="22.5"/><line x1="12" y1="19" x2="10.8" y2="22.5"/><line x1="16" y1="19" x2="14.8" y2="22.5"/></g>`),
  thunder: SVG(`<path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" stroke="currentColor"/><polyline points="13 11 9 17 15 17 11 23" stroke="var(--accent)"/>`),
};

// key = clé d'icône WMO (config.js), isDay = booléen (1/0). Renvoie le markup SVG.
export function weatherIcon(key, isDay) {
  if (!isDay && (key === "clear" || key === "mainly-clear" || key === "partly-cloudy")) {
    return ICONS[key + "-night"] || ICONS[key];
  }
  return ICONS[key] || ICONS.overcast;
}

export { ICONS };
