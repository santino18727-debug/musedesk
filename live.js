import { RELAY_WS_URL } from './config.js?v=7';

// live.js — Mode Pupitre : couche réseau WebSocket leader↔followers.
// Aucun effet de bord à l'import. Ne touche ni au DOM ni à IndexedDB.
// ---------------------------------------------------------------------------
// PROTOCOLE (JSON, {t:'type', ...}) :
//   Client→Relais : hello · snapshot · state · ping
//   Relais→Client : welcome · snapshot · state · peers · leader-gone · pong · error
// ---------------------------------------------------------------------------

// État module-level (une seule WS active à la fois)
let ws = null;
let _role = null;         // 'leader' | 'follower'
let _token = null;
let _handlers = {};
let _lastSnapshot = null; // mémorisé pour re-push après reconnexion leader
let _intentionalClose = false;
let _reconnectDelay = 1000;          // back-off courant
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000];
let _reconnectTimer = null;
let _pingTimer = null;

// ---------------------------------------------------------------------------
// 1. getJoinToken() — lit location.hash pour extraire un token d'invitation
// ---------------------------------------------------------------------------
export function getJoinToken() {
  try {
    const hash = location.hash; // ex. '#join=abc123'
    if (!hash) return null;
    const match = hash.match(/^#join=(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 2. isRelayConfigured() — vérifie qu'une URL de relais est définie
// ---------------------------------------------------------------------------
export function isRelayConfigured() {
  return Boolean(RELAY_WS_URL && RELAY_WS_URL.trim());
}

// ---------------------------------------------------------------------------
// Interne : génère 16 octets aléatoires encodés base64url (sans padding)
// ---------------------------------------------------------------------------
function generateToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Construit une binary string depuis le Uint8Array pour btoa
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// ---------------------------------------------------------------------------
// Interne : envoie un objet JSON sur la WS ouverte (absorbe les erreurs)
// ---------------------------------------------------------------------------
function wsSend(obj) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(obj));
  } catch (err) {
    console.warn('[live] wsSend error:', err);
  }
}

// ---------------------------------------------------------------------------
// Interne : démarre le ping applicatif toutes les 25 s
// ---------------------------------------------------------------------------
function startPing() {
  stopPing();
  _pingTimer = setInterval(() => wsSend({ t: 'ping' }), 25_000);
}

