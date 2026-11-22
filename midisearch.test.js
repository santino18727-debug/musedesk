import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSseResult, pickMidiPath, midiFileUrl, findMidi, MIDI_SEARCH_HOST } from './midisearch.js';

const OUTPUT = [
  'Hotel California --- Eagles',
  [['Hotel California --- Eagles', 0.99]],
  { path: '/tmp/gradio/abc/Hotel California --- Eagles.mid', url: `${MIDI_SEARCH_HOST}/gra/gradio_api/file=/tmp/x.mid`, meta: { _type: 'gradio.FileData' } },
  { path: '/tmp/gradio/abc/render.wav' },
  { plot: 'base64…' },
];
const SSE = `event: heartbeat\ndata: null\n\nevent: complete\ndata: ${JSON.stringify(OUTPUT)}\n\n`;

test('parseSseResult : dernier événement terminal', () => {
  const r = parseSseResult(SSE);
  assert.equal(r.event, 'complete');
  assert.equal(r.data[0], 'Hotel California --- Eagles');
  assert.equal(parseSseResult('event: error\ndata: null\n\n').event, 'error');
  assert.equal(parseSseResult('event: heartbeat\ndata: null\n\n'), null);
});

test('pickMidiPath + midiFileUrl : sans /gra/, espaces encodés', () => {
  const path = pickMidiPath(OUTPUT);
  assert.equal(path, '/tmp/gradio/abc/Hotel California --- Eagles.mid');
  const url = midiFileUrl(path);
  assert.equal(url, `${MIDI_SEARCH_HOST}/gradio_api/file=/tmp/gradio/abc/Hotel%20California%20---%20Eagles.mid`);
  assert.ok(!url.includes('/gra/'));
});

test('findMidi : enchaîne POST, SSE et téléchargement', async () => {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push([opts.method || 'GET', url]);
    if (url.endsWith('/call/find_midi')) return { ok: true, json: async () => ({ event_id: 'e1' }) };
    if (url.endsWith('/call/find_midi/e1')) return { ok: true, text: async () => SSE };
    return { ok: true, arrayBuffer: async () => new Uint8Array([0x4d]).buffer };
  };
  const phases = [];
  const r = await findMidi('Hotel California', 'Eagles', { fetchImpl, onPhase: (p) => phases.push(p) });
  assert.equal(r.matched, 'Hotel California --- Eagles');
  assert.equal(r.bytes.byteLength, 1);
  assert.deepEqual(phases, ['search', 'download']);
  assert.equal(calls[0][0], 'POST');
  assert.ok(calls[2][1].includes('Hotel%20California'));
});

test('findMidi : échec lisible', async () => {
  const fetchImpl = async (url) => url.endsWith('/call/find_midi')
    ? { ok: true, json: async () => ({ event_id: 'e1' }) }
    : { ok: true, text: async () => 'event: error\ndata: null\n\n' };
  await assert.rejects(findMidi('x', 'y', { fetchImpl }), /rien trouvé/);
});
