// config.js — Configuration MuseDesk
// ---------------------------------------------------------------------------
// Pour activer la synchro Google Drive :
//   1) Crée un projet Google Cloud Console
//   2) Active l'API Google Drive
//   3) Crée un OAuth 2.0 Client ID (type "Application Web")
//   4) Ajoute tes origines JS autorisées (ex: http://localhost:8123, https://ton-domaine.com)
//   5) Colle ici le Client ID obtenu
//
// Laisse vide → synchro désactivée, app 100% locale.
// ---------------------------------------------------------------------------

export const GOOGLE_CLIENT_ID = '';

// ---------------------------------------------------------------------------
// Mode Pupitre (multijoueur live leader→followers) — URL du relais WebSocket.
// Vide → bouton « Mode Pupitre » masqué, app 100% solo (dégradé propre).
//
// Prod (Tailscale Funnel + Caddy) : actif. Le bouton s'affiche ; il fonctionnera
// dès que le relais sera déployé sur le T450 (T5). Avant ça, le clic dégrade
// proprement (statut « hors ligne »), l'app solo reste 100% intacte.
//   Dev / localhost-first (relais Node local) : 'ws://localhost:18800/relay/ws'
// ---------------------------------------------------------------------------
export const RELAY_WS_URL = 'wss://alfredvps.tail33620f.ts.net/relay/ws';
