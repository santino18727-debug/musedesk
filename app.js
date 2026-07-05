// app.js — Orchestration complète de MuseDesk
// Vanilla ES6 modules, aucune dépendance externe.
// ---------------------------------------------------------------------------
import * as db from './db.js?v=13';
import { renderSongHTML, detectKey, transposeChord, parseSong, isChord } from './parser.js?v=13';
import { initSync, syncNow, GoogleDriveProvider, isSyncEnabled, getProvider } from './sync.js?v=13';
import { LocalFolderProvider } from './fsprovider.js?v=13';
import { GOOGLE_CLIENT_ID } from './config.js?v=13';
import { extractChordSheetFromPDF, titleFromFilename } from './pdfimport.js?v=13';
import * as live from './live.js?v=13';

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
  scrollTimer: null,   // C3 : timer du défilement par paliers (prefers-reduced-motion)
  twoCol: false,

  // Setlist
  currentSetlistId: null,
  concertMode: false,  // true = navigation dans une setlist
  concertIndex: 0,     // position dans la setlist

  // Drag & drop setlist
  dragSrc: null,

  // Diagrammes d'accords
  showDiagrams: false,

  // Édition en cours (null = import, id = édition)
  editingSongId: null,
};

// ============================================================
// MODE PUPITRE (multijoueur live leader→followers) — état + adaptateurs
// ============================================================
const pupitre = {
  active: false,          // session live en cours (leader OU follower)
  role: null,             // 'leader' | 'follower'
  memSongs: null,         // {songId: song} en mémoire (follower, hors IndexedDB)
  memSetlist: null,       // setlist reçue (follower)
  peers: 0,               // nb followers connectés (vu côté leader)
  joinUrl: null,          // P2 : lien de session mémorisé tant que le leader diffuse
                          //      (réaffiché à la réouverture SANS recréer de session)
  soloShare: false,       // P3 : true si on partage un morceau seul (hors setlist)
  _scrollTimer: null,     // throttle scroll leader
  applyingRemote: false,  // true pendant l'application d'un state distant (anti-boucle)
};
const isFollower = () => pupitre.active && pupitre.role === 'follower';

// Adaptateur : en mode follower on lit le morceau depuis le snapshot mémoire,
// jamais dans IndexedDB (données de session éphémères). Sinon db.getSong normal.
async function getSongForRender(songId) {
  if (isFollower() && pupitre.memSongs) return pupitre.memSongs[songId] || null;
  return db.getSong(songId);
}
// Idem pour la setlist courante.
async function getSetlistForRender(setlistId) {
  if (isFollower() && pupitre.memSetlist) return pupitre.memSetlist;
  return db.getSetlist(setlistId);
}

// ============================================================
// RACCOURCIS DOM
// ============================================================
const $ = (sel) => document.querySelector(sel);

// Mémoïsation de detectKey : parseSong est coûteux et était rappelé pour
// CHAQUE carte à CHAQUE frappe de recherche / re-render. Le contenu est la clé.
const _keyCache = new Map();
function keyOf(content) {
  if (_keyCache.has(content)) return _keyCache.get(content);
  const k = detectKey(content);
  _keyCache.set(content, k);
  return k;
}

// Transposition effective affichée = transpose manuel − capo.
// Capo N = on FRETTE des accords plus simples (décalés de −N demi-tons),
// la hauteur sonore réelle restant celle de la tonalité transposée.
function effSemitones() {
  return state.semitones - state.capo;
}

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
  initSyncProviders();
  await maybeStartFollower();
}

// Détecte un lien #join=… et bascule l'app en mode follower (lecture seule).
async function maybeStartFollower() {
  const token = live.getJoinToken();
  if (!token || !live.isRelayConfigured()) return;
  pupitre.active = true;
  pupitre.role = 'follower';
  document.body.classList.add('pupitre-follower');
  showFollowerBanner('connecting');
  try {
    live.joinSession(token, {
      onStatus: (st) => showFollowerBanner(st),
      onSnapshot: (setlist, songs) => {
        pupitre.memSetlist = setlist;
        pupitre.memSongs = songs || {};
        state.currentSetlistId = setlist ? setlist.id : null;
      },
      onState: (s) => { applyRemoteState(s); },
      onLeaderGone: () => showFollowerBanner('leader-gone'),
      onError: (code) => showFollowerBanner('error:' + code),
    });
  } catch (err) {
    console.warn('[pupitre] follower join failed:', err);
    showFollowerBanner('offline');
  }
}

// --- Mode Pupitre : démarrage d'une session LEADER + QR -------------------
async function buildCurrentSnapshot() {
  // Cas normal : le morceau courant appartient à la setlist partagée → on envoie
  // la setlist + le contenu de TOUS ses morceaux (le follower n'a pas la base).
  const sl = state.currentSetlistId ? await db.getSetlist(state.currentSetlistId) : null;
  if (sl && (sl.songIds || []).length &&
      state.current && sl.songIds.includes(state.current.id)) {
    const songs = {};
    for (const id of sl.songIds) {
      const s = await db.getSong(id);
      if (s) songs[id] = s;
    }
    return { setlist: sl, songs };
  }
  // P3 — hors setlist (ou morceau courant absent de la setlist courante) :
  // partager le morceau courant SEUL (pseudo-setlist mono) plutôt que de laisser
  // le follower « live » sur un écran vide. id '_solo' ne collisionne pas (uuids).
  if (state.current) {
    const song = state.current;
    return {
      setlist: { id: '_solo', name: song.title, songIds: [song.id], overrides: {} },
      songs: { [song.id]: song },
    };
  }
  return null;
}

// P2 — met à jour le statut de session à la fois dans le dialogue ET sur le
// bouton toolbar (#btn-pupitre), pour qu'une perte de connexion soit visible même
// dialogue fermé (F4). st ∈ 'connecting'|'live'|'offline'|'error'.
function updatePupitreStatus(st, code) {
  const statusEl = $('#pupitre-status');
  if (statusEl) {
    if (st === 'live')        { statusEl.textContent = '🟢 Session active';    statusEl.className = 'drive-status status-on'; }
    else if (st === 'offline'){ statusEl.textContent = '⚠️ Relais injoignable'; statusEl.className = 'drive-status status-off'; }
    else if (st === 'error')  { statusEl.textContent = '⚠️ ' + translateLiveError(code); statusEl.className = 'drive-status status-off'; }
    else                      { statusEl.textContent = 'Connexion…';           statusEl.className = 'drive-status status-off'; }
  }
  pupitre._lastStatus = st;
  updateBtnPupitreIndicator();
}
function updatePupitrePeers(n) {
  const prev = pupitre.peers;
  pupitre.peers = n;
  const peersEl = $('#pupitre-peers');
  if (peersEl) peersEl.textContent = `${n} pupitre${n > 1 ? 's' : ''} connecté${n > 1 ? 's' : ''}`;
  updateBtnPupitreIndicator();
  // Vérifié en E2E contre le vrai relais : celui-ci rejoue le SNAPSHOT au
  // retardataire mais PAS le dernier state → il resterait bloqué à la position
  // par défaut jusqu'au prochain geste du leader. Quand un peer rejoint (n monte),
  // on re-pousse la position courante pour le rattraper immédiatement.
  if (n > prev && pupitre.active && pupitre.role === 'leader') pushLiveStateNow();
}
// F4 — reflète l'état de diffusion sur le bouton toolbar (classe .active + compteur peers).
function updateBtnPupitreIndicator() {
  const bp = $('#btn-pupitre');
  if (!bp) return;
  const leaderLive = pupitre.active && pupitre.role === 'leader' && !!pupitre.joinUrl;
  bp.classList.toggle('active', leaderLive);
  bp.classList.toggle('pupitre-offline', leaderLive && pupitre._lastStatus === 'offline');
  if (leaderLive) {
    const n = pupitre.peers;
    bp.textContent = `📡 En direct${n > 0 ? ` · ${n}` : ''}`;
    bp.setAttribute('aria-label', `Session Pupitre active — ${n} pupitre${n > 1 ? 's' : ''} connecté${n > 1 ? 's' : ''}. Ouvrir le panneau.`);
  } else {
    bp.textContent = '📡 Mode Pupitre';
    bp.removeAttribute('aria-label');
  }
}

// P2 — crée la session UNE SEULE FOIS. Réappels = no-op (le token/joinUrl est
// conservé) : rouvrir le dialogue pour un retardataire ne régénère plus le QR et
// ne casse plus les followers déjà connectés (F2).
async function ensurePupitreSession() {
  if (!live.isRelayConfigured()) return false;
  if (pupitre.active && pupitre.role === 'leader' && pupitre.joinUrl) return true; // déjà en cours
  pupitre.active = true;
  pupitre.role = 'leader';
  updatePupitreStatus('connecting');
  try {
    const { joinUrl } = await live.createSession({
      onStatus: (st) => updatePupitreStatus(st),
      onPeers:  (n)  => updatePupitrePeers(n),
      onError:  (code) => updatePupitreStatus('error', code),
    });
    pupitre.joinUrl = joinUrl;
    const snap = await buildCurrentSnapshot();
    if (snap) { live.pushSnapshot(snap); pupitre.soloShare = snap.setlist.id === '_solo'; }
    pushLiveStateNow();
    updateBtnPupitreIndicator();
    return true;
  } catch (err) {
    console.warn('[pupitre] createSession failed:', err);
    pupitre.active = false; pupitre.role = null; pupitre.joinUrl = null;
    updatePupitreStatus('offline');
    return false;
  }
}

// Ouvre le dialogue et RÉAFFICHE le lien + QR mémorisés (crée la session au
// premier appel seulement). C'est le point d'entrée du bouton toolbar.
async function openPupitreDialog() {
  const dlg = $('#pupitre-dialog');
  if (dlg && !dlg.open) dlg.showModal();
  const ok = await ensurePupitreSession();
  if (ok && pupitre.joinUrl) {
    const urlInput = $('#pupitre-url');
    if (urlInput) urlInput.value = pupitre.joinUrl;
    renderPupitreQR(pupitre.joinUrl);
  }
  updatePupitreSoloNote();
}

// P3 — note non bloquante quand on diffuse un morceau seul (hors setlist).
function updatePupitreSoloNote() {
  const dlg = $('#pupitre-dialog');
  if (!dlg) return;
  let note = $('#pupitre-solo-note');
  if (pupitre.soloShare) {
    if (!note) {
      const statusEl = $('#pupitre-status');
      note = document.createElement('p');
      note.id = 'pupitre-solo-note';
      note.className = 'settings-help';
      note.textContent = 'Tu partages ce morceau seul. Démarre le concert depuis une setlist pour enchaîner les morceaux.';
      statusEl?.insertAdjacentElement('afterend', note);
    }
    note.hidden = false;
  } else if (note) {
    note.hidden = true;
  }
}

// P2 — termine proprement la session leader et remet le bouton à l'état repos.
function endPupitreSession() {
  live.close();
  pupitre.active = false;
  pupitre.role = null;
  pupitre.joinUrl = null;
  pupitre.peers = 0;
  pupitre.soloShare = false;
  pupitre._lastStatus = null;
  updateBtnPupitreIndicator();
}

// Rend le QR dans #pupitre-qr. Lib vendor optionnelle (qrcode global) :
// si absente, on dégrade en affichant juste le lien (déjà visible dans l'input).
function renderPupitreQR(url) {
  const box = $('#pupitre-qr');
  if (!box) return;
  box.innerHTML = '';
  // La lib kazuhikoarase expose un global `qrcode(typeNumber, errorCorrection)`.
  if (typeof qrcode === 'function') {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      box.innerHTML = qr.createImgTag(5, 8);
      // Image décorative pour les lecteurs d'écran (le lien est déjà lisible dans l'input)
      box.querySelector('img')?.setAttribute('alt', '');
      return;
    } catch (e) {
      console.warn('[pupitre] QR render failed:', e);
    }
  }
  // Fallback : pas de lib QR → message + lien (l'input reste affiché).
  box.textContent = 'QR indisponible — copie le lien ci-dessous.';
}

