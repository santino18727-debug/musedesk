// app.js — Orchestration complète de MuseDesk
// Vanilla ES6 modules, aucune dépendance externe.
// ---------------------------------------------------------------------------
import * as db from './db.js';
import { renderSongHTML, detectKey, transposeChord } from './parser.js';

// ============================================================
// ÉTAT APPLICATIF
// ============================================================
const state = {
  // Bibliothèque
  songs: [],
  setlists: [],
  filter: 'all',       // 'all' | 'favorites' | 'recent' | 'setlists' | tag-string
  sortBy: 'title',     // 'title' | 'artist' | 'recent'
  searchQuery: '',

  // Lecteur
  current: null,       // morceau ouvert
  semitones: 0,        // transposition courante
  capo: 0,
  fontSize: 26,        // px
  showChords: true,
  scrollActive: false,
  scrollSpeed: 3,      // 1-10
  scrollRaf: null,
  scrollAcc: 0,
  twoCol: false,

  // Setlist
  currentSetlistId: null,
  concertMode: false,  // true = navigation dans une setlist
  concertIndex: 0,     // position dans la setlist

  // Drag & drop setlist
  dragSrc: null,
};

// ============================================================
// RACCOURCIS DOM
// ============================================================
const $ = (sel) => document.querySelector(sel);

// Vues
const viewLibrary = $('#view-library');
const viewReader  = $('#view-reader');
const viewSetlist = $('#view-setlist');

// ============================================================
// DONNÉES DE DÉMO (seed au 1er lancement)
// ============================================================
const DEMO_SONGS = [
  {
    title: "Knockin' On Heaven's Door",
    artist: 'Bob Dylan',
    tags: ['Feu de camp', 'Facile'],
    favorite: true,
    content: [
      '[Intro]',
      'G        D         Am',
      '',
      '[Verse 1]',
      'G            D            Am',
      "Mama take this badge off of me",
      'G            D            C',
      "I can't use it anymore",
      'G              D           Am',
      "It's gettin' dark too dark to see",
      'G            D          C',
      "I feel I'm knockin' on heaven's door",
      '',
      '[Chorus]',
      "Knock-[G]knock-[D]knockin' on [Am]heaven's [C]door",
      "Knock-[G]knock-[D]knockin' on [Am]heaven's [C]door",
    ].join('\n'),
  },
  {
    title: 'Wonderwall',
    artist: 'Oasis',
    tags: ['Acoustique', 'Rock'],
    favorite: true,
    content: [
      '[Intro]',
      'Em7    G       Dsus4   A7sus4',
      '',
      '[Verse]',
      'Em7              G',
      'Today is gonna be the day',
      'Dsus4                  A7sus4',
      "That they're gonna throw it back to you",
      'Em7            G',
      "By now you should've somehow",
      'Dsus4                A7sus4',
      'Realized what you gotta do',
      '',
      '[Chorus]',
      'C          D            Em7',
      "Because maybe you're gonna be the one that saves me",
      'C       D          Em7    G',
      "And after all you're my wonderwall",
    ].join('\n'),
  },
  {
    title: 'Let It Be',
    artist: 'The Beatles',
    tags: ['Acoustique', 'Classique'],
    favorite: false,
    content: [
      '[Verse]',
      'C              G',
      'When I find myself in times of trouble',
      'Am             F',
      'Mother Mary comes to me',
      'C                 G',
      'Speaking words of wisdom',
      'F    C',
      'Let it be',
      '',
      '[Chorus]',
      'C    G     Am   F',
      'Let it be, let it be',
      'C    G       F    C',
      'Let it be, let it be',
      'C              G',
      'Whisper words of wisdom',
      'F    C',
      'Let it be',
    ].join('\n'),
  },
  {
    title: 'Zombie',
    artist: 'The Cranberries',
    tags: ['Rock'],
    favorite: false,
    content: [
      '[Verse]',
      'Em                C',
      'Another head hangs lowly',
      'G                D',
      'Child is slowly taken',
      'Em                    C',
      'And the violence caused such silence',
      'G                    D',
      "Who are we mistaken?",
      '',
      '[Chorus]',
      'Em            C',
      "But you see it's not me",
      'G                  D',
      "It's not my family",
      'Em                C',
      "In your head, in your head",
      'G           D',
      'They are fighting',
    ].join('\n'),
  },
  {
    title: 'Hotel California',
    artist: 'Eagles',
    tags: ['Rock', 'Classique'],
    favorite: false,
    content: [
      '[Intro]',
      'Bm   F#   A   E   G   D   Em   F#',
      '',
      '[Verse]',
      'Bm                     F#',
      'On a dark desert highway, cool wind in my hair',
      'A                          E',
      'Warm smell of colitas rising up through the air',
      'G                      D',
      'Up ahead in the distance I saw a shimmering light',
      'Em                         F#',
      'My head grew heavy and my sight grew dim',
      '',
      '[Chorus]',
      'G              D               F#',
      'Welcome to the Hotel California',
      'Bm                   G',
      'Such a lovely place, such a lovely face',
    ].join('\n'),
  },
];

