// fsprovider.js — Synchro par FICHIER LOCAL (File System Access API).
// -----------------------------------------------------------------------------
// Idée : l'utilisateur lie UNE fois un fichier (ex. dans son dossier Google Drive
// ou Dropbox déjà synchronisé sur le PC). MuseDesk y lit/écrit la bibliothèque ;
// le client cloud natif s'occupe de pousser vers le cloud. Aucun OAuth, aucun
// Client ID, aucune expiration de token.
//
// Le FileSystemFileHandle est "structured-cloneable" → on le mémorise dans
// IndexedDB (store 'meta'). Au redémarrage on le relit et on revérifie la
// permission. Chrome peut exiger un geste utilisateur pour la ré-accorder :
// d'où ensurePermission() appelée sur un clic, vs reconnect() silencieux au boot.
//
// ⚠️ Support : Chromium desktop (Chrome, Edge). Pas Firefox/Safari, pas iOS.
// -----------------------------------------------------------------------------

import { SyncProvider } from './sync.js?v=9';
import { getMeta, setMeta, delMeta } from './db.js?v=9';

const HANDLE_KEY = 'fsFileHandle';
const FILE_NAME  = 'musedesk-library.json';

export class LocalFolderProvider extends SyncProvider {
  constructor() {
    super();
    this._handle = null;
  }

  // L'API est-elle disponible dans ce navigateur ?
  static isSupported() {
    return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
  }

  // Un fichier a-t-il déjà été lié lors d'une session précédente ?
  static async hasSavedHandle() {
    return !!(await getMeta(HANDLE_KEY));
  }

  // --- Lien initial (geste utilisateur requis : ouvre le sélecteur) ---
  async signIn() {
    const handle = await window.showSaveFilePicker({
      suggestedName: FILE_NAME,
      types: [{
        description: 'Bibliothèque MuseDesk',
        accept: { 'application/json': ['.json'] },
      }],
    });
    this._handle = handle;
    await setMeta(HANDLE_KEY, handle);
    return true;
  }

  // --- Reconnexion au démarrage (silencieuse si la permission tient encore) ---
  // Retourne 'granted' | 'prompt' | 'none'. On NE demande PAS la permission ici
  // (pas de geste utilisateur au boot) — voir ensurePermission().
  async reconnect() {
    const handle = await getMeta(HANDLE_KEY);
    if (!handle) return 'none';
    this._handle = handle;
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    return perm; // 'granted' (silencieux OK) ou 'prompt' (clic requis)
  }

  // --- Demande la permission (à appeler depuis un clic) ---
  async ensurePermission() {
    if (!this._handle) return false;
    if ((await this._handle.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
    return (await this._handle.requestPermission({ mode: 'readwrite' })) === 'granted';
  }

  async isAuthenticated() {
    if (!this._handle) return false;
    return (await this._handle.queryPermission({ mode: 'readwrite' })) === 'granted';
  }

  async signOut() {
    this._handle = null;
    await delMeta(HANDLE_KEY);
  }

  // --- Lecture du fichier ---
  async pull() {
    if (!this._handle) return { songs: [], setlists: [] };
    try {
      const file = await this._handle.getFile();
      const text = await file.text();
      if (!text.trim()) return { songs: [], setlists: [] };
      const data = JSON.parse(text);
      return {
        songs:    Array.isArray(data.songs)    ? data.songs    : [],
        setlists: Array.isArray(data.setlists) ? data.setlists : [],
      };
    } catch (_) {
      // Fichier vide / illisible / supprimé → on repart d'une base vide.
      return { songs: [], setlists: [] };
    }
  }

  // --- Écriture du fichier ---
  async push(data) {
    if (!this._handle) throw new Error('Aucun fichier local lié');
    const payload = JSON.stringify({
      version:    1,
      songs:      data.songs    || [],
      setlists:   data.setlists || [],
      exportedAt: new Date().toISOString(),
    }, null, 2);
    const writable = await this._handle.createWritable();
    await writable.write(payload);
    await writable.close();
  }
}