// Traduit un code d'erreur relais technique en message FR. Partagé par le bandeau
// follower ET le statut leader (#pupitre-status) — avant, seul le follower traduisait.
function translateLiveError(code) {
  const errorFR = {
    'payload-too-large': 'Setlist trop volumineuse pour être partagée',
    'relay-not-configured': 'Relais non configuré',
  };
  return errorFR[code]
    || (String(code).startsWith('ws-policy-') ? 'Connexion refusée par le relais' : 'Erreur de connexion');
}

// Met à jour le bandeau follower (#follower-banner doit exister dans index.html).
// C5a : pose les classes d'état (.connecting/.live/.offline/.leader-gone) attendues
// par le CSS du lot A ; C5b : texte explicite en mode live ; C5c : bouton « Quitter
// le suivi » ; C5d : traduction FR des codes d'erreur techniques (code brut en title).
function showFollowerBanner(status) {
  const el = document.querySelector('#follower-banner');
  if (!el) return;
  const labels = {
    connecting: '🔄 Connexion au pupitre…',
    live: '📡 Mode lecture seule — tu suis le pupitre du leader',
    offline: '⚠️ Hors ligne — relais injoignable',
    'leader-gone': '⏹ Le leader a quitté la session',
  };
  let label = labels[status];
  let cls = status;
  let title = '';
  if (!label && status.startsWith('error:')) {
    const code = status.slice(6);
    label = '⚠️ ' + translateLiveError(code);
    cls = 'offline';   // état visuel d'erreur (rouge, cf. lot A)
    title = code;      // le code technique reste accessible au survol pour le debug
  }
  if (!label) { label = status; cls = 'offline'; }
  el.className = 'follower-banner ' + cls;
  el.title = title;
  // Issue 9 — on ne met à jour QUE le texte (dans la live region) ; le bouton
  // « Quitter le suivi » est créé une seule fois et jamais reconstruit : son
  // focus survit aux changements d'état et n'est plus ré-annoncé à chaque fois.
  let txt = el.querySelector('#follower-banner-text');
  if (!txt) {
    txt = document.createElement('span');
    txt.id = 'follower-banner-text';
    txt.setAttribute('role', 'status');
    el.appendChild(txt);
  }
  txt.textContent = label;
  if (!el.querySelector('.follower-leave')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn follower-leave';
    btn.textContent = 'Quitter le suivi';
    btn.addEventListener('click', leaveFollowerMode);
    el.appendChild(btn);
  }
  el.hidden = false;
}

// C5c : quitte le mode follower — coupe la WS, retire #join=… de l'URL (sinon un
// rechargement relancerait maybeStartFollower), nettoie l'état et revient à la
// bibliothèque (les données locales du follower n'ont jamais été touchées).
function leaveFollowerMode() {
  live.close();
  pupitre.active = false;
  pupitre.role = null;
  pupitre.memSongs = null;
  pupitre.memSetlist = null;
  document.body.classList.remove('pupitre-follower');
  history.replaceState(null, '', location.pathname + location.search);
  const banner = document.querySelector('#follower-banner');
  if (banner) banner.hidden = true;
  state.currentSetlistId = null;
  closeReader();       // stoppe scroll/métronome et bascule sur la bibliothèque
  renderLibrary();
}

// Écran d'erreur fatale : sans ça, un échec d'initDB (Safari privé, quota
// dépassé, IndexedDB désactivé) laisse une page blanche muette. On affiche un
// message lisible plutôt que de mourir en silence dans la console.
let _fatalShown = false;
function showFatalError(err) {
  if (_fatalShown) return;
  _fatalShown = true;
  console.error('MuseDesk — erreur fatale au démarrage:', err);
  const o = document.createElement('div');
  o.setAttribute('role', 'alert');
  o.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;'
    + 'justify-content:center;padding:24px;background:#181310;color:#ece2cf;'
    + 'font-family:system-ui,sans-serif;text-align:center';
  o.innerHTML = '<div style="max-width:34rem">'
    + '<div style="font-size:40px;margin-bottom:12px">🎼</div>'
    + '<h1 style="font-size:20px;margin:0 0 10px">MuseDesk n’a pas pu démarrer</h1>'
    + '<p style="color:#a8987c;line-height:1.5;margin:0 0 16px">Le stockage local est peut-être '
    + 'inaccessible (navigation privée, espace disque saturé, ou stockage désactivé). '
    + 'Réessaie dans une fenêtre normale ou libère de l’espace.</p>'
    + '<button id="md-fatal-reload" style="font:inherit;padding:9px 18px;border-radius:8px;'
    + 'border:none;background:#e0703a;color:#1a0e06;font-weight:600;cursor:pointer">Recharger</button>'
    + '</div>';
  document.body.appendChild(o);
  const btn = o.querySelector('#md-fatal-reload');
  if (btn) btn.addEventListener('click', () => location.reload());
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
  // Issue 2 — poser `hidden` sur la vue qui contient le focus le renvoie sur
  // <body> : on repose le focus sur le h1 de la vue affichée (fait aussi office
  // d'annonce du changement de contexte pour les lecteurs d'écran).
  const view = name === 'library' ? viewLibrary : name === 'reader' ? viewReader : viewSetlist;
  const h = view && view.querySelector('h1');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  closeDrawer(); // M12 : changer de vue ferme le tiroir mobile s'il était ouvert
}

// ============================================================
// M12 — TIROIR MOBILE (hamburger) : sidebars en overlay <700px
// ============================================================
function setDrawer(open) {
  document.body.classList.toggle('drawer-open', open);
  document.querySelectorAll('.drawer-toggle').forEach((b) => b.setAttribute('aria-expanded', String(open)));
}
function closeDrawer() { setDrawer(false); }
function setupDrawer() {
  // Délégation : couvre le hamburger biblio (statique) ET celui de la vue setlist
  // (généré dans le detail-head). Un seul handler, pas de double-toggle.
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('.drawer-toggle')) setDrawer(!document.body.classList.contains('drawer-open'));
  });
  $('#drawer-backdrop')?.addEventListener('click', closeDrawer);
  // Escape ferme le tiroir en priorité (capture avant les autres handlers Escape).
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('drawer-open')) { e.stopPropagation(); closeDrawer(); }
  }, true);
  // Cliquer une action dans une sidebar ferme le tiroir (on a navigué).
  ['#lib-sidebar', '#set-sidebar'].forEach((sel) => {
    document.querySelector(sel)?.addEventListener('click', (e) => {
      if (e.target.closest('.nav-item, .btn, .set-item, .back')) closeDrawer();
    });
  });
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
  $('#badge-rec').textContent = Math.min(state.songs.length, 12);
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

  renderGrid(songs, { libraryEmpty: state.songs.length === 0 });
  renderTagList();
  renderAlphaBar(songs);
}

// Palette CHAUDE déterministe par titre — alignée sur l'identité « zéro bleu »
// (terracotta/ocre/brique/vert encre). Remplace les dégradés bleus/violets du
// mockup d'origine (R2), sur la surface la plus visible de l'app (pochettes).
const COVER_PALETTES = [
  ['#e0703a', '#c85a28'], // terracotta
  ['#f5a35e', '#e0703a'], // ocre clair
  ['#b0552f', '#8a3d1e'], // brique
  ['#5fb574', '#3d8a54'], // vert encre
  ['#c9a15a', '#a87c34'], // ocre doré
  ['#e05a4a', '#b03a2e'], // rouge chaud
  ['#8a6a48', '#5f4630'], // brun sépia
  ['#d4b483', '#b08a52'], // sable
  ['#e8894f', '#cf6a30'], // orange brûlé
  ['#9c7b4a', '#6f5230'], // bronze
];
function coverHash(title) {
  let h = 0;
  const s = title || '?';
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xfffffff;
  return h;
}
// Luminance perceptuelle (0..255) pour choisir une encre lisible sur la pochette.
function coverLuminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}
// Style inline complet de la pochette : dégradé de fond + encre adaptée (sombre
// sur pochette claire, crème sinon) — corrige le #fff illisible (~1.6:1) sur les
// teintes claires.
function coverStyle(title) {
  const pair = COVER_PALETTES[coverHash(title) % COVER_PALETTES.length];
  const lum = (coverLuminance(pair[0]) + coverLuminance(pair[1])) / 2;
  const ink = lum > 150 ? 'var(--accent-ink)' : 'var(--text)';
  return `background:linear-gradient(135deg,${pair[0]},${pair[1]});color:${ink}`;
}

