// parser.js — Parser de grilles d'accords ChordPro + Ultimate Guitar
// ---------------------------------------------------------------------------
// Deux formats d'entrée supportés :
//   1) ChordPro inline    : "[C]Hello [G]world"
//   2) Ultimate Guitar     : ligne d'accords AU-DESSUS de la ligne de paroles
//                            "C       G"
//                            "Hello   world"
//
// Le parseur convertit TOUT vers un modèle interne unique : une liste de
// "lignes", chaque ligne étant une liste de segments { chord, text }.
// Ce modèle est :
//   - alignable proprement (chaque segment = un bloc inline-block chord/parole)
//   - prêt pour la transposition (il suffira de mapper segment.chord)
//   - reflow-friendly (les sauts de ligne se font entre segments)
//
// API publique :
//   parseSong(raw)        -> modèle interne (array d'items)
//   renderSongHTML(raw)   -> string HTML prête à injecter dans le DOM
//   transposeChord(c, n)  -> bonus : décale un accord de n demi-tons
// ---------------------------------------------------------------------------

// --- Détection d'accord -----------------------------------------------------

// Un accord = fondamentale [A-G] + altération (#/b) optionnelle
// + qualité/extension (m, maj, sus4, add9, 7, b5, etc.) + basse optionnelle (/E).
// Volontairement permissif : on préfère un faux positif rare à un raté.
export function isChord(token) {
  if (!token) return false;
  const m = token.match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/);
  if (!m) return false;
  const quality = m[2];
  // La qualité ne doit contenir que des caractères d'accord (pas de ponctuation/lettres de mots).
  return /^(m|maj|min|dim|aug|sus|add|M|°|ø|\+|\d|#|b|\(|\))*$/.test(quality);
}

// Une ligne est une "ligne d'accords" si TOUS ses tokens sont des accords.
function isChordLine(line) {
  const trimmed = line.trim();
  if (trimmed === '') return false;
  const tokens = trimmed.split(/\s+/);
  return tokens.every(isChord);
}

// --- HTML escape ------------------------------------------------------------

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// --- Parsing d'une ligne ChordPro inline ------------------------------------
// "[C]Hello [G]world" -> [{chord:'C', text:'Hello '}, {chord:'G', text:'world'}]
function parseChordPro(line) {
  const segs = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  let pendingChord = '';
  let m;
  while ((m = re.exec(line)) !== null) {
    const text = line.slice(last, m.index);
    if (segs.length === 0 && pendingChord === '') {
      if (text) segs.push({ chord: '', text }); // paroles avant le 1er accord
    } else {
      segs.push({ chord: pendingChord, text });
    }
    pendingChord = m[1];
    last = re.lastIndex;
  }
  segs.push({ chord: pendingChord, text: line.slice(last) });
  return segs;
}

// --- Parsing d'une paire ligne-accords / ligne-paroles (Ultimate Guitar) ----
// chordLine : "C       G"
// lyricLine : "Hello   world"
// On découpe les paroles aux colonnes où commencent les accords.
function parseChordOverLyric(chordLine, lyricLine) {
  const chords = [];
  const re = /(\S+)/g;
  let m;
  while ((m = re.exec(chordLine)) !== null) {
    chords.push({ chord: m[1], col: m.index });
  }
  if (chords.length === 0) {
    return [{ chord: '', text: lyricLine }];
  }
  const segs = [];
  // Paroles situées avant le premier accord
  if (chords[0].col > 0) {
    segs.push({ chord: '', text: lyricLine.slice(0, chords[0].col) });
  }
  for (let k = 0; k < chords.length; k++) {
    const start = chords[k].col;
    const end = k + 1 < chords.length
      ? chords[k + 1].col
      : Math.max(lyricLine.length, chordLine.length);
    let text = lyricLine.slice(start, end);
    if (text === '') text = ' '; // garantit une largeur sous l'accord (instrumental)
    segs.push({ chord: chords[k].chord, text });
  }
  return segs;
}

// --- Parsing complet d'un morceau ------------------------------------------
// Retourne une liste d'items : {type:'section'|'line'|'space', ...}
export function parseSong(raw) {
  const lines = String(raw || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Ligne vide -> espacement
    if (trimmed === '') {
      out.push({ type: 'space' });
      continue;
    }

    // En-tête de section [Verse], [Chorus]... (mais PAS un accord seul comme [Em])
    const sec = trimmed.match(/^\[([^\]]+)\]$/);
    if (sec && !isChord(sec[1])) {
      out.push({ type: 'section', label: sec[1] });
      continue;
    }

    // Directive ChordPro {title: ...} / {soc} -> traitée comme une section légère
    const dir = trimmed.match(/^\{(.+)\}$/);
    if (dir) {
      out.push({ type: 'section', label: dir[1] });
      continue;
    }

    // ChordPro inline (contient au moins un [xxx] dans la ligne)
    if (/\[[^\]]+\]/.test(line)) {
      out.push({ type: 'line', segments: parseChordPro(line) });
      continue;
    }

    // Ultimate Guitar : ligne d'accords suivie d'une ligne de paroles
    if (isChordLine(line)) {
      const next = lines[i + 1];
      const nextIsLyric =
        next !== undefined &&
        next.trim() !== '' &&
        !isChordLine(next) &&
        !/\[[^\]]+\]/.test(next);
      if (nextIsLyric) {
        out.push({ type: 'line', segments: parseChordOverLyric(line, next) });
        i++; // on consomme la ligne de paroles
      } else {
        // Accords sans paroles (intro/solo instrumental)
        out.push({ type: 'line', segments: parseChordOverLyric(line, '') });
      }
      continue;
    }

    // Ligne de paroles simple
    out.push({ type: 'line', segments: [{ chord: '', text: line }] });
  }

  return out;
}

// --- Rendu HTML -------------------------------------------------------------

function renderSegments(segs) {
  return segs
    .map((s) => {
      const chord = `<span class="chord">${s.chord ? esc(s.chord) : ''}</span>`;
      const lyric = `<span class="lyric">${s.text ? esc(s.text) : '&nbsp;'}</span>`;
      return `<span class="unit">${chord}${lyric}</span>`;
    })
    .join('');
}

export function renderSongHTML(raw) {
  return parseSong(raw)
    .map((item) => {
      if (item.type === 'space') return `<div class="line-space"></div>`;
      if (item.type === 'section') return `<div class="section">${esc(item.label)}</div>`;
      return `<div class="line">${renderSegments(item.segments)}</div>`;
    })
    .join('');
}

// --- Bonus : transposition (non câblée dans l'UI du MVP, prête à l'emploi) ---
// transposeChord('A', 2) -> 'B' ; transposeChord('Em7', 1) -> 'Fm7'
const SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_TO_SHARP = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };

export function transposeChord(chord, semitones) {
  return chord.replace(/([A-G][#b]?)/g, (root) => {
    const norm = FLAT_TO_SHARP[root] || root;
    const idx = SCALE.indexOf(norm);
    if (idx === -1) return root;
    return SCALE[(idx + semitones + 1200) % 12];
  });
}
