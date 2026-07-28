# AGENTS.md — MuseDesk

Instructions pour tout agent de codage travaillant sur ce dépôt (Jules, Claude Code, Codex…).
Lis ce fichier avant de toucher au code.

---

## Le projet

Lutrin électronique / lecteur de grilles d'accords, pour musicien sur scène ou en répétition.
On colle une grille depuis Ultimate Guitar, elle est rangée en local, elle s'affiche en plein
écran transposable et défilable. **PWA 100 % vanilla** — HTML5, CSS3, modules ES6, aucun
framework, aucune dépendance npm, aucun build. Cible principale : tablette en paysage, ou PC
branché sur une TV. Application mono-utilisateur, données locales, un seul mainteneur.

---

## 🔴 Le piège n°1 — la version `?v=N`

**À lire avant tout changement touchant un module `.js`.**

Les modules ES sont versionnés **à la main** dans leurs imports : `import … from './db.js?v=25'`.
Cette version est **dupliquée dans 9 fichiers** — `index.html`, `app.js`, `sync.js`,
`fsprovider.js`, `live.js`, `db.js`, `parser.js`, `pdfimport.js`, `sw.js`.

Si une seule occurrence diverge, le navigateur charge **deux instances du même module** — donc
deux connexions IndexedDB concurrentes, et une corruption silencieuse des données.

`version-consistency.test.js` échoue si les `?v=` ne sont pas tous identiques, ce qui bloque le
déploiement avant la casse. **Ce test n'est pas une formalité : c'est le garde-fou du projet.**

La règle, à chaque modification d'un module :

1. Incrémenter le `?v=N` **partout en même temps**, dans les 9 fichiers.
2. Incrémenter aussi `const CACHE = 'musedesk-vNN'` en tête de `sw.js` — **compteur distinct**,
   il ne suit pas la même numérotation que `?v=` (aujourd'hui `?v=25` et `musedesk-v31`).
3. Lancer `node --test` avant de committer.

---

## Stack et commandes

| | |
|---|---|
| Runtime | Aucun. Fichiers statiques servis tels quels. |
| Modules | ES6 natifs, `"type": "module"` |
| Dépendances npm | **Aucune.** `package.json` ne déclare ni `dependencies` ni `devDependencies` |
| Tests | `node --test` (natif `node:test` + `node:assert/strict`) |
| Node en CI | 22 |
| Déploiement | GitHub Actions → GitHub Pages, à chaque push sur `main`, **seulement si les tests passent** |
| Prod | `https://santino18727-debug.github.io/musedesk/` |

```bash
node --test          # la seule commande. Pas de build, pas de lint, pas d'install.
```

Pour tester à la main : servir la racine en HTTP (les modules ES et le service worker ne
fonctionnent pas en `file://`).

---

## Architecture

Un module = une responsabilité. Les en-têtes de fichier documentent chacun son rôle et ses
choix — **lis-les avant de modifier**, ils contiennent le raisonnement.

| Fichier | Rôle |
|---|---|
| `app.js` | Orchestration complète et rendu. ~3 600 lignes — le gros du produit. |
| `db.js` | Persistance locale IndexedDB, sans librairie |
| `parser.js` | Parse ChordPro inline **et** Ultimate Guitar (accords au-dessus des paroles) |
| `sync.js` | Synchro Google Drive via Google Identity Services |
| `fsprovider.js` | Synchro par fichier local (File System Access API), sans OAuth |
| `live.js` | Mode Pupitre — WebSocket leader ↔ followers |
| `pdfimport.js` | Extraction de grilles depuis un PDF texte, hors ligne |
| `config.js` | Client ID Google et URL du relais WebSocket |
| `sw.js` | Service worker, cache offline |
| `vendor/` | PDF.js (Mozilla, MPL-2.0) et qrcode, **vendus en local** — jamais de CDN |

---

## Skills disponibles

Instructions détaillées, à charger **à la demande**. Ouvre le fichier correspondant avant de
commencer une tâche qui relève de son domaine — pas tous systématiquement, ce serait du contexte
gaspillé.

| Skill | Quand l'ouvrir | Fichier |
|---|---|---|
| `bump-version` | Dès qu'un `.js` de la racine est modifié — **obligatoire** | `.agent/skills/bump-version/SKILL.md` |
| `write-tests` | Ajouter ou étendre un test | `.agent/skills/write-tests/SKILL.md` |
| `debug-pwa` | Diagnostiquer un bug avant de proposer un correctif | `.agent/skills/debug-pwa/SKILL.md` |
| `ui-scene` | Toucher à `styles.css`, au DOM ou à une animation | `.agent/skills/ui-scene/SKILL.md` |

---

## Conventions

- **Français** partout : commentaires, messages de commit, libellés d'interface.
- **Messages de commit sans accents** — convention constante de l'historique
  (`fix: regressions de la boucle Eclat…`). Préfixes observés : `feat:`, `fix:`, `fix(a11y):`,
  `ui:`, `ux+anim:`, `chore:`. Les changements de version sont mentionnés en suffixe : `, ?v=24`.
- **En-tête de fichier obligatoire** sur tout nouveau module : ce qu'il fait, et pourquoi ce
  choix-là. C'est la documentation réelle du projet.
- `live.js` n'a **aucun effet de bord à l'import** et ne touche ni au DOM ni à IndexedDB.
  Préserver cette séparation si tu le modifies.
- Tests : `*.test.js` à la racine, à côté du module testé. Pas de framework, pas de mock —
  `node:test` et `assert/strict` suffisent.
- Chemins **relatifs** (`./`) obligatoires : la prod est servie sous le sous-chemin `/musedesk/`.
  Un chemin absolu `/x.js` casse le déploiement sans casser le local.

---

## Ce qu'il ne faut pas faire

- **N'ajoute aucune dépendance npm**, aucun framework, aucun bundler. Le « zéro build » est un
  choix de conception, pas un manque. Si une librairie est indispensable, elle est vendue dans
  `vendor/` avec sa licence mentionnée en commentaire.
- **Ne charge rien depuis un CDN.** L'application doit fonctionner hors ligne.
- **Ne persiste jamais un token OAuth.** Le token Drive vit en mémoire uniquement, jamais en
  `localStorage` ni en IndexedDB — voir l'en-tête de `sync.js`. Cette règle n'est pas négociable.
- `config.js` est versionné et contient un Client ID Google : c'est normal, un Client ID de type
  Web est public par construction. En revanche, **aucun client secret, aucun `.env`, aucun
  `client_secret*.json`** — le `.gitignore` les bloque déjà, ne l'affaiblis pas.
- Ne touche pas à `docs/screenshots/` sans raison : ces images sont référencées par le README.

---

## Avant d'ouvrir une PR

1. `node --test` passe — les trois fichiers de test, y compris `version-consistency.test.js`.
2. Les `?v=` sont cohérents dans les 9 fichiers, et `CACHE` de `sw.js` a été bumpé.
3. Aucune dépendance ajoutée : `package.json` reste sans `dependencies`.
4. `git diff` ne contient ni token, ni secret, ni chemin absolu commençant par `/`.
5. Message de commit en français, sans accents, avec un préfixe de l'historique.
6. Une PR = un sujet. La CI lance les tests sur chaque PR et déploie dès le merge sur `main` —
   une PR mergée part directement en production.

En cas de doute sur une intention de design, regarde `docs/WOW_LOOP.md` et les fichiers
`AUDIT_UIUX_*.md` à la racine : ils tracent les décisions d'interface déjà prises et écartées.
