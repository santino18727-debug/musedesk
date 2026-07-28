# Revue de sécurité - MuseDesk

Cette skill définit les points de contrôle de sécurité spécifiques à l'architecture de MuseDesk.

## Synchro Google Drive (OAuth)

- **Stockage du Token** : Le token OAuth doit **toujours** être gardé en mémoire vive (RAM, session) uniquement. Il ne doit **jamais** être stocké en `localStorage` ou `IndexedDB` pour éviter l'exposition persistante.
- **Scope limité** : Vérifier que le scope Drive reste limité à `drive.file` (l'application ne peut accéder qu'aux fichiers qu'elle a elle-même créés).

## Mode Pupitre (Live WebSocket)

- **Partage du lien (Token de session)** : Le token (128 bits) de la session live WebSocket est transmis dans le fragment de l'URL (`#join=<token>`).
- **Absence d'exposition serveur** : Vérifier que ce token `hash` n'est jamais inclus dans le Referer lors de requêtes réseau, et qu'il n'est pas envoyé au serveur hébergeant l'application (ex: GitHub Pages).
- **Transport** : Le WebSocket (`live.js`) est un relais éphémère. Aucune donnée n'est persistée sur le relais.

## Vérification générale

- Aucun secret (ex: Client ID critique, clés API secrètes) ne doit être hardcodé pour un déploiement public sans vérification (le projet indique de coller le Client ID de l'utilisateur dans `config.js` localement).
- Pas de dépendances : Empêcher toute inclusion de scripts CDN tiers (Zero-Day XSS risk).
