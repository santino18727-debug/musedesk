# MEGA-PROMPT — MuseDesk « Mode Pupitre » (multijoueur live leader→followers)

> À coller dans une session d'implémentation (Claude Code / worker). Ce prompt est **auto-suffisant** :
> il contient le contexte, l'archi, le protocole, le code de référence et l'ordre d'exécution.
> Tout ce qui est marqué `⚠️` est un piège vérifié, ne pas l'ignorer.

---

## 0. RÔLE

Tu es l'implémenteur de la feature « Mode Pupitre » de **MuseDesk** (PWA statique de partitions/accords).
Tu touches DEUX repos :
- `C:\Dev\musedesk` — le client (PWA, GitHub Pages).
- `C:\Dev\gabidevfamily-infra` — l'infra (le relais WebSocket, déployé sur le T450 via Docker/Caddy/Tailscale Funnel).

Travaille en **édition chirurgicale** (`Edit`, pas `Write` sur un fichier existant). Vérifie chaque diff.
Délègue le code mécanique au worker local si dispo, mais **tu relis tout**.

---

## 1. OBJECTIF (mini-PRD)

**Quoi** : un musicien (le *leader*, sur PC) ouvre une setlist en mode concert, clique « Mode Pupitre »,
un **QR s'affiche**. Une tablette scanne le QR (appareil photo natif → ouvre l'URL) → elle bascule en
**vue follower lecture seule** et **suit en temps réel** ce que fait le leader : changement de morceau,
transposition, scroll/position, mode 2 colonnes, taille de police.

**User story** : « En répét/concert, je veux que les pupitres des autres musiciens affichent exactement
la même partition que moi, au même endroit, sans qu'ils touchent à rien. »

**Périmètre IN** :
- Partage **leader → followers** d'une **setlist** (morceaux + overrides transpose/capo).
- Sync live de l'état de lecture (morceau courant, semitones, capo, scroll %, 2-col, font).
- Followers en **lecture seule** (aucune action ne remonte).
- Entrée follower via **URL dans le QR** (pas de scanner caméra in-app).
- Relais WebSocket public via le Tailscale Funnel **existant**.
- Dégradé propre : relais down → multijoueur inactif, **app solo 100 % intacte**.

**Périmètre OUT (non-goals)** :
- ❌ Pas de collaboration bidirectionnelle / édition à plusieurs.
- ❌ Pas de scanner QR caméra dans l'app.
- ❌ Pas de partage de toute la bibliothèque.
- ❌ Pas de comptes/auth utilisateur (modèle « lien de salon »).
- ❌ Pas de persistance serveur (sessions en RAM, éphémères).

**Critères d'acceptation** : voir §10.

---

## 2. CONTRAINTES INFRA (vérifiées dans le repo)

| Élément | Valeur réelle |
|---|---|
| Prod MuseDesk | `https://santino18727-debug.github.io/musedesk/` (GitHub Pages, HTTPS ✅) |
| Hôte relais | T450 chez Eric, **pas** de VPS public, modem verrouillé |
| Exposition | **Tailscale Funnel** = public, testé OK depuis 4G : `alfredvps.tail33620f.ts.net` |
| Reverse proxy | **Caddy** — `C:\Dev\gabidevfamily-infra\alfred-vps\caddy\Caddyfile`. Gère l'upgrade WS tout seul. |
| Compose central | `C:\Dev\gabidevfamily-infra\alfred-vps\docker-compose.tailscale.yml` (réseau `alfred-net`) |
| Plage ports libre | `18xxx` (mobile-bff=18000, ocr=18097, openclaw=18789, tts=18998). **Prends `18800`.** |
| URL publique relais cible | `wss://alfredvps.tail33620f.ts.net/relay/ws` (route Caddy `/relay/*`) |

⚠️ **Drift T450** : `/opt/alfred` est ~30 commits derrière `origin/main` + ~19 fichiers modifiés localement non commités.
**NE JAMAIS** `git pull` / écraser en bloc sur le T450. Déploiement = **chirurgical additif** sur les fichiers LIVE
(éditer le `docker-compose.tailscale.yml` et le `Caddyfile` LIVE, ajouter le bloc, rebuild le seul service).

