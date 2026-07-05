# Audit UI/UX MuseDesk — 2026-07-04 (2e audit, 3 voix)

Audit conduit par 3 agents spécialisés, chacun ayant lu [AUDIT_UIUX_2026-07-03.md](AUDIT_UIUX_2026-07-03.md) au préalable — **tout ce qui suit est du neuf**, aucun re-flag du reliquat tracé (preview import, drawer <700px, h3→h2, erreurs leader, test follower réel).

| Voix | Agent | Angle | Constats |
|---|---|---|---|
| 🎨 | frontend-design (custom GabiDevFamily) | Design visuel & polish | 2 🔴 · 9 🟡 · 7 🟢 |
| 🔬 | UX Researcher | Usabilité & parcours (cognitive walkthrough) | 4 🔴 · 7 🟡 · 6 🟢 |
| ♿ | Accessibility Auditor | WCAG 2.2 AA (analyse statique) | 1 Critical · 5 Serious · 7 Moderate · 7 Minor |

Méthode : analyse statique du code uniquement (index.html, styles.css, app.js, live.js, sync.js, fsprovider.js, db.js). Pas de navigateur, pas de lecteur d'écran, pas de tests utilisateurs — les vérifications dynamiques sont marquées « à confirmer manuellement ».

---

## Synthèse consolidée — les 7 chantiers prioritaires

