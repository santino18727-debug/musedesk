---
name: debug-pwa
description: Diagnostiquer un bug de MuseDesk — données qui disparaissent, ancienne version qui persiste, mode Pupitre qui décroche, import PDF bancal. À utiliser avant de proposer un correctif, jamais pour refactorer au passage.
---

# Débugger MuseDesk

Application sans build : ce que tu lis est exactement ce qui tourne dans le navigateur. Pas de
source map à interpréter, pas de transpilation à suspecter. Le bug est dans le fichier.

**Méthode : reproduire, isoler, corriger au minimum.** Ne refactore pas un module parce que tu
passais par là — l'historique du projet montre que les régressions viennent des passes
d'amélioration, pas des correctifs ciblés (`docs/WOW_LOOP.md`, section « Régressions introduites
par nos propres itérations »).

## Les quatre suspects habituels

### 1. Des données qui disparaissent ou reviennent en arrière

**Premier réflexe : vérifier les `?v=`.** Un import divergent fait charger deux instances de
`db.js`, donc deux connexions IndexedDB sur la même base, et les écritures se marchent dessus
sans lever d'erreur.

```bash
node --test        # version-consistency.test.js répond en une seconde
```

Si ce test échoue, tu as trouvé la cause — inutile de chercher plus loin dans `db.js`. Voir la
skill `bump-version`.

### 2. L'ancienne version s'affiche encore

Le service worker (`sw.js`) sert le cache `musedesk-vNN`. Tant que ce nom ne change pas,
l'utilisateur garde l'ancien code même après déploiement. Dans les DevTools : onglet
Application → Service Workers → *Update on reload*, et Storage → *Clear site data* pour repartir
propre. Un bug non reproductible chez toi mais réel chez l'utilisateur commence souvent là.

### 3. Le mode Pupitre décroche

`live.js` est la couche WebSocket leader ↔ followers. Le protocole est documenté dans son
en-tête : lis-le avant de toucher quoi que ce soit. Deux propriétés à ne pas casser — **aucun
effet de bord à l'import**, et le module ne touche ni au DOM ni à IndexedDB. Si ton correctif
l'oblige à faire l'un ou l'autre, c'est que le correctif est au mauvais endroit.

L'URL du relais vient de `RELAY_WS_URL` dans `config.js`. Un échec de connexion peut donc être
une panne d'infrastructure et pas un bug de code : vérifie avant d'accuser `live.js`.

### 4. L'import PDF sort n'importe quoi

`pdfimport.js` reconstruit des lignes à partir de fragments positionnés en X/Y — un PDF ne dit
jamais « cet accord est au-dessus de ce mot ». Les échecs viennent presque toujours du
regroupement par coordonnée, pas de PDF.js. Ajoute un cas dans `pdfimport.test.js` avec
l'entrée qui casse avant de corriger.

## Ce qui n'est jamais la cause

- **Une dépendance.** Il n'y en a aucune. `vendor/` contient PDF.js et qrcode, vendus en local
  et figés.
- **Le build.** Il n'y en a pas.
- **Un problème de framework.** Il n'y en a pas non plus.

## Avant de proposer le correctif

1. `node --test` passe.
2. Le correctif tient en quelques lignes. S'il est gros, tu as probablement traité un symptôme
   en amont plutôt que la cause.
3. Si un module `.js` a changé, les `?v=` et `CACHE` ont été bumpés — sinon ton correctif
   n'atteindra jamais l'utilisateur, qui restera sur la version en cache.
4. Le message de commit décrit le **symptôme corrigé**, pas la manipulation effectuée. Le style
   du dépôt : `fix: regressions de la boucle Eclat reperees en passe critique, ?v=23`.
