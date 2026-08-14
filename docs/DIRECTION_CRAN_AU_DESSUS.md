# Direction artistique — le cran au-dessus de « Partition Gravée »

**Rôle** : art_direction (studio GabiDevFamily) · **Branche** : `game-studio/musedesk-asset-pass-wow`
**Portée** : spec écrite et actionnable — **aucun code livré ici**, aucun bump de version, aucun test
lancé. Consommée par la phase d'implémentation puis par le gate Craft/A11y.
**Base examinée** : [styles.css](../styles.css), [app.js](../app.js), [index.html](../index.html),
[docs/WOW_LOOP.md](WOW_LOOP.md) (journal des 5 itérations déjà livrées, `?v=20`→`?v=24`+rebump `?v=25`).
Les captures dans `docs/screenshots/` sont **périmées** (palette terracotta pré-pivot) — non utilisées
comme référence visuelle, seule la lecture du CSS actuel (indigo/or/vert-de-gris) fait foi.

---

## 0. TL;DR

Les 5 itérations « Éclat » ont posé des **effets** excellents (View Transitions, or spéculaire, deboss
réactif, sceau du favori, illustrations gravées, Cormorant sur les titres). Ce qu'elles n'ont **jamais
posé** : une raison pour que les 3 vues **se sentent différentes au repos**, une échelle de titrage
formalisée, et un moment d'ouverture. Ce document couvre ces trois manques avec 7 gestes techniques
précis, une échelle Cormorant complète, une hiérarchie de matière par vue/état, et une séquence de boot.
Zéro glow, zéro flou coloré, zéro chaud — réaffirmé nommément en §3.

---

## 1. Diagnostic — ce qui lasse (la signature répétitive)

Lecture du CSS actuel, pas une impression :

1. **Une seule recette de survol pour tout ce qui est "élément de liste"** : `.card:hover` et
   `.song-row:hover` sont **littéralement la même recette** — filet gilt gauche 3px + fond qui monte
   d'un cran (`--bg-2`→`--bg-3`) + `var(--sh-deboss-deep), var(--sh-2)`
   ([styles.css:619](../styles.css:619) vs [styles.css:1231](../styles.css:1231)). Bibliothèque et
   Setlists sont **indiscernables au survol**, seul le contenu change.
2. **Un seul grain, une seule opacité, partout** : `.card::after`, `.content::after`, `.dialog::after`,
   `.panel::after`, `.song-row::after` partagent le **même** SVG `feTurbulence` (baseFrequency .85,
   2 octaves) à des opacités quasi identiques (.04 / .055) — [styles.css:220](../styles.css:220). Le
   Lecteur (page tenue à distance, pupitre) a exactement le même grain que le panneau Transpose (tenu
   à 30cm). Aucune hiérarchie de matière.
3. **Un seul filet de chrome** : topbar, toolbar et livebar partagent le même
   `background: var(--bg-glass)` + le même `::after` en dégradé or 90°
   ([styles.css:502](../styles.css:502), [styles.css:747](../styles.css:747)) — aucune variation
   entre vues, et le mode concert (qui existe fonctionnellement, `state.concertMode` dans app.js) n'a
   **aucun reflet visuel dédié** : c'est visuellement le Lecteur normal + un badge `n/N`.
4. **Échelle de titrage ad hoc** : 7 sélecteurs `--display-xl` avec des tailles/tracking choisis au
   cas par cas (18/19/19/20/21/24/28/44px, tracking de `-.01em` à `-.04em` sans règle apparente,
   graisse **toujours** 700 même à 44px) — jamais formalisé en échelle, jamais de variation de casse.
5. **L'ouverture de l'app est silencieuse** : `.view:not([hidden]) { animation: viewFade var(--t-slow) both; }`
   ([styles.css:291](../styles.css:291)) est le générique utilitaire réutilisé pour absolument toute
   apparition de vue — y compris le tout premier écran que voit Eric. Le rideau existant (`.curtain`)
   est réservé à l'entrée en concert ; le boot de l'app lui-même n'a rien.

**Conséquence** : les gestes déjà livrés (or spéculaire, sceau, page-turn…) sont des réponses à
l'**interaction**. Le manque est structurel : la différence entre vues n'existe **qu'au clic**, jamais
au repos. C'est exactement l'inverse de ce qu'il faut pour un effet waouh dès la première seconde,
qui se joue avant toute interaction.

