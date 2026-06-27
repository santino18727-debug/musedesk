# 🎼 MuseDesk

Lutrin électronique / lecteur de grilles d'accords. PWA **100% vanilla** (HTML5 + CSS3 + JS ES6 modules), sans aucun framework. Pensée pour une tablette en mode paysage — ou un PC branché sur une TV.

Colle une grille depuis Ultimate Guitar → elle est rangée localement → affichage plein écran ultra-lisible, transposable, défilable.

## Fonctionnalités

- 📚 **Bibliothèque** locale (IndexedDB) — cartes, recherche instantanée, filtres par tag/favori
- 📋 **Import** par copier-coller (formats Ultimate Guitar **et** ChordPro `[Em]`)
- ✎ **Édition et suppression** d'un morceau depuis le lecteur (bouton "Éditer" dans la toolbar)
- 🎸 **Lecteur** plein écran : accords alignés au-dessus des paroles (monospace)
- 🔠 **Taille de police** ajustable (A− / A+)
- ⏯️ **Auto-scroll** fluide (`requestAnimationFrame`)
- ⌨️ **Raccourcis** : `Espace` scroll · `+/−` police · `Échap` retour
- 🎵 **Métronome** (Web Audio API) — popover BPM avec −/+1/5, tap tempo, play/stop, 40–240 BPM
- 🎛 **Diagrammes de guitare** — SVG inline des accords du morceau, se transposent en temps réel
- 📋 **Setlists** — ordonnables par drag & drop, concert mode
- 📴 **PWA** installable, fonctionne hors-ligne (service worker)
- 📡 **Mode Pupitre** — partage live leader→followers via QR : les autres pupitres suivent ta setlist en temps réel (lecture seule). Relais WebSocket, dégradé propre (mode solo intact si le relais est down).

## Lancer en local

Les modules ES6 nécessitent un serveur HTTP (pas de `file://`) :

```bash
python -m http.server 8000
# puis http://localhost:8000
```

Un morceau de démo s'affiche au premier lancement.

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Structure (vues Bibliothèque + Lecteur + Setlist + dialogues) |
| `styles.css` | Design sombre épuré, responsive paysage |
| `app.js` | Orchestration des vues, CRUD UI, métronome, diagrammes, réglages |
| `db.js` | Persistance IndexedDB (CRUD + export/import) |
| `parser.js` | Parser ChordPro / Ultimate Guitar → HTML aligné (+ transposition) |
| `sync.js` | Synchro Google Drive (GoogleDriveProvider complet) |
| `config.js` | Configuration — colle ton Client ID OAuth ici |
| `live.js` | Mode Pupitre — couche temps réel WebSocket (leader/follower, reconnexion auto) |
| `manifest.json` / `sw.js` | PWA |

---

## Synchro Google Drive (optionnel)

La synchro est **désactivée par défaut**. L'app reste 100% locale sans aucune configuration.

### Prérequis

1. Un compte Google + un navigateur qui supporte OAuth (pas de `file://` — doit être servi en HTTP/HTTPS).

### Étapes

1. **Crée un projet Google Cloud**
   - Va sur [console.cloud.google.com](https://console.cloud.google.com/)
   - Crée un nouveau projet (ex: `MuseDesk`)

2. **Active l'API Google Drive**
   - Dans le menu latéral : "APIs & Services" → "Library"
   - Recherche "Google Drive API" → "Enable"

3. **Crée un OAuth 2.0 Client ID**
   - "APIs & Services" → "Credentials" → "Create Credentials" → "OAuth client ID"
   - Type : **Application Web**
   - Nom : `MuseDesk`
   - **Origines JavaScript autorisées** : ajoute tes URLs exactes, exemple :
     - `http://localhost:8000` (dev local)
     - `http://localhost:8123` (si tu utilises un autre port)
     - `https://ton-domaine.com` (si tu héberges en ligne)
   - Clique "Create" → note le **Client ID** généré (format `xxx.apps.googleusercontent.com`)

4. **Configure `config.js`**
   ```js
   export const GOOGLE_CLIENT_ID = 'TON_CLIENT_ID.apps.googleusercontent.com';
   ```

5. **Lance l'app** → menu "Réglages" → bouton "Connecter Drive" → fenêtre Google → autorise.

### Comportement

- Un seul fichier `musedesk-library.json` est créé dans ton Drive personnel (scope `drive.file` — l'app ne voit **que** ses propres fichiers).
- Merge **last-write-wins** basé sur `updatedAt` au niveau de chaque morceau.
- Le token OAuth est gardé **en mémoire de session uniquement** — jamais stocké en localStorage.
- Redémarre l'app = reconnexion nécessaire (flow OAuth classique).

### Sans Client ID configuré

Le bouton "Connecter Drive" reste grisé. L'app fonctionne parfaitement en mode 100% local.

---

## Roadmap

- [x] ~~Téléphone-comme-télécommande~~ → livré sous forme de **Mode Pupitre** (relais WebSocket, voir DEPLOY.md)

## Mode Pupitre (partage live)

Le leader ouvre une setlist, clique **📡 Mode Pupitre** : un QR s'affiche. Les followers scannent le QR avec l'appareil photo de leur tablette — l'URL s'ouvre avec un fragment `#join=<token>` et bascule automatiquement en **vue lecture seule synchronisée** : morceau courant, transposition (semitones/capo), scroll %, mode 2 colonnes, taille de police.

Transport : relais WebSocket (pas WebRTC) — sessions éphémères en RAM, zéro persistance. Le token 128 bits est dans le fragment `#` de l'URL (jamais transmis au serveur GitHub Pages ni en Referer).

Modèle de sécurité "possession du lien" : quiconque a le QR suit en lecture seule — acceptable pour répét/scène (partitions perso, rien de persisté).

**Dégradé propre** : si `RELAY_WS_URL` dans `config.js` est vide, le bouton Mode Pupitre est masqué. Si le relais est injoignable, un bandeau "hors ligne" s'affiche avec reconnexion auto — le mode solo reste 100 % fonctionnel. Voir le déploiement du relais dans [DEPLOY.md](DEPLOY.md).

## Licence

Usage personnel.