function renderGrid(songs, { libraryEmpty = false } = {}) {
  const grid = $('#song-grid');
  grid.innerHTML = '';

  if (!songs.length) {
    // Bibliothèque encore vierge vs. simple filtre/recherche sans résultat :
    // deux temps morts distincts, deux tons — l'un accueille, l'autre rassure.
    grid.innerHTML = libraryEmpty
      ? `<p class="empty">Le pupitre est encore vierge.<br>
          <small>Importe une première partition — elle t'attend pour prendre l'encre.</small></p>`
      : `<p class="empty">Rien sous ce filtre, pour l'instant.<br>
          <small>Élargis la recherche, ou importe un nouveau morceau.</small></p>`;
    return;
  }

  for (const song of songs) {
    const key = keyOf(song.content);
    const initial = (song.title || '?')[0].toUpperCase();
    // Issue 10 — la carte n'est PLUS role=button : elle contient un <button>.fav
    // (button dans button = interdit ARIA). Même pattern que .song-row (Issue 3) :
    // seul le titre .t devient activable au clavier (makeA11yButton), le clic
    // souris sur toute la carte reste actif en bonus.
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = song.id;

    card.innerHTML = `
      <div class="card-top">
        <div class="cover" aria-hidden="true" style="${coverStyle(song.title)}">${escapeHTML(initial)}</div>
      </div>
      <button class="fav${song.favorite ? ' on' : ''}" data-id="${song.id}" title="Favori" aria-label="${song.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}" aria-pressed="${song.favorite}">★</button>
      <div class="t">${escapeHTML(song.title)}</div>
      <div class="a">${escapeHTML(song.artist || '—')}</div>
      <div class="card-foot">
        ${key ? `<span class="key-badge">${escapeHTML(key)}</span>` : ''}
        ${(song.tags || []).slice(0, 2).map((t) => `<span class="tag-pill">${escapeHTML(t)}</span>`).join('')}
      </div>
    `;

    // Clic souris sur la carte → lecteur (sauf sur le ★ favori)
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('fav')) return;
      openReader(song.id);
    });
    // Titre activable au clavier (role=button + tabindex ; Entrée/Espace gérés par
    // le handler global). Le clic bulle vers le handler de la carte ci-dessus.
    makeA11yButton(card.querySelector('.t'), `Ouvrir « ${song.title} »`);

    // Clic favori
    card.querySelector('.fav').addEventListener('click', async (e) => {
      e.stopPropagation();
      await db.toggleFavorite(song.id);

      const idx = state.songs.findIndex((s) => s.id === song.id);
      if (idx !== -1) {
        state.songs[idx].favorite = !state.songs[idx].favorite;
      }

      renderLibrary();
      // Issue 6 — renderLibrary() détruit la grille : reposer le focus sur le ★
      // reconstruit (même pattern que les .row-move de setlist).
      document.querySelector(`.fav[data-id="${song.id}"]`)?.focus();
      scheduleAutoSync();
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
  const tagColors = ['var(--chord)', 'var(--accent)', 'var(--go)', 'var(--chord-strong)', '#c9a15a', '#b0552f'];
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
    makeA11yButton(el, `Filtrer par tag ${tag}`);
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
    a.textContent = l;
    if (!letters.has(l)) {
      // Issue 15 — lettre sans morceau : repère visuel seul (pas de href → non
      // focusable, aria-hidden → pas de tab-stop ni d'annonce parasite).
      a.setAttribute('aria-hidden', 'true');
      bar.appendChild(a);
      return;
    }
    a.href = '#';
    a.classList.add('has');
    a.setAttribute('aria-label', `Aller aux morceaux commençant par ${l}`);
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
  // Issue 7 — exposer le filtre courant aux lecteurs d'écran (pas que la classe).
  document.querySelectorAll('.nav-item[data-filter]').forEach((el) => {
    const on = el.dataset.filter === filter;
    el.classList.toggle('active', on);
    el.setAttribute('aria-pressed', String(on));
  });
  renderLibrary();
}

// ============================================================
// VUE LECTEUR
// ============================================================

async function openReader(songId, opts = {}) {
  const song = await getSongForRender(songId);
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
  await updateSetlistPositionBadge();  // C8 : badge « n/N » en lecture setlist

  // Tempo mémorisé par morceau (pré-réglage du métronome, comme Soundbrenner).
  if (Number.isFinite(song.bpm) && song.bpm >= 40) setMetroBPM(song.bpm);
  updateMetroUI();

  // S'assurer que le panneau transpose est fermé à l'ouverture
  $('#transpose-panel').hidden = true;
  $('#btn-transpose-toggle').classList.remove('active');
  $('#btn-transpose-toggle').setAttribute('aria-expanded', 'false');

  showView('reader');

  // Retour en haut
  $('#reader-content').scrollTop = 0;
  pushLiveStateNow();
}

// --- Mode Pupitre : émission de l'état (leader) ---------------------------
function currentLiveState() {
  const rc = document.querySelector('#reader-content');
  const denom = rc ? (rc.scrollHeight - rc.clientHeight) : 0;
  const scrollPct = rc && denom > 0 ? rc.scrollTop / denom : 0;
  return {
    songId: state.current ? state.current.id : null,
    idx: state.concertIndex,
    semitones: state.semitones,
    capo: state.capo,
    scrollPct,
    twocol: state.twoCol,
    font: state.fontSize,
  };
}
function pushLiveStateNow() {
  if (pupitre.active && pupitre.role === 'leader') live.pushState(currentLiveState());
}
// Throttle ~150ms pour le scroll (haute fréquence) ; immédiat pour le reste.
function pushLiveStateThrottled() {
  if (!(pupitre.active && pupitre.role === 'leader')) return;
  if (pupitre._scrollTimer) return;
  pupitre._scrollTimer = setTimeout(() => {
    pupitre._scrollTimer = null;
    live.pushState(currentLiveState());
  }, 150);
}

// --- Mode Pupitre : application d'un état distant (follower, lecture seule) --
async function applyRemoteState(s) {
  if (!s) return;
  pupitre.applyingRemote = true;
  try {
    // 1. Bon morceau ? (ouvre depuis le snapshot mémoire si changement)
    if (s.songId && (!state.current || state.current.id !== s.songId)) {
      state.concertIndex = s.idx ?? state.concertIndex;
      await openReader(s.songId, { semitones: s.semitones || 0, capo: s.capo || 0 });
      // Annonce lecteur d'écran (uniquement au changement de morceau, pas au scroll/transpose)
      const ann = document.querySelector('#follower-announcer');
      if (ann && state.current) ann.textContent = `Le leader est passé à « ${state.current.title} »`;
    } else {
      state.semitones = s.semitones || 0;
      state.capo = s.capo || 0;
      applyTranspose();
    }
    // 2. Issue 12 — on N'IMPOSE PLUS la police du leader : le follower garde SA
    // taille de lecture (un écran 27" ne doit pas dicter 26px à une tablette 8").
    // scrollPct étant en %, la synchro de position reste juste quelle que soit la
    // hauteur rendue localement. Le 2col reste synchronisé (impacte la structure).
    const rc = document.querySelector('#reader-content');
    const wantTwoCol = !!s.twocol;
    if (state.twoCol !== wantTwoCol) {
      state.twoCol = wantTwoCol;
      document.querySelector('#btn-twocol')?.classList.toggle('active', state.twoCol);
      document.querySelector('#btn-twocol')?.setAttribute('aria-pressed', String(state.twoCol));
      renderSong();
    }
    // 3. Scroll en dernier, sur la hauteur finale
    if (rc && typeof s.scrollPct === 'number') {
      const denom = rc.scrollHeight - rc.clientHeight;
      rc.scrollTop = denom > 0 ? s.scrollPct * denom : 0;
    }
  } finally {
    pupitre.applyingRemote = false;
  }
}

function renderSong() {
  const content = $('#reader-content');
  // Conserver les zones de tap
  const tapL = '<div class="tap l" aria-hidden="true">‹</div>';
  const tapR = '<div class="tap r" aria-hidden="true">›</div>';
  content.innerHTML = tapL + tapR + renderSongHTML(state.current.content, { semitones: effSemitones() });

  // Mode 2 colonnes
  content.classList.toggle('two-col', state.twoCol);
  // Mode sans accords
  content.classList.toggle('no-chords', !state.showChords);

  // Diagrammes (re-render car la transposition peut avoir changé)
  renderChordDiagrams();
}

function closeReader() {
  stopScroll();
  cleanupMetronome(); // arrêt propre du métronome
  state.current      = null;
  state.concertMode  = false;
  state.twoCol       = false;
  $('#reader-content').classList.remove('two-col', 'no-chords');
  $('#btn-twocol').classList.remove('active');
  $('#btn-twocol').setAttribute('aria-pressed', 'false');
  showView('library');
}

// --- Taille de police -------------------------------------------------------
function applyFontSize() {
  $('#reader-content').style.fontSize = state.fontSize + 'px';
  $('#font-slider').value = state.fontSize;
  pushLiveStateNow();
}
function changeFont(delta) {
  // Issue 12 — autorisé aussi en follower : régler SA propre taille de lecture
  // (le follower ne pousse rien — pushLiveState ne s'exécute que pour le leader).
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
  pushLiveStateNow();
}

function syncTransposePanel() {
  if (!state.current) return;
  const key = detectKey(state.current.content) || '?';
  const transKey = state.semitones ? transposeKey(key, state.semitones) : key;

  $('#t-from').textContent = key;
  $('#t-to').textContent   = state.semitones !== 0 ? ` → ${transKey}` : '';

  // Capo — Issue 5 : exposer l'état sélectionné aux lecteurs d'écran (pas que .on)
  document.querySelectorAll('#capo-row span').forEach((el) => {
    const on = Number(el.dataset.capo) === state.capo;
    el.classList.toggle('on', on);
    el.setAttribute('aria-pressed', String(on));
  });

  // Badge toolbar — tonalité sonore (+ capo en aide de jeu)
  const keyBadge = $('#reader-key');
  const capoTxt = state.capo > 0 ? ` · Capo ${state.capo}` : '';
  keyBadge.textContent = transKey + capoTxt;
  keyBadge.style.display = (transKey && transKey !== '?') || state.capo > 0 ? '' : 'none';
}

function syncLiveBar() {
  if (!state.current) return;
  const key = detectKey(state.current.content) || '—';
  $('#lb-key').textContent = state.semitones ? transposeKey(key, state.semitones) : key;
  $('#lb-play').textContent = state.scrollActive ? '⏸' : '▶';
  $('#lb-play').setAttribute('aria-pressed', String(state.scrollActive));
}

// --- Auto-scroll ------------------------------------------------------------
// C7 : point unique de mise à jour de la vitesse (sliders panneau + livebar +
// boutons ±) — garde les trois contrôles synchronisés, plage 1-10.
function setScrollSpeed(v) {
  state.scrollSpeed = Math.max(1, Math.min(10, v));
  const lb = $('#lb-speed');
  const ps = $('#speed-slider');
  if (lb) lb.value = state.scrollSpeed;
  if (ps) ps.value = state.scrollSpeed;
}

function toggleScroll() {
  if (isFollower()) return;                              // B6 : follower lecture seule
  state.scrollActive ? stopScroll() : startScroll();
}

function startScroll() {
  state.scrollActive = true;
  $('#lb-play').textContent = '⏸';
  $('#lb-play').setAttribute('aria-pressed', 'true');
  $('#btn-scroll').classList.add('active');
  $('#btn-scroll').textContent = '⏸ Scroll';
  $('#btn-scroll').setAttribute('aria-pressed', 'true');

  const content = $('#reader-content');

  // C3 (A3 audit) : prefers-reduced-motion — le glissement continu en rAF est un
  // risque vestibulaire que la règle CSS ne peut pas couvrir (scroll impératif JS).
  // On ne DÉSACTIVE pas l'auto-scroll (fonctionnalité centrale sur scène) : on le
  // remplace par des paliers discrets. Débit équivalent au mode continu :
  // vitesse continue ≈ speed × 0.3 px/frame ≈ speed × 18 px/s (à 60 fps) ;
  // chaque palier saute ~2 lignes rendues (≈ fontSize × 1.5 × 2) et l'intervalle
  // est dérivé de ce débit → même vitesse de lecture, sans mouvement continu.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const tick = () => {
      if (!state.scrollActive) return;
      const stepPx = Math.max(1, Math.round(state.fontSize * 1.5 * 2)); // ~2 lignes
      content.scrollBy(0, stepPx);
      // Arrêt automatique en bas (même seuil que le mode continu)
      if (content.scrollTop + content.clientHeight >= content.scrollHeight - 2) {
        stopScroll();
        return;
      }
      const pxPerSec = state.scrollSpeed * 18; // recalculé à chaque palier (slider vivant)
      state.scrollTimer = setTimeout(tick, (stepPx / pxPerSec) * 1000);
    };
    const firstPxPerSec = state.scrollSpeed * 18;
    const firstStep = Math.max(1, Math.round(state.fontSize * 1.5 * 2));
    state.scrollTimer = setTimeout(tick, (firstStep / firstPxPerSec) * 1000);
    return;
  }

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
  if (state.scrollTimer) clearTimeout(state.scrollTimer);  // C3 : mode paliers
  state.scrollTimer = null;
  state.scrollAcc = 0;
  const btn = $('#btn-scroll');
  if (btn) {
    btn.classList.remove('active');
    btn.textContent = '▶ Scroll';
    btn.setAttribute('aria-pressed', 'false');
  }
  const lbPlay = $('#lb-play');
  if (lbPlay) {
    lbPlay.textContent = '▶';
    lbPlay.setAttribute('aria-pressed', 'false');
  }
}

// --- Pagination --------------------------------------------------------------
// 1 colonne  : défilement vertical d'~une hauteur d'écran.
// 2 colonnes : les colonnes débordent HORIZONTALEMENT (overflow-x), on pagine
//   d'une "page" = N colonnes côte à côte. Le pas n'est PAS clientWidth : à cause
//   de l'asymétrie padding (gauche+droite) vs un seul column-gap interne, scroller
//   de clientWidth dérive de (padL+padR-gap) px par page → le texte finit rogné au
//   bord dès la 3e/4e page. Le bon pas vaut clientWidth - padL - padR + gap (vérifié
//   géométriquement : chaque page retombe pile sur le bord gauche). On positionne en
//   ABSOLU (page * pas) pour éliminer toute dérive cumulative d'arrondi.
function colPageStride(content) {
  const cs = getComputedStyle(content);
  const padL = parseFloat(cs.paddingLeft)  || 0;
  const padR = parseFloat(cs.paddingRight) || 0;
  const gap  = parseFloat(cs.columnGap)    || 0;
  return Math.max(1, content.clientWidth - padL - padR + gap);
}