// ============================================================
// DÉMARRAGE
// ============================================================
async function boot() {
  await db.initDB();
  await seedIfEmpty();
  state.songs    = await db.getAllSongs();
  state.setlists = await db.getAllSetlists();
  renderLibrary();
  bindAllEvents();
  registerServiceWorker();
}

async function seedIfEmpty() {
  const all = await db.getAllSongs();
  if (all.length > 0) return;

  // Ajouter les morceaux de démo
  const songIds = [];
  for (const s of DEMO_SONGS) {
    const added = await db.addSong(s);
    songIds.push(added.id);
  }

  // Créer une setlist de démo avec les 4 premiers
  await db.addSetlist({
    name: 'Jam vendredi',
    songIds: songIds.slice(0, 4),
    overrides: {
      [songIds[0]]: { semitones: 0, capo: 2 },  // Knockin' capo 2
      [songIds[3]]: { semitones: 1, capo: 0 },  // Zombie +1
    },
  });
}

// ============================================================
// ROUTEUR DE VUES
// ============================================================
function showView(name) {
  viewLibrary.hidden = name !== 'library';
  viewReader.hidden  = name !== 'reader';
  viewSetlist.hidden = name !== 'setlist';
}

// ============================================================
// VUE BIBLIOTHÈQUE
// ============================================================

// Retourne la liste filtrée + triée
function getFilteredSongs() {
  let list = [...state.songs];

  // Filtre sidebar
  if (state.filter === 'favorites') {
    list = list.filter((s) => s.favorite);
  } else if (state.filter === 'recent') {
    list = [...list].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    list = list.slice(0, 12);
  } else if (state.filter === 'setlists') {
    // Redirige vers la vue setlist
    openSetlistView();
    return [];
  } else if (state.filter !== 'all') {
    // Filtre par tag
    list = list.filter((s) => (s.tags || []).includes(state.filter));
  }

  // Filtre recherche
  const q = state.searchQuery.toLowerCase();
  if (q) {
    list = list.filter((s) =>
      s.title.toLowerCase().includes(q) ||
      (s.artist || '').toLowerCase().includes(q) ||
      (s.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }

  // Tri
  if (state.sortBy === 'artist') {
    list.sort((a, b) => (a.artist || '').localeCompare(b.artist || '', 'fr', { sensitivity: 'base' }));
  } else if (state.sortBy === 'recent') {
    list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  } else {
    list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'fr', { sensitivity: 'base' }));
  }

  return list;
}

function renderLibrary() {
  const songs = getFilteredSongs();
  if (state.filter === 'setlists') return; // déjà redirigé

  // Badges sidebar
  $('#badge-all').textContent = state.songs.length;
  $('#badge-fav').textContent = state.songs.filter((s) => s.favorite).length;
  $('#badge-sets').textContent = state.setlists.length;

  // Titre topbar
  const titles = {
    all: 'Tous les morceaux',
    favorites: 'Favoris',
    recent: 'Récents',
    setlists: 'Setlists',
  };
  $('#lib-title').textContent = titles[state.filter] || `Tag : ${state.filter}`;
  $('#lib-count').textContent = `${songs.length} chanson${songs.length > 1 ? 's' : ''}`;

  renderGrid(songs);
  renderTagList();
  renderAlphaBar(songs);
}

