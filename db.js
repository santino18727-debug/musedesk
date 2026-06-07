// db.js — Couche de persistance locale (IndexedDB, sans librairie externe)
// ---------------------------------------------------------------------------
// Modèle morceau :
//   { id, title, artist, content, tags:[], favorite:bool,
//     createdAt, updatedAt, syncState }
//
// Modèle setlist :
//   { id, name, songIds:[], overrides:{ [songId]: {semitones:0, capo:0} },
//     createdAt, updatedAt }
// ---------------------------------------------------------------------------

const DB_NAME = 'musedesk';
const DB_VERSION = 3; // v3 : store 'meta' (handles File System Access, prefs sync)
const STORE = 'songs';
const STORE_SL = 'setlists';
const STORE_META = 'meta';

let _db = null;

// --- UUID -------------------------------------------------------------------
function uuid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// --- Initialisation ---------------------------------------------------------
export function initDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // Store songs (créé si absent — migration propre)
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('title',     'title',     { unique: false });
        store.createIndex('artist',    'artist',    { unique: false });
        store.createIndex('syncState', 'syncState', { unique: false });
        store.createIndex('favorite',  'favorite',  { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Store setlists (nouveau en v2)
      if (!db.objectStoreNames.contains(STORE_SL)) {
        db.createObjectStore(STORE_SL, { keyPath: 'id' });
      }

      // Store meta clé/valeur (nouveau en v3) — handles File System Access
      // (structured-cloneable), préférences de synchro, etc.
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META); // clé hors-ligne passée à put/get
      }
    };

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror   = (e) => reject(e.target.error);
  });
}

// --- Helper transaction générique -------------------------------------------
// Permet transactions sur un ou deux stores.
function tx(stores, mode, fn) {
  const storeList = Array.isArray(stores) ? stores : [stores];
  return initDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(storeList, mode);
        const storeMap = {};
        storeList.forEach((s) => { storeMap[s] = transaction.objectStore(s); });
        const result = fn(storeList.length === 1 ? storeMap[storeList[0]] : storeMap);
        transaction.oncomplete = () => resolve(result.value);
        transaction.onerror   = () => reject(transaction.error);
        transaction.onabort   = () => reject(transaction.error);
      })
  );
}

// ============================================================
// CRUD SONGS
// ============================================================

export function addSong(data) {
  const now = new Date().toISOString();
  const song = {
    id:        uuid(),
    title:     data.title   || 'Sans titre',
    artist:    data.artist  || '',
    content:   data.content || '',
    tags:      Array.isArray(data.tags) ? data.tags : [],
    favorite:  !!data.favorite,
    createdAt: now,
    updatedAt: now,
    syncState: 'local',
  };
  return tx(STORE, 'readwrite', (store) => {
    store.add(song);
    return { value: song };
  });
}

export function getAllSongs() {
  return tx(STORE, 'readonly', (store) => {
    const result = { value: [] };
    store.getAll().onsuccess = (e) => {
      result.value = e.target.result.sort((a, b) =>
        (a.title || '').localeCompare(b.title || '', 'fr', { sensitivity: 'base' })
      );
    };
    return result;
  });
}

export function getSong(id) {
  return tx(STORE, 'readonly', (store) => {
    const result = { value: null };
    store.get(id).onsuccess = (e) => { result.value = e.target.result || null; };
    return result;
  });
}

export function updateSong(song) {
  song.updatedAt = new Date().toISOString();
  song.syncState = 'dirty';
  return tx(STORE, 'readwrite', (store) => {
    store.put(song);
    return { value: song };
  });
}

export function deleteSong(id) {
  return tx(STORE, 'readwrite', (store) => {
    store.delete(id);
    return { value: id };
  });
}

// Toggle favori — charge, inverse, sauvegarde
export async function toggleFavorite(id) {
  const song = await getSong(id);
  if (!song) return null;
  song.favorite = !song.favorite;
  return updateSong(song);
}

export function exportAll() { return getAllSongs(); }

export function importAll(songs) {
  return tx(STORE, 'readwrite', (store) => {
    (songs || []).forEach((s) => store.put(s));
    return { value: songs.length };
  });
}

// ============================================================
// CRUD SETLISTS
// ============================================================

export function addSetlist(data) {
  const now = new Date().toISOString();
  const sl = {
    id:        uuid(),
    name:      data.name || 'Nouvelle setlist',
    songIds:   Array.isArray(data.songIds) ? [...data.songIds] : [],
    overrides: data.overrides || {},
    createdAt: now,
    updatedAt: now,
  };
  return tx(STORE_SL, 'readwrite', (store) => {
    store.add(sl);
    return { value: sl };
  });
}

export function getAllSetlists() {
  return tx(STORE_SL, 'readonly', (store) => {
    const result = { value: [] };
    store.getAll().onsuccess = (e) => {
      result.value = e.target.result.sort((a, b) =>
        (b.updatedAt || '').localeCompare(a.updatedAt || '')
      );
    };
    return result;
  });
}

export function getSetlist(id) {
  return tx(STORE_SL, 'readonly', (store) => {
    const result = { value: null };
    store.get(id).onsuccess = (e) => { result.value = e.target.result || null; };
    return result;
  });
}

export function updateSetlist(sl) {
  sl.updatedAt = new Date().toISOString();
  return tx(STORE_SL, 'readwrite', (store) => {
    store.put(sl);
    return { value: sl };
  });
}

export function deleteSetlist(id) {
  return tx(STORE_SL, 'readwrite', (store) => {
    store.delete(id);
    return { value: id };
  });
}

// Importe/fusionne un tableau de setlists (utilisé par la synchro Drive)
export function importSetlists(setlists) {
  return tx(STORE_SL, 'readwrite', (store) => {
    (setlists || []).forEach((sl) => store.put(sl));
    return { value: setlists.length };
  });
}

// ============================================================
// META (clé/valeur) — handles File System Access, prefs sync
// ============================================================
export function getMeta(key) {
  return tx(STORE_META, 'readonly', (store) => {
    const result = { value: null };
    store.get(key).onsuccess = (e) => { result.value = e.target.result ?? null; };
    return result;
  });
}

export function setMeta(key, value) {
  return tx(STORE_META, 'readwrite', (store) => {
    store.put(value, key);
    return { value };
  });
}

export function delMeta(key) {
  return tx(STORE_META, 'readwrite', (store) => {
    store.delete(key);
    return { value: key };
  });
}
