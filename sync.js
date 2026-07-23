// sync.js — Synchro Google Drive pour MuseDesk
// ---------------------------------------------------------------------------
// Stratégie : UN fichier 'musedesk-library.json' dans le Drive de l'utilisateur.
// Auth via Google Identity Services (GIS), chargé dynamiquement à la demande.
// Le token OAuth est gardé EN MÉMOIRE uniquement — jamais persisté en localStorage.
// ---------------------------------------------------------------------------

import { exportAll, importAll, getAllSetlists, exportAllSetlists, importSetlists } from './db.js?v=17';

// ============================================================
// CONTRAT PROVIDER
// ============================================================
export class SyncProvider {
  async isAuthenticated() { return false; }
  async signIn()  { throw new Error('non implémenté'); }
  async signOut() {}
  async pull()    { return { songs: [], setlists: [] }; }
  async push(/* data */) {}
}

// Provider local par défaut (no-op)
class NoopProvider extends SyncProvider {}

let _provider = new NoopProvider();

export function initSync(provider) {
  if (provider) _provider = provider;
}

export function isSyncEnabled() {
  return !(_provider instanceof NoopProvider);
}

export function getProvider() { return _provider; }

// ============================================================
// BOUCLE DE SYNCHRO (last-write-wins sur updatedAt)
// ============================================================
// Mutex applicatif : débounce, timer périodique (3 min) et bouton manuel
// peuvent déclencher syncNow simultanément. Sans verrou, deux exécutions
// entrelacées (PULL→merge→PUSH) peuvent s'écraser et perdre des données.
// On coalesce : tout appel concurrent récupère la promesse en cours.
let _syncing = null;
export function syncNow() {
  if (_syncing) return _syncing;
  _syncing = _syncNowImpl().finally(() => { _syncing = null; });
  return _syncing;
}

async function _syncNowImpl() {
  if (!isSyncEnabled()) return { skipped: true, reason: 'no-provider' };
  if (!(await _provider.isAuthenticated())) return { skipped: true, reason: 'not-authenticated' };

  // --- PULL ---
  const remote = await _provider.pull();
  const remoteSongs    = remote?.songs    || [];
  const remoteSetlists = remote?.setlists || [];

  // Merge songs : last-write-wins basé sur updatedAt
  if (remoteSongs.length) {
    const local = await exportAll();
    const localMap = new Map();
    local.forEach((s, idx) => localMap.set(s.id, { song: s, index: idx }));
    const merged = [...local];

    for (const rs of remoteSongs) {
      const localData = localMap.get(rs.id);
      if (!localData) {
        // Nouveau depuis le remote
        merged.push(rs);
      } else {
        const ls = localData.song;
        if ((rs.updatedAt || '') > (ls.updatedAt || '')) {
          // Remote plus récent
          merged[localData.index] = rs;
        }
      }
      // else : local plus récent ou égal → on garde le local
    }
    await importAll(merged);
  }

  // Merge setlists : last-write-wins PAR setlist (sur updatedAt).
  // L'ancienne version écrasait aveuglément le local par le distant → une
  // setlist modifiée localement et plus récente pouvait être perdue.
  if (remoteSetlists.length) {
    // S2 : inclure les tombstones locaux pour un LWW correct (sinon une setlist
    // supprimée localement serait ressuscitée par une version distante ancienne).
    const localSl = await exportAllSetlists();
    const localMap = Object.fromEntries(localSl.map((s) => [s.id, s]));
    const toWrite = [];
    for (const rs of remoteSetlists) {
      const ls = localMap[rs.id];
      if (!ls || (rs.updatedAt || '') > (ls.updatedAt || '')) toWrite.push(rs);
    }
    if (toWrite.length) await importSetlists(toWrite);
  }

  // --- PUSH ---
  // (tombstones inclus pour propager les suppressions, cf. db.exportAll*)
  const localSongs    = await exportAll();
  const localSetlists = await exportAllSetlists();

  // S3 : ne ré-uploader que si le contenu a changé depuis le dernier push réussi.
  // Évite un upload multipart complet de toute la bibliothèque à chaque toggle
  // favori/edit (déclenché toutes les 2,5 s) quand rien n'a bougé.
  const sig = _pushSignature(localSongs, localSetlists);
  if (sig === _lastPushSig) {
    return { ok: true, pulled: remoteSongs.length, pushed: 0, skippedPush: true };
  }
  await _provider.push({ songs: localSongs, setlists: localSetlists });
  _lastPushSig = sig;

  return {
    ok: true,
    pulled: remoteSongs.length,
    pushed: localSongs.length,
  };
}

// S3 : signature compacte (id:updatedAt triés) du jeu de données à pousser.
let _lastPushSig = null;
function _pushSignature(songs, setlists) {
  const a = songs.map((s) => s.id + ':' + (s.updatedAt || '')).sort().join('|');
  const b = setlists.map((s) => s.id + ':' + (s.updatedAt || '')).sort().join('|');
  return a + '##' + b;
}

// ============================================================
// GOOGLE DRIVE PROVIDER
// ============================================================

const DRIVE_FILE_NAME = 'musedesk-library.json';
const DRIVE_SCOPE     = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_UPLOAD    = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_LIST      = 'https://www.googleapis.com/drive/v3/files';

