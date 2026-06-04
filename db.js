// db.js — Couche de persistance locale (IndexedDB, sans librairie externe)
// ---------------------------------------------------------------------------
// Modèle d'un morceau :
//   { id:uuid, title, artist, content, tags:[], createdAt, updatedAt, syncState }
//
// `syncState` ('local' | 'synced' | 'dirty') est posé dès maintenant pour
// préparer la synchro Google Drive (cf. sync.js) : un futur provider de sync
// repérera les morceaux 'dirty' à pousser. Inutilisé par le MVP.
//
// API publique (toutes async, basées sur Promise) :
//   initDB()            -> ouvre/crée la base
//   addSong(data)       -> crée un morceau (génère id + timestamps)
//   getAllSongs()       -> tous les morceaux (triés par titre)
//   getSong(id)         -> un morceau
//   updateSong(song)    -> remplace un morceau existant
//   deleteSong(id)      -> supprime
//   exportAll()         -> array brut (pour backup / futur push Drive)
//   importAll(songs)    -> import en masse (pour restore / futur pull Drive)
// ---------------------------------------------------------------------------

const DB_NAME = 'musedesk';
const DB_VERSION = 1;
const STORE = 'songs';

let _db = null;

function uuid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  // Fallback (contextes non sécurisés sans crypto.randomUUID)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function initDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('title', 'title', { unique: false });
        store.createIndex('artist', 'artist', { unique: false });
        store.createIndex('syncState', 'syncState', { unique: false });
      }
    };
    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

// Petit helper pour transformer une requête IndexedDB en Promise.
function tx(mode, fn) {
  return initDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const store = transaction.objectStore(STORE);
        const result = fn(store);
        transaction.oncomplete = () => resolve(result.value);
        transaction.onerror = () => reject(transaction.error);
      })
  );
}

export function addSong(data) {
  const now = new Date().toISOString();
  const song = {
    id: uuid(),
    title: data.title || 'Sans titre',
    artist: data.artist || '',
    content: data.content || '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    createdAt: now,
    updatedAt: now,
    syncState: 'local',
  };
  return tx('readwrite', (store) => {
    store.add(song);
    return { value: song };
  });
}

export function getAllSongs() {
  return tx('readonly', (store) => {
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
  return tx('readonly', (store) => {
    const result = { value: null };
    store.get(id).onsuccess = (e) => {
      result.value = e.target.result || null;
    };
    return result;
  });
}

export function updateSong(song) {
  song.updatedAt = new Date().toISOString();
  song.syncState = 'dirty'; // marqué pour un futur push Drive
  return tx('readwrite', (store) => {
    store.put(song);
    return { value: song };
  });
}

export function deleteSong(id) {
  return tx('readwrite', (store) => {
    store.delete(id);
    return { value: id };
  });
}

export function exportAll() {
  return getAllSongs();
}

export function importAll(songs) {
  return tx('readwrite', (store) => {
    (songs || []).forEach((s) => store.put(s));
    return { value: songs.length };
  });
}
