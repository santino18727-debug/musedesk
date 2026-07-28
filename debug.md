# Débogage - MuseDesk

Cette skill détaille la méthode pour reproduire, isoler et corriger les bugs au sein de MuseDesk.

## Principe d'or

**Isoler et corriger au minimum, ne jamais refactorer au passage.** Le projet est grandement couplé par la mutation directe de l'état global et les événements DOM. Une modification minime réduit les risques de régression en cascade.

## Méthodologie

1. **Reproduction** :
   - Lancer un serveur local : `python3 -m http.server 8000` (ou équivalent).
   - Constater le comportement anormal en identifiant si c'est un bug UI/DOM (généralement `app.js` ou `index.html`), un bug de persistance (`db.js`), ou un bug de parsing (`parser.js`).

2. **Isolation** :
   - Pour l'état : Inspecter l'objet global `state` dans `app.js` via les devtools.
   - Pour le parsing : Extraire le texte source, créer un cas de test dans `parser.test.js` avec le comportement défectueux pour valider l'erreur (voir skill `write-tests.md`).

3. **Correction** :
   - Modifier uniquement la ligne ou la fonction fautive.
   - Utiliser des logs en français (`console.log("Erreur de parsing:", err)`).

## Points chauds connus

- `parser.js` : Différences entre ChordPro inline et les formats Ultimate Guitar (accord au-dessus des paroles).
- `live.js` : La reconnexion WebSocket peut laisser des états en suspend si `_intentionalClose` n'est pas bien géré.
- `app.js` (DOM) : Les re-rendus d'accords. S'assurer que le re-calcul avec la transposition (`transposeChord`) s'applique à tous les diagrammes SVG.
