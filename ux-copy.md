# UX Copywriting - MuseDesk

Cette skill définit le ton et le style des textes (UI, erreurs, états vides) pour MuseDesk.

## Ton et Langue

- **Uniquement en Français**.
- **Direct, honnête et sans remplissage** : Pas de marketing, pas de "ce projet innovant".
- Orienté utilisateur : Le texte doit guider le musicien en répétition ou sur scène.

## Exemples du code (Bonnes pratiques)

- **États vides (Empty states)** :
  - *Bibliothèque vide* : Le lecteur attend un import (ex: "Aucun morceau trouvé.").
  - *Pupitre hors ligne* : "Connexion…" ou "0 pupitre connecté" (voir `#pupitre-status` et `#pupitre-peers` dans `index.html`).

- **Actions (Boutons et libellés)** :
  - "Transposer un demi-ton plus bas" (au lieu de "Diminuer la tonalité de la musique").
  - "Ouvrir le menu"
  - "Réinitialiser la transposition"

- **Dialogues** :
  - Au lieu de "Veuillez entrer le nom de la nouvelle setlist", utiliser "Nouvelle setlist" (voir `#setlist-dialog-title`).

- **Erreurs** :
  Doivent être concises, par exemple dans les logs : `console.log("Erreur de parsing:", err)` plutôt que de grandes phrases d'excuses.