// P1 — pagine DANS le morceau et retourne true si un déplacement a eu lieu,
// false si on était déjà en butée (début/fin). Le mode concert s'en sert pour
// ne changer de morceau qu'une fois arrivé au bout — sinon un tap réflexe en
// bord d'écran saute au morceau suivant en plein milieu (l'accident de scène).
function pageBy(dir) {
  if (isFollower()) return false;                       // B6 : follower lecture seule
  const content = $('#reader-content');
  const margin = 2;                                     // tolérance arrondi subpixel
  if (state.twoCol) {
    const stride = colPageStride(content);
    const cur = Math.round(content.scrollLeft / stride);
    const maxPage = Math.round((content.scrollWidth - content.clientWidth) / stride);
    const next = cur + dir;
    if (next < 0 || next > maxPage) return false;       // butée colonne
    content.scrollTo({ left: Math.max(0, next) * stride, behavior: 'smooth' });
    return true;
  }
  const atTop    = content.scrollTop <= margin;
  const atBottom = content.scrollTop + content.clientHeight >= content.scrollHeight - margin;
  if (dir > 0 && atBottom) return false;
  if (dir < 0 && atTop)    return false;
  content.scrollBy({ top: dir * content.clientHeight * 0.9, behavior: 'smooth' });
  return true;
}

function nextPage() { pageBy(1); }
function prevPage() { pageBy(-1); }

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
  const sl = await getSetlistForRender(state.currentSetlistId);
  if (!sl) return;
  const songId = sl.songIds[state.concertIndex];
  const override = (sl.overrides || {})[songId] || {};
  await openReader(songId, {
    semitones: override.semitones || 0,
    capo:      override.capo      || 0,
  });
}

async function concertNext() {
  if (isFollower()) return;                              // B6 : follower lecture seule
  if (pageBy(1)) return;                                 // P1 : d'abord paginer dans le morceau
  const sl = await getSetlistForRender(state.currentSetlistId); // B5 : snapshot mémoire en follower (ici: leader)
  if (!sl) return;
  if (state.concertIndex < sl.songIds.length - 1) {
    state.concertIndex++;
    await openConcertSong();                             // openReader repositionne le scroll en haut
  }
}

async function concertPrev() {
  if (isFollower()) return;                              // B6 : follower lecture seule
  if (pageBy(-1)) return;                                // P1 : d'abord remonter dans le morceau
  if (state.concertIndex > 0) {
    state.concertIndex--;
    await openConcertSong();
  }
}

// C8 : badge « n/N » à côté du titre du lecteur quand la lecture vient d'une
// setlist (mode concert leader, ou follower qui suit la setlist du leader).
// Masqué en lecture individuelle. L'état existait déjà (concertMode/concertIndex).
async function updateSetlistPositionBadge() {
  const badge = $('#reader-setpos');
  if (!badge) return;
  const inSetlist = (state.concertMode || isFollower()) && state.currentSetlistId;
  const sl = inSetlist ? await getSetlistForRender(state.currentSetlistId) : null;
  if (sl && sl.songIds && sl.songIds.length) {
    badge.textContent = `${state.concertIndex + 1}/${sl.songIds.length}`;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
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
    const current = sl.id === state.currentSetlistId;
    el.className = `set-item${current ? ' active' : ''}`;
    el.setAttribute('aria-current', current ? 'true' : 'false'); // Issue 7
    el.innerHTML = `
      ${escapeHTML(sl.name)}
      <span class="count">${sl.songIds.length}</span>
    `;
    el.addEventListener('click', () => {
      state.currentSetlistId = sl.id;
      renderSetlistSidebar();
      renderSetlistDetail();
    });
    makeA11yButton(el, sl.name); // focusable au clavier, comme les .nav-item
    list.appendChild(el);
  }
}

async function renderSetlistDetail() {
  const detail = $('#set-detail');

  if (!state.currentSetlistId) {
    detail.innerHTML = `<p class="set-empty">Aucune setlist pour l'instant.<br>
      <small>Compose la première : l'ordre du concert commence ici.</small></p>`;
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
    <button class="drawer-toggle btn" aria-label="Ouvrir la liste des setlists"
            aria-expanded="false" aria-controls="set-sidebar">☰</button>
    <div>
      <h1>${escapeHTML(sl.name)}</h1>
      <div class="set-meta">
        ${songs.length} morceau${songs.length > 1 ? 'x' : ''} ·
        ~${totalMin} min (est.) ·
        modifié ${formatRelativeDate(sl.updatedAt)}
      </div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <button class="btn" id="btn-rename-setlist">✎ Renommer</button>
      <button class="btn btn-danger" id="btn-delete-setlist">🗑 Supprimer</button>
      <button class="play-btn" id="btn-start-concert">▶ Démarrer le concert</button>
    </div>
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

    const key = keyOf(song.content);

    row.innerHTML = `
      <span class="drag" aria-hidden="true">⠿</span>
      <span class="num">${idx + 1}</span>
      <div class="song-info">
        <div class="t">${escapeHTML(song.title)}</div>
        <div class="a">${escapeHTML(song.artist || '—')}</div>
      </div>
      ${overrideTags}
      ${key ? `<span class="key-badge">${escapeHTML(key)}</span>` : ''}
      <button class="row-move" data-dir="-1" title="Monter" aria-label="Monter"${idx === 0 ? ' disabled' : ''}>↑</button>
      <button class="row-move" data-dir="1" title="Descendre" aria-label="Descendre"${idx === songs.length - 1 ? ' disabled' : ''}>↓</button>
      <button class="row-x" data-idx="${idx}" title="Retirer" aria-label="Retirer de la setlist">✕</button>
    `;

    // Issue 3 — le titre devient activable au clavier (la ligne ne peut pas être
    // role=button : elle contient déjà des <button> ↑/↓/✕). Le clic bulle vers
    // le handler de la ligne qui ouvre le lecteur.
    makeA11yButton(row.querySelector('.song-info'), `Ouvrir « ${song.title} »`);

    // Ouvrir dans le lecteur au clic (pas sur le drag/boutons)
    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('row-x') || e.target.classList.contains('drag')
          || e.target.classList.contains('row-move')) return;
      openReader(song.id, {
        semitones: override.semitones || 0,
        capo:      override.capo      || 0,
      });
    });

    // C1 (A1 audit) : alternative clavier au drag & drop — ↑/↓ échangent la
    // position avec la ligne voisine, même chemin de persistance que le drop.
    row.querySelectorAll('.row-move').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const dir = Number(btn.dataset.dir);
        const to = idx + dir;
        if (to < 0 || to >= sl.songIds.length) return;
        [sl.songIds[idx], sl.songIds[to]] = [sl.songIds[to], sl.songIds[idx]];
        await db.updateSetlist(sl);
        state.setlists = await db.getAllSetlists();
        await renderSetlistDetail();
        scheduleAutoSync();
        // Le re-render détruit le DOM : on repose le focus sur le bouton équivalent
        // de la ligne déplacée pour permettre des déplacements clavier en série.
        const rows = document.querySelectorAll('#setlist-rows .song-row');
        const target = rows[to]?.querySelector(`.row-move[data-dir="${dir}"]:not(:disabled)`)
          || rows[to]?.querySelector('.row-move:not(:disabled)');
        target?.focus();
      });
    });

    // Retirer de la setlist — C2 (U1 audit) : retrait effectif immédiat mais
    // annulable via toast (l'override transposition/capo est restauré aussi).
    row.querySelector('.row-x').addEventListener('click', async (e) => {
      e.stopPropagation();
      const removedId = song.id;
      const removedIdx = idx;
      const removedOverride = sl.overrides ? sl.overrides[removedId] : undefined;
      sl.songIds.splice(idx, 1);
      // Nettoyer l'override
      if (sl.overrides) delete sl.overrides[removedId];
      await db.updateSetlist(sl);
      state.setlists = await db.getAllSetlists();
      renderSetlistSidebar();
      renderSetlistDetail();
      scheduleAutoSync();
      showToast(`« ${song.title} » retiré de la setlist`, 'Annuler', async () => {
        const cur = await db.getSetlist(sl.id);
        if (!cur) return; // setlist supprimée entre-temps : rien à restaurer
        cur.songIds.splice(Math.min(removedIdx, cur.songIds.length), 0, removedId);
        if (removedOverride) {
          cur.overrides = cur.overrides || {};
          cur.overrides[removedId] = removedOverride;
        }
        await db.updateSetlist(cur);
        state.setlists = await db.getAllSetlists();
        renderSetlistSidebar();
        renderSetlistDetail();
        scheduleAutoSync();
      });
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
      scheduleAutoSync();
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
  // Issue 1 (Critical) — seul chemin vers le picker : le rendre focusable +
  // activable au clavier (le handler global role=button gère Entrée/Espace).
  makeA11yButton(addRow, 'Ajouter un morceau depuis la bibliothèque');
  rowsContainer.appendChild(addRow);

  detail.appendChild(rowsContainer);

  // Démarrer le concert
  head.querySelector('#btn-rename-setlist').addEventListener('click', () => openRenameSetlist(sl));
  head.querySelector('#btn-delete-setlist').addEventListener('click', () => deleteSetlistWithUndo(sl));
  head.querySelector('#btn-start-concert').addEventListener('click', () => {
    openConcertMode(sl.id);
  });
}

// F7 — CRUD setlist : renommage + suppression (db.deleteSetlist existait mais
// n'était câblé nulle part). _setlistRenameId bascule le dialogue setlist du
// mode « créer » au mode « renommer » (partage le même formulaire).
let _setlistRenameId = null;
function openRenameSetlist(sl) {
  _setlistRenameId = sl.id;
  const dlg = $('#setlist-dialog');
  dlg.querySelector('h2').textContent = 'Renommer la setlist';
  $('#sl-name').value = sl.name;
  dlg.showModal();
  $('#sl-name').focus();
  $('#sl-name').select();
}
async function deleteSetlistWithUndo(sl) {
  const snapshot = { ...sl }; // pour restaurer par-dessus le tombstone si undo
  await db.deleteSetlist(sl.id);
  state.setlists = await db.getAllSetlists();
  state.currentSetlistId = state.setlists[0] ? state.setlists[0].id : null;
  renderSetlistSidebar();
  renderSetlistDetail();
  scheduleAutoSync();
  showToast(`Setlist « ${sl.name} » supprimée`, 'Annuler', async () => {
    await db.updateSetlist(snapshot); // put réécrit le tombstone avec la setlist complète
    state.setlists = await db.getAllSetlists();
    state.currentSetlistId = snapshot.id;
    renderSetlistSidebar();
    renderSetlistDetail();
    scheduleAutoSync();
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
      listEl.innerHTML = '<p style="padding:14px;color:var(--text-3);">Aucun morceau ne répond à cette recherche.</p>';
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
        renderSetlistSidebar();
        renderSetlistDetail();
        scheduleAutoSync();
        // F8 — le picker reste ouvert : le morceau ajouté disparaît de la liste
        // (déjà filtré par sl.songIds), on peut en enchaîner d'autres sans rouvrir.
        renderPicker(searchEl.value.toLowerCase());
      });
      listEl.appendChild(item);
    }
  };

  renderPicker();
  // F8 — assignation (pas addEventListener) : évite l'accumulation de listeners
  // à chaque réouverture du dialogue.
  searchEl.oninput = (e) => renderPicker(e.target.value.toLowerCase());
  dialog.showModal();
}

// ============================================================
// DIALOGUE IMPORT
// ============================================================
function openImportDialog() {
  $('#import-dialog').showModal();
  $('#imp-title').focus();
}

