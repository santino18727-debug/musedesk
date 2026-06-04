// parser.js — Parser de grilles d'accords ChordPro + Ultimate Guitar
// ---------------------------------------------------------------------------
// Deux formats d'entrée supportés :
//   1) ChordPro inline    : "[C]Hello [G]world"
//   2) Ultimate Guitar     : ligne d'accords AU-DESSUS de la ligne de paroles
//
// API publique :
//   parseSong(raw)                      -> modèle interne (array d'items)
//   renderSongHTML(raw, opts)           -> string HTML prête à injecter
//   transposeChord(chord, semitones)    -> accord transposé
//   detectKey(raw)                      -> premier accord rencontré, '' si aucun
// ---------------------------------------------------------------------------

// --- Détection d'accord -----------------------------------------------------
// Un accord = fondamentale [A-G] + altération (#/b) + qualité + basse /X
export function isChord(token) {
  if (!token) return false;
  const m = token.match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/);
  if (!m) return false;
  const quality = m[2];
  return /^(m|maj|min|dim|aug|sus|add|M|°|ø|\+|\d|#|b|\(|\))*$/.test(quality);
}

// Retourne true si TOUS les tokens non-vides sont des accords
function isChordLine(line) {
  const trimmed = line.trim();
  if (trimmed === '') return false;
  const tokens = trimmed.split(/\s+/);
  return tokens.every(isChord);
}

// --- Echappement HTML -------------------------------------------------------
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// --- Parsing ChordPro inline ------------------------------------------------
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
      if (text) segs.push({ chord: '', text });
    } else {
      segs.push({ chord: pendingChord, text });
    }
    pendingChord = m[1];
    last = re.lastIndex;
  }
  segs.push({ chord: pendingChord, text: line.slice(last) });
  return segs;
}

// --- Parsing Ultimate Guitar (accord au-dessus des paroles) -----------------
function parseChordOverLyric(chordLine, lyricLine) {
  const chords = [];
  const re = /(\S+)/g;
  let m;
  while ((m = re.exec(chordLine)) !== null) {
    chords.push({ chord: m[1], col: m.index });
  }
  if (chords.length === 0) return [{ chord: '', text: lyricLine }];

  const segs = [];
  if (chords[0].col > 0) {
    segs.push({ chord: '', text: lyricLine.slice(0, chords[0].col) });
  }
  for (let k = 0; k < chords.length; k++) {
    const start = chords[k].col;
    const end = k + 1 < chords.length
      ? chords[k + 1].col
      : Math.max(lyricLine.length, chordLine.length);
    let text = lyricLine.slice(start, end);
    // Pas de parole sous cet accord (ligne instrumentale, ou parole plus courte
    // que la ligne d'accords) : on conserve l'espacement de la ligne d'accords
    // pour ne pas coller les accords entre eux. Largeur >= accord + 1 espace.
    if (text.trim() === '') {
      text = ' '.repeat(Math.max(end - start, chords[k].chord.length + 1));
    }
    segs.push({ chord: chords[k].chord, text });
  }
  return segs;
}

// --- Parsing complet d'un morceau ------------------------------------------
// Retourne une liste d'items : { type:'section'|'line'|'space', ... }
export function parseSong(raw) {
  const lines = String(raw || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Ligne vide → espacement
    if (trimmed === '') {
      out.push({ type: 'space' });
      continue;
    }

    // En-tête de section [Verse], [Chorus]… (mais PAS un accord seul comme [Em])
    const sec = trimmed.match(/^\[([^\]]+)\]$/);
    if (sec && !isChord(sec[1])) {
      out.push({ type: 'section', label: sec[1] });
      continue;
    }

    // Directive ChordPro {title: ...}
    const dir = trimmed.match(/^\{(.+)\}$/);
    if (dir) {
      out.push({ type: 'section', label: dir[1] });
      continue;
    }

    // ChordPro inline (contient au moins un [xxx])
    if (/\[[^\]]+\]/.test(line)) {
      out.push({ type: 'line', segments: parseChordPro(line) });
      continue;
    }

    // Ultimate Guitar : ligne d'accords suivie de paroles
    if (isChordLine(line)) {
      const next = lines[i + 1];
      const nextIsLyric =
        next !== undefined &&
        next.trim() !== '' &&
        !isChordLine(next) &&
        !/\[[^\]]+\]/.test(next);
      if (nextIsLyric) {
        out.push({ type: 'line', segments: parseChordOverLyric(line, next) });
        i++;
      } else {
        out.push({ type: 'line', segments: parseChordOverLyric(line, '') });
      }
      continue;
    }

    // Ligne de paroles simple (sans accord)
    out.push({ type: 'line', segments: [{ chord: '', text: line }] });
  }

  return out;
}

// --- Transposition ----------------------------------------------------------
const SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_TO_SHARP = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };

export function transposeChord(chord, semitones) {
  if (!semitones) return chord;
  return chord.replace(/([A-G][#b]?)/g, (root) => {
    const norm = FLAT_TO_SHARP[root] || root;
    const idx = SCALE.indexOf(norm);
    if (idx === -1) return root;
    return SCALE[(idx + semitones + 1200) % 12];
  });
}

// --- Détection de la tonalité (premier accord rencontré) --------------------
export function detectKey(raw) {
  const items = parseSong(raw);
  for (const item of items) {
    if (item.type === 'line') {
      for (const seg of item.segments) {
        if (seg.chord && isChord(seg.chord)) {
          // Retourne uniquement la fondamentale + qualité mineure éventuelle
          const m = seg.chord.match(/^([A-G][#b]?)(m(?!aj|in))?/);
          return m ? m[1] + (m[2] || '') : seg.chord;
        }
      }
    }
  }
  return '';
}

// --- Rendu d'une liste de segments ------------------------------------------
function renderSegments(segs, semitones) {
  return segs
    .map((s) => {
      const rawChord = semitones && s.chord ? transposeChord(s.chord, semitones) : s.chord;
      const chord = `<span class="chord">${rawChord ? esc(rawChord) : ''}</span>`;
      const lyric = `<span class="lyric">${s.text ? esc(s.text) : ' '}</span>`;
      return `<span class="unit">${chord}${lyric}</span>`;
    })
    .join('');
}

// --- Rendu HTML complet du morceau ------------------------------------------
// opts = { semitones: 0 }  (transposition appliquée pendant le rendu)
export function renderSongHTML(raw, opts = {}) {
  const semitones = opts.semitones || 0;
  return parseSong(raw)
    .map((item) => {
      if (item.type === 'space') return `<div class="line-space"></div>`;
      if (item.type === 'section') return `<div class="section">${esc(item.label)}</div>`;
      return `<div class="line">${renderSegments(item.segments, semitones)}</div>`;
    })
    .join('');
}
