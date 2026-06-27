/**
 * S7 — Garde-fou contre le footgun `?v=N` : tous les modules ES sont versionnés
 * manuellement (`./x.js?v=N`) et dupliqués dans plusieurs fichiers. Si l'un
 * diverge, le navigateur peut charger deux instances d'un même module (ex. deux
 * connexions IndexedDB). Ce test échoue en CI (`node --test`) si les `?v=` ne
 * sont pas tous identiques — il bloque le déploiement Pages avant la casse.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILES = [
  'index.html', 'app.js', 'sync.js', 'fsprovider.js',
  'live.js', 'db.js', 'parser.js', 'pdfimport.js', 'sw.js',
];

test('tous les ?v= sont cohérents entre les fichiers', () => {
  const versions = new Set();
  const occurrences = [];
  for (const f of FILES) {
    let content;
    try { content = readFileSync(join(HERE, f), 'utf8'); }
    catch { continue; } // fichier absent → ignoré
    for (const m of content.matchAll(/\?v=(\d+)/g)) {
      versions.add(m[1]);
      occurrences.push(`${f}=v${m[1]}`);
    }
  }
  assert.ok(
    versions.size <= 1,
    `?v= divergents (${[...versions].join(', ')}) — ${occurrences.join(', ')}`
  );
});
