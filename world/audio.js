// Tiny procedural soundscape: wind bed, footsteps and UI blips. No audio files needed except the
// original "enter" chime from sounds/.
export function createAudio() {
  let ctx = null, master = null, wind = null, windGain = null, noise = null;
  let muted = false;
  try { muted = localStorage.getItem('world-muted') === '1'; } catch { /* storage unavailable */ }

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    // Shared noise buffer.
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { last = last * 0.96 + (Math.random() * 2 - 1) * 0.04; d[i] = last * 6; }
    // Wind: looping brown noise through a slowly sweeping band-pass.
    const src = ctx.createBufferSource();
    src.buffer = noise; src.loop = true;
    wind = ctx.createBiquadFilter();
    wind.type = 'bandpass'; wind.frequency.value = 420; wind.Q.value = 0.45;
    windGain = ctx.createGain();
    windGain.gain.value = 0.0;
    src.connect(wind).connect(windGain).connect(master);
    src.start();
    return ctx;
  }

  function burst({ freq = 900, q = 1.2, gain = 0.12, dur = 0.09, type = 'bandpass' }) {
    if (!ctx || muted) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  function tone(freq, dur = 0.12, gain = 0.07, type = 'sine') {
    if (!ctx || muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  const chime = new Audio('sounds/enter.ogg');
  chime.preload = 'none';
  chime.volume = 0.5;

  return {
    get muted() { return muted; },
    start() { ensure(); ctx?.resume?.(); },
    setMuted(v) {
      muted = v;
      try { localStorage.setItem('world-muted', v ? '1' : '0'); } catch { /* ignore */ }
      if (master) master.gain.setTargetAtTime(v ? 0 : 0.9, ctx.currentTime, 0.05);
    },
    /** Called every frame with elapsed time so the wind breathes. */
    update(t, active) {
      if (!ctx) return;
      const gust = 0.5 + 0.5 * Math.sin(t * 0.23) * Math.sin(t * 0.11 + 1.3);
      windGain.gain.setTargetAtTime(active ? 0.05 + gust * 0.07 : 0.0, ctx.currentTime, 0.4);
      wind.frequency.setTargetAtTime(320 + gust * 380, ctx.currentTime, 0.5);
    },
    footstep(running, onDirt) {
      burst({ freq: onDirt ? 520 : 1700, q: onDirt ? 0.9 : 0.6, gain: running ? 0.11 : 0.07, dur: onDirt ? 0.07 : 0.11, type: onDirt ? 'lowpass' : 'bandpass' });
    },
    blip() { tone(660, 0.09, 0.05, 'triangle'); },
    ready() { tone(520, 0.14, 0.05); setTimeout(() => tone(780, 0.2, 0.05), 90); },
    enter() {
      if (muted) return;
      chime.currentTime = 0;
      chime.play().catch(() => {});
    },
  };
}
