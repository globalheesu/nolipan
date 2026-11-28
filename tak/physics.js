/* 탁 physics — deterministic 2D discs on a round board. Shared by the game (host) and the node simulator. */
(function (root, factory) { const P = factory(); if (typeof module === 'object' && module.exports) module.exports = P; else root.TakPhysics = P; })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const KINDS = [
    { name: '무거운 돌', m: 2.0, r: 25 },
    { name: '보통 돌', m: 1.0, r: 19 },
    { name: '가벼운 돌', m: 0.55, r: 14 },
  ];
  const C = { R0: 300, VMAX: 900, MU: 820, E: 0.9, DT: 1 / 120, MAXT: 7, FPS: 30 };
  const launchSpeed = (kind, power) => C.VMAX * Math.max(0, Math.min(1, power)) / Math.sqrt(KINDS[kind].m);
  // stones: [{id, p (player), k (kind), x, y, vx, vy, out}]
  // shots: [{id, a (angle), w (power 0..1)}]
  function simulate(stones, shots, R, record) {
    const S = stones.map(s => Object.assign({}, s, { vx: 0, vy: 0 }));
    const byId = new Map(S.map(s => [s.id, s]));
    for (const sh of shots) { const s = byId.get(sh.id); if (!s || s.out) continue; if (sh.vx != null) { s.vx = sh.vx; s.vy = sh.vy; } else { const v = launchSpeed(s.k, sh.w); s.vx = Math.cos(sh.a) * v; s.vy = Math.sin(sh.a) * v; } }
    const frames = []; const events = []; let t = 0, step = 0; const every = Math.round(1 / C.FPS / C.DT);
    const snap = () => frames.push(S.map(s => s.out ? null : [Math.round(s.x * 10) / 10, Math.round(s.y * 10) / 10]));
    if (record) snap();
    while (t < C.MAXT) {
      let moving = false;
      for (const s of S) {
        if (s.out) continue;
        const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
        if (sp > 0) { const ns = Math.max(0, sp - C.MU * C.DT); if (ns === 0) { s.vx = 0; s.vy = 0; } else { s.vx *= ns / sp; s.vy *= ns / sp; moving = true; } }
        s.x += s.vx * C.DT; s.y += s.vy * C.DT;
      }
      for (let i = 0; i < S.length; i++) {
        const a = S[i]; if (a.out) continue;
        for (let j = i + 1; j < S.length; j++) {
          const b = S[j]; if (b.out) continue;
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy), ra = KINDS[a.k].r, rb = KINDS[b.k].r, min = ra + rb;
          if (d >= min || d === 0) continue;
          const nx = dx / d, ny = dy / d, ma = KINDS[a.k].m, mb = KINDS[b.k].m;
          const over = min - d; a.x -= nx * over * mb / (ma + mb); a.y -= ny * over * mb / (ma + mb); b.x += nx * over * ma / (ma + mb); b.y += ny * over * ma / (ma + mb);
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rv > 0) continue;
          const jimp = -(1 + C.E) * rv / (1 / ma + 1 / mb);
          a.vx -= jimp * nx / ma; a.vy -= jimp * ny / ma; b.vx += jimp * nx / mb; b.vy += jimp * ny / mb;
          if (record && -rv > 60) events.push({ t: Math.round(t * 1000), type: 'hit', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, f: Math.min(1, -rv / 900), a: a.id, b: b.id });
          moving = true;
        }
      }
      for (const s of S) { if (!s.out && s.x * s.x + s.y * s.y > R * R) { s.out = true; s.vx = s.vy = 0; if (record) events.push({ t: Math.round(t * 1000), type: 'fall', id: s.id, p: s.p }); } }
      t += C.DT; step++;
      if (record && step % every === 0) snap();
      if (!moving) break;
    }
    if (record) snap();
    return { stones: S.map(s => ({ id: s.id, p: s.p, k: s.k, x: s.x, y: s.y, out: s.out })), frames, events, dur: Math.round(t * 1000) };
  }
  function setup(n, R) {
    const stones = []; let id = 0;
    for (let p = 0; p < n; p++) {
      const ang = -Math.PI / 2 + p * 2 * Math.PI / n, cx = Math.cos(ang) * R * 0.62, cy = Math.sin(ang) * R * 0.62;
      const tx = -Math.sin(ang), ty = Math.cos(ang); // tangent
      const pos = [[cx * 1.12, cy * 1.12], [cx * 0.9 + tx * 34, cy * 0.9 + ty * 34], [cx * 0.9 - tx * 34, cy * 0.9 - ty * 34]];
      [0, 1, 2].forEach(k => stones.push({ id: id++, p, k, x: pos[k][0], y: pos[k][1], out: false }));
    }
    return stones;
  }
  const toVel = (kind, a, w) => { const v = launchSpeed(kind, w); return { vx: Math.round(Math.cos(a) * v * 1000) / 1000, vy: Math.round(Math.sin(a) * v * 1000) / 1000 }; };
  const travel = (kind, w) => { const v = launchSpeed(kind, w); return v * v / (2 * C.MU); };
  return { KINDS, C, simulate, setup, launchSpeed, toVel, travel };
});
