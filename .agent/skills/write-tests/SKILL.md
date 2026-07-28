---
name: write-tests
description: Écrire ou étendre les tests de MuseDesk avec le runner natif node:test, sans framework ni mock. À utiliser pour couvrir une fonction de parsing, d'import ou une règle d'intégrité du projet.
---

# Écrire des tests

Le projet n'a **aucune dépendance de test**. Pas de Jest, pas de Vitest, pas de mock library.
Le runner natif de Node suffit, et c'est un choix à préserver.

```bash
node --test          # lance tout ce qui matche *.test.js
```

La CI exécute cette commande sur Node 22, et **bloque le déploiement si elle échoue**.

## Où et comment

Les fichiers de test vivent **à la racine, à côté du module testé** : `parser.js` →
`parser.test.js`. Pas de dossier `test/`.

Le style existant, tiré de `parser.test.js` — `describe` imbriqués, un niveau par fonction :

```js
import test, { describe } from 'node:test';
import assert from 'node:assert';
import { isChord, transposeChord } from './parser.js';

describe('parser.js tests', () => {
  describe('isChord()', () => {
    test('valid simple chords', () => {
      assert.strictEqual(isChord('C'), true);
      assert.strictEqual(isChord('Bb'), true);
    });
  });
});
```

⚠️ **Importe sans `?v=`.** Les modules de l'application se référencent entre eux avec
`./parser.js?v=25`, mais les tests importent `./parser.js` tout court. Voir la skill
`bump-version` pour la raison.

Deux conventions d'assertion coexistent dans le dépôt : `node:assert` dans `parser.test.js`,
`node:assert/strict` dans `version-consistency.test.js`. **Aligne-toi sur le fichier voisin**
plutôt que d'uniformiser — ce n'est pas le sujet de ta PR.

## Documenter les cas limites

Quand un cas surprend, le test existant explique **pourquoi** en commentaire de fin de ligne :

```js
assert.strictEqual(isChord('G(/B)'), false); // le parser n'accepte pas `(/B)` comme basse :
                                             // le `/` doit précéder immédiatement la note
```

Reproduis ce réflexe. Un test qui documente une limite connue vaut mieux qu'un test qui la
constate en silence — et évite qu'un futur contributeur « corrige » un comportement voulu.

## Quoi tester en priorité

Le cœur métier est **pur et testable** — parsing, transposition, détection de tonalité,
extraction PDF. C'est là que les tests ont le meilleur rapport valeur/effort.

| Zone | Testable ? |
|---|---|
| `parser.js` — accords, transposition, tonalité | ✅ fonctions pures, déjà couvertes |
| `pdfimport.js` — reconstruction de lignes | ✅ déjà couvert |
| Règles d'intégrité du dépôt | ✅ voir `version-consistency.test.js` |
| `app.js` — orchestration et rendu DOM | ❌ pas de jsdom dans le projet, ne l'ajoute pas |
| `sync.js`, `live.js` — réseau, OAuth | ❌ nécessiterait des mocks : hors périmètre |

Pour la logique liée au DOM ou au réseau, la vérification se fait à la main dans le navigateur.
N'introduis pas jsdom, happy-dom ou un serveur de test pour contourner ça.

## Un test qui garde une règle du projet

`version-consistency.test.js` ne teste aucune fonction : il lit des fichiers et vérifie une
**invariance du dépôt**. C'est un pattern légitime ici, et le meilleur endroit pour ancrer une
règle qu'un humain oublierait. Si tu identifies une contrainte structurelle du même genre —
un chemin absolu interdit, une dépendance qui ne doit pas réapparaître — écris-la sous cette
forme plutôt que dans un commentaire que personne ne lira.
