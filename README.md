# 🎼 MuseDesk

Lutrin électronique / lecteur de grilles d'accords. PWA **100% vanilla** (HTML5 + CSS3 + JS ES6 modules), sans aucun framework. Pensée pour une tablette en mode paysage — ou un PC branché sur une TV.

Colle une grille depuis Ultimate Guitar → elle est rangée localement → affichage plein écran ultra-lisible, transposable, défilable.

## Fonctionnalités (MVP)

- 📚 **Bibliothèque** locale (IndexedDB) — cartes, recherche instantanée
- 📋 **Import** par copier-coller (formats Ultimate Guitar **et** ChordPro `[Em]`)
- 🎸 **Lecteur** plein écran : accords alignés au-dessus des paroles (monospace)
- 🔠 **Taille de police** ajustable (A− / A+)
- ⏯️ **Auto-scroll** fluide (`requestAnimationFrame`)
- ⌨️ **Raccourcis** : `Espace` scroll · `+/−` police · `Échap` retour
- 📴 **PWA** installable, fonctionne hors-ligne (service worker)

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
| `index.html` | Structure (vues Bibliothèque + Lecteur + dialogue Import) |
| `styles.css` | Design sombre épuré, responsive paysage |
| `app.js` | Orchestration des vues, CRUD UI, live tools |
| `db.js` | Persistance IndexedDB (CRUD + export/import) |
| `parser.js` | Parser ChordPro / Ultimate Guitar → HTML aligné (+ transposition) |
| `sync.js` | Interface de synchro — **terrain prêt pour Google Drive** |
| `manifest.json` / `sw.js` | PWA |

## Roadmap

- [ ] Transposition câblée à l'UI (la logique existe déjà dans `parser.js`)
- [ ] Setlists (enchaîner ses morceaux d'une session)
- [ ] Synchro Google Drive (interface prête dans `sync.js`, reste OAuth + provider)
- [ ] Téléphone-comme-télécommande (nécessite un mini-relais)

## Licence

Usage personnel.