### 🔴 P1 — Mode concert : tap/swipe/flèches changent de MORCEAU au lieu de paginer (UX F1)
Le geste réflexe appris (tap bord d'écran = page suivante) saute au morceau suivant en plein milieu d'un morceau long. Sur scène = l'accident type. → `app.js:2026-2027, 2060-2062, 2383-2392` : paginer d'abord, ne passer au morceau suivant qu'en fin de contenu.

### 🔴 P2 — Cycle de vie session Pupitre cassé (UX F2 + F4)
- Rouvrir le dialogue QR (pour un retardataire) rappelle `createSession()` → **nouveau token, session des followers connectés cassée** (`app.js:2408→294-330`, `live.js:225`).
- Dialogue fermé = **aucun indicateur de diffusion**, pas de « Terminer la session », perte de connexion leader invisible (statut écrit dans un dialogue fermé, `app.js:301-315`).
→ Mémoriser `{token, joinUrl}` tant que la session vit ; bouton ⏹ Terminer ; état `.active` + compteur peers sur `#btn-pupitre`.

### 🔴 P3 — Pupitre hors setlist = followers sur écran vide, sans avertissement (UX F3)
`buildCurrentSnapshot()` retourne null si `currentSetlistId` est null → rien n'est poussé, followers « live » devant leur propre bibliothèque (dont les morceaux démo). `app.js:284-292, 322-323, 67-70, 704`. → Garde-fou dans le dialogue ou snapshot mono-morceau.

### 🔴 P4 — Keyframes partagées qui écrasent le transform de base (Design R1)
`panelIn`/`floatUp` (fill: both) remplacent le `transform` : **popover métronome décentré en permanence (~185px)** et **bande de diagrammes décalée d'une ½ largeur hors écran**. `styles.css:1011-1028, 1104, 1325-1332`. → Keyframes dédiées conservant la composante translateX.

### 🔴 P5 — « Ajouter un morceau » inaccessible au clavier (A11y Issue 1, Critical)
`div.add-row` cliquable sans tabindex/rôle = unique chemin vers le picker. `app.js:1267-1272`. → `makeA11yButton(addRow, …)` (1 ligne) ou vrai `<button>`.

### 🔴 P6 — Palette bleue/violette du mockup codée en dur en JS (Design R2)
`titleColor()` (`app.js:550-564`) et `tagColors` (`app.js:641`) : dégradés froids hors identité « zéro bleu » sur la surface la plus visible (pochettes de cartes) + initiale `#fff` illisible sur fonds clairs (~1.6:1). → Palette chaude terracotta/ocre + encre adaptée.

### 🔴 P7 — Échec de synchro totalement silencieux (UX F11)
`autoSyncNow` avale toute exception (`app.js:1868-1870`), statut Réglages basé sur la *permission* pas le succès (`app.js:1903-1908`), `fsprovider.pull` retourne base vide sur fichier illisible (`fsprovider.js:92-95`). L'utilisateur croit ses données sauvegardées. → Pastille + horodatage « dernière synchro réussie ».

## Convergences inter-auditeurs (signal fort)

| Constat | Voix |
|---|---|
| Police du leader imposée au follower, contrôles A−/A+ neutralisés (basse-vision + écrans différents) | 🔬 F6 + ♿ Issue 12 |
| Listener `input` accumulé sur `#picker-search` à chaque ouverture | 🔬 F8 + ♿ (note perf) |
| Blanc pur sur accent : `.play`, `.opt .box.on` (~3.2:1, sous le fix A6) | 🎨 mineur + ♿ Issue 17 |
| Tutoiement/vouvoiement mélangés dans les libellés | 🎨 + 🔬 mineurs |
| Lecture seule follower incomplète (bibliothèque/import/réglages actifs sous le bandeau) | 🔬 F5 (+ ♿ contexte) |

## Quick wins (< 10 lignes chacun)

- `color-scheme: dark` dans `:root` + meta (Design R3) — supprime les widgets natifs blancs
- Pile mono : `Cascadia Mono, Consolas` avant `Courier New` (Design R5)
- `.section { font-size: max(.46em, 11px) }` (Design R6)
- `aria-pressed` sur le capo (A11y I5, 3 lignes) ; focus restauré après toggle favori (I6, 1 ligne) ; focus h1 dans `showView` (I2, 5 lignes)
- Toast undo : pause au survol/focus + 10 s (A11y I4)
- 3 `aria-label` recherche/tri/filtre (A11y I13)
- Picker multi-ajout : retirer le `dialog.close()` (`app.js:1313`)
- Toast « Morceau importé » après `saveImport` (UX F9)

## Fonctions manquantes relevées

- **Supprimer / renommer une setlist** : `db.deleteSetlist` existe (`db.js:234`) mais jamais câblé (UX F7)
- **@media print** : impression = page quasi blanche (Design R7)
- Snapshot Pupitre figé : édits pendant session jamais re-poussés (UX mineur)

---

---

# Rapport 1/3 — 🎨 frontend-design (design visuel & polish)

# Audit design visuel & polish — MuseDesk (2026-07-04)

Angle : cohérence visuelle, hiérarchie, états, lisibilité scène, responsive, micro-interactions. Lecture complète de `index.html`, `styles.css`, `app.js`, `live.js` (sync.js/fsprovider.js vérifiés : aucun rendu UI, hors périmètre). Aucun point du reliquat 2026-07-03 n'est re-flagué. Audit statique — les deux bugs 🔴 méritent une vérif visuelle rapide, mais la mécanique CSS est formelle.

## Constats

### 🔴 Majeurs

**R1 — Keyframes partagées qui écrasent le `transform` de base : popover métronome décentré en permanence + bande de diagrammes décalée d'une demi-largeur**

Une animation CSS remplace *entièrement* la propriété `transform` pendant qu'elle s'applique — et avec `fill: both`, l'état `to` persiste après la fin. Deux victimes :

1. `.metro-pop` (styles.css:1011-1028) a pour base `transform: translateX(-50%) translateX(-80px)` mais anime `panelIn` (styles.css:1329-1332) dont le `to` est `translateY(0) scale(1)` — **sans le translateX**. Résultat : le popover perd définitivement son centrage → décalé de ~185px vers la droite (½ largeur + 80px), et la flèche `::after` (styles.css:1071-1079) ne pointe plus le bouton BPM. Idem en mobile (styles.css:1378-1382).
2. `.chord-diagrams-bar:not([hidden])` (styles.css:1104) anime `floatUp` (styles.css:1325-1328) dont les keyframes embarquent `translateX(-50%)` (prévu pour la livebar centrée). Or la barre est en `left:0; right:0` : elle hérite en permanence d'un décalage de **50% de la largeur du viewport vers la gauche** — la moitié gauche sort de l'écran.

`.livebar` et `.toast` sont corrects par coïncidence (leur base = le transform des keyframes). Correctif : keyframes dédiées sans composante X, p.ex. :

```css
@keyframes fadeUp { /* pour .chord-diagrams-bar (aucun transform de base) */
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes metroIn { /* pour .metro-pop : conserve le centrage */
  from { opacity: 0; transform: translateX(-50%) translateX(-80px) translateY(10px) scale(.98); }
  to   { opacity: 1; transform: translateX(-50%) translateX(-80px) translateY(0) scale(1); }
}
```
(et une variante mobile, ou remplacer le positionnement du metro-pop par `left:50%; margin-left:calc(-50% - 80px)` pour libérer `transform`).

**R2 — Les pochettes de cartes et les puces de tags utilisent encore la palette bleue/violette abandonnée, codée en dur en JS — avec du blanc illisible sur jaune**

Le design system affiche « carton noir chaud (**zéro bleu**) » (styles.css:11) et l'audit précédent a purgé les résidus bleus du CSS (M10) — mais **pas du JS** :
- `titleColor()` (app.js:550-564) : 10 paires de dégradés dont `#5b6bff/#8a4dff`, `#3ecf8e/#2f9bff`, `#c98bff/#5b6bff`, `#4dd0ff/#2f6bff` — bleus/violets froids du mockup d'origine, appliqués aux `.cover` de **chaque carte** de la bibliothèque (app.js:588), la surface la plus visible de l'app.
- En prime, `.cover` pose l'initiale en `color:#fff` (styles.css:432) : blanc sur `#ffcc44` ou `#ffb142` ≈ 1.6:1 de contraste — l'initiale disparaît sur les pochettes jaunes/mint.
- `tagColors` (app.js:641) : `'#c98bff', '#ff7a7a', '#4dd0ff'` en dur, hors tokens, dont un bleu et un violet dans la sidebar.

Correctif : palette déterministe **chaude** dérivée de l'identité (terracotta/ocre/brique/crème/vert encre), avec encre sombre `var(--accent-ink)` quand le fond est clair. Exemple :

```js
const palettes = [
  ['#e0703a', '#c85a28'], ['#f5a35e', '#e0703a'], ['#b0552f', '#8a3d1e'],
  ['#5fb574', '#3d8a54'], ['#c9a15a', '#a87c34'], ['#e05a4a', '#b03a2e'],
  ['#8a6a48', '#5f4630'], ['#d4b483', '#b08a52'],
];
```
et pour les paires claires (`#f5a35e`, `#d4b483`…), rendre `color` en fonction de la paire plutôt que `#fff` fixe.

### 🟡 Moyens

**R3 — `color-scheme: dark` absent → widgets natifs en mode clair** — styles.css:10 (`:root`). Le `<select id="lib-sort">` (index.html:93) ouvre son menu déroulant natif **blanc** sur Chrome/Edge, le bouton ✕ du `type="search"` et les coins de scrollbars restent clairs. Flash d'UI blanche dans une app pensée pour la scène en faible lumière. Correctif : `:root { color-scheme: dark; }` (+ `<meta name="color-scheme" content="dark">`).

**R4 — Hauteurs `100vh` figées : débordement en mode follower et sur tablette avec barre d'URL** — styles.css:231 (`.view { min-height:100vh }`), 239 (`#view-library`), 491 (`#view-reader`), 777 (`#view-setlist`). Deux effets :
1. En follower, `.follower-banner` (sticky, dans le flux, ~41px — styles.css:1254-1263) s'ajoute *au-dessus* de `<main>` → hauteur totale = 100vh + bandeau → scrollbar body parasite et bas de vue coupé de 41px.
2. Sur tablette navigateur (pas PWA installée), `100vh` > viewport visible avec la barre d'adresse → le bas du contenu passe sous le chrome.

Correctif : `100dvh` partout (fallback `100vh`), et en follower `body.pupitre-follower .view { height: calc(100dvh - 41px); min-height: 0 }` ou passer `body` en colonne flex avec `main { flex:1; min-height:0 }`.

**R5 — Pile mono ouverte sur "Courier New" : les grilles (contenu cœur) rendues avec la fonte la plus maigre de Windows** — styles.css:81. `"Courier New"` est présent sur toutes les machines → `Consolas`/`Cascadia Mono` ne servent jamais. Courier New a des fûts notoirement fins : à 26px en fond sombre, lu à distance de pupitre en faible lumière, c'est la pire option de la liste. Correctif (garde l'esprit « tapé ») : `--mono: "Cascadia Mono", Consolas, "Roboto Mono", "Courier New", monospace;`.

**R6 — Labels de section non bornés : illisibles à petite taille de police** — styles.css:555 (`.section { font-size: .46em }`). Relatif à la taille du contenu : à `font-size:26px` → 12px OK, mais le slider descend à 14px (index.html:174) → sections à **6.4px**. Or `[Chorus]`/`[Verse]` sont les repères de navigation du musicien. Correctif : `font-size: max(.46em, 11px);`.

**R7 — Aucun `@media print`** — styles.css (absent). Cas d'usage réel : imprimer une grille ou une setlist en secours papier. Aujourd'hui : texte crème `#ece2cf` sur fond blanc (les navigateurs suppriment les fonds) = page quasi blanche, plus livebar/toolbar imprimées. Correctif minimal :

```css
@media print {
  body::before, body::after, .toolbar, .livebar, .tap, .panel,
  .metro-pop, .chord-diagrams-bar, .alpha, .follower-banner { display: none !important; }
  html, body, .content { background: #fff; color: #000; }
  .chord { color: #000; text-shadow: none; font-weight: 800; }
  .section { color: #000; }
  .view { height: auto; overflow: visible; }
}
```

