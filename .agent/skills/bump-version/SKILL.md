---
name: bump-version
description: Incrémenter la version des modules ES et du cache du service worker. À utiliser dès qu'un fichier .js de la racine est modifié — c'est obligatoire, pas optionnel, sous peine de corruption silencieuse d'IndexedDB.
---

# Bumper la version

MuseDesk n'a pas de bundler. Le cache-busting des modules ES est **manuel**, dupliqué dans
plusieurs fichiers, et c'est le point le plus fragile du projet.

## Pourquoi c'est critique

Un import ressemble à `import * as db from './db.js?v=25'`. Le navigateur traite
`./db.js?v=25` et `./db.js?v=24` comme **deux modules distincts** : il les charge tous les deux,
et exécute deux fois le code de haut niveau. Pour `db.js`, cela signifie **deux connexions
IndexedDB concurrentes** sur la même base. Les écritures se marchent dessus, et la perte de
données est silencieuse — aucune erreur console.

C'est un footgun documenté dans l'en-tête de `version-consistency.test.js`.

## Les deux compteurs

Ils sont **indépendants** et n'ont pas la même valeur. Ne les confonds pas.

| Compteur | Où | Rôle |
|---|---|---|
| `?v=N` | Dans les imports, sur 9 fichiers | Cache-busting des modules ES |
| `musedesk-vNN` | `const CACHE` en tête de `sw.js` | Invalidation du cache du service worker |

Au moment où cette skill a été écrite : `?v=25` et `musedesk-v31`.

## Procédure

1. Relever la valeur actuelle :
   ```bash
   grep -o '?v=[0-9]*' index.html | sort -u
   grep -n "const CACHE" sw.js
   ```

2. Incrémenter `?v=` **de 1, partout à la fois**, dans ces 9 fichiers :
   `index.html`, `app.js`, `sync.js`, `fsprovider.js`, `live.js`, `db.js`, `parser.js`,
   `pdfimport.js`, `sw.js`.

3. Incrémenter `CACHE` dans `sw.js`, de 1 également — mais sur **sa propre** numérotation.

4. Vérifier :
   ```bash
   node --test
   ```
   `version-consistency.test.js` échoue si une seule occurrence a été oubliée, et il liste
   les fichiers fautifs avec leur valeur. Lis le message, il te dit exactement où regarder.

## Ce qu'il ne faut pas faire

- **N'ajoute jamais `?v=` dans un fichier `*.test.js`.** Les tests importent les modules
  directement — `import { isChord } from './parser.js'` — et le garde-fou ne scanne pas les
  fichiers de test. Y mettre une version fausserait le compteur sans être détecté.
- Ne bumpe pas seulement le fichier que tu as modifié. La version est **globale au projet**,
  pas par module. Un `?v=` divergent est précisément le bug que le garde-fou existe pour attraper.
- Ne fais pas sauter le compteur de plusieurs unités « pour être sûr ». L'historique git suit
  cette numérotation, et les messages de commit la mentionnent (`, ?v=24`).

## Message de commit

Mentionne la nouvelle version en suffixe, comme le reste de l'historique :

```
feat: wake lock, persistance des reglages, ?v=26
chore: rebump ?v=26 / CACHE v32 apres merge de main
```

Sans accents — c'est la convention du dépôt.
