import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { renderSongHTML } from './parser.js';

describe('renderSongHTML', () => {
  test('renders empty string as a single line-space', () => {
    const html = renderSongHTML('');
    assert.equal(html, '<div class="line-space"></div>');
  });

  test('renders section headers', () => {
    const html = renderSongHTML('[Verse 1]');
    assert.equal(html, '<div class="section">Verse 1</div>');
  });

  test('renders lyrics without chords', () => {
    const html = renderSongHTML('Hello world');
    assert.equal(html, '<div class="line"><span class="unit"><span class="chord"></span><span class="lyric">Hello world</span></span></div>');
  });

  test('renders ChordPro inline chords', () => {
    const html = renderSongHTML('[C]Hello [G]world');
    const expected = '<div class="line">' +
      '<span class="unit"><span class="chord">C</span><span class="lyric">Hello </span></span>' +
      '<span class="unit"><span class="chord">G</span><span class="lyric">world</span></span>' +
      '</div>';
    assert.equal(html, expected);
  });

  test('renders Ultimate Guitar format', () => {
    const raw = `C       G
Hello   world`;
    const html = renderSongHTML(raw);
    const expected = '<div class="line">' +
      '<span class="unit"><span class="chord">C</span><span class="lyric">Hello   </span></span>' +
      '<span class="unit"><span class="chord">G</span><span class="lyric">world</span></span>' +
      '</div>';
    assert.equal(html, expected);
  });

  test('renders chords with transposition', () => {
    const html = renderSongHTML('[C]Hello [G]world', { semitones: 2 });
    const expected = '<div class="line">' +
      '<span class="unit"><span class="chord">D</span><span class="lyric">Hello </span></span>' +
      '<span class="unit"><span class="chord">A</span><span class="lyric">world</span></span>' +
      '</div>';
    assert.equal(html, expected);
  });

  test('escapes HTML to prevent XSS', () => {
    const html = renderSongHTML('[<script>alert(1)</script>]Hello <world>');
    const expected = '<div class="line">' +
      '<span class="unit"><span class="chord">&lt;script&gt;alert(1)&lt;/script&gt;</span><span class="lyric">Hello &lt;world&gt;</span></span>' +
      '</div>';
    assert.equal(html, expected);
  });
});