// Couleurs déterministes par titre (hash simple)
function titleColor(title) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) & 0xfffffff;
  const palettes = [
    ['#5b6bff', '#8a4dff'],
    ['#ff8a4d', '#ff4d6d'],
    ['#3ecf8e', '#2f9bff'],
    ['#c98bff', '#5b6bff'],
    ['#ffb142', '#ff7a4d'],
    ['#4dd0ff', '#2f6bff'],
    ['#ff5b8a', '#ff9b42'],
    ['#6bffb0', '#3e8eff'],
    ['#ffcc44', '#ff6b6b'],
    ['#42d6a0', '#4f86ff'],
  ];
  const pair = palettes[h % palettes.length];
  return `linear-gradient(135deg,${pair[0]},${pair[1]})`;
}

function renderGrid(songs) {
  const grid = $('#song-grid');
  grid.innerHTML = '';

  if (!songs.length) {
    grid.innerHTML = `<p class="empty">Aucun morceau trouvé.<br>
      <small>Cliquez sur « Importer » ou modifiez vos filtres.</small></p>`;
    return;
  }

  for (const song of songs) {
    const key = detectKey(song.content);
    const initial = (song.title || '?')[0].toUpperCase();
    const card = document.createElement('article');
    card.className = 'card';
    card.tabIndex = 0;
    card.dataset.id = song.id;

    card.innerHTML = `
      <div class="card-top">
        <div class="cover" style="background:${titleColor(song.title)}">${escapeHTML(initial)}</div>
      </div>
      <button class="fav${song.favorite ? ' on' : ''}" data-id="${song.id}" title="Favori">★</button>
      <div class="t">${escapeHTML(song.title)}</div>
      <div class="a">${escapeHTML(song.artist || '—')}</div>
      <div class="card-foot">
        ${key ? `<span class="key-badge">${escapeHTML(key)}</span>` : ''}
        ${(song.tags || []).slice(0, 2).map((t) => `<span class="tag-pill">${escapeHTML(t)}</span>`).join('')}
      </div>
    `;

    // Clic sur la carte → lecteur
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('fav')) return;
      openReader(song.id);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') openReader(song.id);
    });

    // Clic favori
    card.querySelector('.fav').addEventListener('click', async (e) => {
      e.stopPropagation();
      await db.toggleFavorite(song.id);
      state.songs = await db.getAllSongs();
      renderLibrary();
    });

    grid.appendChild(card);
  }
}

// Tags dynamiques dans la sidebar
function renderTagList() {
  const tagMap = {};
  for (const s of state.songs) {
    for (const t of (s.tags || [])) {
      tagMap[t] = (tagMap[t] || 0) + 1;
    }
  }

  // Couleurs statiques pour les tags les plus communs
  const tagColors = ['var(--chord)', 'var(--accent)', 'var(--go)', '#c98bff', '#ff7a7a', '#4dd0ff'];
  const list = $('#tag-list');
  list.innerHTML = '';

  Object.entries(tagMap).slice(0, 6).forEach(([tag, count], i) => {
    const el = document.createElement('div');
    el.className = `nav-item${state.filter === tag ? ' active' : ''}`;
    el.dataset.filter = tag;
    el.innerHTML = `
      <span class="tag-chip">
        <span class="dot" style="background:${tagColors[i % tagColors.length]}"></span>
        ${escapeHTML(tag)}
      </span>
      <span class="badge">${count}</span>
    `;
    el.addEventListener('click', () => setFilter(tag));
    list.appendChild(el);
  });
}

// Barre alphabet
function renderAlphaBar(songs) {
  const letters = new Set(songs.map((s) => (s.title || '?')[0].toUpperCase()));
  const bar = $('#alpha-bar');
  bar.innerHTML = '';
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((l) => {
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = l;
    if (letters.has(l)) a.classList.add('has');
    a.addEventListener('click', (e) => {
      e.preventDefault();
      // Scroll vers la première carte dont l'initiale correspond
      const cards = document.querySelectorAll('#song-grid .card');
      for (const card of cards) {
        const title = card.querySelector('.t')?.textContent || '';
        if (title[0]?.toUpperCase() === l) {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          break;
        }
      }
    });
    bar.appendChild(a);
  });
}

