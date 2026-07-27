# Boucle « Éclat » — état persistant

Journal, score et backlog de la boucle visuelle `/wow`.
**À lire en premier à chaque itération.** Protocole : [.claude/commands/wow.md](../.claude/commands/wow.md).

- Ouverte le **2026-07-26** (demande d'Eric : « rends MuseDesk plus beau, tous les effets wow,
  n'arrête que quand on a pris le maximum de ROI visuel »).
- Prédécesseur : boucle *Atelier* (UX/A11y/thème), close le 2026-07-23 après 5 itérations,
  `b0edeb7`, `?v=19` / `CACHE musedesk-v25`.
- Statut : **itér.0 non démarrée** — attend le lancement de `/wow`.

---

## Score WOW

| Itér. | Date | Score /100 | Δ | Ce qui est entré |
|---|---|---|---|---|
| 0 (base) | — | **à établir en phase 0** | — | héritage boucle Atelier |

⚠️ **Aucun score de base n'est inscrit tant que le rendu n'a pas été VU** (screenshot agent
ou œil d'Eric). Toute la boucle Atelier a été livrée sans compositing du panneau Browser :
on ne recommence pas à noter de la beauté à l'aveugle.

---

## Backlog d'amorçage

Coté **impact 1-5 / coût 1-5**, `ROI = impact / coût`. Trié par ROI décroissant.
Tous vérifiés compatibles CSP stricte (`script-src 'self'`, `font-src 'self'`, zéro CDN)
et offline-first. **À faire challenger en phase 4** — ce n'est qu'une amorce, pas un plan figé.

| # | Effet | Où | Imp. | Coût | ROI | Note |
|---|---|---|---|---|---|---|
| 1 | Tampon d'encre sur le favori ☆→★ | `.card .fav` | 3 | 1 | **3.0** | keyframe + `mask-image`, déjà 90 % du terrain posé |
| 2 | **View Transitions API** sur les changements de vue | `app.js` (bascule des 3 vues) | 5 | 2 | **2.5** | `document.startViewTransition`, natif, progressive enhancement, remplace `viewFade` |
| 3 | Or spéculaire (lumière qui glisse sur la feuille d'or) | `.btn-primary`, `.play`, `.pill` | 4 | 2 | **2.0** | `@property --angle` + conic-gradient, **au survol seulement** (pas d'anim permanente) |
| 4 | Deboss réactif au pointeur | `.card`, `.song-row` | 4 | 2 | **2.0** | `--mx/--my` → ombre interne orientée. Gate `@media (pointer:fine)` |
| 5 | Rail de progression gravé en scroll natif | vue Lecteur | 4 | 2 | **2.0** | `animation-timeline: scroll()` — zéro JS, GPU |
| 6 | Lever de rideau à l'entrée en mode concert | `#btn-start-concert` | 5 | 3 | 1.7 | le moment le plus théâtral de l'app, aujourd'hui muet |
| 7 | Métronome = battement de la **lumière**, pas de la couleur | `#lb-bpm` | 3 | 2 | 1.5 | affine le pulse posé à l'itér.2 |
| 8 | Page-turn 3D (next/prev en concert) | vue Lecteur | 4 | 3 | 1.3 | ⚠️ garde-fou lisibilité : transform bref, jamais pendant la lecture |
| 9 | Portée fantôme réactive au défilement | filets 5-lignes | 3 | 2 | 1.5 | matière déjà en place, à animer très sobrement |
| 10 | Grain vélin en parallaxe | surfaces de chrome **uniquement** | 3 | 2 | 1.5 | ⛔ **interdit sous `.content`** (zone de lecture) |
| 11 | Illustrations d'états vides gravées | Bibliothèque / Setlist vide | 4 | 3 | 1.3 | via `art-director` / SDXL **local** (gratuit). Checkpoint poids offline |
| 12 | Police display vendorisée pour les titres | titres (Georgia système aujourd'hui) | 5 | 4 | 1.25 | **le plus gros levier d'identité** — mais +KB en cache SW. **Décision d'Eric obligatoire** |
| 13 | Splash d'ouverture : diffusion d'encre (canvas isolé) | démarrage | 4 | 4 | 1.0 | isolé donc sûr côté perf, mais cher et vu 2 s |

**Déjà fait, ne pas re-proposer** (boucle Atelier) : sorties animées des dialogs/toasts,
FLIP reorder setlist, pulse métronome de base, grain statique sur `.content`, portée fantôme
statique, focus WCAG 2.4.11, suppression du glow et des `backdrop-filter`.

---

## Écartés (avec la raison)

_(vide — se remplit en phase 4/7)_

---

## Journal des itérations

### Itér.1 — « Le Théâtre » (+ 2 greffes) — 2026-07-27 — ✅ VALIDÉE, commit `def6fe9`

Parti retenu par Eric parmi 3 maquettés (A Lumière / **B Théâtre** / C Matière) :
*au repos rien ne change, tout l'éclat est dans le mouvement entre les états.*
**Verdict visuel d'Eric : « le rendu est nickel »** — 1re itération de toutes les boucles
MuseDesk (Atelier incluse) à être réellement VUE avant commit.

⚠️ **Le score /100 du protocole n'est pas inscriptible** : le panneau Browser de l'agent ne
composite toujours pas, je ne peux pas noter ce que je ne vois pas. La boucle s'arrêtera donc
sur les conditions **B** (tout le backlog restant à ROI < 1,5) ou **D** (Eric dit stop), pas sur
un delta de score. Les conditions A et C sont inapplicables tant que je suis aveugle.

**Livré** — `?v=20` / `CACHE musedesk-v26`, +429/−17 lignes sur `app.js`, `styles.css`, `index.html`, **38/38 tests** :

| # | Effet | Accroche |
|---|---|---|
| 1 | View Transitions sur la bascule de vue | `showView()` devient un wrapper de `showViewInner()` — [app.js:630](../app.js:630) |
| 2 | Morph du titre carte → lecteur | titre isolé dans son propre span, `view-transition-name` posé/retiré dynamiquement — [app.js:977](../app.js:977), [index.html:142](../index.html:142) |
| 3 | Page-turn au changement de morceau | `withPageTurn()` — [app.js:1450](../app.js:1450) |
| 4 | Lever de rideau à l'entrée en concert | `playCurtainAround()` — [app.js:1402](../app.js:1402) |
| 5 | Rail de progression scroll-driven | `animation-timeline: scroll(nearest)` + repli JS — [app.js:2756](../app.js:2756) |
| 6 | Tampon d'encre sur le favori ☆→★ | posé sur l'étoile **reconstruite** — [app.js:849](../app.js:849) |
| 7 | Balayage de lumière à l'activation | délégation click — [app.js:2775](../app.js:2775) |
| 8 | Garde-fous transverses | [styles.css:2007](../styles.css:2007) |

**Décisions d'arbitrage (manager)**
- **`prefers-reduced-motion` était un faux ami** : le bloc existant cible `*, *::before, *::after`,
  qui n'atteint pas l'arbre `::view-transition-*`. Règle explicite ajoutée — c'était bloquant.
- **Le tampon d'encre était mort-né** : `renderLibrary()` détruit toute la grille au clic sur ★.
  Contourné en posant l'animation sur l'élément reconstruit (la ligne de refocus existait déjà).
- **Pas de transition quand la vue ne change pas** : `openReader()` rappelle `showView('reader')`
  à chaque morceau en concert — sans ce garde, cross-fade et page-turn entraient en collision.
- **Les 4 effets théâtraux sont coupés côté follower (Pupitre)** inconditionnellement : un
  mouvement piloté à distance n'a aucune anticipation motrice, c'est de l'auto-play.
- **Page-turn plafonné à 20°** (au lieu des 85° de la maquette) : au-delà, rotation de grande
  surface = déclencheur vestibulaire, et le contenu disparaît en tournant.

**Écarté de cette itération** — stagger de SORTIE sur les listes : les deux listes se re-rendent
par `innerHTML=''`, il faudrait répliquer le pattern FLIP de `flipRow()` partout. Coût
disproportionné au gain. Reste dans le backlog si le filon d'éclat s'épuise ailleurs.

**Reste du backlog après cette itération** : #1 tampon (fait), #2 View Transitions (fait),
#5 rail (fait), #6 rideau (fait), #8 page-turn (fait) → restent **#3 or spéculaire**,
**#4 deboss réactif au pointeur** (parti A), **#9 portée fantôme**, **#11 illustrations d'états
vides**, **#12 police display vendorisée** (le plus gros levier d'identité restant).

---

### Itér.2 — « La Feuille d'Or » — 2026-07-27 — ⏳ EN ATTENTE DU VERDICT VISUEL

Parti A, déjà maquetté et vu par Eric à l'itér.1 — **phases divergence + checkpoint sautées**
(re-maquetter un parti déjà arbitré ne lui apprendrait rien). L'itér.1 a posé la chorégraphie ;
celle-ci pose la lumière et la matière.

**Livré** — `?v=21` / `CACHE musedesk-v27`, +199/−7 lignes, **38/38 tests** :

| # | Effet | Accroche |
|---|---|---|
| 3 | Or spéculaire (reflet qui glisse, survol/focus, one-shot) | `@property --angle` — [styles.css:152](../styles.css:152), règle [styles.css:2034](../styles.css:2034) |
| 4 | Deboss réactif au pointeur | CSS [styles.css:2065](../styles.css:2065), JS [app.js:2801](../app.js:2801) |
| — | Chanfrein lumineux (même source que #4) | [styles.css:2081](../styles.css:2081) |
| 9 | Portée fantôme vivante (épaisseur/opacité inégales, **statique**) | tokens `--ghost-staff` — [styles.css:96](../styles.css:96), 4 hôtes |

**Coût JS mesuré** (item #4, le seul qui touche au JS) : 1 listener `pointermove` délégué,
`{passive:true}`, au plus 1 `getBoundingClientRect()` par frame et uniquement sur l'élément
survolé ; **rien ne tourne au repos** (le rAF n'est planifié que si le pointeur bouge) ; le
listener n'est même pas attaché si `pointer: fine` est faux ou `reduced-motion` est vrai
→ **coût nul sur la tablette de scène**, seul matériel qui compte en live.

**Vérifié en relecture (manager)** : aucun sélecteur ne fuit vers `.content`/`.sheet` ;
`position: relative` + `overflow: hidden` bien posés sur les nouveaux hôtes du reflet (sans
quoi le reflet déborderait du contour — ce serait un glow) ; `.card` confirmée non focusable,
donc la collision de spécificité entre la nouvelle règle et `.card:focus-visible` (styles.css:578)
est inerte — **mais cette règle-là est du code mort**, sortie en tâche séparée.

**Écart notable** : les coefficients du deboss ont été recalibrés (0.04/0.07 au lieu de
0.05/0.09 dans la maquette) pour que le calcul retombe **pixel pour pixel** sur
`--sh-deboss-deep` au repos — la maquette calibrait sur `--sh-deboss`, pas sur la variante
« deep » réellement utilisée par `.card`/`.song-row`. Aucun écart visible tant que le pointeur
n'a pas bougé sur l'élément.

**État du backlog après itér.2** — restent **#11 illustrations d'états vides** (impact 4,
coût 3, ROI 1,3), **#12 police display vendorisée** (impact 5, coût 4, ROI 1,25, **décision
Eric requise** : Ko ajoutés au cache offline), **#13 splash canvas** (ROI 1,0).
⚠️ **La condition d'arrêt B est à un cheveu** : tous les items restants sont sous le seuil
ROI 1,5. La boucle ne continue que par la règle « il reste un item impact ≥ 4 à coût ≤ 3 »
(#11). Après #11, arrêt sauf nouveau filon.
