# Audit UI/UX complet — MuseDesk (2026-07-03)

Audit mené par 3 agents spécialisés en parallèle (sélection via agent-finder) :
- **Accessibility Auditor** → WCAG 2.1 AA (analyse statique + calculs de contraste réels)
- **UX Researcher** (persona catalogue) → usabilité, parcours critiques, 10 heuristiques de Nielsen
- **UI Designer** (persona catalogue) → système de design, hiérarchie visuelle, cohérence, responsive

Périmètre : `index.html`, `styles.css`, `app.js`, `live.js`, `parser.js`, `sync.js`, `manifest.json`, `mockups/`. Lecture seule — aucun fichier modifié.

⚠️ Limites : audit **statique** (lecture de code). Pas de test lecteur d'écran réel (NVDA/VoiceOver), pas de test tactile sur device, pas de vérification du rendu au zoom 400 %. À compléter par un passage manuel avant de considérer la conformité acquise.

---

## Scores

| Dimension | Score | Verdict |
|---|---|---|
| Accessibilité WCAG 2.1 AA | 6/10 | ❌ Non conforme (5 bloquants) — mais base saine, correctifs ciblés |
| Usabilité (Nielsen) | — | 5 frictions majeures dont 3 🔴 |
| Design visuel | 7.3/10 | Système de tokens mature, dette de migration palette + mode Pupitre non stylé |

**Constat transversal fort** : les trois audits convergent sur le **mode Pupitre** (feature la plus récente) et sur les **contrôles de setlist** — c'est là que se concentre la dette UI/UX.

---

## 🔴 Bloquants (9)

### Accessibilité
| # | Problème | Critère | Localisation |
|---|---|---|---|
| A1 | Drag & drop de setlist **sans aucune alternative clavier** — réordonner est impossible sans souris/tactile | 2.1.1 | app.js:1018,1064-1091 |
| A2 | `.set-item` (sélection de setlist) non focusables au clavier — `makeA11yButton()` existe mais n'est pas appliqué | 2.1.1 | app.js:958-970 |
| A3 | L'auto-scroll JS (`requestAnimationFrame`) **ignore `prefers-reduced-motion`** — la règle CSS ne couvre pas le JS impératif ; risque vestibulaire sur la fonctionnalité centrale | 2.3.3 | app.js:831-854 |
| A4 | Mode Pupitre follower : changement de morceau à distance **jamais annoncé** (aucune région `aria-live` sur le contenu) | 4.1.3 | app.js:713-743 |
| A5 | Toggles sans état annoncé : `#btn-scroll`, `#btn-twocol`, `#toggle-chords`, `#toggle-diagrams`, `#lb-play` sans `aria-pressed` (le pattern correct existe déjà sur `.card .fav`) | 4.1.2 | index.html:121-123,166,170,180 |

### Usabilité
| # | Problème | Heuristique | Localisation |
|---|---|---|---|
| U1 | Retrait d'un morceau d'une setlist : **immédiat, sans confirmation ni undo** — perd aussi l'override transposition/capo, cible tactile ~22px | 5, 9 | app.js:1051-1061 |
| U2 | Zones de tap du lecteur quasi invisibles sur tablette (opacité 0.16) — contexte d'usage = scène en faible lumière ; gestuelle jamais expliquée | 1, 8 | styles.css:551-552 |
| U3 | Follower : lecture seule non expliquée (contrôles neutralisés silencieusement), **aucun bouton « Quitter le suivi »** | 1, 5 | styles.css:182-187, app.js:779+ |

### Design visuel
| # | Problème | Localisation |
|---|---|---|
| D1 | `.follower-banner`, `.pupitre-qr`, `.pupitre-link-row` : **aucune règle CSS** — HTML brut non stylé sur la feature la plus démonstrative | index.html:22,384-389 (styles.css : absents) |

---

## 🟡 Majeurs (sélection consolidée)

