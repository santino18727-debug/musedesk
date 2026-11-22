// midi.js — Lecture d'un fichier MIDI et extraction de la partie de batterie
// ---------------------------------------------------------------------------
// PUR (aucun DOM, aucun réseau) : testable sous `node --test`.
//
// Deux familles de fichiers :
//  1. MIDI « réel » (import manuel d'un .mid) : la division (ticks par noire)
//     donne directement les temps, quel que soit le tempo écrit. On rejoue au
//     BPM fixe du morceau.
//  2. MIDI re-généré du Los Angeles MIDI Dataset (renvoyé par MIDI-Search) :
//     division 1000 et tempo factice 60 BPM, donc 1 tick = 1 ms de la vraie
//     interprétation. Le temps musical est perdu : il faut le BPM réel pour
//     découper en mesures. On l'estime sur les frappes elles-mêmes
//     (estimateBpm), en partant du BPM connu du morceau s'il y en a un.
//     Source : capture/2026-11-22-musedesk-batterie-midi-recherche.md (brain).
// ---------------------------------------------------------------------------

// --- Lecture SMF (Standard MIDI File) ----------------------------------------
export function parseMidi(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  let p = 0;
  const str = (n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(b[p + i]); return s; };
  const u32 = () => { const v = (b[p] << 24 | b[p + 1] << 16 | b[p + 2] << 8 | b[p + 3]) >>> 0; p += 4; return v; };
  const u16 = () => { const v = b[p] << 8 | b[p + 1]; p += 2; return v; };
  const vlq = () => { let v = 0, c; do { c = b[p++]; v = (v << 7) | (c & 0x7f); } while (c & 0x80 && p < b.length); return v; };

  if (b.length < 14 || str(4) !== 'MThd') throw new Error('Pas un fichier MIDI (en-tête MThd absent)');
  p = 4;
  const hlen = u32();
  const format = u16(), ntracks = u16(), division = u16();
  if (division & 0x8000) throw new Error('MIDI en temps SMPTE non pris en charge');
  p = 8 + hlen;

  const notes = [], tempos = [], timeSigs = [], names = [];
  for (let t = 0; t < ntracks && p + 8 <= b.length; t++) {
    const id = str(4); p += 4;
    const len = u32();
    const end = Math.min(b.length, p + len);
    if (id !== 'MTrk') { p = end; continue; }
    let tick = 0, status = 0;
    while (p < end) {
      tick += vlq();
      let s = b[p];
      if (s & 0x80) p++; else s = status; // running status
      if (s === 0xff) {
        const type = b[p++]; const l = vlq(); const d = p; p += l;
        if (type === 0x51 && l === 3) tempos.push({ tick, uspq: b[d] << 16 | b[d + 1] << 8 | b[d + 2] });
        else if (type === 0x58 && l >= 2) timeSigs.push({ tick, num: b[d], den: 2 ** b[d + 1] });
        else if (type === 0x03) { let n = ''; for (let i = 0; i < l; i++) n += String.fromCharCode(b[d + i]); names.push(n); }
        else if (type === 0x2f) break;
        continue;
      }
      if (s === 0xf0 || s === 0xf7) { p += vlq(); continue; }
      status = s;
      const kind = s & 0xf0, ch = s & 0x0f;
      if (kind === 0xc0 || kind === 0xd0) { p += 1; continue; }
      const d1 = b[p++], d2 = b[p++];
      if (kind === 0x90 && d2 > 0) notes.push({ tick, ch, note: d1, vel: d2 });
    }
    p = end;
  }
  notes.sort((a, b2) => a.tick - b2.tick);
  tempos.sort((a, b2) => a.tick - b2.tick);
  return { format, division, notes, tempos, timeSigs, names };
}

// Notes General MIDI de batterie (canal 10) → échantillons du kit (kit/).
export const GM_DRUMS = {
  35: 'kick', 36: 'kick',
  37: 'sidestick', 38: 'snare', 39: 'snare', 40: 'snare',
  42: 'hh', 44: 'hh-pedal', 46: 'hh-open', 54: 'hh',
  49: 'crash', 52: 'crash', 55: 'crash', 57: 'crash',
  51: 'ride', 59: 'ride', 53: 'ride-bell',
  41: 'tom-floor', 43: 'tom-floor', 45: 'tom-floor',
  47: 'tom-high', 48: 'tom-high', 50: 'tom-high',
};
const DRUM_CH = 9;

// Tempo factice des fichiers re-générés : un seul tempo à 60 BPM et 1000
// ticks par noire, ou la signature « Project Los Angeles » dans les noms.
export function isFakeTempo(m) {
  if (m.names.some((n) => /project los angeles/i.test(n))) return true;
  return m.division === 1000 && m.tempos.length > 0 && m.tempos.every((t) => t.uspq === 1000000);
}

// Instant (s) de chaque tick, en suivant la carte des tempos (120 par défaut).
function tickToSec(m) {
  const segs = [];
  let lastTick = 0, lastSec = 0, uspq = 500000;
  for (const t of m.tempos) {
    lastSec += ((t.tick - lastTick) * uspq) / (m.division * 1e6);
    lastTick = t.tick; uspq = t.uspq;
    segs.push({ tick: lastTick, sec: lastSec, uspq });
  }
  return (tick) => {
    let s = { tick: 0, sec: 0, uspq: 500000 };
    for (const g of segs) { if (g.tick <= tick) s = g; else break; }
    return s.sec + ((tick - s.tick) * s.uspq) / (m.division * 1e6);
  };
}

