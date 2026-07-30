// Triage d'une PR : classe le diff via Gemini 2.0 Flash, notifie Eric sur Telegram.
// Node >= 18 (fetch global), zéro dépendance. Toutes les entrées arrivent par process.env
// (mappées depuis le contexte GitHub dans jules-triage.yml) — aucune interpolation shell.
// Port fidèle de la logique de julesPrTriage001.json (nœuds Gemini classify + Parse verdict).
import { readFileSync } from 'node:fs';

const env = process.env;
const GOOGLE_API_KEY = env.GOOGLE_API_KEY || '';
const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = env.TELEGRAM_CHAT_ID || '';

const pr = {
  title: env.PR_TITLE || '(sans titre)',
  author: env.PR_AUTHOR || '?',
  url: env.PR_URL || '',
  number: env.PR_NUMBER || '?',
  base: env.PR_BASE || '?',
  head: env.PR_HEAD || '?',
  add: env.PR_ADD || '0',
  del: env.PR_DEL || '0',
  files: env.PR_FILES || '0',
  body: (env.PR_BODY || '').slice(0, 2000) || '(vide)',
  repo: env.REPO || '?',
};

let diff = '(diff indisponible)';
try {
  diff = readFileSync('pr.diff', 'utf8');
} catch { /* garde le fallback */ }
const diffTrunc = diff.slice(0, 12000);

const promptText = [
  "Tu es un trieur de pull requests pour un dev solo (Eric). Ton seul rôle : décider si la PR mérite la relecture humaine coûteuse (Opus) ou non.",
  'Réponds STRICTEMENT en JSON: {"verdict":"review-ready|needs-human|risque","raison":"1 phrase","severite":"low|med|high"}.',
  "",
  "Définitions:",
  "- review-ready: petit, sûr, mécanique (typo, bump version, doc, format). Pas besoin d'Opus.",
  "- needs-human: logique métier modifiée, nouvelle feature, refactor moyen. À relire.",
  "- risque: touche sécurité/secrets/auth/migration DB/suppression massive/CI-deploy. Prioritaire.",
  "",
  "=== PR ===",
  `Titre: ${pr.title}`,
  `Author: ${pr.author}`,
  `Branch: ${pr.head} -> ${pr.base}`,
  `Stats: +${pr.add} -${pr.del} (${pr.files} fichiers)`,
  `Description: ${pr.body}`,
  "",
  "=== DIFF (tronqué) ===",
  diffTrunc,
].join("\n");

// Fallback gracieux : si le LLM/diff est KO, on remonte quand même à Eric (mieux vaut du bruit qu'un raté).
let verdict = "needs-human";
let raison = "classification LLM indisponible, remontée par précaution";
let severite = "med";

try {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(GOOGLE_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: { temperature: 0.1, maxOutputTokens: 400, responseMimeType: "application/json" },
        contents: [{ role: "user", parts: [{ text: promptText }] }],
      }),
    },
  );
  if (res.ok) {
    const data = await res.json();
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (txt) {
      const parsed = JSON.parse(txt.replace(/```json|```/g, "").trim());
      if (parsed.verdict) verdict = String(parsed.verdict);
      if (parsed.raison) raison = String(parsed.raison);
      if (parsed.severite) severite = String(parsed.severite);
    }
  } else {
    raison = `Gemini HTTP ${res.status}, remontée par précaution`;
  }
} catch (e) {
  raison = `triage KO (${String(e && e.message ? e.message : e).slice(0, 80)}), remontée par précaution`;
}

const icon = verdict === "risque" ? "🔴" : verdict === "needs-human" ? "🟡" : "🟢";
const prioritaire = verdict === "risque" || severite === "high";

// Texte BRUT volontairement (pas de parse_mode) : le titre/corps de PR sont contrôlés par
// l'auteur de la PR ; en Markdown un titre type "[clic](http://evil)" deviendrait un lien
// cliquable dans une notif de confiance (phishing). Plain text = sûr, et lisible avec emojis.
const text =
  `${icon} Jules PR triage — ${verdict.toUpperCase()}\n\n` +
  `📋 ${pr.repo} #${pr.number}\n` +
  `✏️ ${pr.title}\n` +
  `👤 ${pr.author} · +${pr.add} -${pr.del} (${pr.files} fichiers)\n` +
  `🗣️ ${raison}\n` +
  (prioritaire ? "⚠️ À relire en priorité (Opus)\n" : "") +
  `\n🔗 ${pr.url}`;

// chat_id en string brute : l'API Telegram accepte un entier ou un @username tels quels ;
// Number(...) casserait un id non numérique (@channel → NaN → chat_id:null → 400).
const tg = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
});

if (!tg.ok) {
  console.error(`::error::Telegram HTTP ${tg.status}`);
  process.exit(1);
}
console.log(`Triage envoyé : ${verdict} (${pr.repo}#${pr.number})`);