function stopPing() {
  if (_pingTimer !== null) {
    clearInterval(_pingTimer);
    _pingTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Interne : annule un éventuel timer de reconnexion en attente
// ---------------------------------------------------------------------------
function cancelReconnect() {
  if (_reconnectTimer !== null) {
    clearTimeout(_reconnectTimer);
    _reconnectTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Interne : calcule le prochain délai de back-off et l'incrémente
// ---------------------------------------------------------------------------
function nextDelay() {
  const d = _reconnectDelay;
  const idx = RECONNECT_DELAYS.indexOf(d);
  _reconnectDelay = idx >= 0 && idx < RECONNECT_DELAYS.length - 1
    ? RECONNECT_DELAYS[idx + 1]
    : 10_000;
  return d;
}

function resetDelay() {
  _reconnectDelay = RECONNECT_DELAYS[0];
}

// ---------------------------------------------------------------------------
// Interne : ouvre la WS et câble les handlers.
// Réutilisée pour la connexion initiale ET les reconnexions.
// ---------------------------------------------------------------------------
function openWs() {
  if (ws) {
    try { ws.close(); } catch { /* ignore */ }
    ws = null;
  }

  ws = new WebSocket(RELAY_WS_URL);

  ws.onopen = () => {
    // Envoi du hello avec le rôle et le token courants
    wsSend({ t: 'hello', role: _role, token: _token, ver: 1 });
    startPing();
    // Re-push snapshot après reconnexion leader
    if (_role === 'leader' && _lastSnapshot) {
      wsSend({ t: 'snapshot', ..._lastSnapshot });
    }
  };

  ws.onmessage = (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }

    switch (m.t) {
      case 'welcome':
        resetDelay();
        _handlers.onStatus?.('live');
        if (m.peers !== undefined) _handlers.onPeers?.(m.peers);
        break;
      case 'snapshot':
        // Reçu par le follower
        _handlers.onSnapshot?.(m.setlist, m.songs);
        break;
      case 'state':
        _handlers.onState?.(m);
        break;
      case 'peers':
        _handlers.onPeers?.(m.peers);
        break;
      case 'leader-gone':
        _handlers.onLeaderGone?.();
        break;
      case 'pong':
        // Pong applicatif — rien à faire
        break;
      case 'error':
        _handlers.onError?.(m.code);
        break;
    }
  };

  ws.onerror = () => {
    // onerror est toujours suivi d'un onclose — on gère dans onclose
    _handlers.onStatus?.('connecting');
  };

  ws.onclose = (ev) => {
    stopPing();

    if (_intentionalClose) return; // close() volontaire → pas de reconnexion

    // 1009 = message trop gros, 1008 = policy violation → pas de reconnexion
    if (ev.code === 1009) {
      _handlers.onStatus?.('offline');
      _handlers.onError?.('payload-too-large');
      return;
    }
    if (ev.code === 1008) {
      _handlers.onStatus?.('offline');
      _handlers.onError?.(`ws-policy-${ev.code}`);
      return;
    }

    _handlers.onStatus?.('connecting');
    const delay = nextDelay();
    _reconnectTimer = setTimeout(() => {
      _reconnectTimer = null;
      openWs();
    }, delay);
  };
}

// ---------------------------------------------------------------------------
// 3. createSession(handlers) — côté LEADER
//    Rejette avec Error('relay-not-configured') si RELAY_WS_URL est vide.
//    Résout en { token, joinUrl } quand la WS est établie (welcome reçu).
// ---------------------------------------------------------------------------
export function createSession(handlers = {}) {
  if (!isRelayConfigured()) {
    // Pas de relais configuré : on prévient et on arrête proprement.
    handlers.onStatus?.('offline');
    return Promise.reject(new Error('relay-not-configured'));
  }

  _intentionalClose = false;
  _role = 'leader';
  _token = generateToken();
  _handlers = { ...handlers };
  _lastSnapshot = null;

  const joinUrl = location.origin + location.pathname + '#join=' + _token;

  return new Promise((resolve, reject) => {
    const originalOnStatus = _handlers.onStatus;
    let settled = false;

    _handlers.onStatus = (s) => {
      originalOnStatus?.(s);
      if (!settled && s === 'live') {
        settled = true;
        resolve({ token: _token, joinUrl });
      }
    };

    _handlers.onError = (code) => {
      handlers.onError?.(code);
      if (!settled) {
        settled = true;
        reject(new Error(code));
      }
    };

    _handlers.onStatus('connecting');
    openWs();
  });
}

// ---------------------------------------------------------------------------
// 4. pushSnapshot({ setlist, songs }) — LEADER envoie/mémorise le snapshot
// ---------------------------------------------------------------------------
export function pushSnapshot({ setlist, songs }) {
  if (_role !== 'leader') return;
  _lastSnapshot = { setlist, songs };
  wsSend({ t: 'snapshot', setlist, songs });
}

// ---------------------------------------------------------------------------
// 5. pushState(stateObj) — LEADER envoie l'état courant
//    stateObj : { songId, idx, semitones, capo, scrollPct, twocol, font }
//    Pas de throttle ici — géré par l'appelant (app.js).
// ---------------------------------------------------------------------------
export function pushState(stateObj) {
  if (_role !== 'leader') return;
  wsSend({ t: 'state', ...stateObj });
}

// ---------------------------------------------------------------------------
// 6. joinSession(token, handlers) — côté FOLLOWER
//    Rejette avec Error('relay-not-configured') si RELAY_WS_URL est vide.
//    handlers : { onSnapshot, onState, onLeaderGone, onStatus, onError }
// ---------------------------------------------------------------------------
export function joinSession(token, handlers = {}) {
  if (!isRelayConfigured()) {
    handlers.onStatus?.('offline');
    return Promise.reject(new Error('relay-not-configured'));
  }

  _intentionalClose = false;
  _role = 'follower';
  _token = token;
  _handlers = { ...handlers };

  handlers.onStatus?.('connecting');
  openWs();
}

// ---------------------------------------------------------------------------
// 7. close() — fermeture propre (supprime la reconnexion auto)
// ---------------------------------------------------------------------------
export function close() {
  _intentionalClose = true;
  cancelReconnect();
  stopPing();
  if (ws) {
    try { ws.close(); } catch { /* ignore */ }
    ws = null;
  }
  _role = null;
  _token = null;
  _handlers = {};
  _lastSnapshot = null;
  resetDelay();
}