// Import depuis un fichier PDF : ouvre l'explorateur, extrait le texte, et
// PRÉREMPLIT le formulaire pour relecture (l'extraction n'est jamais parfaite).
async function handlePdfPick(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = ''; // permet de re-sélectionner le même fichier ensuite
  if (!file) return;
  const status = $('#imp-pdf-status');
  status.textContent = '⏳ Extraction en cours…';
  status.className = 'import-pdf-status loading';
  try {
    const { title, text } = await extractChordSheetFromPDF(file);
    if (!$('#imp-title').value.trim()) $('#imp-title').value = title || titleFromFilename(file.name);
    $('#imp-content').value = text;
    status.textContent = '✓ Texte extrait — relis et corrige si besoin avant d\'enregistrer';
    status.className = 'import-pdf-status ok';
  } catch (err) {
    status.textContent = '⚠ ' + (err && err.message ? err.message : 'Échec de lecture du PDF');
    status.className = 'import-pdf-status error';
  }
}

async function saveImport(e) {
  e.preventDefault();
  const title   = $('#imp-title').value.trim();
  const artist  = $('#imp-artist').value.trim();
  const tags    = $('#imp-tags').value.split(',').map((t) => t.trim()).filter(Boolean);
  const content = $('#imp-content').value;
  if (!title || !content.trim()) return;
  const created = await db.addSong({ title, artist, tags, content });
  $('#import-dialog').close();
  e.target.reset();
  state.songs = await db.getAllSongs();
  renderLibrary();
  scheduleAutoSync();
  // F9 — feedback explicite : sinon un import masqué par un filtre actif
  // (Favoris, tag) donne l'impression que le morceau a disparu.
  showToast(`« ${title} » importé`, 'Ouvrir', () => { if (created && created.id) openReader(created.id); }, 10000, 'toast-ink');
}

// ============================================================
// MÉTRONOME (Web Audio API)
// ============================================================
const metro = {
  bpm:       90,
  isPlaying: false,
  ctx:       null,       // AudioContext créé à la demande
  nextTime:  0,          // prochain temps à scheduler (en secondes audio)
  beatCount: 0,          // compteur de temps (pour l'accent)
  lookahead: 25,         // ms — intervalle du scheduler setInterval
  scheduleAhead: 0.1,    // secondes — fenêtre de pré-scheduling
  timer:     null,       // retour de setInterval
  tapTimes:  [],         // timestamps des taps pour le tap tempo
};

// Initialise ou récupère l'AudioContext (doit suivre un geste utilisateur)
function getAudioContext() {
  if (!metro.ctx) {
    metro.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Résout la suspension automatique sur certains navigateurs
  if (metro.ctx.state === 'suspended') metro.ctx.resume();
  return metro.ctx;
}

// Joue un clic à l'instant audioTime
function scheduleClick(audioTime, accent) {
  const ctx   = getAudioContext();
  const osc   = ctx.createOscillator();
  const gain  = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  // Accent sur le 1er temps : fréquence et volume plus élevés
  osc.frequency.value = accent ? 1200 : 880;
  gain.gain.setValueAtTime(accent ? 0.6 : 0.35, audioTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioTime + 0.06);

  osc.start(audioTime);
  osc.stop(audioTime + 0.07);
}

// Scheduler lookahead : appeler toutes les metro.lookahead ms
function metronomeTick() {
  const ctx = getAudioContext();
  while (metro.nextTime < ctx.currentTime + metro.scheduleAhead) {
    const accent = (metro.beatCount % 4 === 0); // accent sur le 1er temps (mesure 4/4)
    scheduleClick(metro.nextTime, accent);
    metro.nextTime += 60 / metro.bpm;
    metro.beatCount++;
  }
}

function startMetronome() {
  if (metro.isPlaying) return;
  const ctx     = getAudioContext();
  metro.nextTime  = ctx.currentTime + 0.05;
  metro.beatCount = 0;
  metro.isPlaying = true;
  metro.timer     = setInterval(metronomeTick, metro.lookahead);
  updateMetroUI();
}

function stopMetronome() {
  if (!metro.isPlaying) return;
  clearInterval(metro.timer);
  metro.timer     = null;
  metro.isPlaying = false;
  updateMetroUI();
}

function toggleMetronome() {
  metro.isPlaying ? stopMetronome() : startMetronome();
}

let _bpmSaveTimer = null;
function setMetroBPM(bpm) {
  metro.bpm = Math.max(40, Math.min(240, bpm));
  updateMetroUI();
  // Persiste le tempo sur le morceau ouvert (débounce pour ne pas marteler IndexedDB).
  if (state.current && state.current.bpm !== metro.bpm) {
    clearTimeout(_bpmSaveTimer);
    const id = state.current.id, bpmVal = metro.bpm;
    _bpmSaveTimer = setTimeout(async () => {
      const song = await db.getSong(id);
      if (!song) return;
      song.bpm = bpmVal;
      await db.updateSong(song);
      if (state.current && state.current.id === id) state.current.bpm = bpmVal;
      scheduleAutoSync();
    }, 700);
  }
}

function updateMetroUI() {
  const display   = $('#metro-bpm-display');
  const playStop  = $('#metro-playstop');
  const lbBpm     = $('#lb-bpm');
  if (display)  display.textContent  = metro.bpm;
  if (playStop) playStop.textContent = metro.isPlaying ? '⏹ Stop' : '▶ Play';
  if (lbBpm)    lbBpm.textContent    = `♩ = ${metro.bpm}`;
}

// Tap tempo : moyenne glissante des 4 derniers taps
function tapTempo() {
  const now = performance.now();
  metro.tapTimes.push(now);
  // Garde uniquement les taps récents (< 3 secondes d'intervalle)
  metro.tapTimes = metro.tapTimes.filter((t) => now - t < 3000);
  if (metro.tapTimes.length >= 2) {
    const intervals = [];
    for (let i = 1; i < metro.tapTimes.length; i++) {
      intervals.push(metro.tapTimes[i] - metro.tapTimes[i - 1]);
    }
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    setMetroBPM(Math.round(60000 / avg));
  }
}

// Ouvre/ferme le popover métronome
function toggleMetronomePopover() {
  const pop = $('#metronome-popover');
  if (!pop) return;
  const isHidden = pop.hidden;
  pop.hidden = !isHidden;
  $('#lb-bpm')?.setAttribute('aria-expanded', String(!pop.hidden));
  updateMetroUI();
  // C4a : à l'ouverture, focus sur le premier contrôle du popover (utilisateur clavier)
  if (!pop.hidden) $('#metro-minus5')?.focus();
}

// Arrêt propre du métronome quand on quitte le lecteur
function cleanupMetronome() {
  stopMetronome();
  const pop = $('#metronome-popover');
  if (pop) pop.hidden = true;
  $('#lb-bpm')?.setAttribute('aria-expanded', 'false');
}

// ============================================================
// ÉDITION & SUPPRESSION D'UN MORCEAU
// ============================================================

// Ouvre le dialogue d'édition prérempli avec le morceau courant
function openEditDialog(song) {
  state.editingSongId = song.id;
  $('#edit-title').value   = song.title   || '';
  $('#edit-artist').value  = song.artist  || '';
  $('#edit-tags').value    = (song.tags   || []).join(', ');
  $('#edit-content').value = song.content || '';
  $('#edit-dialog').showModal();
  $('#edit-title').focus();
}

// Sauvegarde les modifications
async function saveEdit(e) {
  e.preventDefault();
  const title   = $('#edit-title').value.trim();
  const artist  = $('#edit-artist').value.trim();
  const tags    = $('#edit-tags').value.split(',').map((t) => t.trim()).filter(Boolean);
  const content = $('#edit-content').value;
  if (!title || !content.trim()) return;

  const song = await db.getSong(state.editingSongId);
  if (!song) return;

  song.title   = title;
  song.artist  = artist;
  song.tags    = tags;
  song.content = content;

  await db.updateSong(song);
  $('#edit-dialog').close();

  state.songs = await db.getAllSongs();

  // Si on est dans le lecteur, re-render le morceau courant
  if (state.current && state.current.id === state.editingSongId) {
    state.current = song;
    renderSong();
    $('#reader-title').textContent = `${song.title}${song.artist ? ' — ' + song.artist : ''}`;
    renderChordDiagrams();
  }
  renderLibrary();
  scheduleAutoSync();
  state.editingSongId = null;
}

// Supprime le morceau en cours d'édition
// C6 (M7 audit) : l'impact sur les setlists est annoncé AVANT confirmation, et
// les références (songIds + overrides) sont purgées après — plus d'orphelins
// silencieusement masqués par le .filter(Boolean) du rendu.
async function deleteSongFromEdit() {
  if (!state.editingSongId) return;
  const id = state.editingSongId;
  const allSetlists = await db.getAllSetlists();
  const affected = allSetlists.filter((sl) => (sl.songIds || []).includes(id));
  const msg = affected.length
    ? `Supprimer ce morceau définitivement ? Il sera aussi retiré de ${affected.length} setlist${affected.length > 1 ? 's' : ''}.`
    : 'Supprimer ce morceau définitivement ?';
  const ok = confirm(msg);
  if (!ok) return;
  await db.deleteSong(id);
  for (const sl of affected) {
    sl.songIds = sl.songIds.filter((sid) => sid !== id);
    if (sl.overrides) delete sl.overrides[id];
    await db.updateSetlist(sl);
  }
  state.setlists = await db.getAllSetlists();
  $('#edit-dialog').close();
  state.songs = await db.getAllSongs();
  state.editingSongId = null;

  // Si on était dans le lecteur sur ce morceau → retour bibliothèque
  if (state.current) {
    closeReader();
  }
  renderLibrary();
  scheduleAutoSync();
}

// ============================================================
// DIAGRAMMES D'ACCORDS GUITARE (SVG inline)
// ============================================================

// Dictionnaire d'accords ouverts (cordes EADGBE, index 0 = corde 6 = Mi grave)
// Chaque entrée : { frets:[e6,A,D,G,B,e1], fingers:[...], barre:null|{fret,from,to} }
// -1 = corde étouffée (×), 0 = à vide (○)
const CHORD_DICT = {
  'C':    { frets: [-1, 3, 2, 0, 1, 0] },
  'D':    { frets: [-1,-1, 0, 2, 3, 2] },
  'E':    { frets: [ 0, 2, 2, 1, 0, 0] },
  'G':    { frets: [ 3, 2, 0, 0, 0, 3] },
  'A':    { frets: [-1, 0, 2, 2, 2, 0] },
  'Am':   { frets: [-1, 0, 2, 2, 1, 0] },
  'Em':   { frets: [ 0, 2, 2, 0, 0, 0] },
  'Dm':   { frets: [-1,-1, 0, 2, 3, 1] },
  'F':    { frets: [-1,-1, 3, 2, 1, 1], barre: { fret:1, from:0, to:1 } },
  'C7':   { frets: [-1, 3, 2, 3, 1, 0] },
  'D7':   { frets: [-1,-1, 0, 2, 1, 2] },
  'E7':   { frets: [ 0, 2, 0, 1, 0, 0] },
  'G7':   { frets: [ 3, 2, 0, 0, 0, 1] },
  'A7':   { frets: [-1, 0, 2, 0, 2, 0] },
  'B7':   { frets: [-1, 2, 1, 2, 0, 2] },
  'Em7':  { frets: [ 0, 2, 0, 0, 0, 0] },
  'Am7':  { frets: [-1, 0, 2, 0, 1, 0] },
  'Dm7':  { frets: [-1,-1, 0, 2, 1, 1] },
  'Cadd9':{ frets: [-1, 3, 2, 0, 3, 3] },
  'Dsus4':{ frets: [-1,-1, 0, 2, 3, 3] },
  'Asus4':{ frets: [-1, 0, 2, 2, 3, 0] },
  'Esus4':{ frets: [ 0, 2, 2, 2, 0, 0] },
  'Bm':   { frets: [-1, 2, 4, 4, 3, 2], barre: { fret:2, from:0, to:5 } },
  'F#m':  { frets: [-1,-1, 4, 6, 6, 5], barre: { fret:2, from:0, to:5 } },
  // Variantes orthographiques (transpositions fréquentes)
  'A#':   { frets: [-1, 1, 3, 3, 3, 1], barre: { fret:1, from:0, to:5 } },
  'Bb':   { frets: [-1, 1, 3, 3, 3, 1], barre: { fret:1, from:0, to:5 } },
  'C#':   { frets: [-1, 4, 6, 6, 6, 4], barre: { fret:4, from:0, to:5 } },
  'Db':   { frets: [-1, 4, 6, 6, 6, 4], barre: { fret:4, from:0, to:5 } },
  'D#':   { frets: [-1, 6, 8, 8, 8, 6], barre: { fret:6, from:0, to:5 } },
  'Eb':   { frets: [-1, 6, 8, 8, 8, 6], barre: { fret:6, from:0, to:5 } },
  'F#':   { frets: [-1,-1, 4, 6, 6, 5], barre: { fret:2, from:0, to:5 } },
  'Gb':   { frets: [-1,-1, 4, 6, 6, 5], barre: { fret:2, from:0, to:5 } },
  'G#':   { frets: [-1,-1, 6, 8, 8, 7], barre: { fret:4, from:0, to:5 } },
  'Ab':   { frets: [-1,-1, 6, 8, 8, 7], barre: { fret:4, from:0, to:5 } },
  'B':    { frets: [-1, 2, 4, 4, 4, 2], barre: { fret:2, from:0, to:5 } },
  'C#m':  { frets: [-1, 4, 6, 6, 5, 4], barre: { fret:4, from:0, to:5 } },
  'Dbm':  { frets: [-1, 4, 6, 6, 5, 4], barre: { fret:4, from:0, to:5 } },
  'D#m':  { frets: [-1, 6, 8, 8, 7, 6], barre: { fret:6, from:0, to:5 } },
  'Ebm':  { frets: [-1, 6, 8, 8, 7, 6], barre: { fret:6, from:0, to:5 } },
  'F#m7': { frets: [-1,-1, 4, 4, 5, 2] },
  'Bm7':  { frets: [-1, 2, 4, 2, 3, 2], barre: { fret:2, from:0, to:5 } },
};

// Génère un SVG de manche de guitare (5 frettes × 6 cordes)
function buildChordSVG(name, data) {
  const W = 64, H = 90;
  const PL = 10, PT = 22, PR = 6, PB = 6; // padding
  const cols = 6;   // cordes
  const rows = 5;   // frettes affichées

  const frets = data.frets; // -1 = ×, 0 = ○, n = frette n
  const validFrets = frets.filter((f) => f > 0);

  // Fenêtre de frettes à afficher (base 1, commence là où les doigts sont)
  let startFret = 1;
  if (validFrets.length > 0) {
    const minF = Math.min(...validFrets);
    startFret = minF <= 3 ? 1 : minF;
  }

  const cw = (W - PL - PR) / (cols - 1); // espacement inter-cordes
  const rh = (H - PT - PB) / rows;       // hauteur d'une frette

  const cx = (col) => PL + col * cw;
  const cy = (row) => PT + row * rh;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="chord-svg" title="${name}">`;

  // Nom de l'accord
  svg += `<text x="${W/2}" y="13" text-anchor="middle" class="chord-svg-name">${escapeHTML(name)}</text>`;

  // Sillet (frette 0) — double trait si on démarre à 1
  if (startFret === 1) {
    svg += `<rect x="${PL-1}" y="${PT-4}" width="${W-PL-PR+2}" height="4" rx="1" class="chord-svg-nut"/>`;
  } else {
    // Indicateur de position (numéro de frette)
    svg += `<text x="${W-2}" y="${PT + rh/2 + 4}" text-anchor="end" class="chord-svg-fret-num">${startFret}fr</text>`;
  }

  // Lignes de frettes
  for (let r = 0; r <= rows; r++) {
    const y = cy(r);
    svg += `<line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" class="chord-svg-fret"/>`;
  }

  // Lignes de cordes
  for (let c = 0; c < cols; c++) {
    const x = cx(c);
    svg += `<line x1="${x}" y1="${PT}" x2="${x}" y2="${PT + rows * rh}" class="chord-svg-string"/>`;
  }

  // Barre (si présente)
  if (data.barre) {
    const { fret, from, to } = data.barre;
    const row = fret - startFret;
    if (row >= 0 && row < rows) {
      const y   = cy(row) + rh / 2;
      const x1  = cx(from === 0 ? cols - 1 : from);
      const x2  = cx(to   === 5 ? 0         : to  );
      const xl  = Math.min(x1, x2);
      const xr  = Math.max(x1, x2);
      svg += `<rect x="${xl}" y="${y - 5}" width="${xr - xl}" height="10" rx="5" class="chord-svg-barre"/>`;
    }
  }

  // Points (doigts) et symboles corde vide / étouffée
  for (let c = 0; c < cols; c++) {
    const f = frets[c];
    const x = cx(cols - 1 - c); // corde 0 = Mi grave = gauche → droite visuellement = e1
    if (f === -1) {
      // Corde étouffée ×
      svg += `<text x="${x}" y="${PT - 6}" text-anchor="middle" class="chord-svg-mute">×</text>`;
    } else if (f === 0) {
      // Corde à vide ○
      svg += `<circle cx="${x}" cy="${PT - 7}" r="4" class="chord-svg-open"/>`;
    } else {
      // Doigt sur une frette
      const row = f - startFret;
      if (row >= 0 && row < rows) {
        const y = cy(row) + rh / 2;
        svg += `<circle cx="${x}" cy="${y}" r="6" class="chord-svg-dot"/>`;
      }
    }
  }

  svg += `</svg>`;
  return svg;
}