---

## 2. Direction retenue — « Le Cabinet du Copiste »

**Concept en une phrase** : MuseDesk n'est plus un seul document qu'on feuillette, c'est un **atelier
de copiste avec trois meubles distincts** — un cabinet de fiches (Bibliothèque), un cahier relié à la
main (Setlists), un pupitre où la page est posée (Lecteur) — et une scène qui change la lumière quand
on y monte (Concert). Même encre, même main, même papier — mais un **grain, une reliure et une
signature de bord propres à chaque meuble**, perceptibles **avant** tout survol.

**Axes exploités** (au-delà de la couleur, déjà traitée) : **matière** (grain différencié),
**structure de bord** (dog-ear vs perforations vs reliure), **rythme d'apparition** (stagger différent
par vue), **geste de trait** (une seule famille technique — le tracé à l'encre — déployée à 3 endroits
pour rester cohérente), **asymétrie temporelle** (ouvrir ≠ refermer).

---

## 3. Interdits — réaffirmés nommément

Aucun token ni geste de ce document n'utilise :
- **glow / halo lumineux** (tout élargissement flou et coloré autour d'un élément) ;
- **box-shadow flou coloré** (toute ombre portée avec un `blur-radius` > quelques px teintée autre
  qu'encre/ivoire neutre — `--shadow-light`/`--shadow-dark` uniquement, jamais `--accent`/`--chord`/
  `--go` dans un `box-shadow` flou) ;
- **terracotta ou toute teinte chaude** (aucun token proposé ne sort de la famille indigo/or-vieilli/
  vert-de-gris/vert-encre déjà en place).

Vérification par geste (§6) :

| Geste | Utilise du flou coloré ? | Utilise une teinte chaude ? |
|---|---|---|
| G1 Grain différencié | Non — `feColorMatrix` alpha seul, RGB à zéro (recette déjà en prod) | Non |
| G2 Hairline différencié | Non — traits nets 1px, pas de `blur()` | Non — or existant ou achromatique |
| G3 Vignette de scène | Non — `radial-gradient` **achromatique** (`rgba(3,3,9,x)`), assombrit les bords, n'éclaircit jamais le centre (≠ glow par construction) | Non |
| G4 Tracé à l'encre | Non — `stroke-dasharray`/`mask-image`, un trait net, jamais un flou | Non |
| G5 Iris d'ouverture | Non — `clip-path`, géométrie pure, zéro shadow | Non |
| G6 Asymétrie ouverture/fermeture | Non — `transform: scale()`, zéro shadow | Non |
| G7 Bord différencié carte/ligne | Non — `clip-path` + ombres `--shadow-light/-dark` déjà en prod | Non |

---

## 4. Hiérarchie de matière — les 3 vues + l'état Concert

| Vue / état | Matière (métaphore) | Grain (token, nouveau) | Hairline de chrome | Signature de bord **au repos** |
|---|---|---|---|---|
| **Bibliothèque** | Carton de catalogue | `--grain-fine` : opacity **.03**, `feTurbulence baseFrequency=1.1` (grain plus fin, papier glacé) | filet or plein (inchangé, [styles.css:502](../styles.css:502)) | coin plié bas-droit sur `.card` (G7) |
| **Setlists** | Cahier relié à la main | `--grain-medium` : opacity **.05**, `baseFrequency=.85` (= recette actuelle, conservée telle quelle) | filet or **cousu** en pointillés (G2) | perforations verticales bord gauche sur `.song-row` (G7) |
| **Lecteur** (hors concert) | Page posée au pupitre | `--grain-coarse` : opacity **.07**, `baseFrequency=.6` (grain plus large, lisible même à distance de pupitre) | filet or plein — **vue de référence**, inchangée | ombre de reliure verticale au bord gauche de `.content` (nouveau, cf. §6 G2 bis ci-dessous) |
| **Lecteur — mode CONCERT** | Ardoise mate | `--grain-concert` : opacity **.015** (quasi supprimé — lisibilité maximale sous les feux) | filet **achromatique** `--border-strong-concert` (G2), l'or de chrome disparaît pendant le jeu | vignette radiale périphérique achromatique (G3) + anneau de focus `--go` au lieu de `--accent` |

**Règle transversale** : toute divergence doit être **perceptible au repos**, jamais seulement au survol
— sinon les 3 vues restent indiscernables sur une simple capture d'écran, ce qui est précisément le
diagnostic du §1.

**Ombre de reliure du Lecteur** (précision, complète le tableau) : un dégradé statique sur le bord
gauche de `.content` — `linear-gradient(90deg, var(--shadow-dark) 0, transparent 28px)` en surimpression
(pas d'ajout de padding) — suggère que la page est cousue dans un carnet plutôt que posée seule. En
mode `.two-col`, coexiste avec le gouttière centrale déjà existante ([styles.css:783](../styles.css:783))
sans collision (bords différents).

---

## 5. Échelle de titrage — Cormorant Garamond (≥18px uniquement)

Principe : **churn minimal**. 7 des 9 usages actuels gardent leur taille pixel exacte — seuls le
tracking de `.dialog h2` (absent aujourd'hui) est formalisé, et 2 nouveaux paliers sont ajoutés pour
les 2 gestes qui en ont besoin (boot, sur-titre). **`.metro-bpm-display` n'est délibérément pas touché**
(voir note sous le tableau).

| # | Token | Taille | Graisse | Tracking | Casse | Hôte(s) actuel(s) | Δ vs aujourd'hui |
|---|---|---|---|---|---|---|---|
| 1 | `--fs-display-1` | 18px | 700 | -.02em | normale | `.cover` (lettrine) | inchangé |
| 2 | `--fs-display-2` | 19px | 700 | -.01em | normale | `.transpose-row .keys`, `.side-head` | inchangé |
| 3 | `--fs-display-3` | 20px | 700 | **-.015em** | normale | `.dialog h2` | tracking **ajouté** (absent aujourd'hui — incohérence corrigée, seule vraie retouche de cette échelle) |
| 4 | `--fs-display-4` | 21px | 700 | -.02em | normale | `.brand` | inchangé |
| 5 | `--fs-display-5` | 24px (`--fs-xl`) | 700 | -.03em | normale | `.topbar h1` | inchangé |
| 6 | `--fs-display-6` | 28px (`--fs-2xl`) | 700 | -.03em | normale | `.detail-head h1` | inchangé |
| 7 | `--fs-display-num` | 44px | 700 | -.04em | tabular-nums | `.metro-bpm-display` | **volontairement inchangé**, voir note |
| 8 *(nouveau)* | `--fs-display-hero` | 40px | **600** | -.025em | normale | boot uniquement (G5/G4, §7) | nouveau palier |
| 9 *(nouveau)* | `--fs-display-kicker` | 18px | **600** | **+.09em** | **uppercase** (repli sûr, voir note) | sur-titre facultatif (ex. « PROGRAMME DE SCÈNE » au-dessus d'un titre de setlist) | nouveau palier — seul endroit où la graisse descend sous 700 **et** où la casse varie |

**Note — `.metro-bpm-display` non touché** : la tentation était de l'alléger (44px/700 est lourd pour un
serif display). **Rejeté** : ce chiffre est lu à distance, en faible lumière, pendant le jeu — c'est
exactement le principe R5 déjà posé pour le choix de `--mono` (« Cascadia/Consolas : fûts plus épais,
lisibles à distance de pupitre »). Alléger la graisse ici contredirait un principe déjà arbitré ailleurs
dans le même projet. La diversité de graisse se prouve sur `--fs-display-hero`/`--fs-display-kicker`,
deux contextes lus de près, jamais sur scène.

**Note — casse `--fs-display-kicker`** : `font-variant-caps: small-caps` n'est **pas vérifié** disponible
dans le subset vendorisé (`fonts/cormorant-garamond-latin.woff2`, unicode-range latin, aucune garantie
sur les features OpenType `smcp`) — ne pas s'appuyer dessus sans test visuel préalable (même caveat que
`tabular-nums` déjà noté à l'itér.3, [WOW_LOOP.md:199](WOW_LOOP.md#L199)). **Repli recommandé directement** :
`text-transform: uppercase` + `letter-spacing: +.09em`, qui ne dépend d'aucune feature de police et
fonctionne à coup sûr.

**Poids offline** : aucun octet supplémentaire — zéro nouveau fichier de police, même `.woff2` déjà
précaché ([sw.js:24](../sw.js:24)).

---

## 6. Gestes signature — 7 techniques, chacune distincte du micro-polish déjà livré

| # | Geste | Où | Propriété/technique CSS précise | Distinct de (déjà livré) |
|---|---|---|---|---|
| **G1** | Grain tokenisé par matière | `.card`, `.song-row`, `.content`, `.content` en concert | 4 nouveaux tokens `--grain-fine/medium/coarse/concert` = `opacity` + `feTurbulence baseFrequency` distincts par sélecteur (recette `feColorMatrix` alpha-only conservée), remplace l'unique règle groupée [styles.css:220](../styles.css:220) | le grain unique actuel (une seule opacité `.04` pour tout) |
| **G2** | Hairline différencié + achromatique en concert | `::after` sous topbar/toolbar/set-sidebar | Setlists : `background-image: linear-gradient(90deg, var(--accent-stitch) 0 3px, transparent 3px 6px)` répété (pointillé "cousu") au lieu du dégradé continu. Concert : bascule vers `var(--border-strong-concert)` (achromatique) au lieu de `--accent-line` | le filet or unique et continu partout ([styles.css:502](../styles.css:502)) |
| **G3** | Vignette de scène (mode concert) | `body.concert-live` (classe à créer, reflet CSS de `state.concertMode` qui n'existe pas aujourd'hui) | `radial-gradient(ellipse at center, transparent 62%, rgba(3,3,9,.35) 100%)` posé en overlay fixe, **assombrit les bords uniquement**, jamais le centre — combiné à `--grain-concert` (G1) et au hairline achromatique (G2). Cadré pour ne **jamais** recouvrir la colonne `.content` (seulement chrome/marges) | le rideau `.curtain` (ponctuel, un seul passage) — la vignette est un **état continu**, pas une transition |
| **G4** | Tracé à l'encre (*stroke-draw reveal*) | 3 hôtes : (a) wordmark du voile d'ouverture, (b) sceau de confirmation d'action, (c) 1ʳᵉ apparition d'une illustration d'état vide | **Une seule famille technique**, 2 mécanismes selon le support : SVG (`stroke-dasharray`/`stroke-dashoffset` animés 0→100%) pour les illustrations vectorielles ; `mask-image: linear-gradient(90deg, #000 var(--p), transparent calc(var(--p) + 6%))` animé sur `--p` pour le texte (wordmark). Durée dédiée `--t-seal: .24s` (aucun token existant ne convenait) | le tampon d'encre `.fav-stamp` (scale bounce + `radial-gradient` ring) — ici c'est un **trait qui se dessine**, pas un ring qui s'estompe |
| **G5** | Iris d'ouverture (*boot only*) | voile plein écran au tout premier paint (nouveau composant `.boot-veil`) | `clip-path: circle(0% at 46px 46px)` → `circle(150% at 46px 46px)` (ancre = position de `.brand .mark`), durée = **réutilise** `var(--t-curtain-rise)` (.64s) + `var(--ease-out-expo)` (aucun nouveau token de durée) | `.curtain` (opacité pure, [styles.css:2027](../styles.css:2027)) — géométrie de masque vs. fondu d'opacité, deux mécanismes différents, jamais réutilisés l'un pour l'autre |
| **G6** | Asymétrie ouverture/fermeture de vue | root view transition, Lecteur → Bibliothèque/Setlists uniquement | `html.vt-close::view-transition-old(root) { transform: scale(.98); }`, classe posée juste avant `startViewTransition()` sur le retour seulement (jamais à l'ouverture) | le cross-fade racine actuel ([styles.css:1981](../styles.css:1981)), **parfaitement symétrique** aujourd'hui dans les deux sens — hérite de la garde follower déjà posée sur `showView()` ([app.js:636](../app.js:636)), aucune garde à réinventer |
| **G7** | Signature de bord carte/ligne | `.card` (coin plié bas-droit), `.song-row` (perforations bord gauche) | Carte : `clip-path: polygon(...)` coupe un triangle ~14px en **bas-droit** (évite `.fav` en haut-droite et `.cover` en haut-gauche) + micro-ombre 2 tons `--shadow-light`/`--shadow-dark` (recette déjà en prod via `--sh-deboss`). Ligne : `background-image: repeating-radial-gradient(circle at 10px center, var(--accent-stitch) 0 1.4px, transparent 1.4px 13px)` en bande verticale ~20px, **inset** du `border-left: 3px` existant (pas de collision avec l'accent gilt de survol) | le fait que `.card:hover` et `.song-row:hover` partagent aujourd'hui la recette EXACTE (§1 point 1) — ici la différence existe **au repos**, avant tout survol |

---

## 7. Ouverture de l'app — séquence de boot (~900ms, budget "Dramatic reveal" 600-1200ms déjà documenté)

Déclenchement : **une fois par session** (`sessionStorage`), jamais rejoué sur un simple changement de
vue. Joue aussi côté follower Pupitre (raisonnement : c'est une action **locale** — le follower ouvre
l'app sur son propre appareil — contrairement aux 4 gestes théâtraux de concert qui sont coupés côté
follower parce que **déclenchés à distance par le leader**, cf. décision d'arbitrage
[WOW_LOOP.md:94](WOW_LOOP.md#L94) ; la distinction pertinente est "qui déclenche", pas "qui regarde").

| t | Étape | Technique | Token(s) réutilisé(s) |
|---|---|---|---|
| 0ms | `.boot-veil` opaque (`--bg` plein), contenu app déjà monté dessous | — | `--bg` |
| 0→640ms | Iris s'ouvre depuis l'ancre du mark | G5 (`clip-path: circle()`) | `--t-curtain-rise`, `--ease-out-expo` |
| 60→480ms | Wordmark "MuseDesk" se trace en encre, gauche→droite | G4 (mask-wipe texte) | `--t-morph` (.42s) |
| 560→800ms | 1ʳᵉ carte de la grille (ou l'illustration d'état vide si bibliothèque neuve) reçoit le tracé d'encre | G4 (stroke-draw) | `--t-seal` (.24s, nouveau) |

**Garde-fous** : `prefers-reduced-motion: reduce` → l'état final s'affiche directement, aucune étape
animée (cohérent avec le traitement déjà réservé à `::view-transition-*` depuis l'itér.1, cf. correctif
[WOW_LOOP.md:88](WOW_LOOP.md#L88)). Zéro dépendance réseau, zéro nouvel asset — tout est CSS/SVG inline.

---

## 8. Empty states — raffinement (pas de refonte)

Le contenu des 4 illustrations SVG déjà livrées (itér.3, [WOW_LOOP.md:157](WOW_LOOP.md#L157)) est
**hors périmètre** — elles restent telles quelles. Seul ajout : leur **première apparition** utilise
G4 (stroke-draw) au lieu du `viewFade` générique actuel ([styles.css:561](../styles.css:561)) — cohérent
avec le fait que ces illustrations sont déjà construites en double-tracé (`.illu-dark`/`.illu-light`/
`.illu-main`), donc **structurellement prêtes** pour un `stroke-dasharray` (aucun redessin de sujet
nécessaire, seulement l'ajout de l'animation d'apparition sur les `<path>`/`<line>` existants).

---

## 9. Cibles de contraste — pour falsification par le workstream A11y

Calculs manuels (formule de luminance relative WCAG, `sRGB → linéaire`, contraste = `(L1+.05)/(L2+.05)`)
— **à repasser par un contrast-checker outillé**, ce ne sont pas des mesures automatisées.

| Couple proposé | Fond | Cible | Valeur calculée (manuel) | Statut |
|---|---|---|---|---|
| `--accent-stitch: rgba(201,164,92,.6)` (G2/G7, pointillés/perforations) | `--bg-glass` (#171a26) | ≥3:1 (non-textuel) | **≈3.5:1** | passe avec marge |
| `--accent-stitch` (même token, hôte `.song-row`) | `--bg-2` (#1e2233) | ≥3:1 (non-textuel) | **≈3.3:1** | passe |
| ⚠️ **Rejeté en cours de calcul** : `--accent-line` existant (rgba(...,.38)) pour le même usage | `--bg-glass` | ≥3:1 | ≈2.1:1 | **insuffisant** — ne pas réutiliser tel quel, d'où le nouveau token `--accent-stitch` à .6 |
| `--border-strong-concert: rgba(233,228,210,.42)` (G2, hairline concert) | `--bg-glass` | ≥3:1 (non-textuel, décoratif — SC 1.4.11 ne s'applique pas strictement à un filet ambiant, cible retenue par discipline de craft) | **≈3.45:1** | passe |
| ⚠️ `--border-strong` existant (.30) pour le même usage | `--bg-glass` | ≥3:1 | ≈2.4:1 | **insuffisant**, d'où le token dédié `.42` |
| `--accent` (kicker, `--fs-display-kicker`) | `--bg` (#12131c) | ≥4.5:1 (texte) | **≈7.9:1** (recoupe la valeur déjà documentée dans styles.css:39 pour le même couple) | passe, réutilisation d'un couple déjà vérifié |
| G3 vignette (`rgba(3,3,9,.35)` en périphérie) | s'applique **par-dessus** `--bg`/`--bg-1`, jamais sur `.content` | n/a — assombrit le fond, ce qui **augmente mécaniquement** le contraste du texte ivoire clair déjà en place (propriété de sécurité par construction, pas de calcul requis si la zone de texte n'est jamais couverte) | — | **condition** : le radial-gradient ne doit jamais chevaucher la colonne `.content` à aucun breakpoint — à vérifier visuellement par l'implémentation |
| G4 tracé à l'encre — couleurs de trait | reprend `--text-3`/`--accent`/`--shadow-dark`/`--shadow-light` déjà vérifiés (`.illu-main`, `.illu-accent`, [styles.css:592](../styles.css:592)) | ≥4.5:1 (texte) / ≥3:1 (non-textuel) | déjà vérifié en prod, aucune nouvelle combinaison | passe (réutilisation) |
| G7 dog-ear (bicolore `--shadow-light`/`--shadow-dark`) | reprend la paire déjà utilisée dans `--sh-deboss` en production | ≥3:1 (non-textuel) | non recalculé isolément (paire déjà en usage ailleurs sans incident signalé) | à confirmer si le workstream A11y veut l'isoler |

---

## 10. Hors périmètre (ne pas toucher)

- Le contenu/sujet des illustrations d'état vide (§8) — structure seulement.
- `.metro-bpm-display` (taille/graisse volontairement préservées, §5).
- Les 8 gestes déjà livrés en itér.1-4 (View Transitions racine, morph de titre, page-turn, rideau
  concert existant, rail de progression, tampon favori, balayage lumineux, or spéculaire, deboss
  réactif) — **inchangés**, cette spec les complète, ne les remplace pas.
- Wake Lock, persistance des réglages, rideau de clôture (itér.4, fonctionnel, hors sujet visuel).
- Toute nouvelle police, tout nouvel asset réseau, tout CDN.
- Le bump `?v=25`→`?v=26` / `CACHE v31`→`v32` et les 38 tests : à la charge de la phase d'implémentation,
  pas de ce workstream.

---

## 11. Handoff — tokens et hooks à créer (récapitulatif implémentation)

**Nouveaux tokens CSS** : `--grain-fine`, `--grain-medium` *(= valeur actuelle, juste nommée)*,
`--grain-coarse`, `--grain-concert`, `--accent-stitch`, `--border-strong-concert`, `--t-seal`,
`--fs-display-hero`, `--fs-display-kicker`.

**Nouveaux hooks JS→CSS** (aucun n'existe aujourd'hui, à créer par l'implémentation) :
- `body.concert-live` — reflet CSS de `state.concertMode` (app.js), actuellement sans équivalent visuel.
- `.boot-veil` / `.boot-veil.open` — nouveau composant, monté avant tout `.view`, retiré du DOM après
  la séquence (pas seulement caché — coût zéro une fois jouée).
- `.seal-stamp` — classe sœur de `.fav-stamp` existante, mécanique différente (stroke-draw vs. ring).
- `html.vt-close` — scope de la transition racine asymétrique (G6), posé juste avant l'appel
  `startViewTransition()` sur le retour Lecteur→liste uniquement.

Ce document ne modifie aucun fichier de code, aucune version, aucun test. Prêt pour la phase
d'implémentation et le gate Craft/A11y.