// Cohérence (0..1) des instants avec une grille de pas `step` secondes :
// longueur du vecteur moyen des phases. 1 = toutes les frappes sur la grille.
function coherence(times, step) {
  let c = 0, s = 0;
  const k = (2 * Math.PI) / step;
  for (const t of times) { c += Math.cos(k * t); s += Math.sin(k * t); }
  return { r: Math.hypot(c, s) / times.length, phase: ((Math.atan2(s, c) / k) + step) % step };
}

// BPM d'une suite de frappes (s), sur une grille de croches. Une grille plus
// fine colle toujours au moins aussi bien : sans indice, on garde le tempo le
// plus LENT dont le score atteint 92 % du meilleur. Avec indice (BPM connu),
// on affine seulement autour de lui (±6 %).
export function estimateBpm(times, { hint = null, min = 60, max = 200 } = {}) {
  if (times.length < 8) return null;
  const score = (bpm) => coherence(times, 30 / bpm).r; // croche = 30/bpm s
  let lo = min, hi = max;
  if (hint) { lo = hint * 0.94; hi = hint * 1.06; }
  const cands = [];
  for (let bpm = lo; bpm <= hi; bpm += 0.25) cands.push({ bpm, r: score(bpm) });
  const best = Math.max(...cands.map((c) => c.r));
  const pick = hint ? cands.find((c) => c.r === best) : cands.find((c) => c.r >= best * 0.92);
  // Affinage fin autour du candidat retenu.
  let top = pick;
  for (let bpm = pick.bpm - 0.25; bpm <= pick.bpm + 0.25; bpm += 0.01) {
    const r = score(bpm);
    if (r > top.r) top = { bpm, r };
  }
  return { bpm: Math.round(top.bpm * 100) / 100, confidence: top.r };
}

// Construit la partie de batterie découpée en mesures.
//   bpm         : BPM réel (obligatoire pour un fichier re-généré, ignoré sinon)
//   beatsPerBar : temps par mesure si le fichier n'en indique pas (défaut 4)
// Renvoie { bars: [[{ t, inst, v }]], beatsPerBar, totalBars, bpm, fake }.
// La mesure 0 est la première mesure qui contient une note (tous canaux) :
// les mesures vides du début sont retirées, les silences de batterie en
// cours de morceau (intro guitare…) sont conservés pour rester calé.
export function buildDrumTrack(m, { bpm = null, beatsPerBar = 4 } = {}) {
  const drums = m.notes.filter((n) => n.ch === DRUM_CH && GM_DRUMS[n.note]);
  if (drums.length === 0) throw new Error('Pas de batterie (canal 10) dans ce fichier MIDI');
  const fake = isFakeTempo(m);
  let toBeat, bpb, usedBpm = bpm;

  if (!fake) {
    const ts = m.timeSigs[0];
    bpb = ts ? Math.max(1, Math.round((ts.num * 4) / ts.den)) : beatsPerBar;
    const barTicks = m.division * bpb;
    const origin = Math.floor(m.notes[0].tick / barTicks) * barTicks;
    toBeat = (tick) => (tick - origin) / m.division;
  } else {
    bpb = beatsPerBar;
    const sec = tickToSec(m);
    const times = drums.map((n) => sec(n.tick));
    const est = estimateBpm(times, { hint: bpm });
    if (!est) throw new Error('Trop peu de frappes pour caler le tempo');
    usedBpm = est.bpm;
    const beatSec = 60 / usedBpm, eighth = beatSec / 2;
    const { phase } = coherence(times, eighth);
    // Temps 1 : parmi les 2×bpb croches possibles de la mesure, celle qui met le
    // plus de grosse caisse sur les temps forts et de caisse claire sur 2 et 4.
    const slot = (t) => Math.round((t - phase) / eighth);
    let bestK = 0, bestS = -1;
    for (let k = 0; k < 2 * bpb; k++) {
      let s = 0;
      drums.forEach((n, i) => {
        const pos = (((slot(times[i]) - k) % (2 * bpb)) + 2 * bpb) % (2 * bpb);
        const inst = GM_DRUMS[n.note];
        if (inst === 'kick' && pos === 0) s += 2;
        else if (inst === 'kick' && pos === bpb) s += 1;
        else if (inst === 'snare' && pos % 4 === 2) s += 1.5;
      });
      if (s > bestS) { bestS = s; bestK = k; }
    }
    const barSec = beatSec * bpb;
    // Dernier temps 1 situé avant (ou 20 ms après) la toute première note.
    const first = sec(m.notes[0].tick);
    const d0 = phase + bestK * eighth;
    const downbeat = d0 + Math.floor((first + 0.02 - d0) / barSec) * barSec;
    toBeat = (tick) => (sec(tick) - downbeat) / beatSec;
  }

  const bars = [];
  for (const n of drums) {
    const beat = toBeat(n.tick);
    if (beat < -0.25) continue;
    const bar = Math.max(0, Math.floor((beat + 0.02) / bpb)); // tolérance : une frappe 20 ms en avance reste dans sa mesure
    (bars[bar] ||= []).push({ t: Math.max(0, beat - bar * bpb), inst: GM_DRUMS[n.note], v: n.vel / 127 });
  }
  for (let i = 0; i < bars.length; i++) bars[i] ||= [];
  return { bars, beatsPerBar: bpb, totalBars: bars.length, bpm: usedBpm, fake };
}
