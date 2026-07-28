# Accessibilité (A11y) - MuseDesk

Cette skill est cruciale pour le rôle "Palette" de MuseDesk, se concentrant sur les micro-UX et l'accessibilité.

## Règles de base

- **Attributs ARIA** : Obligatoires pour tous les contrôles, spécialement ceux uniquement visuels ou avec des icônes.
- **Navigation Clavier** : Tout bouton ou champ d'entrée doit être accessible et activable via le clavier.
- **Lecteurs d'écran (Screen Readers)** : Les changements dynamiques (ex: changement de morceau en Mode Pupitre) doivent être annoncés.

## Implémentations existantes (à maintenir)

- **Boutons icônes** : Utiliser `aria-label`.
  - Exemple : `<button class="btn" id="btn-t-down" aria-label="Transposer un demi-ton plus bas">−½</button>`
- **États des boutons / menus** : Utiliser `aria-pressed`, `aria-expanded`, et `aria-controls`.
  - Exemple : `<button id="lib-menu-toggle" aria-expanded="false" aria-controls="lib-sidebar">☰</button>`
- **Live Regions** : Annoncer les mises à jour sans interrompre le focus.
  - Exemple : `<div id="follower-announcer" class="sr-only" aria-live="polite"></div>` (utilisé par le follower dans le Mode Pupitre).
- **Masquage décoratif** : Masquer complètement au lecteur d'écran les éléments d'UI purement visuels.
  - Exemple : `<div id="curtain" class="curtain" aria-hidden="true"></div>` ou les SVG décoratifs `<svg aria-hidden="true" focusable="false">`.
- **Rôles explicites** : Utiliser les `role` appropriés.
  - Exemple : `<div id="reader-content" class="content" role="region" aria-label="Grille">`
