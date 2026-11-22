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

// ---------------------------------------------------------------------------
// GÉNÉRATION DU RYTHME (styles « façon boîte à rythmes » + improvisation)
// ---------------------------------------------------------------------------
// Inspiration : Machinedrum (github.com/Omodaka9375/machinedrum, licence MIT) —
// grilles de pas + frappes probabilistes. AUCUN code repris : seule l'idée.
//
// Une grille = `steps` pas répartis sur `beats` temps. Lettres :
//   X accent (1.0) · x normal (0.75) · g note fantôme (0.3) · . silence
// Le shuffle et la valse utilisent une grille ternaire (3 pas par temps).
// Une mesure générée = liste d'événements { t, inst, v, jit } :
//   t   position en temps depuis le début de la mesure (0 ≤ t < beats)
//   v   vélocité 0..1 ; jit décalage humain en secondes (placement)
export const STYLE_PATTERNS = {
  rock: { steps: 16, tracks: {
    hh:    'x.x.x.x.x.x.x.x.',
    snare: '....X.......X...',
    kick:  'x.......x.x.....' } },
  pop: { steps: 16, tracks: {
    hh:    'xgxgxgxgxgxgxgxg',
    snare: '....X.......X...',
    kick:  'x.....x.x.......' } },
  ballade: { steps: 16, tracks: {
    hh:        'x.g.x.g.x.g.x.g.',
    sidestick: '....x.......x...',
    kick:      'x.........x.....' } },
  shuffle: { steps: 12, tracks: {
    hh:    'x.xx.xx.xx.x',
    snare: '...X.....X..',
    kick:  'x.....x.x...' } },
  bossa: { steps: 16, tracks: {
    hh:        'xgxgxgxgxgxgxgxg',
    sidestick: 'x..x..x...x..x..',
    kick:      'x..xx..xx..xx..x' } },
  valse: { steps: 12, tracks: {
    kick:  'x...........',
    hh:    'x...x...x...',
    snare: '....x...x...' } },
};

const LETTER_V = { X: 1, x: 0.75, g: 0.3 };

// PRNG déterministe (mulberry32) : même graine → même improvisation, donc
// testable, et une mesure rejouée sonne pareil.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Choix de l'échantillon selon l'instrument et la vélocité (fichiers de kit/).
export function pickSample(inst, v) {
  switch (inst) {
    case 'kick':  return v < 0.6 ? 'kick-soft' : 'kick';
    case 'snare': return v < 0.45 ? 'snare-ghost' : (v > 0.9 ? 'snare-accent' : 'snare');
    case 'hh':    return v < 0.5 ? 'hh-soft' : 'hh';
    default:      return inst; // hh-open, hh-pedal, ride, ride-bell, crash, sidestick, tom-high, tom-floor
  }
}

// Mesure de roulement selon l'improvisation : 0 → jamais ; < 50 → toutes les
// 8 mesures ; ≥ 50 → toutes les 4. `bar` compté depuis le début du morceau,
// la phrase démarre à la fin de l'intro (là où le chanteur entre).
export function isFillBar(bar, impro, introBars = 0) {
  if (impro <= 0) return false;
  const period = impro >= 50 ? 4 : 8;
  const rel = bar - introBars;
  if (rel < 0) return (bar + 1) === introBars; // roulement d'entrée sur la dernière mesure d'intro
  return (rel + 1) % period === 0;
}

function fillEvents(beats, steps, amount, rng) {
  // Roulement sur le dernier temps (ou les deux derniers si impro forte),
  // en doubles croches : caisse claire puis toms qui descendent.
  const perBeat = steps / beats;
  const fillBeats = amount >= 0.7 ? 2 : 1;
  const start = (beats - fillBeats) * perBeat;
  const out = [];
  const voices = ['snare', 'snare', 'tom-high', 'tom-high', 'tom-floor', 'tom-floor'];
  const n = steps - start;
  for (let i = 0; i < n; i++) {
    const inst = voices[Math.min(voices.length - 1, Math.floor((i / n) * voices.length))];
    out.push({ step: start + i, inst, v: 0.6 + 0.4 * (i / n) - rng() * 0.1 });
  }
  return { events: out, fromStep: start };
}

// Génère UNE mesure de batterie pour un style donné.
//   impro      0..100
//   introBars  nombre de mesures d'intro (crash à l'entrée du chanteur)
export function generateBar(style, bar, { impro = 0, introBars = 0, seed = 1 } = {}) {
  const pat = STYLE_PATTERNS[style] || STYLE_PATTERNS.rock;
  const beats = beatsPerBar(style);
  const steps = pat.steps;
  const stepBeats = beats / steps;
  const amount = Math.max(0, Math.min(100, impro)) / 100;
  const rng = mulberry32((seed * 7919 + bar * 104729) >>> 0);
  const hits = [];

  const fill = isFillBar(bar, impro, introBars) ? fillEvents(beats, steps, amount, rng) : null;
  for (const [inst, row] of Object.entries(pat.tracks)) {
    for (let i = 0; i < steps; i++) {
      if (fill && i >= fill.fromStep && inst !== 'kick') continue; // le roulement remplace caisse et charleston
      const ch = row[i];
      let v = LETTER_V[ch];
      if (v === undefined) {
        // Pas vide : notes fantômes de caisse claire, kick décalé — seulement si impro.
        if (amount > 0 && inst === 'snare' && row[i - 1] !== 'X' && row[i + 1] !== 'X'
            && rng() < amount * 0.25) v = 0.25;
        else if (amount > 0 && inst === 'kick' && i % 2 === 1 && rng() < amount * 0.08) v = 0.55;
        else continue;
      }
      let name = inst;
      // Charleston ouvert sur la dernière croche de la mesure, de temps en temps.
      if (inst === 'hh' && amount > 0 && i === steps - (steps / beats) / 2 && rng() < amount * 0.35) name = 'hh-open';
      hits.push({ step: i, inst: name, v });
    }
  }
  if (fill) hits.push(...fill.events);

  // Crash sur le premier temps d'une nouvelle phrase (après un roulement) et à
  // l'entrée du chanteur — y compris à impro 0 pour marquer la fin de l'intro.
  const enters = introBars > 0 && bar === introBars;
  if (enters || (bar > 0 && isFillBar(bar - 1, impro, introBars))) {
    hits.push({ step: 0, inst: 'crash', v: 0.85 });
  }

  const jitMax = amount * 0.012; // placement : ±12 ms au maximum
  const velJit = amount * 0.15;
  return hits.map((h) => ({
    t: h.step * stepBeats,
    inst: h.inst,
    v: Math.max(0.05, Math.min(1, h.v + (amount ? (rng() * 2 - 1) * velJit : 0))),
    jit: amount ? (rng() * 2 - 1) * jitMax : 0,
  })).sort((a, b) => a.t - b.t);
}

// Liste des échantillons du kit (pour le chargement et le cache hors ligne).
export const KIT_SAMPLES = [
  'kick', 'kick-soft', 'snare', 'snare-ghost', 'snare-accent', 'sidestick',
  'hh', 'hh-soft', 'hh-open', 'hh-pedal', 'ride', 'ride-bell', 'crash',
  'tom-high', 'tom-floor',
];
