# Design Frontend - MuseDesk

Cette skill détaille le système de design visuel défini dans `styles.css`.

## Esthétique générale

- **Thème Sombre "Atelier de scène"** : L'interface est conçue pour des environnements à faible lumière (scène, répétition).
- **Widgets natifs** : Privilégier `color-scheme: dark;` pour que les éléments natifs (barres de défilement, inputs) soient sombres et ne provoquent pas de flash blanc.
- **Zéro Glassmorphism** : Utiliser des bandeaux opaques (vélin) pour le chrome (topbar, toolbar, etc.). Les propriétés `backdrop-filter` sont à proscrire au profit de tokens comme `--bg-glass`.

## Couleurs & Syntaxe CSS Moderne

- Utiliser strictement la **nouvelle syntaxe couleur CSS espacée par des espaces** avec le slash pour l'opacité.
  - **OUI** : `rgb(233 228 210 / 16%)`
  - **NON** : `rgba(233, 228, 210, 0.16)`
- **Variables CSS globales** : Toujours réutiliser les variables définies dans `:root` de `styles.css` (ex: `--bg`, `--bg-1`, `--border-soft`).

## Typographie et Graphisme

- **100% Système** : Les polices doivent être des fontes systèmes. Aucune requête réseau vers Google Fonts ou autre (Zéro dépendance réseau).
- **SVG Inline** : Les diagrammes d'accords et les icônes vectorielles sont générés en SVG inline (gérés dans le DOM, pas en tant qu'images externes).
