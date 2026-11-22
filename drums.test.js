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
