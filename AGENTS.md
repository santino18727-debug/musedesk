# MuseDesk - Guide des Agents

Ce projet est une PWA 100% vanilla (HTML5, CSS3, JS ES6) fonctionnant principalement en local via IndexedDB. Les contributions doivent respecter scrupuleusement l'architecture sans build et l'absence de framework.

Voici les compétences attendues pour intervenir sur ce dépôt. Chaque fichier contient des instructions spécifiques à l'environnement de MuseDesk.

## Skills

* [Revue de code (`code-review`)](code-review.md) : Vérifier les modules ES6 vanilla et la cohérence avec l'état global.
* [Écriture de tests (`write-tests`)](write-tests.md) : Utiliser le runner natif `node:test` pour valider la logique métier (parser, db).
* [Débogage (`debug`)](debug.md) : Isoler et corriger les bugs liés au DOM ou au state sans refactorisation.
* [Revue de sécurité (`security-review`)](security-review.md) : Contrôler l'usage du token OAuth en RAM et la sécurité du Mode Pupitre.
* [Design Frontend (`frontend-design`)](frontend-design.md) : Maintenir l'UI sombre, utiliser la syntaxe couleur moderne et respecter `styles.css`.
* [UX Copywriting (`ux-copy`)](ux-copy.md) : Rédiger en français, direct et sans fioriture pour l'interface de scène.
* [Accessibilité (`accessibility`)](accessibility.md) : Garantir la navigation clavier et l'usage correct des balises ARIA (focus sur la Palette).

## Règles générales

- **Vanilla uniquement** : Aucune dépendance NPM front-end. Tout passe par des modules ES6 (`import ...`).
- **Mode dégradé** : Les fonctions comme Google Drive ou le relais WebSocket ne bloquent pas le mode local en cas de panne.
- **Serveur local** : Les tests manuels nécessitent un serveur HTTP (ex: `python3 -m http.server 8000`).
