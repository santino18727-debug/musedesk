// midisearch.js — Recherche d'un MIDI par titre + artiste (espace Hugging Face
// asigalov61/MIDI-Search, Los Angeles MIDI Dataset / Lakh MIDI).
// ---------------------------------------------------------------------------
// API Gradio appelée en fetch brut, sans jeton (CORS ouvert, vérifié le 22.11.2026) :
//   1. POST /gradio_api/call/find_midi  {"data":[titre, artiste]}  → { event_id }
//   2. GET  /gradio_api/call/find_midi/<event_id>  → flux SSE ; « event: complete »
//      porte `data: [titre trouvé, top 10, fichier .mid, .wav, graphique]`.
//   3. Le fichier : /gradio_api/file=<path>. Le champ `url` renvoyé contient
//      un « /gra/ » qui rend du HTML : on reconstruit l'URL depuis `path`.
// Compter 51 à 78 s par requête (mesuré) : l'appelant affiche une progression.
// Source : PRD brain reference/prd-musedesk-option-batterie.md + capture du 22.11.
// ---------------------------------------------------------------------------

export const MIDI_SEARCH_HOST = 'https://asigalov61-midi-search.hf.space';

// Dernier événement terminal d'un flux SSE Gradio : { event, data } (data parsé).
export function parseSseResult(text) {
  let result = null;
  for (const block of String(text).split(/\r?\n\r?\n/)) {
    let event = '', data = '';
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (event === 'complete' || event === 'error') {
      let parsed = null;
      try { parsed = data ? JSON.parse(data) : null; } catch { parsed = data; }
      result = { event, data: parsed };
    }
  }
  return result;
}

// Chemin du fichier .mid dans la sortie (recherche en profondeur).
export function pickMidiPath(data) {
  let found = null;
  const walk = (v) => {
    if (found || !v || typeof v !== 'object') return;
    if (typeof v.path === 'string' && /\.midi?$/i.test(v.path)) { found = v.path; return; }
    for (const k of Object.keys(v)) walk(v[k]);
  };
  walk(data);
  return found;
}

export function midiFileUrl(path) {
  return `${MIDI_SEARCH_HOST}/gradio_api/file=${path.split('/').map(encodeURIComponent).join('/')}`;
}

// Recherche + téléchargement. onPhase('search' | 'download'). Lève une Error
// au message lisible (affiché tel quel à l'utilisateur).
export async function findMidi(title, artist, { signal, onPhase, fetchImpl = fetch } = {}) {
  onPhase?.('search');
  let res;
  try {
    res = await fetchImpl(`${MIDI_SEARCH_HOST}/gradio_api/call/find_midi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [title, artist || ''] }),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('Service MIDI-Search injoignable (hors ligne ?)');
  }
  if (!res.ok) throw new Error(`MIDI-Search indisponible (${res.status})`);
  const { event_id: id } = await res.json();
  if (!id) throw new Error('Réponse inattendue de MIDI-Search');

  const sse = await fetchImpl(`${MIDI_SEARCH_HOST}/gradio_api/call/find_midi/${encodeURIComponent(id)}`, { signal });
  if (!sse.ok) throw new Error(`MIDI-Search indisponible (${sse.status})`);
  const out = parseSseResult(await sse.text());
  if (!out || out.event !== 'complete') throw new Error('MIDI-Search n’a rien trouvé (ou a échoué)');
  const path = pickMidiPath(out.data);
  if (!path) throw new Error('Aucun fichier MIDI dans la réponse');
  const matched = Array.isArray(out.data) && typeof out.data[0] === 'string' ? out.data[0] : '';

  onPhase?.('download');
  const file = await fetchImpl(midiFileUrl(path), { signal });
  if (!file.ok) throw new Error(`Téléchargement du MIDI impossible (${file.status})`);
  const bytes = await file.arrayBuffer();
  return { bytes, matched, name: path.split('/').pop() };
}
