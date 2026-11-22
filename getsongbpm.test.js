import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchUrl, pickTempo, fetchSongBpm, GETSONGBPM_HOST } from './getsongbpm.js';

const RES = { search: [
  { id: 'a', title: 'Hotel California (Live)', uri: 'https://getsongbpm.com/song/x/a', tempo: '147', artist: { name: 'Eagles' } },
  { id: 'b', title: 'Hotel California', uri: 'https://getsongbpm.com/song/hotel-california/b', tempo: '75', artist: { name: 'Eagles' } },
  { id: 'c', title: 'Hotel California', uri: 'https://getsongbpm.com/song/y/c', tempo: '120', artist: { name: 'Gipsy Kings' } },
] };

test('buildSearchUrl : type both avec artiste, song sans', () => {
  const u = new URL(buildSearchUrl('Hotel California', 'Eagles', 'K'));
  assert.equal(u.origin, GETSONGBPM_HOST);
  assert.equal(u.pathname, '/search/');
  assert.equal(u.searchParams.get('type'), 'both');
  assert.equal(u.searchParams.get('lookup'), 'song:Hotel California artist:Eagles');
  assert.equal(u.searchParams.get('api_key'), 'K');
  assert.equal(new URL(buildSearchUrl('Wonderwall', '', 'K')).searchParams.get('type'), 'song');
});

test('pickTempo : titre et artiste exacts gagnent, tempo en chaîne accepté', () => {
  const r = pickTempo(RES, 'Hotel California', 'The Eagles');
  assert.equal(r.bpm, 75);
  assert.equal(r.uri, 'https://getsongbpm.com/song/hotel-california/b');
});

test('pickTempo : aucun résultat ou titre sans rapport → null', () => {
  assert.equal(pickTempo({ search: { error: 'no result' } }, 'x', 'y'), null);
  assert.equal(pickTempo({ search: [{ title: 'Autre chose', tempo: 100, artist: { name: 'Eagles' } }] }, 'Hotel California', 'Eagles'), null);
});

test('fetchSongBpm : sans clé, rien appelé ; erreur réseau → null', async () => {
  let called = 0;
  const fetchImpl = async () => { called++; throw new TypeError('Failed to fetch'); };
  assert.equal(await fetchSongBpm('a', 'b', { apiKey: '', fetchImpl }), null);
  assert.equal(called, 0);
  assert.equal(await fetchSongBpm('a', 'b', { apiKey: 'K', fetchImpl }), null);
  const ok = async () => ({ ok: true, json: async () => RES });
  assert.equal((await fetchSongBpm('Hotel California', 'Eagles', { apiKey: 'K', fetchImpl: ok })).bpm, 75);
});