⚠️ **WebSocket sur Tailscale Funnel** : Funnel proxifie HTTPS et accepte l'upgrade WS, mais la **stabilité des
connexions longues** n'est pas garantie à 100 % par la doc. → **À valider au smoke-test** (cf §10). Prévoir une
**reconnexion auto** côté client (back-off) pour absorber les coupures.

⚠️ **Disponibilité** : le T450 est une machine perso. S'il est éteint, le mode pupitre est indispo (le mode solo,
lui, n'est jamais affecté). Le client doit afficher un message clair si le relais est injoignable, jamais planter.

---

## 3. ARCHITECTURE

```
LEADER (PC)                     RELAIS (T450, Docker)            FOLLOWER (tablette, 4G/WiFi)
 ouvre setlist concert           ws server (lib `ws`)             appareil photo scanne QR
 clic « Mode Pupitre »  ──CREATE──►  crée session {token}         → ouvre URL  …/#join=<token>
 reçoit token, affiche QR                                          MuseDesk boote en mode follower
 (URL = …/musedesk/#join=token)                                    se connecte wss + token
 pousse snapshot setlist ──SNAPSHOT──► stocke + relaie ──────────► reçoit setlist + contenus, rend
 je change morceau/scroll/… ──STATE──► broadcast ────────────────► applique en lecture seule
```

- **Transport** : WebSocket via relais (PAS de WebRTC — events rares, NAT/STUN évités).
- **Token session** : 128 bits aléatoires, transporté dans le **fragment `#`** de l'URL (jamais envoyé au
  serveur GitHub Pages, jamais en Referer). Le relais ne fait QUE relayer entre membres d'un même token.
- **Snapshot** : le leader détient les données (app statique), il pousse la setlist + le contenu des morceaux
  au relais à la création ; le relais le garde en RAM et le sert à chaque nouveau follower.
- **Rôles** : 1 leader, N followers. Si le leader se déconnecte → session expire après grâce (cf §4).

---

## 4. PROTOCOLE WEBSOCKET (messages JSON)

Un message = `{ "t": "<type>", ... }`. `t` = type. Tous les champs sont explicites (pas de positionnel).

**Client → Relais** :
| `t` | Émis par | Payload | Effet |
|---|---|---|---|
| `hello` | leader & follower | `{ role, token, ver }` | Rejoint la session `token`. `role`∈`leader\|follower`. `ver`=version protocole (= `1`). |
| `snapshot` | leader | `{ setlist, songs }` | Le relais mémorise le snapshot pour la session et le diffuse aux followers présents. |
| `state` | leader | `{ songId, idx, semitones, capo, scrollPct, twocol, font }` | Diffusé à tous les followers. |
| `ping` | leader & follower | `{}` | Keep-alive applicatif (toutes ~25 s). Relais répond `pong`. |

**Relais → Client** :
| `t` | Vers | Payload | Effet |
|---|---|---|---|
| `welcome` | celui qui `hello` | `{ role, peers }` | Confirme l'entrée. `peers`=nb de followers. |
| `snapshot` | follower | `{ setlist, songs }` | À l'arrivée d'un follower, on lui pousse le dernier snapshot connu (ou rien si pas encore reçu). |
| `state` | followers | `{ … }` (idem ci-dessus) | Le follower applique. |
| `leader-gone` | followers | `{}` | Le leader a quitté ; afficher « Le leader a quitté la session ». |
| `pong` | émetteur | `{}` | Réponse keep-alive. |
| `error` | émetteur | `{ code, msg }` | Ex. `token-required`, `role-conflict` (2e leader refusé). |

