# AGENTS

Ce fichier définit les règles, conventions et compétences (skills) disponibles pour les agents IA intervenant sur le dépôt MuseDesk.

## Le projet en 5 lignes

MuseDesk est un lutrin électronique et un lecteur de grilles d'accords (formats ChordPro et Ultimate Guitar) pensé pour une utilisation sur tablette en mode paysage ou sur PC. C'est une Progressive Web App (PWA) 100% vanilla (sans aucun framework externe) qui stocke ses données localement via IndexedDB, avec une option de synchronisation Google Drive. L'application possède un métronome intégré, une gestion de setlists, et un mode "Pupitre" (lecture seule en temps réel pour followers via WebSocket). Le projet respecte une contrainte stricte du "zéro dépendance réseau", incluant ses dépendances comme PDF.js dans le dépôt.

## Stack et versions

- **Langages** : HTML5, CSS3, JavaScript (ES6 modules, syntaxe ES2019+).
- **Frameworks** : Aucun (100% Vanilla JS).
- **Gestionnaire de paquets / Runtime** : Node.js (utilisé uniquement pour lancer les tests).
- **Tests** : Runner natif Node.js (`node:test`) avec `node:assert/strict`.

## Commandes

- **Lancer localement** : `python3 -m http.server 8000` (ou tout autre serveur HTTP statique, pour résoudre les modules ES6).
- **Tester** : `npm test` (lance `node --test`).
- **Linter / Builder** : Aucun script de build ni de linting n'est défini. Les fichiers sont servis tels quels.

## Conventions de code

- **Architecture d'état** : L'interface utilisateur est maintenue par un objet global `state` (ex: `state.songs`). Les interactions UI locales doivent muter directement ce tableau local pour les performances, au lieu de redéclencher des lectures complètes dans la base de données (IndexedDB).
- **Style JS** : Préférer les syntaxes modernes (ES2019+), comme le *optional catch binding* (`catch { ... }`).
- **Langue** : Les commentaires de code et les logs console doivent être écrits en français, pour s'aligner avec l'existant.
- **Style CSS** : Utiliser la syntaxe moderne des couleurs séparées par des espaces avec un slash pour l'opacité (ex. `rgb(255 255 255 / 50%)` et non `rgba(255, 255, 255, 0.5)`).
- **Cache busting** : Les imports ES6 utilisent des paramètres de version explicites qu'il faut maintenir lors de changements d'architecture (ex. `import * as db from './db.js?v=25';`).

## Ce qu'il ne faut pas faire

- **Zéro dépendance réseau** : Ne jamais ajouter de ressources distantes (CDN, polices Google Fonts, scripts externes). Tout doit être en local (les polices système, PDF.js est dans `./vendor/`).
- **Pas de frameworks** : Ne jamais introduire de frameworks de build ou de frontend (React, Vue, Tailwind, Webpack, etc.).
- **Ne pas recréer l'état complet** : Ne jamais faire de modifications massives de la logique backend. Modifier les composants locaux sans casser la structure `state`.

## Avant d'ouvrir une PR

- **Tests** : La suite `npm test` doit passer à 100% sans erreur.
- **Messages de commit** : Suivre la convention *Conventional Commits* observée dans l'historique (ex. `chore: ...`, `style: ...`, `test: ...`, `perf: ...`, `refactor: ...`).
- **Vérifications** : Assurez-vous que les tests (qui utilisent l'assertion stricte Node) couvrent les nouveaux comportements.

## Skills disponibles

*Consigne explicite : lisez le fichier SKILL.md correspondant AVANT de commencer une tâche qui relève de ce domaine, et jamais systématiquement en amont.*

| Nom du skill | Quand l'utiliser | Chemin du fichier |
| --- | --- | --- |
| **Palette** | Pour les tâches liées à l'interface utilisateur (UI/UX) et à l'accessibilité. | `.agent/skills/palette/SKILL.md` |