// Changement de filtre sidebar
function setFilter(filter) {
  state.filter = filter;
  // Mettre à jour l'état actif des nav-items
  document.querySelectorAll('.nav-item[data-filter]').forEach((el) => {
    el.classList.toggle('active', el.dataset.filter === filter);
  });
  renderLibrary();
}

// ============================================================
// VUE LECTEUR
// ============================================================

async function openReader(songId, opts = {}) {
  const song = await db.getSong(songId);
  if (!song) return;
  state.current = song;
  state.semitones = opts.semitones ?? 0;
  state.capo      = opts.capo      ?? 0;

  // Titre + badge tonalité
  $('#reader-title').textContent = `${song.title}${song.artist ? ' — ' + song.artist : ''}`;
  const key = detectKey(song.content);
  const keyBadge = $('#reader-key');
  if (key) {
    keyBadge.textContent = state.semitones
      ? `${key} → ${transposeKey(key, state.semitones)}`
      : key;
    keyBadge.style.display = '';
  } else {
    keyBadge.style.display = 'none';
  }

  renderSong();
  applyFontSize();
  syncLiveBar();
  syncTransposePanel();

  // S'assurer que le panneau transpose est fermé à l'ouverture
  $('#transpose-panel').hidden = true;
  $('#btn-transpose-toggle').classList.remove('active');

  showView('reader');

  // Retour en haut
  $('#reader-content').scrollTop = 0;
}

function renderSong() {
  const content = $('#reader-content');
  // Conserver les zones de tap
  const tapL = '<div class="tap l">‹</div>';
  const tapR = '<div class="tap r">›</div>';
  content.innerHTML = tapL + tapR + renderSongHTML(state.current.content, { semitones: state.semitones });

  // Mode 2 colonnes
  content.classList.toggle('two-col', state.twoCol);
  // Mode sans accords
  content.classList.toggle('no-chords', !state.showChords);
}

function closeReader() {
  stopScroll();
  state.current      = null;
  state.concertMode  = false;
  state.twoCol       = false;
  $('#reader-content').classList.remove('two-col', 'no-chords');
  $('#btn-twocol').classList.remove('active');
  showView('library');
}

// --- Taille de police -------------------------------------------------------
function applyFontSize() {
  $('#reader-content').style.fontSize = state.fontSize + 'px';
  $('#font-slider').value = state.fontSize;
}
function changeFont(delta) {
  state.fontSize = Math.max(14, Math.min(48, state.fontSize + delta));
  applyFontSize();
}

// --- Transposition ----------------------------------------------------------
function transposeKey(key, semitones) {
  // Transpose la tonalité affichée dans le badge
  return transposeChord(key, semitones);
}

function applyTranspose() {
  if (!state.current) return;
  renderSong();
  syncTransposePanel();
  syncLiveBar();
}

function syncTransposePanel() {
  if (!state.current) return;
  const key = detectKey(state.current.content) || '?';
  const transKey = state.semitones ? transposeKey(key, state.semitones) : key;

  $('#t-from').textContent = key;
  $('#t-to').textContent   = state.semitones !== 0 ? ` → ${transKey}` : '';

  // Capo
  document.querySelectorAll('#capo-row span').forEach((el) => {
    el.classList.toggle('on', Number(el.dataset.capo) === state.capo);
  });

  // Badge toolbar
  const keyBadge = $('#reader-key');
  keyBadge.textContent = transKey;
  keyBadge.style.display = transKey && transKey !== '?' ? '' : 'none';
}

function syncLiveBar() {
  if (!state.current) return;
  const key = detectKey(state.current.content) || '—';
  $('#lb-key').textContent = state.semitones ? transposeKey(key, state.semitones) : key;
  $('#lb-play').textContent = state.scrollActive ? '⏸' : '▶';
}

// --- Auto-scroll ------------------------------------------------------------
function toggleScroll() {
  state.scrollActive ? stopScroll() : startScroll();
}

function startScroll() {
  state.scrollActive = true;
  $('#lb-play').textContent = '⏸';
  $('#btn-scroll').classList.add('active');
  $('#btn-scroll').textContent = '⏸ Scroll';

  const content = $('#reader-content');
  const step = () => {
    if (!state.scrollActive) return;
    state.scrollAcc += state.scrollSpeed * 0.3;
    if (state.scrollAcc >= 1) {
      const px = Math.floor(state.scrollAcc);
      content.scrollBy(0, px);
      state.scrollAcc -= px;
      // Arrêt automatique en bas
      if (content.scrollTop + content.clientHeight >= content.scrollHeight - 2) {
        stopScroll();
        return;
      }
    }
    state.scrollRaf = requestAnimationFrame(step);
  };
  state.scrollRaf = requestAnimationFrame(step);
}

