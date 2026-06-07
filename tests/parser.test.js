import test from 'node:test';
import assert from 'node:assert/strict';
import { transposeChord } from '../parser.js';

test('transposeChord', async (t) => {
  await t.test('should return the original chord if semitones is falsy', () => {
    assert.equal(transposeChord('C', 0), 'C');
    assert.equal(transposeChord('Am', null), 'Am');
    assert.equal(transposeChord('G7', undefined), 'G7');
  });

  await t.test('should transpose simple chords correctly (positive)', () => {
    assert.equal(transposeChord('C', 2), 'D');
    assert.equal(transposeChord('G', 5), 'C');
    assert.equal(transposeChord('A', 12), 'A');
  });

  await t.test('should transpose simple chords correctly (negative)', () => {
    assert.equal(transposeChord('C', -1), 'B');
    assert.equal(transposeChord('D', -2), 'C');
    assert.equal(transposeChord('A', -12), 'A');
  });

  await t.test('should handle chords with suffixes', () => {
    assert.equal(transposeChord('Cm7', 2), 'Dm7');
    assert.equal(transposeChord('F#m11', -2), 'Em11');
    assert.equal(transposeChord('Bbmaj7', 2), 'Cmaj7');
    assert.equal(transposeChord('Dsus4', 5), 'Gsus4');
  });

  await t.test('should convert flat roots to sharp equivalents', () => {
    assert.equal(transposeChord('Db', 2), 'D#');
    assert.equal(transposeChord('Eb', 0), 'Eb'); // Note: if semitones is 0, it doesn't convert
    assert.equal(transposeChord('Eb', 1), 'E');
    assert.equal(transposeChord('Gb', -1), 'F');
    assert.equal(transposeChord('Ab', 2), 'A#');
    assert.equal(transposeChord('Bb', 2), 'C');
  });

  await t.test('should transpose slash chords (both root and bass note)', () => {
    assert.equal(transposeChord('C/E', 2), 'D/F#');
    assert.equal(transposeChord('G/B', 5), 'C/E');
    assert.equal(transposeChord('F#m/C#', -2), 'Em/B');
    assert.equal(transposeChord('Bb/D', 2), 'C/E');
  });

  await t.test('should handle unrecognized notes or edge cases gracefully', () => {
    // Unrecognized root note letter (not A-G)
    assert.equal(transposeChord('H', 2), 'H');
    assert.equal(transposeChord('Zmaj7', 1), 'Zmaj7');

    // Flat notes not in the FLAT_TO_SHARP dictionary (e.g., Cb, Fb)
    // Cb matches regex as "Cb", not in FLAT_TO_SHARP, SCALE.indexOf("Cb") is -1, returns "Cb"
    assert.equal(transposeChord('Cb', 2), 'Cb');
    assert.equal(transposeChord('Fb', -1), 'Fb');
  });
});
