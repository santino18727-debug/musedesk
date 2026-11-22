import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDrums, normalizeBpm, bpmFromTaps, beatsPerBar, DRUM_DEFAULTS,
} from './drums.js';

test('normalizeDrums : absent ou corrompu → valeurs par défaut', () => {
  assert.deepEqual(normalizeDrums(undefined), { ...DRUM_DEFAULTS });
  assert.deepEqual(normalizeDrums('x'), { ...DRUM_DEFAULTS });
  assert.deepEqual(
    normalizeDrums({ enabled: 'oui', intro: 'abc', impro: null, style: 'disco' }),
    { ...DRUM_DEFAULTS, impro: 0 },
  );
});

test('normalizeDrums : bornes et arrondis', () => {
  const d = normalizeDrums({ enabled: true, intro: 99.4, impro: -5, style: 'valse' });
  assert.deepEqual(d, { enabled: true, intro: 64, impro: 0, style: 'valse' });
  assert.equal(normalizeDrums({ intro: 2.6 }).intro, 3);
});

test('normalizeBpm : hors plage → null', () => {
  assert.equal(normalizeBpm(120.4), 120);
  assert.equal(normalizeBpm(39), null);
  assert.equal(normalizeBpm(241), null);
  assert.equal(normalizeBpm(''), null);
});

test('beatsPerBar : valse en 3, sinon 4', () => {
  assert.equal(beatsPerBar('valse'), 3);
  assert.equal(beatsPerBar('rock'), 4);
  assert.equal(beatsPerBar('inconnu'), 4);
});

test('bpmFromTaps : régulier à 500 ms → 120', () => {
  assert.equal(bpmFromTaps([0, 500, 1000, 1500]), 120);
  assert.equal(bpmFromTaps([0]), null);
  // une pause > 3 s relance la série
  assert.equal(bpmFromTaps([0, 400, 5000, 5600, 6200]), 100);
});

import { generateBar, isFillBar, pickSample, STYLE_PATTERNS, KIT_SAMPLES } from './drums.js';
import { existsSync } from 'node:fs';

test('grilles : chaque piste a exactement `steps` pas', () => {
  for (const [style, p] of Object.entries(STYLE_PATTERNS)) {
    for (const [inst, row] of Object.entries(p.tracks)) {
      assert.equal(row.length, p.steps, `${style}/${inst}`);
    }
  }
});

test('generateBar : impro 0 = grille fidèle, déterministe, sans décalage', () => {
  const a = generateBar('rock', 2, { impro: 0 });
  assert.deepEqual(a, generateBar('rock', 2, { impro: 0 }));
  assert.ok(a.every((e) => e.jit === 0));
  assert.equal(a.filter((e) => e.inst === 'snare').length, 2);       // temps 2 et 4
  assert.deepEqual(a.filter((e) => e.inst === 'snare').map((e) => e.t), [1, 3]);
  assert.ok(a.every((e) => e.t >= 0 && e.t < 4));
});

test('generateBar : valse sur 3 temps', () => {
  assert.ok(generateBar('valse', 0).every((e) => e.t < 3));
});

test('roulements : jamais à 0, toutes les 8 mesures sous 50, toutes les 4 au-delà', () => {
  const fills = (impro) => [...Array(16).keys()].filter((b) => isFillBar(b, impro, 0));
  assert.deepEqual(fills(0), []);
  assert.deepEqual(fills(30), [7, 15]);
  assert.deepEqual(fills(80), [3, 7, 11, 15]);
  // intro de 4 mesures : roulement d'entrée sur la 4e, phrases comptées après
  assert.ok(isFillBar(3, 30, 4));
  assert.ok(isFillBar(11, 30, 4));
});

test('crash à l’entrée du chanteur, même à impro 0', () => {
  assert.ok(generateBar('pop', 4, { impro: 0, introBars: 4 }).some((e) => e.inst === 'crash' && e.t === 0));
  assert.ok(!generateBar('pop', 5, { impro: 0, introBars: 4 }).some((e) => e.inst === 'crash'));
});

test('chaque échantillon choisi existe dans kit/', () => {
  const used = new Set();
  for (const style of Object.keys(STYLE_PATTERNS)) {
    for (let bar = 0; bar < 16; bar++) {
      for (const e of generateBar(style, bar, { impro: 100, introBars: 2 })) used.add(pickSample(e.inst, e.v));
    }
  }
  for (const s of used) assert.ok(KIT_SAMPLES.includes(s), s);
  for (const s of KIT_SAMPLES) assert.ok(existsSync(new URL(`./kit/${s}.mp3`, import.meta.url)), s);
});
