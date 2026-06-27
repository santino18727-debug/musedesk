# Déploiement — MuseDesk (GitHub Pages)

PWA 100 % statique, déployée via GitHub Actions sur GitHub Pages.

## 1. Activer Pages (une seule fois)

`Settings` → `Pages` → **Source : GitHub Actions**.

Le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) lance `node --test`
puis déploie la racine du repo à chaque push sur `main` (déploiement **uniquement si les tests passent**).

**URL de prod** : `https://santino18727-debug.github.io/musedesk/`
(project pages = sous-chemin `/musedesk/` ; l'app utilise des chemins relatifs `./`, donc compatible.)

## 2. Configurer Google Drive (OAuth)

Pour activer la synchro Drive sur mobile/tablette :

1. [Google Cloud Console](https://console.cloud.google.com/) → un projet → `APIs & Services` → `Credentials`.
2. Créer un **OAuth client ID** de type *Web application*.
3. **Authorized JavaScript origins** → ajouter **l'origine** (schéma + hôte, **sans** le sous-chemin) :
   ```
   https://santino18727-debug.github.io
   ```
   ⚠️ Une origine = `scheme://host`. Ne PAS mettre `/musedesk/` ici.
4. Écran de consentement OAuth : le **publier** (sinon écran « app non vérifiée » + plafond 100 utilisateurs test).
5. Renseigner le Client ID obtenu dans [`config.js`](config.js) (`GOOGLE_CLIENT_ID`).
   Un Client ID OAuth web est **public** (pas un secret) → commit OK. Ne jamais commit de `client_secret`.

Sur **PC** (Chrome/Edge), pas besoin d'OAuth : la synchro passe par un fichier local
(File System Access API) pointant un dossier déjà synchronisé (Drive/Dropbox desktop).

## 3. Limite GitHub Pages — en-têtes de sécurité

GitHub Pages ne permet pas de définir d'en-têtes HTTP custom. La **CSP** est donc posée
en `<meta http-equiv>` dans [`index.html`](index.html) (couvre l'essentiel anti-XSS).
Les en-têtes `Strict-Transport-Security`, `X-Content-Type-Options: nosniff` et
`frame-ancestors` ne sont **pas** disponibles ici. Si ce durcissement devient nécessaire,
migrer vers Cloudflare Pages ou Netlify (supportent un fichier `_headers`).

## 4. Rappel versioning (footgun)

À chaque modif d'un module ES : bumper le `?v=N` **partout de façon uniforme**
(`index.html`, `app.js`, `sync.js`, `fsprovider.js`, `db.js`, `sw.js`) **et** `CACHE` dans
[`sw.js`](sw.js). Sinon le navigateur sert un mélange d'anciennes/nouvelles versions et
`sync.js` perd son état module-level. *(Actuellement : `?v=6` + `CACHE='musedesk-v11'`.)*

## 5. Mode Pupitre — relais WebSocket (déploiement T450)

### Architecture

```
Client (config.js → RELAY_WS_URL)
  → Caddy (route handle /relay/*)
    → conteneur musedesk-relay:18800
      → Tailscale Funnel public (wss://alfredvps.tail33620f.ts.net/relay/ws)
```

Le relais vit dans `gabidevfamily-infra/musedesk-relay/` (`package.json`, `server.js`, `Dockerfile`). Sessions éphémères en RAM, zéro persistance. Aucune donnée ne quitte la RAM — RGPD-léger OK.

### Déploiement chirurgical sur le T450

⚠️ **Le T450 a drifté. NE JAMAIS `git pull` ni écraser en bloc.** Éditer les fichiers LIVE et rebuild le seul service `musedesk-relay` :

```bash
# Depuis une machine du tailnet, dans /opt/alfred/alfred-vps
docker compose -f docker-compose.tailscale.yml up -d --build musedesk-relay
docker compose -f docker-compose.tailscale.yml ps     # musedesk-relay = healthy
```

### Vérification

```bash
# Santé interne (depuis le T450 ou tailnet)
curl -s http://127.0.0.1:18800/health

# Santé via Tailscale Funnel (depuis l'extérieur)
curl -s https://alfredvps.tail33620f.ts.net/relay/health   # doit répondre {ok:true}
```

### Points d'attention

⚠️ **Deux Caddyfile** dans le repo (`alfred-vps/caddy/Caddyfile` et `alfred-vps/Caddyfile`) : confirmer lequel est monté LIVE sur le T450 **avant** d'éditer la route `/relay/*`.

⚠️ **Passage prod** : une fois le relais validé (`curl` ci-dessus OK), passer dans `config.js` :
```js
// dev
export const RELAY_WS_URL = 'ws://localhost:18800/relay/ws';
// prod
export const RELAY_WS_URL = 'wss://alfredvps.tail33620f.ts.net/relay/ws';
```
Puis re-bumper le `?v=N` partout et la constante `CACHE` dans `sw.js` (cf. §4).

⚠️ **`vendor/qrcode.min.js` doit exister** avant le déploiement Pages : le SW le précache via `cache.addAll`. S'il est absent, l'installation du SW échoue en bloc et l'app ne se met pas en cache hors-ligne.

### Limites anti-abus (côté relais)

| Limite | Valeur |
|---|---|
| Taille max message | 256 KB |
| Followers max / session | 50 |
| Sessions simultanées max | 500 |