function stopScroll() {
  state.scrollActive = false;
  if (state.scrollRaf) cancelAnimationFrame(state.scrollRaf);
  state.scrollRaf = null;
  state.scrollAcc = 0;
  const btn = $('#btn-scroll');
  if (btn) {
    btn.classList.remove('active');
    btn.textContent = '▶ Scroll';
  }
  const lbPlay = $('#lb-play');
  if (lbPlay) lbPlay.textContent = '▶';
}

// --- Pagination 2 colonnes --------------------------------------------------
// En 2 colonnes le contenu est overflow:hidden, on simule la pagination en
// décalant via marginTop sur le contenu intérieur.
let pageOffset = 0;

function getPageHeight() {
  const content = $('#reader-content');
  return content.clientHeight - 86; // marge basse live bar
}

function nextPage() {
  if (!state.twoCol) {
    // Mode 1 col : scroll d'une page
    const content = $('#reader-content');
    content.scrollBy({ top: content.clientHeight * 0.9, behavior: 'smooth' });
  } else {
    // Mode 2 col : concert mode pagination
    pageOffset += getPageHeight();
    applyPageOffset();
  }
}

function prevPage() {
  if (!state.twoCol) {
    const content = $('#reader-content');
    content.scrollBy({ top: -content.clientHeight * 0.9, behavior: 'smooth' });
  } else {
    pageOffset = Math.max(0, pageOffset - getPageHeight());
    applyPageOffset();
  }
}

function applyPageOffset() {
  const inner = $('#reader-content');
  // On décale via un wrapper enfant (si besoin on cible les enfants directs)
  inner.style.paddingTop = pageOffset > 0 ? `-${pageOffset}px` : '';
  inner.scrollTop = pageOffset;
}

// --- Concert mode (setlist enchaînée) ---------------------------------------
async function openConcertMode(setlistId) {
  const sl = await db.getSetlist(setlistId);
  if (!sl || !sl.songIds.length) return;
  state.concertMode     = true;
  state.currentSetlistId = setlistId;
  state.concertIndex    = 0;
  await openConcertSong();
}

async function openConcertSong() {
  const sl = await db.getSetlist(state.currentSetlistId);
  if (!sl) return;
  const songId = sl.songIds[state.concertIndex];
  const override = (sl.overrides || {})[songId] || {};
  await openReader(songId, {
    semitones: override.semitones || 0,
    capo:      override.capo      || 0,
  });
}

async function concertNext() {
  const sl = await db.getSetlist(state.currentSetlistId);
  if (!sl) return;
  if (state.concertIndex < sl.songIds.length - 1) {
    state.concertIndex++;
    await openConcertSong();
  }
}

async function concertPrev() {
  if (state.concertIndex > 0) {
    state.concertIndex--;
    await openConcertSong();
  }
}

// ============================================================
// VUE SETLIST
// ============================================================

function openSetlistView() {
  state.setlists && renderSetlistSidebar();
  if (state.setlists.length > 0 && !state.currentSetlistId) {
    state.currentSetlistId = state.setlists[0].id;
  }
  renderSetlistDetail();
  showView('setlist');
}

function renderSetlistSidebar() {
  const list = $('#setlist-list');
  list.innerHTML = '';
  for (const sl of state.setlists) {
    const el = document.createElement('div');
    el.className = `set-item${sl.id === state.currentSetlistId ? ' active' : ''}`;
    el.innerHTML = `
      ${escapeHTML(sl.name)}
      <span class="count">${sl.songIds.length}</span>
    `;
    el.addEventListener('click', () => {
      state.currentSetlistId = sl.id;
      renderSetlistSidebar();
      renderSetlistDetail();
    });
    list.appendChild(el);
  }
}

