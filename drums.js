// drums.js — Logique PURE de l'option « accompagnement batterie »
// ---------------------------------------------------------------------------
// Aucun effet de bord à l'import, ni DOM, ni IndexedDB, ni Web Audio : tout ce
// qui est ici est testable sous `node --test`. Le son vit dans drumplayer.js,
// l'orchestration dans app.js.
//
// Modèle (porté par le morceau, donc synchronisé avec lui) :
//   song.bpm    : tempo FIXE du morceau (champ déjà partagé avec le métronome)
//   song.drums  : { enabled, intro, impro, style }
//     enabled : option active pour ce morceau
//     intro   : nombre de mesures jouées par la batterie avant que le texte défile
//     impro   : curseur « improvisation », 0 = fidèle … 100 = très libre
//     style   : rythme généré quand le morceau n'a pas de MIDI
//
// Pourquoi un sous-objet plutôt que des champs à plat : un seul point de
// normalisation (normalizeDrums), et un morceau importé d'une ancienne version
// (sans `drums`) retombe proprement sur les valeurs par défaut.
// Source fonctionnelle : PRD « option batterie » v2 validé le 22.11.2026.
// ---------------------------------------------------------------------------

// Styles proposés quand aucun MIDI n'est disponible. `beats` = temps par mesure.
export const DRUM_STYLES = [
  { id: 'rock',    label: 'Rock',          beats: 4 },
  { id: 'pop',     label: 'Pop',           beats: 4 },
  { id: 'ballade', label: 'Ballade',       beats: 4 },
  { id: 'shuffle', label: 'Shuffle / blues', beats: 4 },
  { id: 'bossa',   label: 'Bossa nova',    beats: 4 },
  { id: 'valse',   label: 'Valse (3/4)',   beats: 3 },
];

export const BPM_MIN = 40;
export const BPM_MAX = 240;
export const INTRO_MAX = 64;

export const DRUM_DEFAULTS = Object.freeze({
  enabled: false,
  intro: 4,
  impro: 20,
  style: 'rock',
});

function clampInt(v, min, max, fallback) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// Ramène n'importe quelle valeur (absente, corrompue, ancienne) à un réglage valide.
export function normalizeDrums(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const style = DRUM_STYLES.some((s) => s.id === r.style) ? r.style : DRUM_DEFAULTS.style;
  return {
    enabled: r.enabled === true,
    intro: clampInt(r.intro, 0, INTRO_MAX, DRUM_DEFAULTS.intro),
    impro: clampInt(r.impro, 0, 100, DRUM_DEFAULTS.impro),
    style,
  };
}

// BPM valide ou null (null = « pas encore connu », à saisir ou à rechercher).
export function normalizeBpm(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < BPM_MIN || n > BPM_MAX) return null;
  return n;
}

export function beatsPerBar(style) {
  return (DRUM_STYLES.find((s) => s.id === style) || DRUM_STYLES[0]).beats;
}

// Tap tempo : BPM à partir d'horodatages en ms. Ignore les taps de plus de
// 3 s (nouvelle série) ; null tant qu'il n'y a pas deux taps exploitables.
export function bpmFromTaps(times) {
  const recent = [];
  for (const t of times) {
    if (recent.length && t - recent[recent.length - 1] > 3000) recent.length = 0;
    recent.push(t);
  }
  const last = recent.slice(-8);
  if (last.length < 2) return null;
  const avg = (last[last.length - 1] - last[0]) / (last.length - 1);
  if (avg <= 0) return null;
  return normalizeBpm(60000 / avg);
}
