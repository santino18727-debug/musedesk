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

---

### Itér.3 — « Le Graveur & la Lettrine » — 2026-07-27 — ⏳ EN ATTENTE DU VERDICT VISUEL

Les deux derniers items d'impact ≥ 4 du backlog, groupés en une itération.
`?v=22` / `CACHE musedesk-v28`, **38/38 tests**.

**A. Illustrations d'états vides** (#11) — SVG pur inline, technique du **double tracé
décalé** (filet clair + creux sombre) portée depuis la maquette du parti C. 4 situations
distinctes, chacune avec son sujet, l'or en simple rehaut :

| Situation | Illustration | Accroche |
|---|---|---|
| Bibliothèque jamais alimentée | lutrin + page + portée miniature, pin doré | [app.js:806](../app.js:806) |
| Recherche sans résultat | page à coin corné + loupe, étincelle dorée | [app.js:809](../app.js:809) |
| Aucune setlist créée | liasse en éventail + rubans-repères | [app.js:1638](../app.js:1638) |
| Setlist vidée (variante compacte) | idem, redimensionnée | [app.js:1827](../app.js:1827) |

Zéro octet réseau (tout inline), statique (aucune animation → gratuit en perf).
Les anciens glyphes `♫`/`≡` en `::before` sont supprimés ; les `::after` portant la portée
fantôme de l'itér.2 sont intouchés.

**B. Police display vendorisée** (#12) — **Cormorant Garamond**, choisie par Eric.
- Fichier : `fonts/cormorant-garamond-latin.woff2`, **37 640 octets** (mesuré, pas estimé).
  C'est une **police variable** : un seul fichier couvre les graisses 400→700.
- Licence **SIL OFL 1.1**, `fonts/OFL.txt` inclus — obligatoire pour redistribuer dans un
  repo public.
- `@font-face` [styles.css:162](../styles.css:162) avec `unicode-range` limité au latin :
  un titre contenant un caractère hors-plage retombe automatiquement sur Georgia plutôt
  que d'afficher du tofu.
- **Aucune URL Google dans le code livré** (CSP `font-src 'self'`) ; précachée dans les
  assets CORE du SW ([sw.js:24](../sw.js:24)) — sans ça les titres retombaient sur Georgia
  hors ligne, c'est-à-dire **sur scène**.

**Décision de conception (manager)** — Cormorant est une police *display* : fine, à faible
hauteur d'x, pénible sous ~18px. Elle n'a donc PAS remplacé le token `--display` : un token
distinct `--display-xl` a été créé, et seuls les **7 sélecteurs ≥ 18px** ont basculé (`.brand`,
`.topbar h1`, `.detail-head h1`, `.dialog h2`, `.metro-bpm-display`, `.transpose-row .keys`,
`.side-head`). Tout le reste garde Georgia.

**Deux arbitrages de seuil**
- `#reader-title` (17px) → **reste en Georgia**. C'est le titre lu sur scène en faible
  lumière : exactement ce que le seuil protège. Garde aussi le morph de l'itér.1 cohérent
  (même police des deux côtés de la transition).
- `.cover` (monogramme, 18px pile) → **basculé en Cormorant**, contre l'avis de l'agent.
  Une ou deux lettres en serif display = une **lettrine gravée**, cœur de la métaphore
  manuscrite ; le monogramme est décoratif (le titre lisible est juste à côté), donc le
  risque de lisibilité ne s'applique pas.

**Caveat non vérifié** : `.metro-bpm-display` utilise `font-variant-numeric: tabular-nums` ;
rien ne garantit que Cormorant expose la feature OpenType `tnum`. Si absente → chiffres
proportionnels, léger jitter du BPM. Dégradation propre, pas de casse. **À regarder à l'œil.**

---

## 🏁 Condition d'arrêt

**Atteinte au terme de l'itér.3 (sous réserve du verdict visuel d'Eric).**
Condition **B** : tous les items restants du backlog sont sous le seuil ROI 1,5 —
il ne reste que **#13 splash canvas** (ROI 1,0) et le stagger de sortie (écarté à l'itér.1,
coût disproportionné). Aucun item d'impact ≥ 4 à coût ≤ 3 ne subsiste.

Rouvrir la boucle = nouvelle passe critique (le backlog date de l'ouverture, il peut être
périmé après 3 itérations) ou besoin ciblé.

---

## Passe critique finale — 2026-07-27 (4 voix : direction artistique, A11y, UX scène, whimsy)

### Régressions introduites par nos propres itérations — CORRIGÉES (`?v=23` / `CACHE v29`)
1. **`showView()` n'était pas gaté follower** (impact 5, coût 1) — `playCurtainAround()` et
   `withPageTurn()` avaient chacun leur `isFollower()`, mais **pas le cross-fade racine** :
   un follower dont le leader lançait un morceau depuis la bibliothèque voyait une transition
   plein écran de 420 ms qu'il n'avait pas déclenchée. Garde ajoutée — [app.js:636](../app.js:636).