// Collecte les accords distincts du morceau courant (dans l'ordre d'apparition)
function getDistinctChords() {
  if (!state.current) return [];
  const items = parseSong(state.current.content);
  const seen  = new Set();
  const out   = [];

  for (const item of items) {
    if (item.type !== 'line') continue;
    for (const seg of item.segments) {
      if (!seg.chord) continue;
      // Transpose selon l'état courant (transpose manuel − capo)
      const eff = effSemitones();
      const chord = eff ? transposeChord(seg.chord, eff) : seg.chord;
      // Extrait la racine + qualité (sans basse /X)
      const root  = chord.split('/')[0];
      if (!seen.has(root) && isChord(root)) {
        seen.add(root);
        out.push(root);
      }
    }
  }
  return out;
}

// Affiche ou cache la bande de diagrammes
function renderChordDiagrams() {
  const bar = $('#chord-diagrams-bar');
  if (!bar) return;

  if (!state.showDiagrams) {
    bar.hidden = true;
    return;
  }

  const chords = getDistinctChords();
  if (!chords.length) { bar.hidden = true; return; }

  bar.innerHTML = '';
  for (const chord of chords) {
    const data = CHORD_DICT[chord];
    const wrap = document.createElement('div');
    wrap.className = 'chord-diagram-item';
    if (data) {
      wrap.innerHTML = buildChordSVG(chord, data);
    } else {
      // Accord inconnu : juste le nom
      wrap.innerHTML = `<div class="chord-diagram-unknown">${escapeHTML(chord)}</div>`;
    }
    bar.appendChild(wrap);
  }
  bar.hidden = false;
}

// Popover : tap sur un accord dans le texte → mini-diagramme flottant.
// (inspiré de Songbook/LinkeSOFT — voir un doigté sans activer toute la bande)
let _chordPopupEl = null;
function showChordPopup(chordName, anchorEl) {
  hideChordPopup();
  const root = chordName.split('/')[0];
  const data = CHORD_DICT[root];
  const pop = document.createElement('div');
  pop.className = 'chord-popup';
  pop.innerHTML = data
    ? buildChordSVG(root, data)
    : `<div class="chord-diagram-unknown">${escapeHTML(root)}</div>`;
  document.body.appendChild(pop);

  // Positionne au-dessus de l'accord, recentré et borné à l'écran.
  const r = anchorEl.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = r.left + r.width / 2 - pw / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
  let top = r.top - ph - 8;
  if (top < 8) top = r.bottom + 8; // bascule en dessous si pas de place au-dessus
  pop.style.left = left + 'px';
  pop.style.top  = top + 'px';
  _chordPopupEl = pop;
}
function hideChordPopup() {
  if (_chordPopupEl) { _chordPopupEl.remove(); _chordPopupEl = null; }
}

// ============================================================
// SYNCHRO — orchestration (Fichier local PC + Google Drive mobile)
// ============================================================
let _autoSyncTimer = null;
let _periodicSync  = null;

// P7 — santé de la synchro : on distingue « fichier lié » (permission) de
// « synchro qui marche » (succès réel). lastOk est persisté pour afficher
// « dernière synchro : il y a X » même après un rechargement.
const _syncHealth = {
  lastOk: (() => { try { return localStorage.getItem('musedesk:lastSyncOk') || null; } catch { return null; } })(),
  lastError: null,
};
function markSyncOk() {
  _syncHealth.lastOk = new Date().toISOString();
  _syncHealth.lastError = null;
  try { localStorage.setItem('musedesk:lastSyncOk', _syncHealth.lastOk); } catch { /* quota/private mode */ }
  refreshSyncStatusIfOpen();
}
function markSyncError(err) {
  _syncHealth.lastError = (err && err.message) ? err.message : 'échec inconnu';
  refreshSyncStatusIfOpen();
}
// Ne rafraîchit l'UI Réglages que si le dialogue est ouvert (évite le travail DOM inutile).
function refreshSyncStatusIfOpen() {
  if ($('#settings-dialog')?.open) updateSettingsUI();
}

// Choix du provider au démarrage + reconnexion automatique.
async function initSyncProviders() {
  // 1) Fichier local (PC) — prioritaire s'il a déjà été lié une fois.
  if (LocalFolderProvider.isSupported() && await LocalFolderProvider.hasSavedHandle()) {
    const fs = new LocalFolderProvider();
    initSync(fs);
    const perm = await fs.reconnect();
    if (perm === 'granted') {
      await autoSyncNow();      // synchro immédiate au boot
      startPeriodicSync();
    }
    // si 'prompt' → l'UI Réglages propose "Reconnecter" (1 clic, geste requis)
    updateSettingsUI();
    return;
  }

  // 2) Google Drive (mobile / fallback) si un Client ID est configuré.
  if (GOOGLE_CLIENT_ID) {
    const drive = new GoogleDriveProvider({ clientId: GOOGLE_CLIENT_ID });
    initSync(drive);
    const ok = await drive.reconnectSilently();
    if (ok) {
      await autoSyncNow();
      startPeriodicSync();
    }
    updateSettingsUI();
    return;
  }

  // 3) Rien de configuré → app 100% locale.
  updateSettingsUI();
}

// Synchro immédiate (silencieuse) + rafraîchit la vue visible.
async function autoSyncNow() {
  if (!isSyncEnabled()) return null;
  try {
    const provider = getProvider();
    if (provider?.isAuthenticated && !(await provider.isAuthenticated())) return null;
    const res = await syncNow();
    if (res && res.ok) {
      markSyncOk();
      state.songs    = await db.getAllSongs();
      state.setlists = await db.getAllSetlists();
      // Ne pas perturber le lecteur ; rafraîchir seulement la vue affichée.
      if (!viewSetlist.hidden) { renderSetlistSidebar(); renderSetlistDetail(); }
      else if (!viewLibrary.hidden) { renderLibrary(); }
    }
    return res;
  } catch (e) {
    // P7 — plus de silence total : on mémorise l'échec pour l'exposer dans Réglages
    // (le statut ne doit pas rester « ✅ synchro auto » si ça échoue en boucle).
    markSyncError(e);
    return null; // on réessaiera à la prochaine modif / au prochain intervalle
  }
}

