// drumplayer.js — Moteur audio de l'accompagnement batterie (Web Audio)
// ---------------------------------------------------------------------------
// Joue des échantillons de vraie batterie (kit/ — Virtuosity Drums, CC0) au
// tempo FIXE du morceau, mesure par mesure. La partition de chaque mesure est
// fournie par l'appelant (barSource) : rythme généré par style (drums.js) ou
// squelette MIDI. Ce module ne connaît ni le DOM ni IndexedDB.
//
// Pourquoi un ordonnanceur à fenêtre glissante (setInterval + horloge audio)
// et pas des setTimeout par frappe : même technique que le métronome existant
// (« A Tale of Two Clocks », Chris Wilson) — les frappes sont posées à l'avance
// sur l'horloge Web Audio, précise à l'échantillon, et setInterval ne sert qu'à
// remplir la fenêtre. Le tempo reste stable même si le fil principal rame.
//
// Chargement paresseux : les sons ne sont téléchargés qu'au premier usage de
// l'option (loadKit), puis le service worker les garde hors ligne.
// ---------------------------------------------------------------------------

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12; // secondes

export function createDrumPlayer({ getContext, kitUrl = './kit/', samples = [] }) {
  const buffers = new Map();
  let loading = null;
  let master = null;
  const st = {
    playing: false,
    timer: null,
    t0: 0,           // instant audio du temps 1 de la mesure 0
    bpm: 100,
    beats: 4,
    nextBar: 0,      // prochaine mesure à poser
    barSource: null,
    onBar: null,
  };

  function out(ctx) {
    if (master && master.context === ctx) return master;
    // Léger compresseur : colle les frappes entre elles et évite la saturation
    // quand crash + kick + caisse tombent ensemble.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3;
    comp.attack.value = 0.005; comp.release.value = 0.15;
    const gain = ctx.createGain();
    gain.gain.value = 0.9;
    gain.connect(comp); comp.connect(ctx.destination);
    master = gain;
    return master;
  }

  // Télécharge et décode le kit. onProgress(fait, total). Idempotent.
  function loadKit(onProgress) {
    if (loading) return loading;
    const ctx = getContext();
    let done = 0;
    loading = Promise.all(samples.map(async (name) => {
      const res = await fetch(`${kitUrl}${name}.mp3`);
      if (!res.ok) throw new Error(`kit : ${name} introuvable (${res.status})`);
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      buffers.set(name, buf);
      onProgress?.(++done, samples.length);
    })).catch((err) => { loading = null; throw err; });
    return loading;
  }

  const isLoaded = () => buffers.size === samples.length && samples.length > 0;

  function hit(ctx, name, when, v) {
    const buf = buffers.get(name);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    // Courbe de vélocité légèrement exponentielle : les notes fantômes restent discrètes.
    g.gain.value = Math.pow(Math.max(0, Math.min(1, v)), 1.6);
    src.connect(g); g.connect(out(ctx));
    src.start(Math.max(when, ctx.currentTime));
  }

  const barDur = () => (60 / st.bpm) * st.beats;

  function tick() {
    const ctx = getContext();
    while (st.t0 + st.nextBar * barDur() < ctx.currentTime + SCHEDULE_AHEAD) {
      const bar = st.nextBar++;
      const barStart = st.t0 + bar * barDur();
      const events = st.barSource ? st.barSource(bar) : [];
      if (events === null) { stop(); return; } // fin de partition
      for (const e of events) {
        hit(ctx, e.sample || e.inst, barStart + e.t * (60 / st.bpm) + (e.jit || 0), e.v);
      }
      if (st.onBar) {
        const delay = Math.max(0, (barStart - ctx.currentTime) * 1000);
        setTimeout(() => { if (st.playing) st.onBar(bar); }, delay);
      }
    }
  }

  // Démarre à la mesure 0. barSource(bar) → événements { t, inst|sample, v, jit }
  // ou null pour s'arrêter. onBar(bar) est appelé au temps 1 de chaque mesure.
  function start({ bpm, beats = 4, barSource, onBar, delay = 0.08 }) {
    stop();
    const ctx = getContext();
    st.bpm = bpm; st.beats = beats; st.barSource = barSource; st.onBar = onBar || null;
    st.t0 = ctx.currentTime + delay;
    st.nextBar = 0;
    st.playing = true;
    tick();
    st.timer = setInterval(tick, LOOKAHEAD_MS);
    return st.t0;
  }

  function stop() {
    if (st.timer) clearInterval(st.timer);
    st.timer = null;
    st.playing = false;
    // Coupe net les frappes déjà posées dans la fenêtre : on remplace la sortie.
    if (master) { try { master.disconnect(); } catch { /* déjà déconnecté */ } master = null; }
  }

  // Mesures écoulées depuis le temps 1 de la mesure 0 (fractionnaire, peut être < 0).
  function elapsedBars() {
    if (!st.playing) return 0;
    return (getContext().currentTime - st.t0) / barDur();
  }

  return {
    loadKit, isLoaded, start, stop, elapsedBars,
    get playing() { return st.playing; },
    get t0() { return st.t0; },
  };
}
