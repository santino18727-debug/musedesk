import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchUrl, pickTrack, fetchReccoBpm, RECCOBEATS_HOST } from './reccobeats.js';

const tr = (id, trackTitle, ...names) => ({ id, trackTitle, href: `https://open.spotify.com/track/${id}`, artists: names.map((name) => ({ name })) });

test('buildSearchUrl : titre seul, 50 par page', () => {
  const u = new URL(buildSearchUrl('Hotel California', 1));
  assert.equal(u.origin, RECCOBEATS_HOST);
  assert.equal(u.pathname, '/v1/track/search');
  assert.equal(u.searchParams.get('searchText'), 'Hotel California');
  assert.equal(u.searchParams.get('page'), '1');
});

test('pickTrack : bon artiste parmi plusieurs, même en 2e position', () => {
  const json = { content: [tr('j', 'Hotel California', 'Joji'), tr('e', 'Hotel California', 'Gipsy Kings', 'Eagles'), tr('x', 'Autre', 'Eagles')] };
  assert.equal(pickTrack(json, 'Hotel California', 'The Eagles').track.id, 'e');
  assert.equal(pickTrack({ content: [tr('x', 'Autre', 'Eagles')] }, 'Hotel California', 'Eagles'), null);
});

test('fetchReccoBpm : page 2 lue si besoin, tempo arrondi, source', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const u = new URL(url);
    if (u.pathname.endsWith('/audio-features')) return { ok: true, json: async () => ({ tempo: 174.497 }) };
    const page = u.searchParams.get('page');
    const content = page === '0' ? [tr('a', 'Wonderwall', 'Ryan Adams')] : [tr('o', 'Wonderwall', 'Oasis')];
    return { ok: true, json: async () => ({ content, totalPages: 4 }) };
  };
  const r = await fetchReccoBpm('Wonderwall', 'Oasis', { fetchImpl });
  assert.deepEqual([r.bpm, r.source, r.uri], [174, 'ReccoBeats', 'https://reccobeats.com']);
  assert.equal(calls.length, 3);
});

test('fetchReccoBpm : rien trouvé ou réseau coupé → null, annulation → lève', async () => {
  assert.equal(await fetchReccoBpm('x', 'y', { fetchImpl: async () => ({ ok: true, json: async () => ({ content: [] }) }) }), null);
  assert.equal(await fetchReccoBpm('x', 'y', { fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }), null);
  const abort = async () => { const e = new Error('stop'); e.name = 'AbortError'; throw e; };
  await assert.rejects(fetchReccoBpm('x', 'y', { fetchImpl: abort }), { name: 'AbortError' });
});