export class GoogleDriveProvider extends SyncProvider {
  constructor({ clientId }) {
    super();
    this.clientId = clientId;
    // ⚠️ SÉCURITÉ : le token est gardé EN MÉMOIRE de session uniquement.
    // Il ne sera JAMAIS écrit dans localStorage ou sessionStorage.
    this._token = null;
    this._tokenClient = null;
    this._gisLoaded   = false;
  }

  // --- Chargement dynamique du SDK GIS (uniquement à la demande) ---
  async _loadGIS() {
    if (this._gisLoaded) return;
    if (typeof window === 'undefined') throw new Error('GIS : environnement navigateur requis');

    await new Promise((resolve, reject) => {
      if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
        resolve(); return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload  = resolve;
      script.onerror = () => reject(new Error('Impossible de charger le SDK Google Identity Services'));
      document.head.appendChild(script);
    });

    this._gisLoaded = true;
  }

  // --- Initialise le TokenClient GIS ---
  async _initTokenClient() {
    if (this._tokenClient) return;
    await this._loadGIS();

    this._tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: this.clientId,
      scope:     DRIVE_SCOPE,
      // callback défini lors du signIn
    });
  }

  // --- Demande un token OAuth ---
  // silent=false → popup de consentement (1ère fois).
  // silent=true  → prompt:'' : nouveau token SANS UI si l'utilisateur a déjà
  //                consenti et a une session Google active (reconnexion auto).
  async signIn({ silent = false } = {}) {
    await this._initTokenClient();
    return new Promise((resolve, reject) => {
      this._tokenClient.callback = (response) => {
        if (response.error) {
          reject(new Error(`Erreur OAuth : ${response.error}`));
          return;
        }
        // ⚠️ Token gardé EN MÉMOIRE uniquement
        this._token = response.access_token;
        // On mémorise UNIQUEMENT le fait d'avoir été lié (pas le token).
        try { localStorage.setItem('musedesk.driveLinked', '1'); } catch (_) {}
        resolve(this._token);
      };
      this._tokenClient.requestAccessToken({ prompt: silent ? '' : 'consent' });
    });
  }

  // Reconnexion silencieuse au démarrage. Ne rejette jamais : renvoie un booléen.
  // Garde-fou temporel : si GIS attend une interaction, on abandonne (pas de popup
  // surprise au boot).
  async reconnectSilently() {
    if (localStorage.getItem('musedesk.driveLinked') !== '1') return false;
    try {
      await Promise.race([
        this.signIn({ silent: true }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
      ]);
      return true;
    } catch (_) {
      return false;
    }
  }

  // --- Révoque le token et l'efface de la mémoire ---
  async signOut() {
    if (this._token) {
      // Révocation propre via GIS
      try {
        await this._loadGIS();
        window.google.accounts.oauth2.revoke(this._token, () => {});
      } catch (_) {
        // Silencieux si GIS pas chargé
      }
      this._token = null;
    }
    try { localStorage.removeItem('musedesk.driveLinked'); } catch (_) {}
  }

  async isAuthenticated() {
    return !!this._token;
  }

  // --- Requête Drive avec le token en mémoire ---
  async _request(url, opts = {}) {
    if (!this._token) throw new Error('Non authentifié');
    const headers = {
      Authorization: `Bearer ${this._token}`,
      ...(opts.headers || {}),
    };
    const res = await fetch(url, { ...opts, headers });
    if (res.status === 401) {
      // Token expiré — on efface (l'utilisateur devra se reconnecter)
      this._token = null;
      throw new Error('Token Google expiré — veuillez vous reconnecter');
    }
    return res;
  }

  // --- Cherche l'ID du fichier library sur Drive ---
  async _findFileId() {
    const q   = encodeURIComponent(`name='${DRIVE_FILE_NAME}' and trashed=false`);
    const res = await this._request(`${DRIVE_LIST}?q=${q}&fields=files(id,name,modifiedTime)&spaces=drive`);
    const json = await res.json();
    const files = json.files || [];
    return files.length > 0 ? files[0].id : null;
  }

  // --- Lit le contenu du fichier library ---
  async pull() {
    const fileId = await this._findFileId();
    if (!fileId) return { songs: [], setlists: [] };

    const res = await this._request(`${DRIVE_LIST}/${fileId}?alt=media`);
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return {
        songs:    Array.isArray(data.songs)    ? data.songs    : [],
        setlists: Array.isArray(data.setlists) ? data.setlists : [],
      };
    } catch (_) {
      console.warn('MuseDesk Sync : fichier Drive illisible, ignoré');
      return { songs: [], setlists: [] };
    }
  }

  // --- Écrit (crée ou met à jour) le fichier library ---
  async push(data) {
    const payload = JSON.stringify({
      version:    1,
      songs:      data.songs    || [],
      setlists:   data.setlists || [],
      exportedAt: new Date().toISOString(),
    });

    const blob     = new Blob([payload], { type: 'application/json' });
    const fileId   = await this._findFileId();
    const metadata = { name: DRIVE_FILE_NAME, mimeType: 'application/json' };

    if (fileId) {
      // Mise à jour multipart
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);
      await this._request(`${DRIVE_UPLOAD}/${fileId}?uploadType=multipart`, {
        method: 'PATCH',
        body:   form,
      });
    } else {
      // Création multipart
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);
      await this._request(`${DRIVE_UPLOAD}?uploadType=multipart`, {
        method: 'POST',
        body:   form,
      });
    }
  }
}
