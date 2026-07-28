# Écriture de tests - MuseDesk

Cette skill détaille comment écrire les tests (TDD) pour MuseDesk.

## L'environnement de test

- **Runner** : Le module natif `node:test`.
- **Assertions** : Le module natif `node:assert/strict`.
- **Exécution** : Commande `npm test` (qui exécute `node --test`).

## Règles de rédaction

- Écrire les tests **avant** d'implémenter la fonctionnalité.
- Se concentrer sur les fonctions pures (ex: `parser.js`) et la logique métier isolée. Le projet étant 100% vanilla et sans bundler, tester le DOM requiert un mock ou doit être évité si trop complexe; préférez tester la logique d'état.
- Les blocs `describe` et `test` doivent structurer clairement le comportement attendu.

## Exemple tiré du code (`parser.test.js`)

```javascript
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { isChord } from './parser.js';

describe('parser.js tests', () => {
  describe('isChord()', () => {
    test('valid simple chords', () => {
      assert.strictEqual(isChord('C'), true);
      assert.strictEqual(isChord('G'), true);
    });
  });
});
```