// Débounce : après une modif, on pousse au bout de quelques secondes.
function scheduleAutoSync() {
  if (!isSyncEnabled()) return;
  clearTimeout(_autoSyncTimer);
  _autoSyncTimer = setTimeout(autoSyncNow, 2500);
}

// Filet de fond : récupère les modifs venues des autres appareils.
function startPeriodicSync() {
  if (_periodicSync) return;
  _periodicSync = setInterval(autoSyncNow, 3 * 60 * 1000);
}

// Met à jour les deux sections du dialogue Réglages selon le provider actif.
async function updateSettingsUI() {
  const provider = getProvider();
  const isFs    = provider instanceof LocalFolderProvider;
  const isDrive = provider instanceof GoogleDriveProvider;

  // ---- Section Fichier local ----
  const fsStatus    = $('#settings-fs-status');
  const fsLink      = $('#settings-fs-link');
  const fsReconnect = $('#settings-fs-reconnect');
  const fsUnlink    = $('#settings-fs-unlink');
  const fsSection   = $('#settings-fs-section');
  if (fsSection) {
    if (!LocalFolderProvider.isSupported()) {
      fsSection.hidden = true; // navigateur non compatible (mobile/Safari)
    } else {
      fsSection.hidden = false;
      const linked = isFs && await provider.isAuthenticated();
      const hasHandle = isFs && await LocalFolderProvider.hasSavedHandle();
      if (linked) {
        // P7 — statut basé sur le SUCCÈS réel de la synchro, pas juste la permission.
        fsLink.hidden = true; fsReconnect.hidden = true; fsUnlink.hidden = false;
        if (_syncHealth.lastError) {
          fsStatus.textContent = `⚠ Fichier lié — échec de synchro (${_syncHealth.lastError})`;
          fsStatus.className = 'drive-status status-off';
        } else if (_syncHealth.lastOk) {
          fsStatus.textContent = `✅ Fichier local lié — synchro ${formatRelativeDate(_syncHealth.lastOk)}`;
          fsStatus.className = 'drive-status status-on';
        } else {
          fsStatus.textContent = '✅ Fichier local lié — synchro auto';
          fsStatus.className = 'drive-status status-on';
        }
      } else if (hasHandle) {
        fsStatus.textContent = 'Lié — autorisation à renouveler';
        fsStatus.className = 'drive-status status-off';
        fsLink.hidden = true; fsReconnect.hidden = false; fsUnlink.hidden = false;
      } else {
        fsStatus.textContent = 'Non lié';
        fsStatus.className = 'drive-status status-off';
        fsLink.hidden = false; fsReconnect.hidden = true; fsUnlink.hidden = true;
      }
    }
  }

  // ---- Section Google Drive ----
  const btnConnect    = $('#settings-btn-connect');
  const btnSync       = $('#settings-btn-sync');
  const btnDisconnect = $('#settings-btn-disconnect');
  const statusEl      = $('#settings-drive-status');
  const helpEl        = $('#settings-drive-help');
  if (!btnConnect) return;

  if (!GOOGLE_CLIENT_ID) {
    btnConnect.disabled = true;
    btnSync.disabled    = true;
    statusEl.textContent = 'Non configuré — colle ton Client ID dans config.js';
    statusEl.className   = 'drive-status status-off';
    btnDisconnect.hidden = true;
    return;
  }

  const authed = isDrive && provider.isAuthenticated ? await provider.isAuthenticated() : false;
  if (authed) {
    statusEl.textContent  = '✅ Connecté à Google Drive — synchro auto';
    statusEl.className    = 'drive-status status-on';
    btnConnect.hidden     = true;
    btnSync.disabled      = false;
    btnDisconnect.hidden  = false;
    if (helpEl) helpEl.hidden = true;
  } else {
    statusEl.textContent  = 'Déconnecté';
    statusEl.className     = 'drive-status status-off';
    btnConnect.hidden     = false;
    btnConnect.disabled   = false;
    btnSync.disabled      = true;
    btnDisconnect.hidden  = true;
  }
}

// C10 : erreurs de synchro affichées dans la zone inline du dialogue Réglages
// (#settings-sync-result) — remplace les alert() natifs qui cassaient l'esthétique.
function showSettingsError(msg) {
  const result = $('#settings-sync-result');
  if (!result) return;
  result.textContent = '❌ ' + msg;
  result.classList.add('error');
  result.hidden = false;
}

