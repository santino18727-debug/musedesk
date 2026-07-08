import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { titleFromFilename } from './pdfimport.js';

describe('pdfimport.js tests', () => {
  describe('titleFromFilename()', () => {
    test('happy path: "Artist - Title.pdf"', () => {
      assert.deepStrictEqual(titleFromFilename('The Beatles - Let It Be.pdf'), {
        artist: 'The Beatles',
        title: 'Let It Be'
      });
    });

    test('filenames with multiple hyphens: "Artist - Title - Live.pdf"', () => {
      assert.deepStrictEqual(titleFromFilename('Nirvana - Smells Like Teen Spirit - Live.pdf'), {
        artist: 'Nirvana',
        title: 'Smells Like Teen Spirit - Live'
      });
    });

    test('filenames with underscores: "Artist_-_Title.pdf"', () => {
      assert.deepStrictEqual(titleFromFilename('Queen_-_Bohemian_Rhapsody.pdf'), {
        artist: 'Queen',
        title: 'Bohemian Rhapsody'
      });
      // also test a mix
      assert.deepStrictEqual(titleFromFilename('Pink_Floyd - Comfortably_Numb.pdf'), {
        artist: 'Pink Floyd',
        title: 'Comfortably Numb'
      });
    });

    test('filenames without an artist: "Just a Title.pdf"', () => {
      assert.deepStrictEqual(titleFromFilename('Hallelujah.pdf'), {
        artist: '',
        title: 'Hallelujah'
      });
      assert.deepStrictEqual(titleFromFilename('Hallelujah'), {
        artist: '',
        title: 'Hallelujah'
      });
    });

    test('extension removal case-insensitivity: ".pdf", ".PDF"', () => {
      assert.deepStrictEqual(titleFromFilename('Coldplay - Yellow.PDF'), {
        artist: 'Coldplay',
        title: 'Yellow'
      });
      assert.deepStrictEqual(titleFromFilename('Coldplay - Yellow.pDf'), {
        artist: 'Coldplay',
        title: 'Yellow'
      });
    });

    test('edge cases: empty string, null, and undefined inputs', () => {
      assert.deepStrictEqual(titleFromFilename(''), {
        artist: '',
        title: ''
      });
      assert.deepStrictEqual(titleFromFilename(null), {
        artist: '',
        title: ''
      });
      assert.deepStrictEqual(titleFromFilename(undefined), {
        artist: '',
        title: ''
      });
    });

    test('trimming of whitespace', () => {
       assert.deepStrictEqual(titleFromFilename('  Oasis   -   Wonderwall   .pdf  '), {
           artist: 'Oasis',
           title: 'Wonderwall'
       });
    });
  });
});
