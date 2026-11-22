// getsongbpm.js — Tempo d'un morceau via l'API GetSongBPM (api.getsong.co)
// ---------------------------------------------------------------------------
// Doc : https://getsongbpm.com/api (v1.3). GET /search/?type=both&lookup=
//   song:<titre> artist:<artiste> → { search: [ { id, title, uri, tempo, artist: { name } } ] }
//   Aucun résultat : { search: { error: "no result" } }.
// Clé passée en paramètre d'URL (api_key) plutôt qu'en en-tête X-API-KEY :
// requête « simple », pas de pré-vol CORS. Licence des données : CC BY 4.0,
// lien vers getsongbpm.com obligatoire (affiché à côté du tempo + À propos).
// ---------------------------------------------------------------------------

export const GETSONGBPM_HOST = 'https://api.getsong.co';

export function buildSearchUrl(title, artist, apiKey) {
  const p = new URLSearchParams({ api_key: apiKey });
  if (artist) { p.set('type', 'both'); p.set('lookup', `song:${title} artist:${artist}`); }
  else { p.set('type', 'song'); p.set('lookup', title); }
  p.set('limit', '10');
  return `${GETSONGBPM_HOST}/search/?${p}`;
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/^the\s+/, '').replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Meilleur résultat : titre identique d'abord, puis artiste identique ; un
// tempo hors 40..240 est écarté. Renvoie { bpm, uri, title, artist } ou null.
export function pickTempo(json, title, artist) {
  const list = Array.isArray(json?.search) ? json.search : [];
  const t = norm(title), a = norm(artist);
  let best = null, bestScore = -1;
  for (const s of list) {
    const bpm = Math.round(Number(s.tempo));
    if (!Number.isFinite(bpm) || bpm < 40 || bpm > 240) continue;
    const st = norm(s.title), sa = norm(s.artist?.name);
    const titleScore = st === t ? 4 : st && (st.includes(t) || t.includes(st)) ? 2 : 0;
    if (!titleScore) continue; // titre sans rapport : on ne devine pas
    const score = titleScore
      + (a && sa === a ? 3 : a && (sa.includes(a) || a.includes(sa)) ? 1 : 0)
      + (/[([]/.test(s.title || '') ? 0 : 0.5); // version studio avant « (Live) », « [Remix] »…
    if (score > bestScore) { best = { bpm, uri: s.uri || 'https://getsongbpm.com', title: s.title, artist: s.artist?.name || '' }; bestScore = score; }
  }
  return best;
}

// null si pas de clé, rien trouvé ou service injoignable : le tempo reste
// alors à la saisie / au tap / à l'estimation MIDI. Seule l'annulation lève.
export async function fetchSongBpm(title, artist, { apiKey, signal, fetchImpl = fetch } = {}) {
  if (!apiKey || !title) return null;
  try {
    const res = await fetchImpl(buildSearchUrl(title, artist, apiKey), { signal });
    if (!res.ok) return null;
    return pickTempo(await res.json(), title, artist);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.warn('GetSongBPM :', err);
    return null;
  }
}
