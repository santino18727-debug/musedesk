---
name: security-review
description: Contrôler les invariants de sécurité de MuseDesk — token OAuth Google Drive, token de session du Mode Pupitre, secrets. À ouvrir avant de toucher à sync.js, live.js, config.js, ou à tout ce qui manipule un token, une URL de partage ou un scope OAuth.
---

# Revue de sécurité : les invariants à ne pas casser

MuseDesk n'a pas de backend. Toute la surface de sécurité tient dans trois endroits : la synchro
Google Drive (`sync.js`), le relais WebSocket du Mode Pupitre (`live.js`), et la config locale
(`config.js`). Les invariants ci-dessous ont été **vérifiés dans le code** — si une modification
les contredit, c'est une régression, pas un choix.

## Synchro Google Drive (`sync.js`)

| Invariant | Où c'est établi | Pourquoi |
|---|---|---|
| Le token d'accès reste **en RAM uniquement** | `this._token = response.access_token` | Un token en `localStorage`/`IndexedDB` survit à l'onglet et devient exfiltrable par n'importe quel XSS. |
| `localStorage` ne mémorise que le **fait** d'avoir lié un compte | clé `musedesk.driveLinked` (valeur `'1'`) | Permet la reconnexion silencieuse sans jamais persister de secret. |
| Le scope reste `drive.file` | `DRIVE_SCOPE` | `drive.file` limite l'app aux fichiers **qu'elle a elle-même créés**. Élargir (`drive`, `drive.readonly`) donnerait accès à tout le Drive de l'utilisateur. |

Si tu ajoutes une fonctionnalité Drive qui « aurait besoin » d'un scope plus large, c'est le
besoin qu'il faut requalifier — pas le scope qu'il faut élargir.

## Mode Pupitre — session live (`live.js`)

- **Le token de session fait 128 bits** (16 octets via `crypto.getRandomValues`, encodés
  base64url sans padding). Ne le raccourcis pas, et n'utilise jamais `Math.random()` pour le
  générer : c'est le seul secret qui protège une session.
- **Il voyage dans le fragment d'URL** (`#join=<token>`). Le fragment n'est **jamais** transmis
  au serveur ni dans l'en-tête `Referer` — c'est précisément pourquoi il est là plutôt qu'en
  query string (`?join=`), qui, elle, finirait dans les logs de GitHub Pages.
  **Ne déplace jamais ce token du fragment vers la query string.**
- **Le relais est éphémère** : aucune donnée de morceau n'est persistée côté relais. Si tu
  ajoutes un mécanisme de reprise/historique, ne le fais pas au prix d'une persistance sur le
  relais sans l'avoir explicitement acté.
- Quitter le mode follower **retire `#join=…` de l'URL** (cf. `app.js`, section C5c). Une URL
  qui garde le token après la sortie le fuite dans l'historique et les partages d'écran.

## Secrets et déploiement

Le site est déployé publiquement sur GitHub Pages (workflow `deploy.yml`, sur push `main`).
Tout ce qui est committé est donc public.

- Aucune clé API ni secret ne doit être committé. Le Client ID Google est collé par
  l'utilisateur dans `config.js` **en local**.
- Avant de committer un fichier touchant à l'auth, relis le diff en entier : un token collé
  pendant un test de débogage est vite oublié.

## Avant de proposer la PR

1. Aucun secret ni token dans le diff (relire `git diff` en entier, pas seulement le résumé).
2. Le token Drive n'est écrit dans aucun stockage persistant.
3. `DRIVE_SCOPE` inchangé, ou élargissement explicitement justifié dans la description de PR.
4. Le token de session reste en fragment (`#join=`), généré par `crypto.getRandomValues`.
5. `node --test` passe, et les `?v=` ont été bumpés si un `.js` a changé (cf. `bump-version`).