**R8 — Toolbar lecteur <700px : 7 boutons à libellé complet = 2-3 rangées de chrome qui mangent la grille** — styles.css:1349-1354 (le wrap est prévu mais rien ne compacte), index.html:131-137 (`⊞ 2 col.`, `⤓ Transpose`, `▶ Scroll`, `✎ Éditer`, `📡 Mode Pupitre`…). Sur tablette portrait étroite, le mode lecteur — là où chaque pixel vertical compte — perd ~90px de hauteur. Distinct du reliquat « drawer sidebars <700px ». Correctif : à ≤700px, masquer les libellés (icône seule + `aria-label`), p.ex. envelopper les textes dans `<span class="btn-label">` et `.btn-label { display:none }` dans la media query.

**R9 — Collision bande de diagrammes / livebar sur mobile** — styles.css:1091 (`.chord-diagrams-bar { bottom: 72px }`) vs livebar qui passe en `flex-wrap` sur ≤700px (styles.css:1371-1375) : sur 2 rangées elle atteint ~110px de haut depuis le bas → elle recouvre la moitié inférieure des diagrammes (z-index 20 > 18). Déjà ~6px de chevauchement sur desktop. Correctif : remonter la bande en mobile (`bottom: 118px` dans la media query ≤700px) ou ancrer via une variable `--livebar-h` mise à jour.

