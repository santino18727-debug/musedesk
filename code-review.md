# Revue de code - MuseDesk

Cette skill définit les critères pour relire un diff sur MuseDesk. Le projet est une PWA 100% vanilla.

## Règles générales

- **Pas de build** : Le code doit s'exécuter tel quel dans un navigateur moderne. Les imports utilisent l'extension (ex: `import { ... } from './db.js'`).
- **Gestion d'état** : L'état UI est géré par l'objet `state` global dans `app.js`. Les mutations locales doivent privilégier la modification directe des tableaux (ex: `state.songs`) pour éviter les re-fetchs complets sur la DB (IndexedDB).
- **ES Modules Vanilla** : Utiliser `const` et `let`, l'optional chaining (`?.`), nullish coalescing (`??`), et l'optional catch binding si l'erreur n'est pas utilisée.
- **Commentaires** : En français, explicatifs sur le *pourquoi*.

## Cas limites et vérifications

- **Évitement de requêtes réseau bloquantes** : MuseDesk est offline-first. Le code ne doit jamais dépendre de CDN externes. Les assets locaux (fonts, SVG inline) sont obligatoires.
- **Destruction/Nettoyage** : Si des timers (comme `_reconnectTimer` dans `live.js`) ou listeners globaux sont ajoutés, s'assurer qu'ils peuvent être proprement détruits ou masqués par des conditions d'état (ex: `_intentionalClose`).

## Checklist

- [ ] L'import/export ES6 contient-il un timestamp ou version cache si nécessaire (ex: `?v=25`) comme dans les fichiers actuels de l'app ?
- [ ] Les manipulations DOM sont-elles optimales (pas de reflow intempestif) ?
- [ ] Y a-t-il un risque d'introduction de dépendances (strictement interdit) ?
