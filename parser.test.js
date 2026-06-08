import test, { describe } from 'node:test';
import assert from 'node:assert';
import {
  isChord,
  parseSong,
  transposeChord,
  detectKey,
  renderSongHTML,
} from './parser.js';

describe('parser.js tests', () => {
  describe('isChord()', () => {
    test('valid simple chords', () => {
      assert.strictEqual(isChord('C'), true);
      assert.strictEqual(isChord('G'), true);
      assert.strictEqual(isChord('A#'), true);
      assert.strictEqual(isChord('Bb'), true);
    });

    test('valid complex chords', () => {
      assert.strictEqual(isChord('Am'), true);
      assert.strictEqual(isChord('Cmaj7'), true);
      assert.strictEqual(isChord('D/F#'), true);
      assert.strictEqual(isChord('Gsus4'), true);
      assert.strictEqual(isChord('F#m7b5'), true);
      assert.strictEqual(isChord('Cadd9'), true);
      assert.strictEqual(isChord('Bdim'), true);
      assert.strictEqual(isChord('C+'), true);
      assert.strictEqual(isChord('G(/B)'), false); // The parser does not match `(/B)` as a bass because the `/` must precede the base immediately.
    });

    test('invalid chords', () => {
      assert.strictEqual(isChord(''), false);
      assert.strictEqual(isChord(null), false);
      assert.strictEqual(isChord('Hello'), false);
      assert.strictEqual(isChord('[C]'), false);
      assert.strictEqual(isChord('H'), false);
      assert.strictEqual(isChord('C/H'), false); // Base note H is invalid
    });
  });

  describe('parseSong()', () => {
    test('empty or whitespace', () => {
      assert.deepStrictEqual(parseSong(''), [{ type: 'space' }]);
      assert.deepStrictEqual(parseSong('   '), [{ type: 'space' }]);
      assert.deepStrictEqual(parseSong('\n\n'), [
        { type: 'space' },
        { type: 'space' },
        { type: 'space' },
      ]);
    });

    test('sections', () => {
      assert.deepStrictEqual(parseSong('[Chorus]'), [{ type: 'section', label: 'Chorus' }]);
      assert.deepStrictEqual(parseSong('{title: My Song}'), [{ type: 'section', label: 'title: My Song' }]);
    });

    test('chordpro inline format', () => {
      const raw = '[C]Hello [G]world';
      const expected = [{
        type: 'line',
        segments: [
          { chord: 'C', text: 'Hello ' },
          { chord: 'G', text: 'world' }
        ]
      }];
      assert.deepStrictEqual(parseSong(raw), expected);
    });

    test('chordpro inline with no initial text', () => {
      const raw = 'Intro [C] [G]';
      const expected = [{
        type: 'line',
        segments: [
          { chord: '', text: 'Intro ' },
          { chord: 'C', text: ' ' },
          { chord: 'G', text: '' }
        ]
      }];
      assert.deepStrictEqual(parseSong(raw), expected);
    });

    test('ultimate guitar format (chords over lyrics)', () => {
      const raw = 'C     G\nHello world';
      const expected = [{
        type: 'line',
        segments: [
          { chord: 'C', text: 'Hello ' },
          { chord: 'G', text: 'world' }
        ]
      }];
      assert.deepStrictEqual(parseSong(raw), expected);
    });

    test('ultimate guitar format (chords over nothing)', () => {
      const raw = 'C G';
      const expected = [{
        type: 'line',
        segments: [
          { chord: 'C', text: '  ' }, // Needs to keep spacing
          { chord: 'G', text: '  ' }
        ]
      }];
      assert.deepStrictEqual(parseSong(raw), expected);
    });

    test('lyrics line without chords', () => {
      const raw = 'Just a normal line of text';
      const expected = [{
        type: 'line',
        segments: [
          { chord: '', text: 'Just a normal line of text' }
        ]
      }];
      assert.deepStrictEqual(parseSong(raw), expected);
    });
  });

  describe('transposeChord()', () => {
    test('positive transposition', () => {
      assert.strictEqual(transposeChord('C', 2), 'D');
      assert.strictEqual(transposeChord('C', 1), 'C#');
      assert.strictEqual(transposeChord('B', 1), 'C');
    });

    test('negative transposition', () => {
      assert.strictEqual(transposeChord('C', -1), 'B');
      assert.strictEqual(transposeChord('G', -2), 'F');
    });

    test('complex chords transposition', () => {
      assert.strictEqual(transposeChord('Am', 2), 'Bm');
      assert.strictEqual(transposeChord('Cmaj7', 2), 'Dmaj7');
      assert.strictEqual(transposeChord('D/F#', 2), 'E/G#');
      assert.strictEqual(transposeChord('Bb', 2), 'C');
    });

    test('zero or no transposition', () => {
      assert.strictEqual(transposeChord('C', 0), 'C');
      assert.strictEqual(transposeChord('C', undefined), 'C');
    });

    test('unknown chord part fallback', () => {
      assert.strictEqual(transposeChord('H', 2), 'H');
    });

    test('special no-chord cases', () => {
      assert.strictEqual(transposeChord('N.C.', 2), 'N.C.');
      assert.strictEqual(transposeChord('N.C.', -1), 'N.C.');
      assert.strictEqual(transposeChord('NC', 3), 'NC');
      assert.strictEqual(transposeChord('NC', -5), 'NC');
    });

    test('flat to sharp normalization', () => {
      assert.strictEqual(transposeChord('Db', 0), 'Db'); // Transposition with 0 returns original
      assert.strictEqual(transposeChord('Db', 1), 'D');
      assert.strictEqual(transposeChord('Eb', 1), 'E');
      assert.strictEqual(transposeChord('Gb', 1), 'G');
      assert.strictEqual(transposeChord('Ab', 1), 'A');
      assert.strictEqual(transposeChord('Bb', 1), 'B');

      assert.strictEqual(transposeChord('Db', -1), 'C');
      assert.strictEqual(transposeChord('Eb', -1), 'D');
    });

    test('large transposition intervals (modulo arithmetic)', () => {
      assert.strictEqual(transposeChord('C', 12), 'C');
      assert.strictEqual(transposeChord('C', 13), 'C#');
      assert.strictEqual(transposeChord('C', -12), 'C');
      assert.strictEqual(transposeChord('C', -13), 'B');
      assert.strictEqual(transposeChord('G', 24), 'G');
      assert.strictEqual(transposeChord('G', -24), 'G');
      assert.strictEqual(transposeChord('Am', 12), 'Am');
      assert.strictEqual(transposeChord('Am', -12), 'Am');
    });
  });

  describe('detectKey()', () => {
    test('simple key detection', () => {
      assert.strictEqual(detectKey('[C]Hello'), 'C');
      assert.strictEqual(detectKey('[Am]Hello'), 'Am');
    });

    test('skips non-chord elements', () => {
      assert.strictEqual(detectKey('Title\n[Chorus]\n[G]Hello'), 'G');
    });

    test('strips complex qualities', () => {
      assert.strictEqual(detectKey('[Cmaj7]Hello'), 'C');
      assert.strictEqual(detectKey('[F#m7b5]Hello'), 'F#m');
      assert.strictEqual(detectKey('[D/F#]Hello'), 'D');
    });

    test('returns empty string if no chords', () => {
      assert.strictEqual(detectKey('Just some text'), '');
    });
  });

  describe('renderSongHTML()', () => {
    test('renders sections and lines', () => {
      const raw = '[Verse]\n[C]Hello';
      const html = renderSongHTML(raw);
      assert.ok(html.includes('<div class="section">Verse</div>'));
      assert.ok(html.includes('<span class="chord">C</span>'));
      assert.ok(html.includes('<span class="lyric">Hello</span>'));
    });

    test('renders with transposition', () => {
      const raw = '[C]Hello';
      const html = renderSongHTML(raw, { semitones: 2 });
      assert.ok(html.includes('<span class="chord">D</span>')); // Transposed C to D
    });

    test('escapes HTML', () => {
      const raw = '[C]1 < 2 & 3 > 1';
      const html = renderSongHTML(raw);
      assert.ok(html.includes('&lt;'));
      assert.ok(html.includes('&gt;'));
      assert.ok(html.includes('&amp;'));
    });
  });
});
