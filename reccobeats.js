// reccobeats.js — Tempo d'un morceau via l'API ReccoBeats (api.reccobeats.com)
// ---------------------------------------------------------------------------
// Sans clé, CORS ouvert (vérifié le 2026-11-23 depuis le navigateur) :
//   GET /v1/track/search?searchText=<titre>&size=50&page=N
//     → { content: [ { id, trackTitle, artists: [ { name } ], href } ], totalPages }
//     La recherche porte sur le titre seul : l'artiste est filtré ici.
//   GET /v1/track/<id>/audio-features → { tempo, … }
// Le tempo vient d'une analyse audio et tombe parfois au double (Hotel
// California → 144 au lieu de 74) : l'appelant le recale sur le MIDI.
// ---------------------------------------------------------------------------

import { matchScore } from './getsongbpm.js?v=36';

export const RECCOBEATS_HOST = 'https://api.reccobeats.com';
const PAGES = 2; // le bon artiste est parfois en page 2 (Wonderwall / Oasis)

export function buildSearchUrl(title, page = 0) {
  const p = new URLSearchParams({ searchText: title, size: '50', page: String(page) });
  return `${RECCOBEATS_HOST}/v1/track/search?${p}`;
}

// Meilleur morceau d'une page de résultats : { track, score } ou null.
export function pickTrack(json, title, artist) {
  let best = null;
  for (const tr of Array.isArray(json?.content) ? json.content : []) {
    const names = (tr.artists || []).map((x) => x.name);
    const score = Math.max(0, ...names.map((n) => matchScore(tr.trackTitle, n, title, artist)),
      names.length ? 0 : matchScore(tr.trackTitle, '', title, artist));
    if (score > (best?.score ?? 0)) best = { track: tr, score };
  }
  return best;
}

// null si rien trouvé ou service injoignable ; seule l'annulation lève.
export async function fetchReccoBpm(title, artist, { signal, fetchImpl = fetch } = {}) {
  if (!title) return null;
  try {
    let best = null;
    for (let page = 0; page < PAGES; page++) {
      const res = await fetchImpl(buildSearchUrl(title, page), { signal });
      if (!res.ok) break;
      const json = await res.json();
      const hit = pickTrack(json, title, artist);
      if (hit && hit.score > (best?.score ?? 0)) best = hit;
      // Titre et artiste identiques (4 + 3) : inutile de lire la page suivante.
      if ((best && best.score >= 7) || page + 1 >= (json.totalPages ?? 1)) break;
    }
    if (!best) return null;
    const res = await fetchImpl(`${RECCOBEATS_HOST}/v1/track/${encodeURIComponent(best.track.id)}/audio-features`, { signal });
    if (!res.ok) return null;
    const bpm = Math.round(Number((await res.json()).tempo));
    if (!Number.isFinite(bpm) || bpm < 40 || bpm > 240) return null;
    const tr = best.track;
    return { bpm, uri: 'https://reccobeats.com', title: tr.trackTitle, artist: tr.artists?.[0]?.name || '', source: 'ReccoBeats' };
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.warn('ReccoBeats :', err);
    return null;
  }
}
