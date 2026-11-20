/* NoliSFX — synthesized sounds (no audio files) + haptics. Off when the user mutes or prefers reduced motion for haptics. */
(function (root) {
  'use strict';
  let ctx = null;
  function on() { try { return localStorage.getItem('noli:sound') !== 'off'; } catch (e) { return true; } }
  function set(v) { try { localStorage.setItem('noli:sound', v ? 'on' : 'off'); } catch (e) { } }
  function ac() { if (!ctx) { const C = root.AudioContext || root.webkitAudioContext; if (!C) return null; ctx = new C(); } if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  function tone(f, dur, type, vol, slide) {
    const a = ac(); if (!a) return; const t = a.currentTime;
    const o = a.createOscillator(), g = a.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol) {
    const a = ac(); if (!a) return; const n = a.sampleRate * dur | 0; const b = a.createBuffer(1, n, a.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const s = a.createBufferSource(); s.buffer = b; const g = a.createGain(); g.gain.value = vol || 0.2; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    s.connect(f).connect(g).connect(a.destination); s.start();
  }
  const SOUNDS = {
    tap: () => tone(660, 0.05, 'triangle', 0.05),
    step: () => tone(520, 0.06, 'triangle', 0.06),
    pop: () => tone(880, 0.09, 'sine', 0.08, 1320),
    flip: () => { tone(300, 0.08, 'triangle', 0.06, 600); },
    stamp: () => { noise(0.25, 0.35); tone(110, 0.25, 'sine', 0.25, 60); },
    hit: () => { tone(220, 0.18, 'square', 0.06, 140); noise(0.12, 0.12); },
    win: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.08), i * 110)); },
    lose: () => { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.07), i * 140)); },
    tick: () => tone(1200, 0.03, 'square', 0.03)
  };
  const HAPTIC = { stamp: [30, 40, 30], hit: 25, win: [20, 30, 20, 30, 60], pop: 8, tap: 5 };
  function play(name) {
    if (on() && SOUNDS[name]) try { SOUNDS[name](); } catch (e) { }
    if (on() && HAPTIC[name] && navigator.vibrate) try { navigator.vibrate(HAPTIC[name]); } catch (e) { }
  }
  root.NoliSFX = { play, on, set, unlock: () => { try { ac(); } catch (e) { } } };
  root.addEventListener && root.addEventListener('pointerdown', function u() { try { ac(); } catch (e) { } root.removeEventListener('pointerdown', u); }, { once: true });
})(typeof window !== 'undefined' ? window : this);