async function renderSetlistDetail() {
  const detail = $('#set-detail');

  if (!state.currentSetlistId) {
    detail.innerHTML = '<p class="set-empty">Aucune setlist. Créez-en une !</p>';
    return;
  }

  const sl = await db.getSetlist(state.currentSetlistId);
  if (!sl) return;

  // Récupérer les morceaux dans l'ordre de la setlist
  const songMap = {};
  for (const s of state.songs) songMap[s.id] = s;
  const songs = sl.songIds.map((id) => songMap[id]).filter(Boolean);

  // Calcul durée estimée (pas de métadonnée durée, on met un placeholder)
  const totalMin = songs.length * 4;

  const head = document.createElement('div');
  head.className = 'detail-head';
  head.innerHTML = `
    <div>
      <h1>${escapeHTML(sl.name)}</h1>
      <div class="set-meta">
        ${songs.length} morceau${songs.length > 1 ? 'x' : ''} ·
        ~${totalMin} min ·
        modifié ${formatRelativeDate(sl.updatedAt)}
      </div>
    </div>
    <button class="play-btn" id="btn-start-concert">▶ Démarrer le concert</button>
  `;
  // Vidage juste avant le rendu (après l'await) : évite la duplication
  // si deux appels concurrents passent leur await en même temps.
  detail.innerHTML = '';
  detail.appendChild(head);

  // Lignes morceaux (drag & drop HTML5)
  const rowsContainer = document.createElement('div');
  rowsContainer.id = 'setlist-rows';

  songs.forEach((song, idx) => {
    const override = (sl.overrides || {})[song.id] || {};
    const row = document.createElement('div');
    row.className = 'song-row';
    row.draggable = true;
    row.dataset.songId = song.id;
    row.dataset.idx = idx;

    let overrideTags = '';
    if (override.capo > 0) overrideTags += `<span class="transpose-tag">capo ${override.capo}</span>`;
    if (override.semitones > 0) overrideTags += `<span class="transpose-tag">+${override.semitones} ½ton</span>`;
    if (override.semitones < 0) overrideTags += `<span class="transpose-tag">${override.semitones} ½ton</span>`;

    const key = detectKey(song.content);

    row.innerHTML = `
      <span class="drag">⠿</span>
      <span class="num">${idx + 1}</span>
      <div class="song-info">
        <div class="t">${escapeHTML(song.title)}</div>
        <div class="a">${escapeHTML(song.artist || '—')}</div>
      </div>
      ${overrideTags}
      ${key ? `<span class="key-badge">${escapeHTML(key)}</span>` : ''}
      <button class="row-x" data-idx="${idx}" title="Retirer">✕</button>
    `;

    // Ouvrir dans le lecteur au clic (pas sur le drag/bouton)
    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('row-x') || e.target.classList.contains('drag')) return;
      openReader(song.id, {
        semitones: override.semitones || 0,
        capo:      override.capo      || 0,
      });
    });

    // Supprimer de la setlist
    row.querySelector('.row-x').addEventListener('click', async (e) => {
      e.stopPropagation();
      sl.songIds.splice(idx, 1);
      // Nettoyer l'override
      if (sl.overrides) delete sl.overrides[song.id];
      await db.updateSetlist(sl);
      state.setlists = await db.getAllSetlists();
      renderSetlistSidebar();
      renderSetlistDetail();
    });

    // Drag & drop
    row.addEventListener('dragstart', (e) => {
      state.dragSrc = idx;
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', async (e) => {
      e.preventDefault();
      row.classList.remove('drag-over');
      const from = state.dragSrc;
      const to   = idx;
      if (from === to || from === null) return;
      // Réordonner songIds
      const [moved] = sl.songIds.splice(from, 1);
      sl.songIds.splice(to, 0, moved);
      await db.updateSetlist(sl);
      state.setlists = await db.getAllSetlists();
      renderSetlistDetail();
    });
    row.addEventListener('dragend', () => {
      state.dragSrc = null;
      document.querySelectorAll('.song-row').forEach((r) => r.classList.remove('drag-over'));
    });

    rowsContainer.appendChild(row);
  });

  // Bouton ajouter
  const addRow = document.createElement('div');
  addRow.className = 'add-row';
  addRow.innerHTML = '＋ Ajouter un morceau depuis la bibliothèque';
  addRow.addEventListener('click', () => openPickerDialog(sl));
  rowsContainer.appendChild(addRow);

  detail.appendChild(rowsContainer);

  // Démarrer le concert
  head.querySelector('#btn-start-concert').addEventListener('click', () => {
    openConcertMode(sl.id);
  });
}

