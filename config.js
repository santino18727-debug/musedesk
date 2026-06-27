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
// Prod : relais déployé sur le T450, exposé en public via Tailscale Funnel sur le
// port dédié 8443 (PAS de Caddy — vestige). Vérifié OK (handshake WS public).
//   Dev / localhost-first (relais Node local) : 'ws://localhost:18800/relay/ws'
// ---------------------------------------------------------------------------
export const RELAY_WS_URL = 'wss://alfredvps.tail33620f.ts.net:8443/relay/ws';
