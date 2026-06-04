// sync.js — Préparation du terrain pour la synchro Google Drive
// ---------------------------------------------------------------------------
// CE FICHIER NE FAIT RIEN POUR LE MVP. Il définit l'INTERFACE qu'un provider
// de synchro devra respecter, pour que l'ajout de Google Drive plus tard ne
// touche QUE ce fichier (db.js et app.js exposent déjà tout le nécessaire).
//
// Stratégie prévue (cf. brainstorm) :
//   - Source de vérité = morceaux dans IndexedDB (db.js).
//   - Sync = pousser les morceaux 'dirty' vers Drive, tirer les nouveaux.
//   - Auth = Google Identity Services (GIS) + Google Drive API, scope
//     'drive.file' (l'app ne voit que les fichiers qu'elle crée).
//   - ⚠️ OAuth impose une origine autorisée (https/localhost) : la PWA devra
//     être SERVIE (GitHub Pages / Netlify), pas ouverte en file://.
//
// Pour brancher Drive plus tard :
//   1) Créer un projet Google Cloud + client OAuth (origine = l'URL de la PWA).
//   2) Charger GIS, demander un token avec le scope drive.file.
//   3) Implémenter pull()/push() ci-dessous via l'API Drive REST (fetch).
//   4) Appeler initSync(new GoogleDriveProvider(...)) au démarrage dans app.js.
// ---------------------------------------------------------------------------

import { exportAll, importAll } from './db.js';

// Contrat qu'un provider de synchro doit implémenter.
export class SyncProvider {
  async isAuthenticated() { return false; }
  async signIn() { throw new Error('non implémenté'); }
  async signOut() {}
  // Récupère les morceaux distants -> doit renvoyer un array de morceaux.
  async pull() { return []; }
  // Envoie les morceaux locaux donnés vers le distant.
  async push(/* songs */) {}
}

// Provider par défaut : ne synchronise rien (mode 100% local du MVP).
class NoopProvider extends SyncProvider {}

let _provider = new NoopProvider();

export function initSync(provider) {
  if (provider) _provider = provider;
}

export function isSyncEnabled() {
  return !(_provider instanceof NoopProvider);
}

// Boucle de synchro générique : indépendante du provider concret.
// Quand un GoogleDriveProvider sera fourni, ceci fonctionnera sans changement.
export async function syncNow() {
  if (!isSyncEnabled()) return { skipped: true };
  if (!(await _provider.isAuthenticated())) return { skipped: true, reason: 'not-authenticated' };

  const remote = await _provider.pull();
  if (remote && remote.length) {
    await importAll(remote); // stratégie de merge à affiner (last-write-wins via updatedAt)
  }
  const local = await exportAll();
  await _provider.push(local);
  return { ok: true, pulled: remote.length, pushed: local.length };
}

/*
// SQUELETTE à implémenter plus tard — laissé en commentaire volontairement.
export class GoogleDriveProvider extends SyncProvider {
  constructor({ clientId }) { super(); this.clientId = clientId; this.token = null; }
  async signIn() {
    // google.accounts.oauth2.initTokenClient({ client_id, scope:'https://www.googleapis.com/auth/drive.file', callback })
  }
  async isAuthenticated() { return !!this.token; }
  async pull() {
    // GET files.list (q: name contains '.json' / appProperties), puis files.get (alt=media)
  }
  async push(songs) {
    // PATCH/POST files multipart pour chaque morceau dirty
  }
}
*/