// Dialogue picker
function openPickerDialog(sl) {
  const dialog = $('#picker-dialog');
  const listEl = $('#picker-list');
  const searchEl = $('#picker-search');
  searchEl.value = '';

  const renderPicker = (q = '') => {
    listEl.innerHTML = '';
    const filtered = state.songs.filter((s) =>
      !sl.songIds.includes(s.id) &&
      (s.title.toLowerCase().includes(q) || (s.artist || '').toLowerCase().includes(q))
    );
    if (!filtered.length) {
      listEl.innerHTML = '<p style="padding:14px;color:var(--text-3);">Aucun morceau à ajouter.</p>';
      return;
    }
    for (const song of filtered) {
      const item = document.createElement('div');
      item.className = 'picker-item';
      item.innerHTML = `
        <div>
          <div class="pi-title">${escapeHTML(song.title)}</div>
          <div class="pi-artist">${escapeHTML(song.artist || '—')}</div>
        </div>
        <button class="btn btn-primary" style="font-size:12px;padding:5px 10px;">Ajouter</button>
      `;
      item.querySelector('button').addEventListener('click', async () => {
        sl.songIds.push(song.id);
        await db.updateSetlist(sl);
        state.setlists = await db.getAllSetlists();
        dialog.close();
        renderSetlistSidebar();
        renderSetlistDetail();
      });
      listEl.appendChild(item);
    }
  };

  renderPicker();
  searchEl.addEventListener('input', (e) => renderPicker(e.target.value.toLowerCase()));
  dialog.showModal();
}

// ============================================================
// DIALOGUE IMPORT
// ============================================================
function openImportDialog() {
  $('#import-dialog').showModal();
  $('#imp-title').focus();
}

async function saveImport(e) {
  e.preventDefault();
  const title   = $('#imp-title').value.trim();
  const artist  = $('#imp-artist').value.trim();
  const tags    = $('#imp-tags').value.split(',').map((t) => t.trim()).filter(Boolean);
  const content = $('#imp-content').value;
  if (!title || !content.trim()) return;
  await db.addSong({ title, artist, tags, content });
  $('#import-dialog').close();
  e.target.reset();
  state.songs = await db.getAllSongs();
  renderLibrary();
}

