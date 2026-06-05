// pdfimport.js — Extraction de grille d'accords depuis un PDF (texte), offline.
// -----------------------------------------------------------------------------
// Utilise PDF.js (Mozilla, MPL-2.0) vendu en local dans ./vendor/.
// L'enjeu : un PDF ne stocke pas "cet accord est au-dessus de ce mot", juste des
// fragments de texte positionnés en X/Y. On reconstruit donc :
//   1) les LIGNES en regroupant les fragments par coordonnée Y,
//   2) l'ALIGNEMENT horizontal en convertissant X en colonnes de caractères
//      (largeur de caractère estimée), pour que les accords retombent au-dessus
//      des bonnes syllabes une fois rendus en police à chasse fixe.
//
// ⚠️ Best-effort : la qualité dépend du PDF. Sur un PDF *scanné* (image) il n'y a
//    aucun texte extractible → on renvoie une erreur explicite (pas d'OCR ici).
// -----------------------------------------------------------------------------

import * as pdfjsLib from './vendor/pdf.min.js';

// Le worker tourne aussi en local (offline).
pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.js';

// Médiane d'un tableau de nombres.
function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Reconstruit le texte aligné d'une page à partir de ses fragments PDF.js.
function pageItemsToText(items) {
  // On ne garde que les fragments avec du texte réel.
  const frags = items
    .filter((it) => it.str && it.str.trim() !== '')
    .map((it) => ({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
      w: it.width || 0,
    }));
  if (!frags.length) return '';

  // Largeur de caractère estimée (médiane sur tous les fragments mesurables).
  const charWidths = frags
    .filter((f) => f.w > 0 && f.str.length > 0)
    .map((f) => f.w / f.str.length);
  const charW = median(charWidths) || 6;

  // Origine X gauche de la page (marge).
  const pageMinX = Math.min(...frags.map((f) => f.x));

  // Hauteur de ligne typique pour grouper par Y et détecter les sauts.
  // On trie par Y décroissant (origine PDF en bas à gauche → grand Y = haut).
  frags.sort((a, b) => b.y - a.y || a.x - b.x);

  // Tolérance verticale : fragments dont le Y diffère de < yTol = même ligne.
  const yTol = Math.max(2, charW * 0.6);

  // Regroupe en lignes.
  const lines = [];
  let cur = null;
  for (const f of frags) {
    if (cur && Math.abs(cur.y - f.y) <= yTol) {
      cur.items.push(f);
    } else {
      cur = { y: f.y, items: [f] };
      lines.push(cur);
    }
  }

  // Interligne médian (pour insérer des lignes vides entre les sections).
  const gaps = [];
  for (let i = 1; i < lines.length; i++) gaps.push(lines[i - 1].y - lines[i].y);
  const medGap = median(gaps) || charW * 1.4;

  // Construit chaque ligne en plaçant chaque fragment à sa colonne.
  const out = [];
  let prevY = null;
  for (const line of lines) {
    // Saut de section : interligne anormalement grand → ligne vide.
    if (prevY !== null) {
      const gap = prevY - line.y;
      if (gap > medGap * 1.7) out.push('');
    }
    prevY = line.y;

    line.items.sort((a, b) => a.x - b.x);
    let text = '';
    for (const it of line.items) {
      const col = Math.max(0, Math.round((it.x - pageMinX) / charW));
      if (col > text.length) text += ' '.repeat(col - text.length);
      // Si chevauchement (rare), on ajoute juste un espace de séparation.
      else if (text.length > 0 && !text.endsWith(' ')) text += ' ';
      text += it.str;
    }
    out.push(text.replace(/\s+$/, ''));
  }
  return out.join('\n');
}

// Devine un titre propre depuis le nom de fichier.
export function titleFromFilename(name) {
  return String(name || '')
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// API principale : File PDF → { title, text }. Lève une erreur explicite si vide.
export async function extractChordSheetFromPDF(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const txt = pageItemsToText(tc.items);
    if (txt.trim()) pages.push(txt);
  }

  const text = pages.join('\n\n');
  if (!text.trim()) {
    throw new Error(
      'Aucun texte extractible — ce PDF est probablement scanné (image). ' +
      'Exporte-le en PDF *texte* (ou colle la grille manuellement).'
    );
  }
  return { title: titleFromFilename(file.name), text };
}