// ============================================================
// CÂBLAGE GLOBAL DES ÉVÉNEMENTS
// ============================================================
function bindAllEvents() {
  // ---- Bibliothèque ----
  $('#btn-import').addEventListener('click', openImportDialog);
  $('#import-form').addEventListener('submit', saveImport);
  $('#imp-cancel').addEventListener('click', () => $('#import-dialog').close());
  $('#imp-pdf-btn').addEventListener('click', () => $('#imp-pdf-input').click());
  $('#imp-pdf-input').addEventListener('change', handlePdfPick);

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

  // Vitesse scroll (panneau + live bar + boutons ± partagent la même valeur — C7)
  $('#speed-slider').addEventListener('input', (e) => setScrollSpeed(Number(e.target.value)));
  $('#lb-speed').addEventListener('input', (e) => setScrollSpeed(Number(e.target.value)));
  // C7 (M14 audit) : pas ±1 au clic, plus précis qu'un slider en jouant (pattern .metro-step)
  $('#lb-speed-dec')?.addEventListener('click', () => setScrollSpeed(state.scrollSpeed - 1));
  $('#lb-speed-inc')?.addEventListener('click', () => setScrollSpeed(state.scrollSpeed + 1));

  // Taille via slider panneau
  $('#font-slider').addEventListener('input', (e) => {
    state.fontSize = Number(e.target.value);
    applyFontSize();
  });

  // ---- Interactions tactiles / clic sur le contenu du lecteur ----
  // (#reader-content est stable ; renderSong recrée son innerHTML, donc on
  //  délègue ici plutôt que de re-binder à chaque rendu.)
  const readerContent = $('#reader-content');

  readerContent.addEventListener('click', (e) => {
    if (e.target.closest('.tap.l')) { if (state.concertMode) concertPrev(); else prevPage(); return; }
    if (e.target.closest('.tap.r')) { if (state.concertMode) concertNext(); else nextPage(); return; }
    const chordEl = e.target.closest('.chord');
    if (chordEl && chordEl.textContent.trim()) {
      // Tap sur un accord → diagramme flottant (toggle).
      if (_chordPopupEl && _chordPopupEl.dataset.for === chordEl.textContent) {
        hideChordPopup();
      } else {
        showChordPopup(chordEl.textContent.trim(), chordEl);
        if (_chordPopupEl) _chordPopupEl.dataset.for = chordEl.textContent;
      }
    }
  });

  // Ferme le popover d'accord à tout clic ailleurs / scroll / changement de morceau.
  document.addEventListener('click', (e) => {
    if (_chordPopupEl && !e.target.closest('.chord') && !e.target.closest('.chord-popup')) {
      hideChordPopup();
    }
  });
  readerContent.addEventListener('scroll', hideChordPopup, { passive: true });
  readerContent.addEventListener('scroll', pushLiveStateThrottled, { passive: true });

  // Swipe horizontal tactile = page précédente / suivante (mode mains libres tablette)
  let _swipeX = null, _swipeY = null;
  readerContent.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    _swipeX = t.clientX; _swipeY = t.clientY;
  }, { passive: true });
  readerContent.addEventListener('touchend', (e) => {
    if (_swipeX === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - _swipeX, dy = t.clientY - _swipeY;
    // Swipe franc et horizontal (évite de déclencher pendant un scroll vertical).
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      if (state.concertMode) { dx < 0 ? concertNext() : concertPrev(); }
      else                   { dx < 0 ? nextPage()    : prevPage(); }
    }
    _swipeX = _swipeY = null;
  }, { passive: true });

  // Toggle 2 colonnes
  $('#btn-twocol').addEventListener('click', () => {
    state.twoCol = !state.twoCol;
    $('#btn-twocol').classList.toggle('active', state.twoCol);
    $('#btn-twocol').setAttribute('aria-pressed', String(state.twoCol));
    $('#reader-content').scrollTo({ top: 0, left: 0 });
    renderSong();
    pushLiveStateNow();
  });

  // Panneau transpose
  $('#btn-transpose-toggle').addEventListener('click', () => {
    const panel = $('#transpose-panel');
    panel.hidden = !panel.hidden;
    $('#btn-transpose-toggle').classList.toggle('active', !panel.hidden);
    $('#btn-transpose-toggle').setAttribute('aria-expanded', String(!panel.hidden));
    // C4a : à l'ouverture, focus sur le premier contrôle du panneau
    if (!panel.hidden) $('#btn-t-down')?.focus();
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
      applyTranspose();   // re-rend le morceau avec les accords décalés
    });
  });

  // Toggle accords
  $('#toggle-chords').addEventListener('click', () => {
    state.showChords = !state.showChords;
    $('#toggle-chords').classList.toggle('on', state.showChords);
    $('#toggle-chords').textContent = state.showChords ? '✓' : '';
    $('#toggle-chords').setAttribute('aria-pressed', String(state.showChords));
    $('#reader-content').classList.toggle('no-chords', !state.showChords);
  });

  // ---- Métronome ----
  $('#lb-bpm').addEventListener('click', toggleMetronomePopover);

  $('#metro-minus5').addEventListener('click', () => { setMetroBPM(metro.bpm - 5); });
  $('#metro-minus1').addEventListener('click', () => { setMetroBPM(metro.bpm - 1); });
  $('#metro-plus1').addEventListener('click',  () => { setMetroBPM(metro.bpm + 1); });
  $('#metro-plus5').addEventListener('click',  () => { setMetroBPM(metro.bpm + 5); });
  $('#metro-tap').addEventListener('click', () => { tapTempo(); });
  $('#metro-playstop').addEventListener('click', toggleMetronome);

  // Fermer le popover métronome en cliquant ailleurs
  document.addEventListener('click', (e) => {
    const pop = $('#metronome-popover');
    const btn = $('#lb-bpm');
    if (pop && !pop.hidden && !pop.contains(e.target) && e.target !== btn) {
      pop.hidden = true;
      btn?.setAttribute('aria-expanded', 'false'); // C4 : état cohérent avec le lot B
    }
  });

  // ---- Édition morceau ----
  $('#btn-edit-song').addEventListener('click', () => {
    if (state.current) openEditDialog(state.current);
  });

  $('#edit-form').addEventListener('submit', saveEdit);
  $('#edit-cancel').addEventListener('click', () => {
    $('#edit-dialog').close();
    state.editingSongId = null;
  });
  $('#edit-delete').addEventListener('click', deleteSongFromEdit);

  // ---- Toggle diagrammes ----
  $('#toggle-diagrams').addEventListener('click', () => {
    state.showDiagrams = !state.showDiagrams;
    $('#toggle-diagrams').classList.toggle('on', state.showDiagrams);
    $('#toggle-diagrams').textContent = state.showDiagrams ? '✓' : '';
    $('#toggle-diagrams').setAttribute('aria-pressed', String(state.showDiagrams));
    renderChordDiagrams();
  });

  // ---- Réglages ----
  $('#nav-settings').addEventListener('click', () => {
    updateSettingsUI();
    $('#settings-dialog').showModal();
  });
  $('#settings-close').addEventListener('click', () => $('#settings-dialog').close());

  // ---- Fichier local (File System Access) ----
  $('#settings-fs-link')?.addEventListener('click', async () => {
    let provider = getProvider();
    if (!(provider instanceof LocalFolderProvider)) {
      provider = new LocalFolderProvider();
      initSync(provider);
    }
    try {
      await provider.signIn();        // showSaveFilePicker (geste utilisateur)
      await autoSyncNow();
      startPeriodicSync();
      updateSettingsUI();
    } catch (err) {
      // AbortError = l'utilisateur a fermé le sélecteur, pas une vraie erreur.
      // C10 : statut inline plutôt qu'alert() natif (esthétique + non bloquant)
      if (err && err.name !== 'AbortError') showSettingsError(`Impossible de lier le fichier : ${err.message}`);
    }
  });

  $('#settings-fs-reconnect')?.addEventListener('click', async () => {
    const provider = getProvider();
    if (!(provider instanceof LocalFolderProvider)) return;
    const ok = await provider.ensurePermission();
    if (ok) { await autoSyncNow(); startPeriodicSync(); }
    updateSettingsUI();
  });

  $('#settings-fs-unlink')?.addEventListener('click', async () => {
    const provider = getProvider();
    if (provider instanceof LocalFolderProvider) await provider.signOut();
    if (_periodicSync) { clearInterval(_periodicSync); _periodicSync = null; }
    updateSettingsUI();
  });

  // ---- Google Drive : connexion manuelle (popup de consentement) ----
  $('#settings-btn-connect').addEventListener('click', async () => {
    if (!GOOGLE_CLIENT_ID) return;
    let provider = getProvider();
    if (!(provider instanceof GoogleDriveProvider)) {
      provider = new GoogleDriveProvider({ clientId: GOOGLE_CLIENT_ID });
      initSync(provider);
    }
    const btn = $('#settings-btn-connect');
    btn.disabled  = true;
    btn.textContent = '…';
    try {
      await provider.signIn();        // popup de consentement
      await autoSyncNow();
      startPeriodicSync();
      updateSettingsUI();
    } catch (err) {
      // C10 : statut inline plutôt qu'alert() natif
      showSettingsError(`Erreur de connexion : ${err.message}`);
      btn.disabled  = false;
      btn.textContent = 'Connecter Drive';
    }
  });

  $('#settings-btn-sync').addEventListener('click', async () => {
    const btn    = $('#settings-btn-sync');
    const result = $('#settings-sync-result');
    btn.disabled     = true;
    btn.textContent  = '↻ …';
    result.hidden    = true;

    try {
      const res = await syncNow();
      state.songs    = await db.getAllSongs();
      state.setlists = await db.getAllSetlists();
      renderLibrary();
      result.textContent = `✅ Synchro OK — ${res.pulled} récupérés, ${res.pushed} envoyés`;
      result.classList.remove('error');
      result.hidden = false;
    } catch (err) {
      result.textContent = `❌ Erreur : ${err.message}`;
      result.classList.add('error');  // C10 : classe d'erreur (teinte danger)
      result.hidden = false;
    }
    btn.disabled    = false;
    btn.textContent = '↻ Synchroniser';
  });

  $('#settings-btn-disconnect').addEventListener('click', async () => {
    const provider = getProvider();
    if (provider) await provider.signOut();
    if (_periodicSync) { clearInterval(_periodicSync); _periodicSync = null; }
    updateSettingsUI();
    const result = $('#settings-sync-result');
    result.textContent = 'Déconnecté.';
    result.classList.remove('error');
    result.hidden = false;
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
    _setlistRenameId = null;
    $('#setlist-dialog').querySelector('h2').textContent = 'Nouvelle setlist';
    $('#setlist-dialog').showModal();
    $('#sl-name').value = '';
    $('#sl-name').focus();
  });

  $('#sl-cancel').addEventListener('click', () => { _setlistRenameId = null; $('#setlist-dialog').close(); });
  $('#setlist-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#sl-name').value.trim();
    if (!name) return;
    const isRename = !!_setlistRenameId;
    if (isRename) {
      const sl = await db.getSetlist(_setlistRenameId);
      if (sl) { sl.name = name; await db.updateSetlist(sl); }
      _setlistRenameId = null;
      state.setlists = await db.getAllSetlists();
      // on garde la setlist renommée sélectionnée (currentSetlistId inchangé)
    } else {
      await db.addSetlist({ name });
      state.setlists = await db.getAllSetlists();
      if (state.setlists[0]) state.currentSetlistId = state.setlists[0].id;
    }
    $('#setlist-dialog').close();
    renderSetlistSidebar();
    renderSetlistDetail();
    scheduleAutoSync();
  });

  // Picker
  $('#picker-cancel').addEventListener('click', () => $('#picker-dialog').close());

  // ---- Tiroir mobile (hamburger) ----
  setupDrawer();

  // ---- Accessibilité : div/span cliquables → boutons focusables ----
  document.querySelectorAll('.nav-item').forEach((el) => makeA11yButton(el));
  document.querySelectorAll('#capo-row span').forEach((el) =>
    makeA11yButton(el, el.dataset.capo === '0' ? 'Sans capo' : `Capo ${el.dataset.capo}`));
  makeA11yButton($('#toggle-chords'), 'Afficher les accords');
  makeA11yButton($('#toggle-diagrams'), 'Afficher les diagrammes guitare');
  // aria-labels sur les boutons-icônes du lecteur
  $('#btn-font-dec')?.setAttribute('aria-label', 'Réduire la taille du texte');
  $('#btn-font-inc')?.setAttribute('aria-label', 'Agrandir la taille du texte');
  $('#lb-t-down')?.setAttribute('aria-label', 'Transposer un demi-ton plus bas');
  $('#lb-t-up')?.setAttribute('aria-label', 'Transposer un demi-ton plus haut');
  $('#lb-play')?.setAttribute('aria-label', 'Lecture / pause du défilement');
  $('#lb-bpm')?.setAttribute('aria-label', 'Métronome');

  // Active Entrée/Espace sur tout élément rôle=bouton qui n'est pas un vrai bouton.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = document.activeElement;
    if (el && el.getAttribute('role') === 'button' &&
        !el.matches('button, a, input, textarea, select')) {
      e.preventDefault();
      el.click();
    }
  });

  // ---- A2 : gestion du focus des dialogs (a11y) ----
  // Couvre TOUS les <dialog> : focus initial à l'ouverture + retour du focus sur
  // l'élément déclencheur à la fermeture (sinon l'utilisateur clavier est éjecté
  // en haut de page). showModal() natif gère déjà le piège de focus + Escape.
  let _dialogTrigger = null;
  const _origShowModal = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function (...args) {
    _dialogTrigger = document.activeElement;
    const r = _origShowModal.apply(this, args);
    const first = this.querySelector(
      'input:not([type=hidden]):not([disabled]), button:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (first) { try { first.focus(); } catch { /* ignore */ } }
    return r;
  };
  document.querySelectorAll('dialog').forEach((dlg) => {
    dlg.addEventListener('close', () => {
      const t = _dialogTrigger;
      _dialogTrigger = null;
      if (t && document.body.contains(t)) { try { t.focus(); } catch { /* ignore */ } }
    });
  });

  // ---- Raccourcis clavier globaux ----
  document.addEventListener('keydown', (e) => {
    const inReader = !viewReader.hidden;
    const inLibrary = !viewLibrary.hidden;
    const inDialog = !!document.querySelector('dialog[open]');
    if (inDialog) return;
    // A1 : ne pas voler les flèches/espace quand le focus est sur un contrôle de
    // saisie (sliders de vitesse/taille, recherche…) — sinon ils sont inutilisables.
    // C4 : exception pour Escape, qui doit fermer le panneau ouvert même quand le
    // focus est sur un slider à l'intérieur (sinon l'utilisateur clavier est coincé).
    if (e.key !== 'Escape' && e.target.matches('input, textarea, select')) return;

    if (inReader) {
      if (e.key === 'Escape') {
        // C4b (M1 audit) : Escape contextuel — ferme d'abord le popover/panneau
        // ouvert en rendant le focus au bouton déclencheur ; ne quitte le lecteur
        // que s'il n'y a rien à fermer.
        const metroPop = $('#metronome-popover');
        const tPanel = $('#transpose-panel');
        if (metroPop && !metroPop.hidden) {
          metroPop.hidden = true;
          const lb = $('#lb-bpm');
          lb?.setAttribute('aria-expanded', 'false');
          lb?.focus();
        } else if (tPanel && !tPanel.hidden) {
          tPanel.hidden = true;
          const tBtn = $('#btn-transpose-toggle');
          tBtn?.classList.remove('active');
          tBtn?.setAttribute('aria-expanded', 'false');
          tBtn?.focus();
        } else {
          closeReader();
          if (state.currentSetlistId) openSetlistView();
        }
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

  // ---- Mode Pupitre (leader) ----
  // Révèle le bouton si un relais est configuré (sinon mode solo strict).
  if (live.isRelayConfigured()) {
    const bp = $('#btn-pupitre');
    if (bp) bp.hidden = false;
  }
  $('#btn-pupitre')?.addEventListener('click', () => { openPupitreDialog(); });
  $('#pupitre-close')?.addEventListener('click', () => $('#pupitre-dialog').close());
  $('#pupitre-end')?.addEventListener('click', () => { endPupitreSession(); $('#pupitre-dialog').close(); });
  $('#pupitre-copy')?.addEventListener('click', async () => {
    const url = $('#pupitre-url')?.value;
    if (url && navigator.clipboard) {
      try { await navigator.clipboard.writeText(url); $('#pupitre-copy').textContent = '✓ Copié'; }
      catch { /* clipboard refusé : l'utilisateur peut copier manuellement */ }
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
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// C2 : toast minimal avec action (undo) — un seul toast à la fois, role=status
// (équivaut à aria-live="polite"), auto-fermeture ~6 s. Pas de lib externe.
let _toastEl = null;
let _toastTimer = null;
function showToast(message, actionLabel, onAction, ms = 10000, variant = '') {
  hideToast();
  const el = document.createElement('div');
  el.className = variant ? `toast ${variant}` : 'toast';
  el.setAttribute('role', 'status');
  const txt = document.createElement('span');
  txt.textContent = message;
  el.appendChild(txt);
  if (actionLabel && onAction) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = actionLabel;
    btn.addEventListener('click', () => { hideToast(); onAction(); });
    el.appendChild(btn);
  }
  document.body.appendChild(el);
  _toastEl = el;
  // Issue 4 (WCAG 2.2.1) — délai à 10 s + pause au survol/focus pour laisser le
  // temps d'atteindre « Annuler » au clavier ou en contexte scène/stress.
  const arm = () => { _toastTimer = setTimeout(hideToast, ms); };
  const disarm = () => { if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; } };
  el.addEventListener('mouseenter', disarm);
  el.addEventListener('focusin', disarm);
  el.addEventListener('mouseleave', arm);
  el.addEventListener('focusout', arm);
  arm();
}
function hideToast() {
  if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
  if (_toastEl) { _toastEl.remove(); _toastEl = null; }
}

// Rend un div/span cliquable accessible au clavier (rôle bouton + focusable).
function makeA11yButton(el, label) {
  if (!el) return;
  el.setAttribute('role', 'button');
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  if (label && !el.getAttribute('aria-label')) el.setAttribute('aria-label', label);
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
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      // Échec de l'enregistrement du Service Worker.
      // L'application continuera de fonctionner, mais les fonctionnalités hors-ligne et PWA ne seront pas disponibles.
      console.warn('Erreur d\'enregistrement du Service Worker:', err);
    });
  }
}

// ============================================================
// DÉMARRAGE
// ============================================================
// Filets globaux : on ne veut aucune erreur muette en prod.
window.addEventListener('unhandledrejection', (e) => {
  console.error('MuseDesk — promesse non gérée:', e.reason);
});
window.addEventListener('error', (e) => {
  console.error('MuseDesk — erreur non gérée:', e.error || e.message);
});

boot().catch(showFatalError);
