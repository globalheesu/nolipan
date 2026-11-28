/* 탁 bot: tries candidate shots against a still board and keeps the best. Noise sets skill. */
(function (root, factory) { const A = factory(root.TakPhysics || (typeof require === 'function' ? require('./physics.js') : null)); if (typeof module === 'object' && module.exports) module.exports = A; else root.TakAI = A; })(typeof self !== 'undefined' ? self : this, function (P) {
  'use strict';
  function plan(stones, me, R, skill, rnd) {
    rnd = rnd || Math.random;
    const mine = stones.filter(s => s.p === me && !s.out), foes = stones.filter(s => s.p !== me && !s.out);
    if (!mine.length) return null;
    const cands = [];
    for (const s of mine) {
      for (const f of foes) {
        const base = Math.atan2(f.y - s.y, f.x - s.x);
        for (const off of [-0.08, 0, 0.08]) for (const w of [0.55, 0.8, 1]) cands.push({ id: s.id, a: base + off, w });
      }
      const toC = Math.atan2(-s.y, -s.x); const d = Math.sqrt(s.x * s.x + s.y * s.y);
      if (d > R * 0.45) cands.push({ id: s.id, a: toC, w: Math.min(1, Math.sqrt(d * 0.8 * 2 * P.C.MU) / P.launchSpeed(s.k, 1)), safe: true });
    }
    let best = null, bestV = -1e9;
    const sample = cands.length > 48 ? cands.sort(() => rnd() - 0.5).slice(0, 48) : cands;
    for (const c of sample) {
      const r = P.simulate(stones, [c], R, false);
      let v = 0;
      for (const s of r.stones) { if (!s.out) { if (s.p === me) v += 0.15 * (1 - Math.sqrt(s.x * s.x + s.y * s.y) / R); continue; } const was = stones.find(o => o.id === s.id); if (was.out) continue; v += s.p === me ? -1.4 : 1; }
      v += (rnd() - 0.5) * 0.15;
      if (v > bestV) { bestV = v; best = c; }
    }
    const noise = skill === 'hard' ? 0.025 : skill === 'easy' ? 0.12 : 0.06;
    const g = () => { let u = 0; for (let i = 0; i < 4; i++) u += rnd(); return (u - 2) / 1.15; };
    return { id: best.id, a: best.a + g() * noise, w: Math.max(0.15, Math.min(1, best.w + g() * noise * 1.5)) };
  }
  // reads the table: predicts everyone else's greedy shot, then plans against all of them together
  function planSmart(stones, me, R, rnd) {
    rnd = rnd || Math.random;
    const others = [...new Set(stones.filter(s => !s.out && s.p !== me).map(s => s.p))];
    const pred = others.map(p => plan(stones, p, R, 'hard', rnd)).filter(Boolean);
    const mine = stones.filter(s => s.p === me && !s.out), foes = stones.filter(s => s.p !== me && !s.out);
    if (!mine.length) return null;
    const cands = [];
    for (const s of mine) {
      for (const f of foes) { const b = Math.atan2(f.y - s.y, f.x - s.x); for (const off of [-0.08, 0, 0.08]) for (const w of [0.55, 0.8, 1]) cands.push({ id: s.id, a: b + off, w }); }
      for (let k = 0; k < 6; k++) cands.push({ id: s.id, a: k * Math.PI / 3, w: 0.35 });
      cands.push({ id: s.id, a: Math.atan2(-s.y, -s.x), w: 0.5 });
    }
    const sample = cands.length > 40 ? cands.sort(() => rnd() - 0.5).slice(0, 40) : cands;
    let best = null, bv = -1e9;
    for (const c of sample) {
      const r = P.simulate(stones, pred.filter(x => x.id !== c.id).concat([c]), R, false); let v = 0;
      for (const s of r.stones) { const was = stones.find(o => o.id === s.id); if (was.out) continue; if (s.out) v += s.p === me ? -1.4 : 1; else if (s.p === me) v += 0.15 * (1 - Math.sqrt(s.x * s.x + s.y * s.y) / R); }
      if (v > bv) { bv = v; best = c; }
    }
    const g = () => { let u = 0; for (let i = 0; i < 4; i++) u += rnd(); return (u - 2) / 1.15; };
    return { id: best.id, a: best.a + g() * 0.05, w: Math.max(0.15, Math.min(1, best.w + g() * 0.08)) };
  }
  return { plan, planSmart };
});
