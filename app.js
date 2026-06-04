// app.js — Orchestration de l'UI (vues Bibliothèque <-> Lecteur) et live tools
// ---------------------------------------------------------------------------
import * as db from './db.js';
import { renderSongHTML } from './parser.js';
import { initSync } from './sync.js';

// --- État applicatif --------------------------------------------------------
const state = {
  songs: [],
  current: null, // morceau ouvert dans le lecteur
  fontSize: 22, // px, ajusté par A- / A+
  scroll: { active: false, raf: null, speed: 0.6, acc: 0 },
};

// Raccourcis DOM
const $ = (sel) => document.querySelector(sel);
const viewLibrary = $('#view-library');
const viewReader = $('#view-reader');
const grid = $('#song-grid');
const readerContent = $('#reader-content');
const readerTitle = $('#reader-title');

// --- Démarrage --------------------------------------------------------------
async function boot() {
  await db.initDB();
  initSync(); // provider Noop pour l'instant (Google Drive viendra ici)
  await seedIfEmpty();
  await refreshLibrary();
  bindGlobalUI();
  registerServiceWorker();
}

// Insère un morceau de démo au tout premier lancement (pour tester direct).
async function seedIfEmpty() {
  const all = await db.getAllSongs();
  if (all.length > 0) return;
  await db.addSong({
    title: 'Knockin\' On Heaven\'s Door',
    artist: 'Bob Dylan',
    tags: ['démo', 'facile'],
    content: [
      '[Intro]',
      'G        D         Am',
      '',
      '[Verse]',
      'G            D            Am',
      'Mama take this badge off of me',
      'G            D            C',
      'I can\'t use it anymore',
      'G              D           Am',
      'It\'s gettin\' dark too dark to see',
      'G            D          C',
      'I feel I\'m knockin\' on heaven\'s door',
      '',
      '[Chorus]',
      'Knock-[G]knock-[D]knockin\' on [Am]heaven\'s door',
    ].join('\n'),
  });
}

// --- Vue Bibliothèque -------------------------------------------------------
async function refreshLibrary() {
  state.songs = await db.getAllSongs();
  renderGrid(state.songs);
}

function renderGrid(songs) {
  grid.innerHTML = '';
  if (!songs.length) {
    grid.innerHTML = '<p class="empty">Aucun morceau. Clique sur « Importer » pour coller une grille.</p>';
    return;
  }
  for (const song of songs) {
    const card = document.createElement('article');
    card.className = 'card';
    card.tabIndex = 0;
    card.innerHTML = `
      <h3>${escapeHTML(song.title)}</h3>
      <p class="artist">${escapeHTML(song.artist || '—')}</p>
      <div class="card-tags">${(song.tags || []).map((t) => `<span>${escapeHTML(t)}</span>`).join('')}</div>
      <button class="card-del" title="Supprimer" data-id="${song.id}">✕</button>`;
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('card-del')) return;
      openReader(song.id);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') openReader(song.id);
    });
    card.querySelector('.card-del').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Supprimer « ${song.title} » ?`)) {
        await db.deleteSong(song.id);
        await refreshLibrary();
      }
    });
    grid.appendChild(card);
  }
}

function filterLibrary(query) {
  const q = query.trim().toLowerCase();
  if (!q) return renderGrid(state.songs);
  renderGrid(
    state.songs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.artist || '').toLowerCase().includes(q)
    )
  );
}

// --- Vue Lecteur ------------------------------------------------------------
async function openReader(id) {
  const song = await db.getSong(id);
  if (!song) return;
  state.current = song;
  readerTitle.textContent = `${song.title}${song.artist ? ' — ' + song.artist : ''}`;
  readerContent.innerHTML = renderSongHTML(song.content);
  applyFontSize();
  viewLibrary.hidden = true;
  viewReader.hidden = false;
  window.scrollTo(0, 0);
}

function closeReader() {
  stopScroll();
  state.current = null;
  viewReader.hidden = true;
  viewLibrary.hidden = false;
}

// --- Live tools : taille de police -----------------------------------------
function applyFontSize() {
  readerContent.style.fontSize = state.fontSize + 'px';
}
function changeFont(delta) {
  state.fontSize = Math.max(12, Math.min(64, state.fontSize + delta));
  applyFontSize();
}

// --- Live tools : auto-scroll (requestAnimationFrame) -----------------------
function toggleScroll() {
  state.scroll.active ? stopScroll() : startScroll();
}
function startScroll() {
  state.scroll.active = true;
  $('#btn-scroll').classList.add('active');
  $('#btn-scroll').textContent = '⏸ Scroll';
  const step = () => {
    if (!state.scroll.active) return;
    state.scroll.acc += state.scroll.speed;
    if (state.scroll.acc >= 1) {
      const px = Math.floor(state.scroll.acc);
      window.scrollBy(0, px);
      state.scroll.acc -= px;
      // Arrêt automatique en bas de page
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) {
        stopScroll();
        return;
      }
    }
    state.scroll.raf = requestAnimationFrame(step);
  };
  state.scroll.raf = requestAnimationFrame(step);
}
function stopScroll() {
  state.scroll.active = false;
  if (state.scroll.raf) cancelAnimationFrame(state.scroll.raf);
  state.scroll.raf = null;
  const btn = $('#btn-scroll');
  if (btn) {
    btn.classList.remove('active');
    btn.textContent = '▶ Scroll';
  }
}

// --- Import (coller une grille Ultimate Guitar) -----------------------------
function openImportDialog() {
  $('#import-dialog').showModal();
  $('#imp-title').focus();
}
async function saveImport(e) {
  e.preventDefault();
  const title = $('#imp-title').value.trim();
  const artist = $('#imp-artist').value.trim();
  const tags = $('#imp-tags').value.split(',').map((t) => t.trim()).filter(Boolean);
  const content = $('#imp-content').value;
  if (!title || !content.trim()) return;
  await db.addSong({ title, artist, tags, content });
  $('#import-dialog').close();
  e.target.reset();
  await refreshLibrary();
}

// --- Câblage global ---------------------------------------------------------
function bindGlobalUI() {
  $('#btn-import').addEventListener('click', openImportDialog);
  $('#import-form').addEventListener('submit', saveImport);
  $('#imp-cancel').addEventListener('click', () => $('#import-dialog').close());
  $('#search').addEventListener('input', (e) => filterLibrary(e.target.value));

  $('#btn-back').addEventListener('click', closeReader);
  $('#btn-font-dec').addEventListener('click', () => changeFont(-2));
  $('#btn-font-inc').addEventListener('click', () => changeFont(+2));
  $('#btn-scroll').addEventListener('click', toggleScroll);

  // Raccourcis clavier (passage de page au canapé / tablette + clavier)
  document.addEventListener('keydown', (e) => {
    if (viewReader.hidden) return;
    if (e.key === 'Escape') closeReader();
    if (e.key === ' ') { e.preventDefault(); toggleScroll(); }
    if (e.key === '+') changeFont(+2);
    if (e.key === '-') changeFont(-2);
  });
}

function escapeHTML(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {/* offline optionnel */});
  }
}

boot();
