---
description: Boucle "Éclat" — passe visuelle wow sur MuseDesk, itère jusqu'au ROI visuel maximum
argument-hint: "[zone ciblée, ex. 'lecteur' | 'concert' | vide = auto]"
---

# /wow — Boucle « Éclat »

Boucle d'auto-amélioration **purement visuelle** de MuseDesk. Objectif : le maximum
d'effet « wow » compatible avec un outil de scène. Successeur de la boucle *Atelier*
(close le 2026-07-23 après 5 itérations, `b0edeb7`, `?v=19`) qui traitait l'UX/A11y/
cohérence de thème — celle-ci traite **l'éclat** : matière, lumière, chorégraphie.

Cible de cette itération : `$ARGUMENTS` (vide → prendre la zone au plus haut ROI
dans le backlog de `docs/WOW_LOOP.md`).

---

## 0. Contexte figé (ne pas le re-découvrir à chaque tour)

| Fait | Valeur |
|---|---|
| Stack | HTML/CSS/JS vanilla, ES modules, **zéro framework, zéro build** |
| Fichiers visuels | [styles.css](../../styles.css) (~1900 l.), [index.html](../../index.html) (440 l.), [app.js](../../app.js) (3136 l.) |
| Thème courant | « Partition Gravée » — indigo froid `--bg #12131c`, ivoire `--text #e9e4d2`, **or vieilli `--accent #c9a45c`**, vert-de-gris accords `--chord #6fae9c`. Identité = **relief / deboss / matière, JAMAIS le glow** |
| 3 vues | `#view-library`, `#view-reader`, `#view-setlist` |
| Preview | `preview_start {name:"musedesk-static"}` → `http://localhost:8137/?fresh=vN` (le SW sert du stale sans `?fresh=`) |
| Tests | `node --test` — **38/38 attendus**, dont `version-consistency.test.js` (bloque le déploiement si un `?v=` diverge) |
| Version courante | `?v=19` · `CACHE = 'musedesk-v25'` dans [sw.js](../../sw.js) |
| Prod | https://santino18727-debug.github.io/musedesk/ (GitHub Pages, CI `CI & Deploy`) |

---

## 1. Dispatch — qui fait quoi (règle permanente, pas de confirmation à demander)

| Phase | Route | Pourquoi |
|---|---|---|
| Preuve visuelle, arbitrage, relecture, scoring | **Opus (moi)** | jugement, c'est le cœur non délégable |
| Recon de l'existant (tokens, effets déjà posés) | **agent Haiku** (`Explore`) | lecture pure |
| Direction artistique / divergence | skill **`genjutsu:paint`** + agent **`art-director`** (moodboards SDXL **local**, gratuit) | anti-monotonie, fait VOIR les partis |
| Vocabulaire d'effets & creative coding | skill **`genjutsu:cast`** | c'est LA skill « wow » web (motion, micro-interactions, illusions) |
| Timing / easing / chorégraphie | skill **`motion-design`** | courbes et durées argumentées, pas au pif |
| Codification du style en tokens | skill **`design-dna`** | fige « Partition Gravée » en profil JSON → cohérence entre itérations |
| Critique parallèle (4 voix) | agents **Sonnet** : `Accessibility Auditor`, `Whimsy Injector`, `frontend-design`, `UX Researcher` | angles morts croisés |
| Implémentation CSS/JS | agent **Sonnet** (skill `frontend-design` / `impeccable`) | production normale |
| Mécanique (bump `?v=N`, renommage de tokens, duplications) | **`local-worker`** (qwen2.5-coder local, gratuit) | zéro jugement requis |
| Arbitrage d'un parti risqué | skill **`llm-council`** | uniquement si 2 directions se valent et que l'enjeu est structurant |

> Lancer les 4 critiques **en parallèle** (un seul message, 4 appels `Agent`).
> Ne monter en orchestration `Workflow` que si Eric le demande explicitement
> (mot-clé « ultracode » / « workflow ») — l'étalon Atelier était **~1,22 M tokens**
> pour une seule phase de critique+maquettes en fan-out.

---

## 2. Une itération = 8 phases

### Phase 0 — Preuve visuelle (bloquante)
`preview_start` puis `computer{action:"screenshot"}` sur les 3 vues.
⚠️ **Pendant toute la boucle Atelier, le panneau Browser n'a jamais composité** →
screenshots impossibles, 4 itérations livrées à l'aveugle. Donc :
- screenshot OK → je juge moi-même, la boucle peut enchaîner vite ;
- screenshot KO → **le dire franchement**, et l'œil d'Eric devient le seul juge :
  aucune itération ne se clôt sans son verdict visuel. Ne jamais écrire « c'est beau »
  sans l'avoir vu.

### Phase 1 — Recon (agent Haiku)
Inventaire de ce qui est **déjà** posé (`@keyframes`, `mask-image`, gradients, grain,
portée fantôme, `prefers-reduced-motion`) → éviter de re-proposer l'existant.

### Phase 2 — Divergence (`genjutsu:paint` + `art-director`)
**3 partis d'éclat** maximum, chacun maquetté en **HTML autonome** dans le scratchpad
(pas dans le repo). Chaque parti = un pari clair, pas trois nuances du même.

### Phase 3 — Checkpoint Eric ⛔
Je montre les 3 partis + le coût estimé. **Eric choisit, mélange ou rejette.**
Aucune ligne n'est écrite dans le repo avant sa réponse.