2. **`font-weight: 800` hors de la plage déclarée `400 700`** (impact 3, coût 1) — 6 sélecteurs
   `--display-xl` demandaient une graisse que le fichier variable ne couvre pas. Risque de
   **faux gras** synthétique, désastreux sur un serif à fort contraste. Ramenés à 700.

### Finding REJETÉ après vérification
**« `overflow: hidden` rogne l'anneau de focus des 4 familles de boutons »** (coté BLOQUANT
impact 5 par l'auditeur). **C'est faux.** `overflow` établit une région de clip pour le
*contenu et les descendants* d'un élément — **pas pour sa propre `box-shadow` externe**, qui
est peinte avec le fond/bordure de l'élément lui-même. Le cas classique (un parent en
`overflow:hidden` qui rogne l'ombre d'un enfant) ne s'applique pas ici : le clip et l'anneau
sont sur le **même** élément. La « preuve » avancée (les sélecteurs en `outline` ont survécu)
était une corrélation construite, pas une démonstration.
⚠️ Non vérifié au rendu (pas de compositing) — **un Tab sur « Enregistrer » tranche en 10 s.**

### Ce que la passe a vraiment révélé — le reliquat n'est PAS visuel
La voix UX a produit le constat le plus important de toute la boucle :

| Manque | Impact | Coût | ROI |
|---|---|---|---|
| **Aucun Screen Wake Lock** — l'écran peut s'éteindre en plein morceau, sur scène | 5 | 1 | **5,0** |
| `fontSize`/`scrollSpeed` non persistés — remis à zéro à chaque lancement | 4 | 1 | **4,0** |
| Pas de recherche accessible depuis le Lecteur (le moteur existe pourtant) | 4 | 3 | 1,3 |
| Position dans le concert non résiliente à un reload | 3 | 3 | 1,0 |

### Reliquat visuel — un seul item au-dessus du seuil
- **Le rideau ne tombe qu'à l'aller** (impact 5, coût 3, **ROI 1,7**) : l'app sait accueillir,
  pas conclure. Et sur le dernier morceau, « suivant » ne fait **rien**, en silence.
- Sous le seuil mais quasi gratuits : creux gravé sur les champs de formulaire (3/1), grain
  sur les toasts hors import (2/1), ton du picker aligné sur la voix des états vides (2/1).

### Dette préexistante repérée au passage (hors boucle)
`.cover` : monogramme `color: #fff` sur fond `--accent` ≈ **2,3–3,2:1**, sous le seuil AA
même en texte large. Antérieur à la boucle, non introduit par elle.

---

### Itér.4 — « La Sortie de Scène » (mixte) — 2026-07-27 — ⏳ EN ATTENTE DU VERDICT

**La boucle change de nature** : sur décision d'Eric, cette itération traite les 2 items
fonctionnels de plus haut ROI trouvés par la passe critique, plus les 2 items de finition
qui restaient au-dessus du seuil. `?v=24` / `CACHE musedesk-v30`, **38/38 tests**.

| # | Item | Accroche |
|---|---|---|
| 1 | **Screen Wake Lock** — l'écran ne s'éteint plus pendant qu'on joue | `acquireWakeLock()` [app.js:1167](../app.js:1167), câblé sur `openReader`/`closeReader` |
| 2 | **Persistance `fontSize`/`scrollSpeed`** en localStorage | `loadReaderPrefs()` [app.js:1261](../app.js:1261), relu au `boot()` |
| 3 | **Rideau de clôture** en fin de set | `isEndOfSetClosing()` [app.js:1237](../app.js:1237) |
| 4 | **Fin de set signalée** (le « suivant » silencieux) | `updateEndOfSetAffordance()` [app.js:1552](../app.js:1552) |

**Décisions de conception (manager)**
- **Pas de sortie automatique en fin de set.** Un musicien peut vouloir rester sur le dernier
  morceau pour un rappel : on SIGNALE la fin, on ne la provoque pas.
- **Le rideau ne célèbre que la fin d'un CONCERT.** Une sortie anticipée (Échap à la 3ᵉ sur 10)
  n'a droit à aucune cérémonie. Ajouté en relecture : un opt-out `ceremony: false` sur les
  fermetures **techniques** du lecteur — sans lui, enregistrer une édition sur le dernier
  titre d'une setlist déclenchait 780 ms de rideau pour un geste qui n'a rien d'une fin de set.
- **Le Wake Lock n'est PAS gaté follower** : l'écran du follower est aussi sur un pupitre,
  il en a autant besoin. C'est le seul item de toute la boucle qui s'applique aux deux rôles.

**Points délicats traités par l'agent, vérifiés en relecture**
- Course sur le Wake Lock : une ouverture/fermeture rapide du lecteur pouvait laisser un
  verrou obtenu *après* le retour en bibliothèque. Garde ajoutée.
- Le verrou est relâché par le navigateur au passage en arrière-plan et **jamais repris seul** :
  ré-acquisition sur `visibilitychange` (le piège classique de cette API).
- Bornes de validation de `localStorage` reprises de `changeFont()` (14–48) et
  `setScrollSpeed()` (1–10), pas inventées — un `localStorage` corrompu ne peut pas produire
  une taille de police absurde.
