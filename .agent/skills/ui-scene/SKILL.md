---
name: ui-scene
description: Travailler l'interface de MuseDesk — lisibilité sur scène, accessibilité, animations. À utiliser pour toute modification de styles.css, du DOM ou d'une transition. Le contexte d'usage n'est pas un bureau : c'est une tablette posée sur un pied, à un mètre, éclairage variable, mains occupées.
---

# Interface : le contexte d'usage d'abord

MuseDesk est lu par un musicien **en train de jouer**. Une tablette en paysage à un mètre, ou un
PC sur une TV. Souvent une seule main libre, parfois aucune. Lumière de scène ou de salon.

Toute décision d'interface se juge à cette aune, pas sur une capture d'écran de bureau. Un
contraste « suffisant » à 40 cm sur un écran calibré ne l'est plus à un mètre sous un projecteur.

## Ce que le projet gère déjà — ne le casse pas

`styles.css` couvre ces contextes. Vérifie que ta modification les respecte encore :

| Media query | Ce qu'elle protège |
|---|---|
| `prefers-reduced-motion: reduce` | Les animations doivent être neutralisables |
| `forced-colors: active` | Mode contraste forcé de Windows |
| `hover: none` / `pointer: fine` | Distinction tactile / souris — pas de fonction cachée derrière un survol |
| `max-width: 700px / 900px / 1100px` | Les trois paliers de largeur |

Une fonction accessible uniquement au survol est **inutilisable sur la tablette**, qui est la
cible principale.

## Pièges déjà rencontrés dans ce dépôt

Ils sont documentés dans `AUDIT_UIUX_2026-07-03.md`, `AUDIT_UIUX_2026-07-04.md` et
`docs/WOW_LOOP.md`. Lis-les avant une passe visuelle : ils listent aussi les pistes **écartées
avec leur raison**, ce qui évite de reproposer ce qui a déjà été refusé.

- **`:focus-visible` sur un conteneur.** Un `.card:focus-visible` ne se déclenche jamais si
  c'est un enfant qui reçoit le focus. Corrigé une fois en `:focus-within` (commit `1513e35`).
  Vérifie sur quel élément le focus atterrit réellement.
- **Keyframes partagées qui écrasent le `transform` de base.** Une animation réutilisée sur
  plusieurs éléments remet leur transform à zéro. Chantier P4 de l'audit du 4 juillet.
- **Couleurs codées en dur en JS.** La palette appartient à `styles.css`. Une valeur écrite dans
  `app.js` échappe au thème et aux modes de contraste. Chantier P6.
- **Élément interactif inatteignable au clavier.** « Ajouter un morceau » l'a été, classé
  critique. Teste chaque contrôle ajouté à la tabulation seule, sans souris.
- **Échec silencieux.** Une synchro qui échoue sans rien dire a été classée P7. Tout état
  d'erreur doit être visible à l'écran.

## Animations

Le projet assume une identité visuelle forte — View Transitions, page-turn, effets de matière —
construite par itérations tracées dans `docs/WOW_LOOP.md`, chacune avec un verdict.

Deux règles : toute animation reste neutralisable par `prefers-reduced-motion`, et aucune ne
retarde l'accès à l'information. Sur scène, une transition élégante qui coûte 300 ms avant
d'afficher le couplet suivant est un défaut, pas une finition.

Si tu ajoutes une itération visuelle, consigne-la dans `docs/WOW_LOOP.md` en suivant le format
existant — intention, ce qui a été fait, verdict attendu.

## Avant de proposer la PR

1. Testé au clavier seul : tabulation, `Entrée`, `Échap`. Tout contrôle atteignable, focus visible.
2. Testé en largeur réduite — les trois paliers.
3. `prefers-reduced-motion` respecté par toute nouvelle animation.
4. Aucune couleur en dur ajoutée dans un fichier `.js`.
5. `node --test` passe, et les `?v=` ont été bumpés si un `.js` a changé.
6. Préfixe de commit `ui:` pour une passe visuelle, `ux+anim:` si le comportement bouge,
   `fix(a11y):` pour une correction d'accessibilité.