### Phase 4 — Critique multi-voix (4 agents Sonnet en parallèle)
Chaque voix rend un backlog coté **impact 1-5 / coût 1-5**. Je fusionne, je dédoublonne,
je classe par **ROI = impact / coût**. Tout ce qui a ROI < 1,5 part en « écarté » (avec la raison).

### Phase 5 — Implémentation (agent Sonnet + `genjutsu:cast`, mécanique → `local-worker`)
Édition **chirurgicale** (`Edit`, jamais `Write` sur un fichier vivant). Un effet = un diff
lisible. Pas de dépendance ajoutée sans vérif du manifeste.

### Phase 6 — Vérif (moi)
1. `node --test` → **38/38** (le test `version-consistency` doit rester vert)
2. Preview + `read_console_messages` (zéro erreur) + screenshot si dispo
3. **Perf** : pas de `rAF` continu sur la surface de lecture, effets sur `transform`/`opacity`/
   `filter` (couche composée), pas de layout thrash au scroll
4. `prefers-reduced-motion: reduce` → tout effet non essentiel neutralisé
5. **Mode Pupitre non cassé** (le DOM du follower reste pilotable par [live.js](../../live.js))

### Phase 7 — Score, journal, clôture
Mise à jour de [docs/WOW_LOOP.md](../../docs/WOW_LOOP.md) : score, ce qui est entré,
ce qui est écarté et pourquoi. Puis rituel de clôture (§5) et commit.

---

## 3. Garde-fous — rejet automatique, sans discussion

1. **La lisibilité de la partition est sacrée.** MuseDesk se lit sur scène, en concert,
   parfois en faible lumière. Tout effet qui trouble la zone de lecture (`.content`) —
   animation permanente, contraste baissé, flou, parallaxe sous le texte — est **rejeté**,
   quelle que soit sa beauté.
2. **Pas de glow.** L'identité « Partition Gravée » vient du deboss et de la matière.
   Un halo lumineux = régression d'identité (le glow a été retiré partout à l'itér.1).
3. **CSP stricte** : `script-src 'self'`, `font-src 'self'`, `img-src 'self' data:`.
   → **aucun CDN**, aucun handler inline, aucune police Google. Toute lib doit être
   vendorisée dans `vendor/` — et donc justifier son poids.
4. **Offline-first** : chaque octet ajouté est mis en cache par le SW. Un asset lourd
   (police display, PNG d'illustration) = checkpoint Eric obligatoire, jamais en douce.
5. **A11y non négociable** : contrastes WCAG AA tenus, focus visible, `prefers-reduced-motion`
   gaté systématiquement, cibles ≥ 24 px. Un effet qui casse un de ces points est refait ou jeté.
6. **Batterie/tablette** : cible 60 fps sur entrée de gamme. Un effet joli qui chauffe est un
   effet raté.
7. **Jamais annoncer un rendu non vu.** Si je n'ai pas de screenshot, je dis « non vérifié
   visuellement » — cf. l'aveu de la boucle Atelier.

---

## 4. Score WOW /100 et **condition d'arrêt** (le ROI)

Noté à chaque fin d'itération, dans le journal, avec le delta.

| Axe | Poids | Ce qu'on mesure |
|---|---|---|
| Impact au premier regard | 25 | « effet waouh » en 2 s sur la vue d'accueil |
| Cohérence d'identité (anti-slop) | 20 | ça ressemble à MuseDesk, pas à un template IA |
| Matière & profondeur | 15 | grain, deboss, feuille d'or, épaisseur perçue |
| Chorégraphie & micro-interactions | 15 | entrées/sorties, feedback, timing |
| Lisibilité de scène préservée | 15 | **malus fort** si dégradée |
| Tenue technique | 10 | 60 fps, A11y, offline, reduced-motion |

**La boucle s'arrête (ROI maximal atteint) dès qu'UNE de ces conditions tient :**
- **A.** Deux itérations consécutives à **gain net < +3 pts** → le filon est épuisé.
- **B.** Tous les items restants du backlog ont **ROI < 1,5** → ne reste que du coûteux/marginal.
- **C.** Score ≥ **85** ET plus aucun item d'impact ≥ 4 → point de rendement décroissant.
- **D.** Eric dit stop. (Toujours prioritaire.)

**La boucle continue** tant qu'il reste un item impact ≥ 4 à coût ≤ 3.
Un parti rejeté par Eric en phase 3 **ne compte pas** comme une itération.

---

## 5. Rituel de clôture (le footgun, à ne jamais rater)

1. Bump **uniforme** `?v=N` → `N+1` dans les 9 fichiers (`index.html`, `app.js`, `sync.js`,
   `fsprovider.js`, `live.js`, `db.js`, `parser.js`, `pdfimport.js`, `sw.js`) — **et** le
   commentaire d'en-tête de `sw.js`.
2. Bump `CACHE = 'musedesk-vM'` → `M+1` dans [sw.js](../../sw.js).
3. `node --test` → 38/38 (`version-consistency` valide le point 1).
4. Commit : `ui: <résumé> (boucle Éclat itér.N), ?v=<N+1>`.
5. **Ne pas pousser** sans accord explicite d'Eric.

---

## 6. Lancement

- **Un tour** : `/wow` (ou `/wow lecteur` pour cibler).
- **En boucle auto-rythmée** : `/loop /wow` — mais l'itération s'arrête d'elle-même
  au checkpoint phase 3, donc la boucle reste sous contrôle humain. C'est voulu :
  une boucle de beauté sans œil humain produit du joli-sur-le-papier.
- **État persistant** : tout est dans [docs/WOW_LOOP.md](../../docs/WOW_LOOP.md) — le lire
  EN PREMIER à chaque tour pour reprendre où on en est.
