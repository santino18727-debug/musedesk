import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMidi, buildDrumTrack, estimateBpm, isFakeTempo, GM_DRUMS } from './midi.js';
import { KIT_SAMPLES } from './drums.js';

// --- Petit écrivain SMF pour fabriquer des fichiers de test -----------------
const vlq = (n) => { const out = [n & 0x7f]; while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80); return out; };
const u32 = (n) => [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255];
function track(events) { // events : [{ tick, bytes }]
  events.sort((a, b) => a.tick - b.tick);
  const data = []; let last = 0;
  for (const e of events) { data.push(...vlq(e.tick - last), ...e.bytes); last = e.tick; }
  data.push(0, 0xff, 0x2f, 0);
  return [...[0x4d, 0x54, 0x72, 0x6b], ...u32(data.length), ...data];
}
function smf(division, tracks) {
  return new Uint8Array([0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 1, 0, tracks.length, division >> 8, division & 255, ...tracks.flat()]);
}
const on = (tick, ch, note, vel = 100) => ({ tick, bytes: [0x90 | ch, note, vel] });
const off = (tick, ch, note) => ({ tick, bytes: [0x80 | ch, note, 0] });

// Rythme rock sur `bars` mesures : kick 1 et 3, caisse 2 et 4, charleston en croches.
function rock(bars, at) { // at(beat) → tick
  const ev = [];
  for (let b = 0; b < bars * 4; b += 0.5) {
    ev.push(on(at(b), 9, 42, 80), off(at(b) + 10, 9, 42));
    if (b % 2 === 0) ev.push(on(at(b), 9, 36, 110));
    if (b % 2 === 1) ev.push(on(at(b), 9, 38, 105));
  }
  return ev;
}

test('MIDI réel (division 480) : temps lus directement, mesures vides du début retirées', () => {
  const ppq = 480;
  const lead = 2 * 4 * ppq; // deux mesures vides
  const bytes = smf(ppq, [
    track([{ tick: 0, bytes: [0xff, 0x51, 3, 0x07, 0xa1, 0x20] }, { tick: 0, bytes: [0xff, 0x58, 4, 4, 2, 24, 8] }]),
    track(rock(8, (beat) => lead + Math.round(beat * ppq))),
  ]);
  const m = parseMidi(bytes);
  assert.equal(m.division, 480);
  assert.equal(isFakeTempo(m), false);
  const tr = buildDrumTrack(m);
  assert.equal(tr.beatsPerBar, 4);
  assert.equal(tr.totalBars, 8);
  assert.deepEqual(tr.bars[0].filter((e) => e.inst === 'snare').map((e) => e.t), [1, 3]);
});

test('running status et note-on vélocité 0 = note-off', () => {
  const t = [0x4d, 0x54, 0x72, 0x6b];
  const data = [0, 0x99, 36, 100, 10, 36, 0, 10, 38, 90, 0, 0xff, 0x2f, 0];
  const bytes = new Uint8Array([0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 0, 0, 1, 1, 0xe0, ...t, ...u32(data.length), ...data]);
  const m = parseMidi(bytes);
  assert.deepEqual(m.notes.map((n) => [n.tick, n.note]), [[0, 36], [20, 38]]);
});

test('fichier re-généré (1 tick = 1 ms, tempo factice 60) : BPM retrouvé et temps 1 calé', () => {
  const bpm = 74, beatMs = 60000 / bpm, start = 1230; // la batterie démarre à 1,23 s
  const ms = (beat) => Math.round(start + beat * beatMs + (beat % 1 ? 3 : -2)); // petit flottement humain
  const bytes = smf(1000, [
    track([{ tick: 0, bytes: [0xff, 0x51, 3, 0x0f, 0x42, 0x40] }, { tick: 0, bytes: [0xff, 0x03, 19, ...Buffer.from('Project Los Angeles')] }]),
    track([on(start, 0, 64), off(start + 400, 0, 64), ...rock(16, ms)]),
  ]);
  const m = parseMidi(bytes);
  assert.equal(isFakeTempo(m), true);
  assert.ok(Math.abs(buildDrumTrack(m).bpm - bpm) < 0.3, 'sans indice');
  const tr = buildDrumTrack(m, { bpm: 75 }); // indice approximatif (GetSongBPM / saisie)
  assert.ok(Math.abs(tr.bpm - bpm) < 0.3, `bpm ${tr.bpm}`);
  assert.equal(tr.totalBars, 16);
  const kicks = tr.bars[3].filter((e) => e.inst === 'kick').map((e) => Math.round(e.t * 4) / 4);
  assert.deepEqual(kicks, [0, 2]);
});

test('estimateBpm sans indice : garde le tempo lent plutôt que le double', () => {
  const beat = 60 / 96;
  const times = [];
  for (let b = 0; b < 64; b += 0.5) times.push(b * beat);
  const est = estimateBpm(times);
  assert.ok(Math.abs(est.bpm - 96) < 0.2, `bpm ${est.bpm}`);
});

test('pas de batterie → erreur explicite', () => {
  const bytes = smf(480, [track([on(0, 0, 60), off(480, 0, 60)])]);
  assert.throws(() => buildDrumTrack(parseMidi(bytes)), /batterie/);
});

test('pas un MIDI → erreur explicite', () => {
  assert.throws(() => parseMidi(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])), /MIDI/);
});

test('chaque note GM mappée existe dans le kit', () => {
  for (const s of new Set(Object.values(GM_DRUMS))) assert.ok(KIT_SAMPLES.includes(s), s);
});