**Règles relais** :
- Un seul `leader` par token. Un 2e `hello role=leader` sur un token déjà mené → `error role-conflict`.
- `state`/`snapshot` venant d'un `follower` = ignorés (lecture seule stricte côté serveur aussi).
- Session purgée : après déco du leader, garder le snapshot **120 s** (grâce reconnexion) puis détruire si pas de
  re-`hello` leader. Purger aussi toute session sans aucun socket depuis >10 min.
- Limites anti-abus : message JSON max **256 KB** (snapshot d'une setlist), max **50 sockets**/session,
  max **500** sessions simultanées. Au-delà → `error` + close.

---

## 5. PARTIE A — RELAIS (`C:\Dev\gabidevfamily-infra\musedesk-relay\`)

Créer un nouveau dossier `musedesk-relay/` à la racine de `gabidevfamily-infra`.

### 5.1 `musedesk-relay/package.json`
```json
{
  "name": "musedesk-relay",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "server.js",
  "dependencies": { "ws": "^8.18.0" }
}
```
⚠️ `ws` est la seule dépendance. Vérifier la dernière version stable au moment de l'install (ne pas inventer).

### 5.2 `musedesk-relay/server.js` (implémentation de référence — adapter, relire)
```js
// Relais WebSocket MuseDesk « Mode Pupitre ». Sessions en RAM, éphémères, zéro persistance.
import { WebSocketServer } from 'ws';
import http from 'node:http';

const PORT      = Number(process.env.RELAY_PORT || 18800);
const PROTO_VER = 1;
const MAX_MSG   = 256 * 1024;
const MAX_PEERS = 50;
const MAX_SESS  = 500;
const GRACE_MS  = 120_000;   // grâce après déco leader
const IDLE_MS   = 600_000;   // purge session inactive

/** @type {Map<string,{leader:WebSocket|null, followers:Set<WebSocket>, snapshot:object|null, graceTimer:any, lastSeen:number}>} */
const sessions = new Map();

const server = http.createServer((req, res) => {
  if (req.url === '/relay/health' || req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, sessions: sessions.size, ts: new Date().toISOString() }));
    return;
  }
  res.writeHead(404); res.end();
});

const wss = new WebSocketServer({ server, maxPayload: MAX_MSG, path: '/relay/ws' });

function getOrCreate(token) {
  let s = sessions.get(token);
  if (!s) {
    if (sessions.size >= MAX_SESS) return null;
    s = { leader: null, followers: new Set(), snapshot: null, graceTimer: null, lastSeen: Date.now() };
    sessions.set(token, s);
  }
  return s;
}
const send = (ws, obj) => { try { ws.send(JSON.stringify(obj)); } catch {} };

wss.on('connection', (ws) => {
  ws._role = null; ws._token = null; ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'hello') {
      const token = String(m.token || '').slice(0, 128);
      if (!token) return send(ws, { t: 'error', code: 'token-required' });
      const s = getOrCreate(token);
      if (!s) return send(ws, { t: 'error', code: 'too-many-sessions' });
      ws._token = token;
      if (m.role === 'leader') {
        if (s.leader && s.leader !== ws && s.leader.readyState === s.leader.OPEN)
          return send(ws, { t: 'error', code: 'role-conflict' });
        ws._role = 'leader'; s.leader = ws;
        if (s.graceTimer) { clearTimeout(s.graceTimer); s.graceTimer = null; }
      } else {
        if (s.followers.size >= MAX_PEERS) return send(ws, { t: 'error', code: 'too-many-peers' });
        ws._role = 'follower'; s.followers.add(ws);
        if (s.snapshot) send(ws, { t: 'snapshot', ...s.snapshot });
      }
      s.lastSeen = Date.now();
      send(ws, { t: 'welcome', role: ws._role, peers: s.followers.size });
      return;
    }
    const s = sessions.get(ws._token); if (!s) return;
    s.lastSeen = Date.now();
    if (m.t === 'ping') return send(ws, { t: 'pong' });
    if (ws._role !== 'leader') return;            // lecture seule serveur : followers muets
    if (m.t === 'snapshot') { s.snapshot = { setlist: m.setlist, songs: m.songs }; }
    if (m.t === 'snapshot' || m.t === 'state') {
      const msg = JSON.stringify(m);
      for (const f of s.followers) { if (f.readyState === f.OPEN) { try { f.send(msg); } catch {} } }
    }
  });

  ws.on('close', () => {
    const s = ws._token && sessions.get(ws._token); if (!s) return;
    if (ws._role === 'follower') s.followers.delete(ws);
    if (ws._role === 'leader' && s.leader === ws) {
      s.leader = null;
      for (const f of s.followers) send(f, { t: 'leader-gone' });
      s.graceTimer = setTimeout(() => {
        const cur = sessions.get(ws._token);
        if (cur && !cur.leader) sessions.delete(ws._token);
      }, GRACE_MS);
    }
  });
});

// Keep-alive transport + purge inactivité
setInterval(() => {
  wss.clients.forEach((ws) => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; try { ws.ping(); } catch {} });
  const now = Date.now();
  for (const [tok, s] of sessions) {
    if (!s.leader && s.followers.size === 0 && now - s.lastSeen > IDLE_MS) sessions.delete(tok);
  }
}, 30_000);

server.listen(PORT, () => console.log(`[musedesk-relay] ws://0.0.0.0:${PORT}/relay/ws`));
```

### 5.3 `musedesk-relay/Dockerfile`
```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
ENV RELAY_PORT=18800
EXPOSE 18800
CMD ["node", "server.js"]
```

### 5.4 Ajout au compose LIVE (chirurgical) — `alfred-vps/docker-compose.tailscale.yml`
Ajouter ce service (réseau `alfred-net`, bind loopback, RAM bornée, healthcheck — pattern identique à mobile-bff) :
```yaml
  musedesk-relay:
    build:
      context: ../musedesk-relay
      dockerfile: Dockerfile
    image: musedesk-relay:local
    container_name: alfred-musedesk-relay
    restart: unless-stopped
    environment:
      - RELAY_PORT=18800
      - TZ=Europe/Zurich
    ports:
      - "127.0.0.1:18800:18800"
    networks:
      - alfred-net
    mem_limit: 128m
    mem_reservation: 32m
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:18800/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      start_period: 10s
      retries: 3
```

### 5.5 Route Caddy LIVE — `alfred-vps/caddy/Caddyfile`
Dans le bloc `{$PUBLIC_HOSTNAME} { … }`, ajouter (Caddy gère l'upgrade WS seul) :
```caddyfile
    handle /relay/* {
        reverse_proxy musedesk-relay:18800
    }
```
⚠️ Utiliser `handle` (pas `handle_path`) pour conserver le préfixe `/relay/…` que le serveur Node attend
(`path:'/relay/ws'`, `'/relay/health'`). Vérifier l'ordre des routes : les plus spécifiques avant le `reverse_proxy` par défaut.

---

## 6. PARTIE B — CLIENT MuseDesk (`C:\Dev\musedesk`)

### 6.1 `config.js` — ajouter l'URL du relais
```js
// URL publique du relais Mode Pupitre (Tailscale Funnel + Caddy). Vide → mode pupitre désactivé.
export const RELAY_WS_URL = 'wss://alfredvps.tail33620f.ts.net/relay/ws';
```
⚠️ Si vide → masquer le bouton « Mode Pupitre » (dégradé propre).

### 6.2 NOUVEAU module `live.js` — la couche temps réel
Responsabilités (exporter une petite API, **aucune dépendance externe**) :
- `createSession()` → génère un token (`crypto.getRandomValues`, 16 octets → base64url), ouvre la WS,
  envoie `hello{role:'leader'}`, renvoie `{ token, joinUrl }` où
  `joinUrl = location.origin + location.pathname + '#join=' + token`.
- `pushSnapshot({setlist, songs})` → envoie `snapshot`. À rappeler à chaque nouveau follower n'est PAS nécessaire
  (le relais sert le dernier snapshot tout seul), mais re-pousser si la setlist change.
- `pushState(state)` → envoie `state` (throttlé ~150 ms pour le scroll, immédiat pour morceau/transpose).
- `joinSession(token, handlers)` → ouvre la WS, `hello{role:'follower'}`, branche `handlers.onSnapshot`,
  `handlers.onState`, `handlers.onLeaderGone`, `handlers.onStatus`.
- **Reconnexion auto** : back-off exponentiel (1s→2s→5s→10s plafonné), re-`hello` au retour, `ping` toutes 25 s.
- `getJoinToken()` → lit `location.hash`, renvoie le token si `#join=…`, sinon `null`.
- `close()`.

Garde-fous : si `RELAY_WS_URL` vide ou WS injoignable → callbacks `onStatus('offline'|'connecting'|'live')`,
jamais d'exception non catchée.

### 6.3 `app.js` — intégration (édition chirurgicale)
Points d'ancrage repérés (lignes indicatives, **revérifier**) :
- État global `state` (l. ~24-35) : `semitones`, `capo`, `currentSetlistId`, `current` (morceau courant).
- `openConcertMode(setlistId)` (l. ~695) / `openConcertSong()` (l. ~704) : mode concert + changement de morceau.
- `renderSong()` (l. ~542) : rendu.
- Scroll : élément `#reader-content` (`scrollTop`/`scrollHeight`), auto-scroll `toggleScroll`.
- Transpose : boutons `#btn-t-up` (l. ~1674) / `#btn-t-down`, `state.semitones`.
- 2 colonnes : `#btn-twocol` (l. ~1660). Police : `changeFont` (`#btn-font-inc/dec`).

**Côté LEADER** — émettre l'état SANS dupliquer la logique :
1. Construire un helper `currentLiveState()` qui lit `state` → `{ songId, idx, semitones, capo, scrollPct, twocol, font }`
   (`scrollPct = scrollTop / (scrollHeight - clientHeight)`).
2. Appeler `live.pushState(currentLiveState())` aux points de mutation : fin de `openConcertSong()`, handlers
   transpose +/-, toggle 2-col, changeFont, et sur l'event `scroll` de `#reader-content` (throttlé).
3. Au démarrage de la session : `live.pushSnapshot({ setlist, songs })` où `songs` = les morceaux de la setlist
   (récupérés via `db.getSong`), `setlist` = l'objet setlist (avec `overrides`).

**Côté FOLLOWER** — au boot (`init`), si `live.getJoinToken()` :
1. Basculer l'UI en **mode follower** : masquer toutes les commandes (transpose, scroll manuel, édition, retour
   bibliothèque), afficher un bandeau « 🔴 Suivi en direct — <leader> » + état connexion.
2. `live.joinSession(token, { onSnapshot, onState, onLeaderGone, onStatus })`.
3. `onSnapshot(setlist, songs)` : charger ces données EN MÉMOIRE (ne PAS polluer IndexedDB du follower — données
   éphémères de session), construire un index `songId→song`.
4. `onState(s)` : appliquer en réutilisant les fonctions existantes en lecture seule —
   ouvrir le bon morceau (`openReader`-like depuis le snapshot mémoire avec `s.semitones/s.capo`),
   appliquer 2-col/font, puis `#reader-content.scrollTop = s.scrollPct * (scrollHeight - clientHeight)`.
   ⚠️ Désactiver l'auto-scroll local et tout input du follower (il ne fait QU'appliquer).
5. `onLeaderGone()` / `onStatus('offline')` : bandeau d'info, ne pas planter, proposer « Quitter ».

⚠️ **Ne pas réécrire `openReader`/`renderSong`** : ajouter un paramètre/source « snapshot mémoire » pour que le
follower rende un morceau qui n'est pas dans SA base. Le plus propre : un petit adaptateur
`getSongForRender(id)` qui regarde d'abord le snapshot mémoire (mode follower) sinon IndexedDB.

### 6.4 `index.html` — UI + CSP + versioning
1. **Bouton leader** : dans la barre du mode concert/setlist, ajouter `#btn-pupitre` « 📡 Mode Pupitre ».
2. **Modale QR** `#pupitre-dialog` (`<dialog>`) : zone QR (`<canvas>`/`<div id="qr">`), l'URL en clair + bouton
   « Copier le lien », bouton fermer. Indicateur « N pupitres connectés » mis à jour via un handler léger.
3. **Bandeau follower** `#follower-banner` (caché par défaut).
4. ⚠️ **CSP** : la CSP est dans un `<meta http-equiv="Content-Security-Policy">`. **Lire la valeur actuelle**
   et **ajouter à `connect-src`** : `wss://alfredvps.tail33620f.ts.net` (en plus des domaines Google déjà présents).
   Sans ça, la WS est bloquée silencieusement.
5. ⚠️ **Versioning (footgun, cf DEPLOY.md §4 + mémoire projet)** : ajouter `live.js?v=N` avec le **même `?v=N`**
   que les autres modules, et **bumper `?v=N` partout uniformément** (`index.html`, `app.js`, `sync.js`,
   `fsprovider.js`, `db.js`, `sw.js`) **ET** la constante `CACHE` dans `sw.js`. Lire les valeurs actuelles, ne pas
   deviner. Ajouter `live.js`, le fichier QR vendor et `config.js` à la liste de précache de `sw.js`.

### 6.5 Générateur QR (vendor, pas de hallucination de dépendance)
- Récupérer une **lib QR autonome, MIT, sans build** (ex. `kazuhikoarase/qrcode-generator` — fichier unique
  `qrcode.js`), la déposer dans `vendor/qrcode.min.js`. **Ne PAS** réimplémenter QR à la main, **ne PAS** inventer
  un CDN externe (la CSP `script-src` ne l'autoriserait pas + offline-first). Pin la version, note la source.
- L'inclure comme les autres `vendor/*` (cf `vendor/pdf.min.js`). Générer le QR depuis `joinUrl`.

---

## 7. SÉCURITÉ

- Token = 128 bits aléatoires (`crypto.getRandomValues`), dans le fragment `#` (hors logs serveur/Referer).
- Modèle « possession du lien » : quiconque a le QR peut suivre (lecture seule). **Acceptable** pour l'usage répét/scène.
  Le **documenter** dans `DEPLOY.md` (pas de données sensibles : ce sont des partitions de l'utilisateur).
- Relais : pas d'auth, mais limites anti-abus (taille msg, peers, sessions) déjà dans `server.js`.
- Données qui transitent par le T450 d'Eric (son infra) — pas un tiers. OK RGPD-léger, rien de persisté.
- ⚠️ Pas de `client_secret`, pas de token Google touché ici. Le relais ne voit que setlist+contenus de partitions.

---

## 8. DÉPLOIEMENT

**Relais (T450)** — chirurgical additif, depuis une machine du tailnet :
```bash
# 1. Copier le dossier musedesk-relay/ sur le T450 (rsync/scp), ou git fetch le delta SANS écraser le drift.
# 2. Éditer LIVE le docker-compose.tailscale.yml + caddy/Caddyfile (ajouter les blocs §5.4 / §5.5).
cd /opt/alfred/alfred-vps
docker compose -f docker-compose.tailscale.yml up -d --build musedesk-relay
docker compose -f docker-compose.tailscale.yml ps          # musedesk-relay = healthy
docker logs alfred-musedesk-relay --tail 20
# 3. Recharger Caddy (selon le pattern du compose : restart du service caddy ou `caddy reload`).
# 4. Smoke test :
curl -s http://127.0.0.1:18800/health
curl -s https://alfredvps.tail33620f.ts.net/relay/health   # doit répondre {ok:true} depuis l'extérieur
```

**Client (GitHub Pages)** : commit sur `main` → le workflow `.github/workflows/deploy.yml` lance `node --test`
puis déploie. ⚠️ Les tests doivent passer (sinon pas de déploiement).

---

## 9. VERSIONING — checklist anti-footgun (obligatoire avant commit)
- [ ] `live.js` créé avec `?v=N` cohérent dans ses imports (`./config.js?v=N`, `./db.js?v=N`).
- [ ] `?v=N` bumpé **uniformément** dans `index.html`, `app.js`, `sync.js`, `fsprovider.js`, `db.js`, `sw.js`.
- [ ] `CACHE` bumpé dans `sw.js`.
- [ ] `live.js`, `config.js`, `vendor/qrcode.min.js` ajoutés au précache `sw.js`.
- [ ] `connect-src` CSP inclut `wss://alfredvps.tail33620f.ts.net`.

---

## 10. TESTS & CRITÈRES D'ACCEPTATION
1. **Relais isolé** : démarrer `server.js` en local, 1 client leader + 1 follower (script `wscat`/node) →
   `hello`/`welcome`, `snapshot` relayé, `state` relayé, `leader-gone` à la déco leader. ✅
2. **Funnel WS** : depuis un appareil **hors tailnet (4G)**, ouvrir une WS sur `wss://alfredvps.tail33620f.ts.net/relay/ws`,
   garder la connexion **≥ 5 min** avec ping → pas de coupure intempestive. ⚠️ Si coupures → ajuster keep-alive /
   documenter la limite Funnel. ✅
3. **Bout-en-bout** : PC ouvre setlist → Mode Pupitre → QR. Tablette scanne → vue follower. Sur PC : changer de
   morceau, transposer +2, scroller, passer 2-col → la tablette **reflète chaque action** en < 1 s. ✅
4. **Lecture seule** : aucune action de la tablette ne modifie l'écran du leader ni des autres. ✅
5. **Dégradé** : couper le relais → PC et tablette affichent « hors ligne », **le mode solo reste pleinement
   utilisable**, aucun crash. Reconnexion auto quand le relais revient. ✅
6. **CSP** : aucune erreur `Refused to connect` en console. ✅
7. **`node --test`** vert (sinon pas de déploiement Pages). ✅

---

## 11. ORDRE D'EXÉCUTION (une tâche à la fois, vérifier avant de cocher)
1. [ ] Relais : `musedesk-relay/` (package.json, server.js, Dockerfile) + test local 2 clients.
2. [ ] Déploiement relais sur T450 (compose + Caddy additifs) + smoke test Funnel (test #2).
3. [ ] Client : `config.js` (RELAY_WS_URL) + `vendor/qrcode.min.js`.
4. [ ] Client : module `live.js` (WS, reconnexion, API leader/follower).
5. [ ] Client leader : bouton + modale QR + `pushSnapshot`/`pushState` câblés sur les mutations.
6. [ ] Client follower : détection `#join=`, vue lecture seule, application du state via snapshot mémoire.
7. [ ] CSP + versioning (checklist §9).
8. [ ] Tests bout-en-bout (#3-#6) + `node --test`.
9. [ ] Doc : section « Mode Pupitre » dans `DEPLOY.md` + `README.md`.

---

## 12. PIÈGES À ÉVITER (résumé)
- ⚠️ T450 drifté → déploiement **additif chirurgical**, jamais de `git pull`/overwrite en bloc.
- ⚠️ `handle` (garder `/relay/`), pas `handle_path`, sinon le path attendu par Node casse.
- ⚠️ WS sur Funnel = à valider (test #2) ; reconnexion auto obligatoire.
- ⚠️ Versioning `?v=N` + `CACHE` à bumper partout (footgun connu MuseDesk).
- ⚠️ CSP `connect-src` à élargir au `wss://`.
- ⚠️ Follower : données en MÉMOIRE, ne pas écrire dans son IndexedDB.
- ⚠️ Ne pas réécrire `openReader`/`renderSong` : adaptateur `getSongForRender` (snapshot mémoire vs IndexedDB).
- ⚠️ QR : lib vendor MIT autonome, pas de CDN externe, pas de réimplémentation maison.
- ⚠️ Mode solo doit rester 100 % fonctionnel si le relais est down.
```