| # | Problème | Source | Localisation |
|---|---|---|---|
| M1 | Popover métronome + panneau Transpose : pas d'`aria-expanded`, focus non déplacé, `Escape` ferme **le lecteur entier** au lieu du panneau ouvert | A11y | app.js:1321-1327,1880-1884,2147 |
| M2 | Icônes `.row-x`/`.drag` en `#4a5268` : contraste 2.01:1 (< 3:1 requis) — couleur hors palette héritée du mockup bleu | A11y+UI | styles.css:837,842-849 |
| M3 | Cibles tactiles trop petites : `.row-x` ≈22px, `.fav` ≈20px, `.alpha a` — sous les 24px WCAG 2.2 / 44px recommandés | A11y | styles.css:410-416,445-448,842-849 |
| M4 | Texte bouton primaire sur bas de dégradé (`--accent-strong`) : 4.46:1, échec de justesse du seuil 4.5:1 | A11y | styles.css:170-177 |
| M5 | Sliders `#font-slider`/`#speed-slider`/`#lb-speed` sans `aria-label` ni label lié | A11y | index.html:162,174,184 |
| M6 | Import sans preview : le rendu (accords alignés) n'est découvert qu'après enregistrement + ouverture ; format ChordPro jamais mentionné dans l'UI | UX | app.js:1185-1198, index.html:257-259 |
| M7 | Suppression d'un morceau utilisé dans des setlists : confirmation générique, références orphelines silencieuses (`.filter(Boolean)`) | UX | app.js:1386-1401,987 |
| M8 | Codes d'erreur réseau bruts affichés au follower (« ws-policy-1008 », « payload-too-large ») sans traduction | UX | app.js:362, live.js:189,194 |
| M9 | Durée de setlist = `songs.length * 4` min, placeholder non signalé — risque de confiance déplacée pour un timing de concert | UX | app.js:990 |
| M10 | 8 résidus `rgba(79,134,255,…)` (palette bleue abandonnée) dans ombres/glow ; pas de variable `--danger` (rouges en dur) | UI | styles.css:60,168,174,176,235,596,599,601,1279 |
| M11 | Mode 2 colonnes : police chute à 21px (−19 %) alors que c'est le mode « beaucoup de contenu lu à distance » | UI | styles.css:494-503 |
| M12 | < 700px : sidebars masquées (`display:none`) sans hamburger/drawer de remplacement visible — accès filtres/setlists à vérifier | UI | styles.css:1222-1229 |
| M13 | Pas d'indicateur de position dans la setlist pendant la lecture (badge « 3/8 ») — besoin central sur scène | UI | index.html (toolbar) |
| M14 | Incohérence sliders : vitesse scroll = slider seul, BPM = slider + boutons ±1/±5 — précision tactile difficile en jouant | UX | index.html:184 vs 199-202 |
| M15 | Aucun heading dans la vue lecteur (`#reader-title` est un `<span>`), pas de `<main>`, `<nav>` incomplet | A11y | index.html:31-232,115 |
| M16 | Sync Drive last-write-wins non explicité dans l'UI (perte silencieuse possible en modif simultanée PC+tablette) | UX | dialogue Réglages |

---

## 🟢 Mineurs (en bref)

- `alert()`/`confirm()` natifs qui cassent l'esthétique (app.js:1979,2015,1388) ; pas de badge « démo » sur les morceaux seed ; `.chord` cliquable sans affordance ; `<h3>` de dialogues (saut de niveau) ; QR `<img>` sans `alt` ; raccourcis à touche unique (2.1.4) ; bordures d'inputs quasi invisibles (1.30:1) ; `px` fixes au lieu de `rem` pour le chrome UI ; styles inline dupliqués (`#picker-search`, bouton 🗑, hints) ; échelle typo non tokenisée ; `mockups/` obsolète depuis le pivot terracotta (à archiver) ; grille de chanson = mur de spans pour lecteur d'écran (ajouter `role="region"` + headings de section).

---

## ✅ Points forts confirmés (à préserver)

- **Design system tokenisé** rare pour du vanilla : couleurs, espacement base 4px, rayons, ombres, transitions (styles.css:10-74)
- **Gestion de focus des `<dialog>`** : patch `showModal` global = focus initial + retour au déclencheur (app.js:2113-2134)
- `prefers-reduced-motion` CSS complet, `:focus-visible` systématique (5.75:1), `::selection` custom
- Contrastes texte excellents : `--text` 14.35:1, `--text-2` 6.54:1, `--text-3` 5.44:1 (meilleur que le commentaire ne l'annonce)
- Dégradation propre du mode Pupitre (bouton masqué si non configuré, fallback QR→lien, reconnexion back-off+jitter)
- Écran d'erreur fatale IndexedDB, distinction AbortError vs vraie erreur, seed de démo, recherche instantanée + raccourci `/`, micro-interactions premium (easing overshoot, delays échelonnés)
- Pattern `aria-pressed` déjà correct sur `.card .fav` — modèle à répliquer

---

## Top 10 priorisé (effort × impact)

| # | Correctif | Effort | Fichiers |
|---|---|---|---|
| 1 | Styler `.follower-banner` + `.pupitre-qr` + `.pupitre-link-row` (réutiliser le vocabulaire `.drive-status`) | Faible | styles.css |
| 2 | `makeA11yButton()` sur `.set-item` (fonction déjà écrite, juste oubliée) | Trivial | app.js:958-970 |
| 3 | Boutons ↑/↓ par ligne de setlist (alternative clavier au drag & drop) | Moyen | app.js, styles.css |
| 4 | Toast « Morceau retiré — Annuler » sur le retrait de setlist | Moyen | app.js:1051-1061 |
| 5 | `#4a5268` → `var(--text-3)` + variable `--danger` + purge des 8 résidus bleus | Faible | styles.css |
| 6 | `aria-pressed` sur les 5 toggles + `aria-expanded` sur métronome/transpose + `aria-label` sur les 3 sliders | Faible | app.js, index.html |
| 7 | `matchMedia('(prefers-reduced-motion)')` dans `startScroll()` → défilement par paliers | Moyen | app.js:831-854 |
| 8 | Bandeau follower explicite (« Mode lecture seule — tu suis le leader ») + bouton « Quitter le suivi » + dictionnaire d'erreurs FR | Moyen | app.js, live.js |
| 9 | Opacité `.tap` 0.16 → ~0.3 sur `hover:none` + hint gestuel au premier lancement du lecteur | Faible | styles.css:551-552 |
| 10 | `Escape` contextuel (ferme le panneau ouvert avant de quitter le lecteur) + agrandir cibles `.row-x`/`.fav` à ≥40px | Faible | app.js:2147, styles.css |

---

*Rapports complets des 3 agents disponibles dans les transcripts de session du 2026-07-03.*
