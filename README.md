# ZÉPHYR — Météo ultra-précise

Tableau de bord météo **statique** et complet, dans la lignée des outils de Léo Garnaud. Pour un lieu donné (géoloc ou recherche, villes favorites) :

- **Conditions en direct** : température, ressenti, icône/état, vent (force, rafales, direction), humidité, point de rosée, pression, nébulosité, visibilité, UV.
- **Pluie dans l'heure** (nowcast 15 min).
- **Alertes** : vigilance officielle Météo-France si un token est configuré, sinon **alertes calculées** (vent, fortes pluies, canicule, grand froid).
- **Prévision horaire 48 h** (méteogramme) et **14 jours**.
- **Radar de précipitations animé** (carte).
- **Comparaison de modèles** (ECMWF / GFS / ICON / Météo-France).
- **Climat** : température du jour vs normale de saison.
- **Vent** : rose des vents, Beaufort, vent à 10/80/120/180 m.
- **Soleil & lune** : lever/coucher, durée du jour, ensoleillement, heure dorée/bleue, phase de lune.
- **Confort** : villes favorites, bascule d'unités (°C/°F, km/h·m/s·kt·mph, mm/in, 12/24 h).

## Données

- **Open-Meteo** (prévisions, `minutely_15`, modèles, archives climat) — gratuit, **sans clé**.
- **RainViewer** (radar) — gratuit, **sans clé**. Fond de carte © OpenStreetMap.
- **Météo-France Vigilance** (optionnel) — **nécessite un token** : créez un compte sur [portail-api.meteofrance.fr](https://portail-api.meteofrance.fr/), créez une application « Vigilance météorologique », puis collez la clé dans `MF_TOKEN` (`config.js`). ⚠️ La clé est visible côté client (site statique). Sans token, ZÉPHYR utilise des alertes calculées.

Aucune donnée personnelle collectée ; la position sert uniquement à interroger les API.

## Stack

HTML / CSS / JS **vanilla** (ES modules), **zéro build**. Seule dépendance externe : **Leaflet** (CDN) pour la carte radar. Graphiques en **inline-SVG** maison. PWA (hors-ligne) ; `config.js` = point d'édition unique (codes WMO, unités, modèles, seuils, token).

```bash
python -m http.server 8500 --directory .
# http://localhost:8500
```

## Déploiement

GitHub Pages depuis `main` (racine), `.nojekyll`. Servi à `https://leo-grnd.github.io/Weather/`.

## Licence

MIT — voir [LICENSE](LICENSE).