**R10 — `#33c08e` en dur dans le bouton concert : vert menthe froid hors tokens** — styles.css:850 (`linear-gradient(180deg, var(--go), #33c08e)`). Seul hex de couleur vive hors système dans tout le CSS ; le teal tire vers le froid alors que `--go` (#5fb574) a été calibré « vert encre qui tient sur le carton ». Correctif : `linear-gradient(180deg, var(--go), color-mix(in srgb, var(--go) 80%, #2a7a44))` ou introduire `--go-strong`.

**R11 — Diagrammes d'accords de la bande : nom à 9px, numéro de frette à 7px** — styles.css:1128-1131 (`.chord-svg` 64×90px), 1132-1137 (`.chord-svg-name` 9px), 1166-1170 (7px). Le popup au tap fait déjà 80×112 (styles.css:603) — la bande, elle, est censée être lue en jouant. Correctif : passer la bande à 80×112 aussi (ou `@media (hover:none) { .chord-svg { width:80px; height:112px } }`).

### 🟢 Mineurs

- **Tutoiement/vouvoiement mélangés** : `« Cliquez sur « Importer » ou modifiez vos filtres »` (app.js:572-573) et `« Créez-en une ! »` (app.js:1105) vs le reste de l'app en tutoiement (« tu suis le pupitre » app.js:366, « ton cloud » index.html:325, « Colle ici » index.html:276, « relis et corrige » app.js:1348). Uniformiser en « tu ».
- **`#reader-title` : titre et artiste concaténés dans le même style** (app.js:710 → `${song.title} — ${song.artist}` dans le h1 18px/700). Les cartes et rows distinguent `.t`/`.a` ; la toolbar non. Fix : `<span class="title-artist">` en `color:var(--text-2); font-weight:400`.
- **`#pupitre-url` : gros bloc de style inline qui duplique `.dialog input`** (index.html:402-404 vs styles.css:972-978) avec divergence (`padding:9px 12px` vs `10px 12px`). Le sélecteur `.dialog input` matche déjà cet input → supprimer l'inline. Idem `style="margin-bottom:12px"` sur `#pupitre-status` (index.html:399) → classe.
- **Blancs purs `#fff` résiduels vs identité « encre crème »** : `.play` (styles.css:629), `.brand .mark` (261), `.cover` (432), `.opt .box.on` (742), thumbs de sliders (652/657/753/758), `::selection` (112). L'identité annonce deux encres (crème + terracotta) ; `var(--text)` #ece2cf à la place de `#fff` renforcerait la matière sans coût.
- **Dialogues sans `max-height`/`overflow`** (styles.css:949-955) : l'import avec `textarea rows=12` (index.html:275) peut dépasser un viewport de tablette paysage ~600px de haut — comportement UA variable, **non vérifié en rendu réel**. Filet : `.dialog { max-height: 90dvh; overflow-y: auto; }`.
- **Deux vocabulaires d'état actif** : `.btn.active` = rempli terracotta (styles.css:186-192), `.mini.active` = teinté (677-679). Si c'est une hiérarchie voulue (toolbar vs livebar), la documenter en commentaire ; sinon aligner.
- **`<nav>` avec flex inline** (index.html:47-49) : le commentaire dit « styles.css intouchable dans ce lot » — le lot est passé, rapatrier dans styles.css (`.sidebar nav { display:flex; flex-direction:column; gap:5px }`).

## Points forts (à préserver)

- **Identité « Sérigraphie de Studio · Nuit » réellement exécutée** : texture de bruit SVG + halos radiaux (styles.css:99-110), tokens complets couleurs/espacement/rayons/ombres/transitions (10-82), `--danger`/`--danger-bright` en `color-mix` — rarissime en vanilla.
- **Correctifs du lot précédent bien intégrés** : `.follower-banner` reprend exactement le vocabulaire pastille+teinte de `.drive-status` (1252-1278), toast avec action undo (1301-1320), `.row-x` teinté danger dès le repos avec hit-area ≥40px en pseudo-élément (879-893), Escape contextuel (app.js:2358-2379), restauration du focus après re-render des `.row-move` (app.js:1194-1199).
- **QR sur fond blanc justifié en commentaire** (quiet zone, lisibilité caméra sur thème sombre — styles.css:1280-1289) : le bon réflexe design documenté.
- Micro-interactions calibrées : entrée échelonnée des 12 premières cartes (414-426), easing overshoot, liseré dégradé sous les topbars, gouttière ombrée du mode 2 colonnes (536-541), `prefers-reduced-motion` couvert jusque dans le scroll JS par paliers (app.js:924-941).

## Top 5 priorités

| # | Correctif | Effort | Impact |
|---|---|---|---|
| 1 | **R1** — keyframes dédiées pour `.metro-pop` et `.chord-diagrams-bar` (transform écrasé → éléments déplacés à l'écran) | Faible | Bug visuel franc sur 2 features |
| 2 | **R2** — palette chaude pour `titleColor()` + `tagColors` + encre adaptée sur pochettes claires | Faible | Cohérence de la vue principale + contraste |
| 3 | **R3** — `color-scheme: dark` | Trivial | Supprime les flashs d'UI native blanche sur scène |
| 4 | **R4** — `100dvh` + compensation du bandeau follower | Faible | Layout follower/tablette fiable |
| 5 | **R5 + R6** — pile mono `Cascadia/Consolas` d'abord + `max(.46em, 11px)` sur `.section` | Trivial | Lisibilité du contenu cœur en conditions scène |

Rappel footgun mémoire projet : tout bump `?v=N` devra être uniforme (HTML/JS/sw.js).

---

---

# Rapport 2/3 — 🔬 UX Researcher (usabilité & parcours)

# Audit Usabilité & Parcours Utilisateur — MuseDesk (2026-07-04)

Méthode : cognitive walkthrough par lecture de code (index.html, app.js, live.js, sync.js, fsprovider.js, styles.css). Aucun test utilisateur réel, aucune métrique inventée. Le serveur relais WS est hors périmètre : les comportements côté relais sont signalés comme non vérifiés. Tout ce qui figure dans AUDIT_UIUX_2026-07-03.md ou son reliquat connu est exclu — uniquement du neuf ci-dessous.

## Parcours analysés

### 1. Premier lancement / onboarding
- Seed de 5 morceaux démo + 1 setlist « Jam vendredi » avec overrides capo/transpose (app.js:446-466) : l'utilisateur atterrit sur une bibliothèque peuplée, bon point de départ.
- Aucun tour guidé, mais l'UI est auto-descriptive pour le persona bibliothèque. En revanche rien n'explique les `transpose-tag` (« capo 2 », « +1 ½ton ») de la setlist démo (app.js:1151-1153) — le concept d'override par setlist se découvre par accident.
- Le badge « Récents » affiche « 9 » en dur avant le premier render JS (index.html:61) — flash de donnée fausse.
- Ton mixte : « Cliquez sur « Importer » ou modifiez vos filtres » (app.js:572), « Créez-en une ! » (app.js:1105) vs « tu joues » (index.html:397), « ton cloud » (index.html:324-327). Deux voix dans la même app.

### 2. Import & organisation, création de setlist
- Import : après « Enregistrer », le dialogue se ferme sans aucun feedback (app.js:1363-1368). Si un filtre est actif (Favoris, tag), le morceau importé n'apparaît pas dans la vue courante → impression qu'il a disparu. Le toast `showToast()` existe (app.js:2434) mais n'est pas utilisé ici.
- Bon réflexe : le brouillon d'import est préservé si on annule (reset uniquement au save, app.js:1365).
- Picker « Ajouter un morceau » : `dialog.close()` après **chaque** ajout (app.js:1313) → pour ajouter 5 morceaux, il faut rouvrir le picker 5 fois. Au passage, un listener `input` s'accumule sur `#picker-search` à chaque ouverture (app.js:1323).
- **Aucun moyen de supprimer ni renommer une setlist** : `db.deleteSetlist` existe (db.js:234) mais n'est câblé nulle part dans app.js. Cul-de-sac : la liste ne peut que grossir, une faute de frappe dans le nom est définitive.
- La sidebar setlists est triée par `updatedAt` desc (db.js:201-203) : chaque modification fait sauter la setlist en tête de liste, et `#nav-setlists` resélectionne toujours `setlists[0]` (app.js:2264) — l'ordre spatial n'est jamais stable, désorientant en répétition.

### 3. Mode live leader (création session, QR)
- Le bouton 📡 n'existe que dans la toolbar du lecteur (index.html:137), mais le snapshot est construit depuis `state.currentSetlistId` (app.js:284) : **si le leader ouvre un morceau depuis la bibliothèque (hors setlist) et lance le Pupitre, `buildCurrentSnapshot()` retourne null, aucun snapshot n'est poussé** (app.js:322-323). Les followers passent « live » mais `pupitre.memSongs` reste vide → `getSongForRender` retourne null (app.js:67-70), `openReader` sort silencieusement (app.js:704) : écran follower vide, aucun avertissement côté leader. Le dialogue promet pourtant « suivre ce que tu joues » (index.html:395-398) sans mentionner la condition setlist.
- **Rouvrir le dialogue Pupitre (par ex. pour faire scanner un retardataire) rappelle `startPupitreSession()` → `live.createSession()` → nouveau token généré** (app.js:2408 → 294-330, live.js:225) : le QR change et la session des followers déjà connectés est cassée. Geste ultra-probable en répétition (« rescanne, toi »).
- Une fois le dialogue fermé : **aucun indicateur qu'une session diffuse** (pas d'état `.active` sur `#btn-pupitre`, pas de compteur peers visible), aucun bouton « Terminer la session » (`live.close()` n'est appelé que par `leaveFollowerMode`, app.js:405). Les mises à jour `onStatus`/`onPeers` n'écrivent que dans des éléments du dialogue fermé (app.js:305-314) : une perte de connexion du leader est invisible pour lui.
- Le snapshot est figé au démarrage : éditer un morceau ou réordonner la setlist pendant la session n'est jamais re-poussé (`pushSnapshot` appelé une seule fois, app.js:322-323 ; `_lastSnapshot` re-poussé à la reconnexion est donc périmé, live.js:139-141).

### 4. Parcours follower (scan QR → suivi)
- Le scan → `#join=` → `maybeStartFollower` (app.js:256-279) fonctionne, bandeau d'état FR + « Quitter le suivi » : la base posée au lot C est bonne.
- **Entre le join et le premier `state`, le follower voit sa propre bibliothèque** — c'est-à-dire, pour un follower non-technique qui découvre l'app, les 5 morceaux de démo fraîchement seedés (app.js:446). Rien n'indique « en attente du leader » ; il peut croire que Wonderwall fait partie de la session.
- **La « lecture seule » ne couvre que le lecteur** : `pointer-events:none` sur `.tools/.livebar/#transpose-panel/.tap` seulement (styles.css:209-214). La bibliothèque, l'import, l'édition, les Réglages restent entièrement actifs sous le bandeau « Mode lecture seule ». Le follower peut ouvrir un morceau local, puis se le faire arracher par le prochain `state` du leader (app.js:778-780) — tug-of-war incohérent avec le modèle annoncé.
- **La taille de police du leader est imposée au follower** (`s.font` appliqué, app.js:790) et il ne peut pas la corriger : `changeFont` est bloqué (app.js:844) et les `.tools` sont désactivés. Un leader sur écran 27" impose ses 26px à une tablette 8" — problème de lisibilité réel sur scène, pour la personne qui a le moins de recours.
- Non vérifiable ici : si le relais ne rejoue pas le dernier `state` à un follower qui rejoint en cours de session, celui-ci attend le prochain geste du leader pour voir quelque chose (le leader ne pousse qu'aux changements, app.js:759-770). À vérifier côté serveur relais.

### 5. Récupération d'erreur
- Follower : reconnexion back-off + bandeau d'état → bon. `leader-gone` affiché, sortie possible via « Quitter le suivi » → bon.
- **Échec de synchro totalement silencieux** : `autoSyncNow` avale toute exception (app.js:1868-1870), le statut Réglages « ✅ Fichier local lié — synchro auto » est calculé sur la *permission*, pas sur le succès réel (app.js:1903-1908), et `fsprovider.pull` retourne une base vide sur fichier supprimé/illisible (fsprovider.js:92-95). Si le fichier lié a été déplacé, chaque push échoue en boucle sans que l'utilisateur le sache — il croit ses données sauvegardées. Aucun horodatage « dernière synchro réussie ».
- Écran d'erreur fatale IndexedDB : couvert et bien fait (app.js:422-444).

## Frictions

### 🔴 Bloquants (4)
| # | Friction | Localisation |
|---|---|---|
| F1 | **Mode concert : tap/swipe/flèches changent de MORCEAU au lieu de paginer.** Impossible de tourner les pages d'un morceau long autrement qu'au scroll manuel ; un tap réflexe en bord d'écran (le geste appris hors setlist) saute au morceau suivant en plein milieu — sur scène, c'est l'accident type | app.js:2026-2027, 2060-2062, 2383-2392 |
| F2 | **Rouvrir le dialogue Pupitre régénère le token et casse la session en cours** (retardataire qui scanne = tous les autres déconnectés de fait) | app.js:2408→294-330, live.js:225 |
| F3 | **Pupitre lancé hors setlist = followers « live » sur écran vide**, sans avertissement d'aucun côté ; idem désync silencieuse si le leader navigue hors de la setlist partagée en cours de session | app.js:284-292, 322-323, 67-70, 704 |
| F4 | **Aucun indicateur de session active côté leader** une fois le dialogue fermé, aucun « Terminer la session » ; perte de connexion leader invisible (statut écrit dans un dialogue fermé) — le leader diffuse (ou ne diffuse plus) à son insu | app.js:301-315, 2408 ; `live.close()` jamais appelé côté leader |

### 🟡 Gênants (7)
| # | Friction | Localisation |
|---|---|---|
| F5 | Lecture seule follower limitée au lecteur : bibliothèque/import/Réglages actifs sous le bandeau « lecture seule », morceaux démo visibles, tug-of-war si le follower ouvre un morceau local | styles.css:209-214, app.js:446, 778-780 |
| F6 | Taille de police du leader imposée au follower, sans ajustement local possible (écrans différents) | app.js:790, 844 |
| F7 | Pas de suppression ni renommage de setlist (`db.deleteSetlist` existe mais jamais câblé) | db.js:234, absent d'app.js |
| F8 | Picker fermé après chaque ajout → N réouvertures pour N morceaux ; listener `input` accumulé à chaque ouverture | app.js:1313, 1323 |
| F9 | Import sans feedback ; le morceau importé peut être masqué par le filtre actif → « il a disparu » | app.js:1363-1368 |
| F10 | Transposition/capo jamais persistés par morceau (reset à 0 à chaque ouverture) alors que le BPM l'est — modèle incohérent ; un ajustement mid-concert est perdu au next/prev sans proposer de l'enregistrer dans l'override | app.js:706-707 vs 1448-1463, 1027-1031 |
| F11 | Échec de synchro silencieux + statut basé sur la permission, pas le succès ; pas de « dernière synchro : il y a X » | app.js:1868-1870, 1903-1908 ; fsprovider.js:92-95 |

### 🟢 Mineurs (6)
- Snapshot Pupitre figé : édits/réordonnancements pendant la session non re-poussés (app.js:322-323, live.js:139-141)
- Sidebar setlists triée par `updatedAt` : items qui sautent en tête après chaque modif, sélection toujours resetée sur `setlists[0]` (db.js:201-203, app.js:2264)
- Tags sidebar : `slice(0,6)` sans tri par fréquence — les tags 7+ sont invisibles et infiltrables (app.js:645)
- Ton mixte vous/tu dans les libellés (app.js:572, 1105 vs index.html:325-327, 397)
- Recherche : re-render complet + animation `cardRise` ré-échelonnée à chaque frappe (app.js:1977-1980, styles.css:414-426)
- Badge « Récents » = « 9 » en dur avant render (index.html:61) ; Escape ne nettoie pas `currentSetlistId` contrairement au bouton Retour (app.js:2376-2378 vs 1995-1998)

## Points forts (nouveaux, à préserver)

- **Undo du retrait de setlist restaure aussi l'override transpose/capo** et gère la setlist supprimée entre-temps (app.js:1218-1231) — le correctif C2 est complet, pas cosmétique.
- **Focus reposé sur le bouton ↑/↓ équivalent après re-render** (app.js:1194-1199) : déplacements clavier en série fluides, détail rarement soigné.
- **Ordre d'application font → 2col → scroll dans `applyRemoteState`** (app.js:789-803) : le `scrollPct` du follower tombe juste sur la hauteur finale.
- **Escape contextuel** ferme popover/panneau avant de quitter le lecteur, avec retour du focus au déclencheur (app.js:2358-2379).
- **Suppression de morceau annonce l'impact setlists avant confirmation** et purge songIds + overrides (app.js:1564-1579).
- **Le snapshot Pupitre embarque le contenu complet des morceaux** (app.js:282-292) : le follower n'a besoin de rien posséder localement — bon modèle.
- **Garde-fou swipe** (dx > 60 px et ratio horizontal 1.6, app.js:2060) : pas de faux positifs pendant le scroll vertical.
- Traduction FR des erreurs follower avec code technique conservé en `title` pour le debug (app.js:372-382).

## Top 5 recommandations actionnables

1. **Mode concert : paginer d'abord, changer de morceau ensuite.** Tap/flèches/swipe doivent tourner les pages DANS le morceau ; ne passer au suivant qu'en fin de morceau (ou via des contrôles dédiés « morceau préc./suiv. » près du badge n/N). Modifier les branchements `state.concertMode ? concertNext() : nextPage()` (app.js:2026-2027, 2061, 2383-2392) pour que `pageBy` détecte la fin de contenu et enchaîne alors seulement.
2. **Cycle de vie de session Pupitre.** Mémoriser `{token, joinUrl}` tant que la session est active : rouvrir le dialogue réaffiche le QR existant au lieu de rappeler `createSession()` (app.js:294) ; ajouter « ⏹ Terminer la session » dans le dialogue (appelle `live.close()`) ; état `.active` + compteur peers sur `#btn-pupitre` et rebond du statut hors dialogue (toast si la connexion leader tombe).
3. **Garde-fou « Pupitre hors setlist ».** Si `state.currentSetlistId` est null au lancement de session, soit avertir dans le dialogue (« Démarre le concert depuis une setlist pour partager »), soit construire un snapshot mono-morceau depuis `state.current` (extension simple de `buildCurrentSnapshot`, app.js:282-292).
4. **Boucler le CRUD setlist.** Boutons Renommer + Supprimer (avec confirmation et toast undo, le pattern existe déjà) dans `detail-head` — `db.deleteSetlist` (db.js:234) attend juste d'être câblé.
5. **Feedback de synchro honnête.** Remonter les échecs d'`autoSyncNow` (app.js:1868-1870) dans un état visible (pastille Réglages + horodatage « dernière synchro réussie il y a X » stocké en meta), et distinguer « fichier lié » de « synchro qui marche » dans `updateSettingsUI` (app.js:1903-1908).

Quick wins bonus : picker multi-ajout (retirer le `dialog.close()` de app.js:1313, marquer la ligne « Ajouté ✓ »), toast « Morceau importé » avec lien d'ouverture après `saveImport`, et autoriser `changeFont` côté follower (délier `font` de l'état appliqué à distance).

---

---

# Rapport 3/3 — ♿ Accessibility Auditor (WCAG 2.2 AA)

**Méthode** : analyse statique du code uniquement (HTML/CSS/JS). Les ratios de contraste sont **calculés depuis les valeurs hex du CSS** (constaté) ; le comportement réel des lecteurs d'écran (NVDA/VoiceOver) et le rendu au zoom 400 % sont **à confirmer manuellement** — aucun navigateur ni AT disponible dans cette session.

## Synthèse

**Conformité estimée : NON CONFORME WCAG 2.2 AA** — mais nette progression depuis l'audit du 2026-07-03 : les correctifs A/B/C/D sont bien visibles dans le code (aria-pressed sur les toggles, `#follower-announcer` aria-live, boutons ↑/↓, Escape contextuel, paliers reduced-motion, patch focus des `<dialog>`). Les issues ci-dessous sont **toutes nouvelles** (non couvertes par le rapport précédent ni par son reliquat tracé).

| Sévérité | Nombre |
|---|---|
| Critical | 1 |
| Serious | 5 |
| Moderate | 7 |
| Minor | 7 |
| **Total** | **20** |

Constat transversal : la dette restante n'est plus dans le markup statique (largement assaini) mais dans la **gestion dynamique** — focus perdu lors des re-renders/changements de vue, états sélectionnés non exposés, messages de statut muets pour les lecteurs d'écran.

## Issues

### CRITICAL

**Issue 1 — « Ajouter un morceau » à une setlist : inaccessible au clavier**
- **WCAG** : 2.1.1 Keyboard (A)
- **Impact** : un utilisateur clavier ne peut **pas du tout** ajouter un morceau à une setlist — c'est un `div` cliquable sans `tabindex` ni rôle, et c'est l'unique chemin vers le picker. Fonction entière bloquée (même famille que l'ancien A2 sur `.set-item`, corrigé — celui-ci a été oublié).
- **Localisation** : app.js:1267-1272 — constaté
- **Actuel** :
```js
const addRow = document.createElement('div');
addRow.className = 'add-row';
addRow.innerHTML = '＋ Ajouter un morceau depuis la bibliothèque';
addRow.addEventListener('click', () => openPickerDialog(sl));
```
- **Correctif** (minimal — le handler global `role=button` app.js:2312 fera le reste) : `makeA11yButton(addRow, 'Ajouter un morceau depuis la bibliothèque');` — mieux : `document.createElement('button')` avec `type="button"` (+ `width:100%; font:inherit` dans `.add-row`).
- **Vérification** : Tab jusqu'à la ligne, Entrée ouvre le picker.

### SERIOUS

**Issue 2 — Changement de vue : focus perdu et transition silencieuse**
- **WCAG** : 2.4.3 Focus Order (A), 4.1.2
- **Impact** : `showView()` pose `hidden` sur la section qui contient l'élément focusé → le navigateur renvoie le focus sur `<body>`. Un utilisateur clavier/SR qui ouvre un morceau depuis une carte, ou revient via « ← Retour », repart de zéro en haut du document, sans aucune annonce du changement de vue. Cela touche **chaque** navigation bibliothèque↔lecteur↔setlist.
- **Localisation** : app.js:471-475 (`showView`), déclencheurs app.js:600-611, 1993-1999 — constaté (mécanisme DOM standard ; comportement SR exact à confirmer manuellement)
- **Correctif** :
```js
function showView(name) {
  viewLibrary.hidden = name !== 'library';
  viewReader.hidden  = name !== 'reader';
  viewSetlist.hidden = name !== 'setlist';
  const view = { library: viewLibrary, reader: viewReader, setlist: viewSetlist }[name];
  const h = view.querySelector('h1');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}
```

**Issue 3 — Ouvrir un morceau depuis une setlist : impossible au clavier**
- **WCAG** : 2.1.1 Keyboard (A)
- **Impact** : dans le détail de setlist, l'ouverture d'un morceau passe uniquement par le clic sur la ligne (`div.song-row`, non focusable). Les boutons ↑/↓/✕ sont focusables, mais pas l'action principale. Seul contournement : « Démarrer le concert » puis naviguer — inacceptable pour ouvrir le 7ᵉ morceau.
- **Localisation** : app.js:1171-1179, styles.css:862-869 — constaté
- **Correctif** : ne pas mettre `role=button` sur la ligne (elle contient déjà des `<button>` → imbrication interdite) ; rendre le titre activable :
```html
<button type="button" class="song-open song-info">
  <div class="t">${escapeHTML(song.title)}</div>
  <div class="a">${escapeHTML(song.artist || '—')}</div>
</button>
```
  + CSS `.song-open { background:none; border:none; text-align:left; font:inherit; color:inherit; cursor:pointer; }` et brancher `openReader` dessus.

**Issue 4 — Toast d'annulation : 6 secondes, non prolongeable**
- **WCAG** : 2.2.1 Timing Adjustable (A)
- **Impact** : le toast « … retiré de la setlist — Annuler » (correctif C2) disparaît après 6 s sans possibilité de pause ni d'extension. Un utilisateur clavier doit tabuler jusqu'au bouton avant l'échéance ; utilisateur SR ou moteur lent = undo raté. Contexte scène/stress : 6 s est court même pour un voyant.
- **Localisation** : app.js:2434-2453 (`showToast`, `ms = 6000`) — constaté
- **Correctif** : pause au survol/focus + délai rallongé :
```js
const arm = () => { _toastTimer = setTimeout(hideToast, ms); };
el.addEventListener('mouseenter', () => clearTimeout(_toastTimer));
el.addEventListener('focusin',   () => clearTimeout(_toastTimer));
el.addEventListener('mouseleave', arm);
el.addEventListener('focusout',  arm);
// et passer ms par défaut à 10000
```

**Issue 5 — Sélecteur de capo : état sélectionné invisible pour les lecteurs d'écran**
- **WCAG** : 4.1.2 Name, Role, Value (A)
- **Impact** : les `span[data-capo]` reçoivent `role=button` + label (« Capo 2 », app.js:2299-2300) mais l'état actif n'existe que via la classe `.on`. Un utilisateur SR ne sait jamais quel capo est sélectionné — sur une app de musicien, c'est une info centrale. (L'A5 du rapport précédent listait 5 toggles, corrigés ; le groupe capo n'en faisait pas partie.)
- **Localisation** : app.js:871-874 (`syncTransposePanel`), index.html:162-169 — constaté
- **Correctif** :
```js
document.querySelectorAll('#capo-row span').forEach((el) => {
  const on = Number(el.dataset.capo) === state.capo;
  el.classList.toggle('on', on);
  el.setAttribute('aria-pressed', String(on));
});
```

**Issue 6 — Toggle favori : focus détruit par le re-render complet de la grille**
- **WCAG** : 2.4.3 Focus Order (A)
- **Impact** : Entrée sur ★ → `renderLibrary()` → `grid.innerHTML = ''` → le bouton focusé est détruit, focus sur `<body>`. Marquer 5 favoris au clavier = 5 fois retraverser toute la page. Le pattern de restauration existe déjà pour `.row-move` (app.js:1194-1199) mais n'a pas été appliqué ici.
- **Localisation** : app.js:613-626 — constaté
- **Correctif** (fin du handler, après `renderLibrary()`) : `document.querySelector(`.fav[data-id="${song.id}"]`)?.focus();`

### MODERATE

**Issue 7 — Filtres sidebar et setlists : état actif non exposé**
- **WCAG** : 4.1.2 (A)
- **Impact** : `.nav-item` (Tous/Favoris/Récents/tags) et `.set-item` sont des `role=button` corrects, mais le filtre courant / la setlist sélectionnée n'existent que via `.active`. Un utilisateur SR ne sait pas où il est.
- **Localisation** : app.js:689-696 (`setFilter`), app.js:1085-1086 (`renderSetlistSidebar`) — constaté
- **Correctif** : dans `setFilter` : `el.setAttribute('aria-pressed', String(el.dataset.filter === filter));` ; dans `renderSetlistSidebar` : `el.setAttribute('aria-current', sl.id === state.currentSetlistId ? 'true' : 'false')`.

**Issue 8 — Messages de statut sans aria-live (4 emplacements)**
- **WCAG** : 4.1.3 Status Messages (AA), 3.3.1 pour les erreurs
- **Impact** : mises à jour de `textContent` jamais annoncées : `#pupitre-status` (« Session active » / « Relais injoignable ») et `#pupitre-peers` (index.html:399,406) ; `#imp-pdf-status` (extraction PDF ok/échec, index.html:258 + app.js:1341-1353) ; `#settings-sync-result` (erreurs de synchro — le remplacement des `alert()` par C10 a perdu l'annonce que le natif garantissait, index.html:353 + app.js:1958-1964). Nota : la *traduction FR* des erreurs leader est déjà dans le reliquat tracé — ici je flague uniquement l'absence de live region, distincte.
- **Correctif** : ajouter `role="status"` sur ces 4 éléments dans index.html (déjà présents au chargement, condition idéale pour les live regions). Pour les erreurs (`#settings-sync-result.error`, `#imp-pdf-status.error`), `role="alert"` serait légitime mais `status` suffit et évite les interruptions.

**Issue 9 — Bouton interactif à l'intérieur de la live region du bandeau follower**
- **WCAG** : 4.1.3 (AA) + anti-pattern ARIA
- **Impact** : `#follower-banner` porte `role="status"` (index.html:22) et `showFollowerBanner` reconstruit **tout** son innerHTML — bouton « Quitter le suivi » compris — à chaque changement d'état (app.js:386-398). Conséquences : (a) le libellé du bouton est re-annoncé avec chaque statut (bruit), (b) si le focus est sur le bouton au moment d'un changement d'état (fréquent : reconnexions), il est détruit → focus perdu. L'annonce du premier état sur une région initialement `hidden` est en plus incertaine selon les SR — à confirmer manuellement.
- **Correctif** : créer le bouton **une fois** hors du flux de mise à jour, et ne mettre à jour que le texte :
```html
<div id="follower-banner" class="follower-banner" hidden>
  <span id="follower-banner-text" role="status"></span>
</div>
```
```js
// showFollowerBanner : ne toucher que #follower-banner-text.textContent ;
// créer le bouton .follower-leave une seule fois (if (!el.querySelector('.follower-leave')) …)
```

**Issue 10 — Cartes bibliothèque : bouton imbriqué dans un role=button**
- **WCAG** : 4.1.2 (A) — descendants interactifs interdits dans un `role=button`
- **Impact** : `card.setAttribute('role','button')` alors que la carte contient `<button class="fav">` (app.js:580-590). Le nom accessible de la carte (calculé depuis son contenu) inclut en outre le label du bouton favori (« Retirer des favoris ») → nom verbeux et trompeur. Certains SR ignorent ou aplatissent les descendants interactifs — comportement exact à confirmer manuellement, mais le markup viole la spec ARIA de façon constatée.
- **Correctif** : retirer `role`/`tabindex` de la carte et rendre le titre activable — même pattern que l'Issue 3 : `<button class="card-open"><span class="t">…</span></button>`, le clic sur la carte entière restant un bonus souris.

**Issue 11 — Sliders : zone tactile de 5 px de haut**
- **WCAG** : 2.5.8 Target Size Minimum (AA, nouveau en 2.2)
- **Impact** : `appearance:none; height:5px` sur `.lb-slider` et `.pslider` → la zone interactive de l'`<input type=range>` fait **5 px de haut** (pouce visuel 14-15 px, mais la hit-box est la boîte de l'input). Sur scène, au doigt, régler la vitesse de scroll en jouant est quasi impossible — c'est exactement le handicap situationnel du contexte MuseDesk.
- **Localisation** : styles.css:643-647 (`.lb-slider`), styles.css:744-749 (`.pslider`) — constaté
- **Correctif** : garder la piste fine visuellement mais élargir la boîte :
```css
.lb-slider, .pslider {
  height: 24px; background: transparent;
}
.lb-slider::-webkit-slider-runnable-track,
.pslider::-webkit-slider-runnable-track,
.lb-slider::-moz-range-track, .pslider::-moz-range-track {
  height: 5px; border-radius: 99px; background: var(--border);
}
/* thumb : ajouter margin-top:-5px côté webkit pour recentrer */
```

**Issue 12 — Follower : taille de texte imposée par le leader, contrôles locaux neutralisés**
- **WCAG** : 1.4.4 Resize Text (AA) — techniquement atténué par le zoom navigateur, mais barrière réelle
- **Impact** : `applyRemoteState` applique `s.font` du leader (app.js:790) et le mode follower neutralise `.tools`/`.livebar` (`pointer-events:none`, styles.css:209-214) + gardes `isFollower()` sur `changeFont`. Un musicien basse-vision qui suit une session ne peut pas agrandir le texte — le leader écrase son réglage à chaque state. Le pinch-zoom reste possible (viewport non verrouillé) mais casse la mise en page de lecture.
- **Correctif** : côté follower, **ignorer `s.font`** et laisser A−/A+ actifs (le `scrollPct` est en pourcentage, il reste correct quelle que soit la hauteur rendue) :
```js
if (!isFollower() && typeof s.font === 'number') { state.fontSize = s.font; applyFontSize(); }
```
  + retirer le garde `isFollower()` de `changeFont` et sortir `#btn-font-dec/inc` de la zone `pointer-events:none`.

**Issue 13 — Recherche, tri et filtre picker : placeholder seul, pas de label**
- **WCAG** : 3.3.2 Labels or Instructions (A) / 4.1.2
- **Impact** : `#lib-search` (index.html:88-90), `#lib-sort` (index.html:93-97, aucun nom accessible — les options « Trier : … » ne nomment pas le select) et `#picker-search` (index.html:382). Le placeholder disparaît à la saisie ; le select sans label est annoncé par sa seule valeur.
- **Correctif** : `aria-label="Rechercher un titre, un artiste ou un accord"` sur `#lib-search`, `aria-label="Trier les morceaux"` sur `#lib-sort`, `aria-label="Filtrer les morceaux"` sur `#picker-search`.

### MINOR

**Issue 14 — `aria-label` sur div générique** — `#pupitre-qr` (index.html:400) : `aria-label` sur un `<div>` sans rôle n'est pas exposé (prohibé sur `role=generic`). Ajouter `role="img"`, ou retirer le label (l'img interne est déjà `alt=""` et le lien est dans l'input). — 1.1.1/4.1.2, constaté.

**Issue 15 — Barre alphabet** — `<nav class="alpha">` sans `aria-label` (2 nav sur la page, l'autre est labellisée) (index.html:109) ; 26 liens `href="#"` focusables dont les lettres sans morceau ne font rien (app.js:663-686) — 26 tab-stops de bruit. Correctif : `aria-label="Accès alphabétique"`, ne rendre focusables que les lettres `.has` (les autres en `<span aria-hidden="true">`). Nota : la cible ~14 px de `.alpha a` (styles.css:476-481) était dans le M3 de l'audit précédent — corrigé pour `.row-x`/`.fav` mais **pas** pour `.alpha a` : correctif incomplet à finir, je ne le recompte pas comme nouveau.

**Issue 16 — Bruit SR : initiale de couverture et poignée de drag** — `.cover` (initiale décorative, app.js:588) et le glyphe braille `⠿` de `.drag` (app.js:1158) sont lus par les SR. Ajouter `aria-hidden="true"` aux deux. — 1.1.1, constaté.

**Issue 17 — Blanc sur accent : reliquat du fix A6** — le correctif « encre sombre sur terracotta » (styles.css:196) n'a pas été propagé à `.play` (`color:#fff`, styles.css:627-637) ni `.opt .box.on` (`color:#fff`, styles.css:740-743). Blanc sur #e0703a = **3,21:1** (calculé, et confirmé par le commentaire CSS existant) : passe le 3:1 « icône » (1.4.11) mais échoue en tant que texte (1.4.3) — le ✓ d'état est limite. Harmoniser sur `var(--accent-ink)`.

**Issue 18 — Emojis dans les libellés de statut** — `🔄 Connexion…`, `📡 Mode lecture seule…`, etc. (app.js:363-368, 307-315) : les SR vocalisent le nom Unicode de l'emoji avant chaque message. Préférer des emojis en `<span aria-hidden="true">` ou les retirer des textes annoncés. — à confirmer manuellement (verbosité selon SR).

**Issue 19 — Langue des parties** — `lang="fr"` (index.html:2) mais les chansons de démo embarquées sont en anglais (app.js:107-238) → prononciation TTS française sur paroles anglaises. — 3.1.2 (AA). Pour le contenu utilisateur c'est inévitable ; pour la démo, un attribut `lang` optionnel par morceau (champ + `lang` sur `#reader-content`) serait propre. Faible priorité.

**Issue 20 — Mode contraste forcé (Windows High Contrast)** — l'état capo `.on` n'est porté que par le fond dégradé + graisse (styles.css:723-727) : en `forced-colors: active` les fonds sont supprimés → état invisible. Les toggles `.box.on` survivent grâce au ✓ textuel. Correctif : `@media (forced-colors: active) { .capo span.on { outline: 2px solid CanvasText; } }`. — à confirmer manuellement.

Hors périmètre a11y, relevé en passant : `openPickerDialog` ré-attache un listener `input` sur `#picker-search` à chaque ouverture (app.js:1323) → accumulation (rendu N fois après N ouvertures). Bug mineur de perf à corriger à l'occasion.

## Ce qui est bien fait (à préserver)

- **Les correctifs de l'audit précédent sont réels et bien faits** : `#follower-announcer` aria-live pour le changement de morceau follower (index.html:24, app.js:781-783), `aria-pressed` sur les 5 toggles + mise à jour JS systématique, `aria-expanded`/`aria-controls` sur métronome et transpose, boutons ↑/↓ **avec restauration du focus après re-render** (app.js:1194-1199 — le pattern exact qu'il faut répliquer aux Issues 6), Escape contextuel avec retour de focus au déclencheur (app.js:2358-2379), paliers `prefers-reduced-motion` sur l'auto-scroll JS (app.js:924-941).
- **Patch global des `<dialog>`** (app.js:2326-2343) : focus initial + retour au déclencheur avec garde `document.body.contains(t)` — robuste.
- `.sr-only` correctement implémentée (clip-path, styles.css:139-147) ; `:focus-visible` fallback global (styles.css:129-133) + traitements dédiés partout.
- Zones tactiles `.fav`/`.row-x`/`.row-move` étendues à ≥40 px par pseudo-élément sans grossir le glyphe (styles.css:445-447, 888-890, 904-906) — technique exemplaire pour 2.5.8.
- Le garde `e.target.matches('input, textarea, select')` sur les raccourcis clavier (app.js:2355) évite de voler les flèches aux sliders — piège classique évité.
- QR : `alt=""` explicite + lien textuel équivalent dans un input labellisé (app.js:346, index.html:402).
- Contrastes texte calculés : `--text` 14,3:1, `--text-2` 6,5:1, `--text-3` ~4,6:1, accent/chord 5,75:1 sur `--bg` — tous AA (constaté depuis les hex).

## Priorités de remédiation

### Immédiat (avant prochaine release)
1. **Issue 1** — `makeA11yButton` sur `.add-row` (1 ligne, débloc total d'une fonction)
2. **Issue 5** — `aria-pressed` sur le capo (3 lignes dans `syncTransposePanel`)
3. **Issue 6** — restauration du focus après toggle favori (1 ligne, pattern déjà écrit ailleurs)
4. **Issue 2** — focus sur le `h1` de la vue dans `showView` (5 lignes)
5. **Issue 4** — pause du toast au survol/focus + 10 s (6 lignes)

### Court terme (prochain sprint)
6. **Issue 3 + Issue 10** — bouton-titre dans `.song-row` et `.card` (même pattern, un seul chantier)
7. **Issue 8** — `role="status"` sur les 4 zones de statut (index.html uniquement)
8. **Issue 9** — sortir le bouton « Quitter le suivi » de la live region
9. **Issue 11** — hit-box 24 px des sliders
10. **Issue 13** — 3 `aria-label` sur recherche/tri/filtre
11. **Issue 12** — ne plus imposer la police du leader au follower

### Maintenance
12. Issues 14-20 (rôle img QR, barre alphabet + finir le M3 sur `.alpha a`, `aria-hidden` cover/drag, accent-ink sur `.play`/`.box.on`, emojis dans les statuts, `lang` des morceaux, forced-colors)
13. Passage manuel obligatoire avant de déclarer la conformité : NVDA + Chrome sur les parcours import → setlist → concert → follower ; zoom 400 % ; Windows High Contrast ; vérification que les live regions initialement `hidden` annoncent bien leur premier état.