// ============================================================
// CÂBLAGE GLOBAL DES ÉVÉNEMENTS
// ============================================================
function bindAllEvents() {
  // ---- Bibliothèque ----
  $('#btn-import').addEventListener('click', openImportDialog);
  $('#import-form').addEventListener('submit', saveImport);
  $('#imp-cancel').addEventListener('click', () => $('#import-dialog').close());

  $('#lib-search').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderLibrary();
  });

  $('#lib-sort').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderLibrary();
  });

  // Nav sidebar
  document.querySelectorAll('.nav-item[data-filter]').forEach((el) => {
    el.addEventListener('click', () => setFilter(el.dataset.filter));
  });

  // ---- Lecteur ----
  $('#btn-back').addEventListener('click', () => {
    closeReader();
    if (state.currentSetlistId) {
      openSetlistView();
      state.currentSetlistId = null;
    }
  });

  $('#btn-font-dec').addEventListener('click', () => changeFont(-2));
  $('#btn-font-inc').addEventListener('click', () => changeFont(+2));

  $('#btn-scroll').addEventListener('click', toggleScroll);
  $('#lb-play').addEventListener('click', toggleScroll);

  // Vitesse scroll (panneau + live bar partagent la même valeur)
  $('#speed-slider').addEventListener('input', (e) => {
    state.scrollSpeed = Number(e.target.value);
    $('#lb-speed').value = state.scrollSpeed;
  });
  $('#lb-speed').addEventListener('input', (e) => {
    state.scrollSpeed = Number(e.target.value);
    $('#speed-slider').value = state.scrollSpeed;
  });

  // Taille via slider panneau
  $('#font-slider').addEventListener('input', (e) => {
    state.fontSize = Number(e.target.value);
    applyFontSize();
  });

  // Toggle 2 colonnes
  $('#btn-twocol').addEventListener('click', () => {
    state.twoCol = !state.twoCol;
    pageOffset = 0;
    $('#btn-twocol').classList.toggle('active', state.twoCol);
    renderSong();
  });

  // Panneau transpose
  $('#btn-transpose-toggle').addEventListener('click', () => {
    const panel = $('#transpose-panel');
    panel.hidden = !panel.hidden;
    $('#btn-transpose-toggle').classList.toggle('active', !panel.hidden);
  });

  $('#btn-t-up').addEventListener('click', () => {
    state.semitones++;
    applyTranspose();
  });
  $('#btn-t-down').addEventListener('click', () => {
    state.semitones--;
    applyTranspose();
  });
  $('#btn-t-reset').addEventListener('click', () => {
    state.semitones = 0;
    applyTranspose();
  });

  // Live bar transpo
  $('#lb-t-up').addEventListener('click', () => { state.semitones++; applyTranspose(); });
  $('#lb-t-down').addEventListener('click', () => { state.semitones--; applyTranspose(); });

  // Capo
  document.querySelectorAll('#capo-row span').forEach((el) => {
    el.addEventListener('click', () => {
      state.capo = Number(el.dataset.capo);
      syncTransposePanel();
    });
  });

  // Toggle accords
  $('#toggle-chords').addEventListener('click', () => {
    state.showChords = !state.showChords;
    $('#toggle-chords').classList.toggle('on', state.showChords);
    $('#toggle-chords').textContent = state.showChords ? '✓' : '';
    $('#reader-content').classList.toggle('no-chords', !state.showChords);
  });

  // ---- Setlist ----
  $('#nav-setlists').addEventListener('click', () => {
    state.currentSetlistId = state.setlists[0]?.id || null;
    openSetlistView();
  });

  $('#btn-set-back').addEventListener('click', () => {
    state.currentSetlistId = null;
    showView('library');
    renderLibrary();
  });

  $('#btn-new-setlist').addEventListener('click', () => {
    $('#setlist-dialog').showModal();
    $('#sl-name').value = '';
    $('#sl-name').focus();
  });

  $('#sl-cancel').addEventListener('click', () => $('#setlist-dialog').close());
  $('#setlist-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#sl-name').value.trim();
    if (!name) return;
    await db.addSetlist({ name });
    state.setlists = await db.getAllSetlists();
    state.currentSetlistId = state.setlists[0].id;
    $('#setlist-dialog').close();
    renderSetlistSidebar();
    renderSetlistDetail();
  });

  // Picker
  $('#picker-cancel').addEventListener('click', () => $('#picker-dialog').close());

  // ---- Raccourcis clavier globaux ----
  document.addEventListener('keydown', (e) => {
    const inReader = !viewReader.hidden;
    const inLibrary = !viewLibrary.hidden;
    const inDialog = !!document.querySelector('dialog[open]');
    if (inDialog) return;

    if (inReader) {
      if (e.key === 'Escape') {
        closeReader();
        if (state.currentSetlistId) openSetlistView();
      }
      if (e.key === ' ') { e.preventDefault(); toggleScroll(); }
      if (e.key === '+' || e.key === '=') changeFont(+2);
      if (e.key === '-') changeFont(-2);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (state.concertMode) concertNext();
        else nextPage();
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (state.concertMode) concertPrev();
        else prevPage();
      }
    }
    if (inLibrary) {
      if (e.key === '/') {
        e.preventDefault();
        $('#lib-search').focus();
      }
    }
  });
}

// ============================================================
// UTILITAIRES
// ============================================================
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatRelativeDate(iso) {
  if (!iso) return 'jamais';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000)   return "à l'instant";
  if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)} h`;
  const days = Math.floor(diff / 86400000);
  if (days === 1) return 'hier';
  if (days < 30)  return `il y a ${days} j`;
  return d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' });
}

// ============================================================
// SERVICE WORKER
// ============================================================
function registerServiceWorker() {
  // Pas de service worker sur localhost : évite de servir des assets en cache
  // pendant le développement (le SW cache-first masque les modifications).
  const isLocalDev = ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && !isLocalDev) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// ============================================================
// DÉMARRAGE
// ============================================================
boot();
