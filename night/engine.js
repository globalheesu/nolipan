// 밤의 기록 (working title) — rules engine
(function (root) {
  'use strict';
  const N = {};
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  N.rng = rng;
  const W = 3, R = 9, T = 5, VAULT = 8;
  N.W = W; N.R = R; N.T = T; N.VAULT = VAULT;
  N.ROOMS = ['로비', '카페', '기념품점', '조각실', '중앙홀', '회화실', '사무실', '자료실', '금고'];
  N.HOURS = ['21시', '22시', '23시', '24시', '01시'];
  const WALLS = new Set(['1-2', '4-5', '6-7']);
  const adj = [...Array(R)].map(() => []);
  for (let i = 0; i < R; i++) { const x = i % W, y = (i / W) | 0; [[1, 0], [0, 1]].forEach(([dx, dy]) => { const xx = x + dx, yy = y + dy; if (xx < W && yy < W) { const j = yy * W + xx; const k = i + '-' + j; if (!WALLS.has(k)) { adj[i].push(j); adj[j].push(i); } } }); }
  N.adj = adj;
  N.doors = []; for (let i = 0; i < R; i++) for (const j of adj[i]) if (i < j) N.doors.push(i + '-' + j);
  N.doorKey = (a, b) => a < b ? a + '-' + b : b + '-' + a;
  N.canMove = (a, b) => a === b || adj[a].includes(b);
  N.validRoute = (r, start, mustVault, forbidVault) => {
    if (!Array.isArray(r) || r.length !== T || r[0] !== start) return false;
    for (let t = 1; t < T; t++) if (!Number.isInteger(r[t]) || r[t] < 0 || r[t] >= R || !N.canMove(r[t - 1], r[t])) return false;
    if (mustVault && !r.slice(1).includes(VAULT)) return false;
    if (forbidVault && r.includes(VAULT)) return false;
    return true;
  };
  N.allRoutes = start => { const out = []; const rec = p => { if (p.length === T) { out.push(p.slice()); return; } const c = p[p.length - 1]; for (const n of [c, ...adj[c]]) { p.push(n); rec(p); p.pop(); } }; rec([start]); return out; };

  // round: {starts[], culprit, errands[], sensors[], npcRoutes{}}
  N.newRound = function (nHumans, seed) {
    const r = rng(seed); const total = Math.max(nHumans, 6); const pick = a => a[Math.floor(r() * a.length)];
    const starts = []; for (let p = 0; p < total; p++) starts.push(Math.floor(r() * 8));
    const culprit = Math.floor(r() * nHumans);
    const errands = starts.map((s, p) => p < nHumans && p !== culprit ? pick([0, 1, 2, 3, 4, 5, 6, 7].filter(x => x !== s)) : null);
    const pool = N.doors.filter(k => !k.endsWith('-8')); const sensors = [];
    while (sensors.length < 3) { const k = pool.splice(Math.floor(r() * pool.length), 1)[0]; sensors.push(k); }
    const npc = {};
    for (let p = nHumans; p < total; p++) npc[p] = pick(N.allRoutes(starts[p]).filter(x => !x.includes(VAULT)));
    return { nHumans, total, starts, culprit, errands, sensors, npc, seed };
  };

  function counts(routes) { const c = [...Array(T)].map(() => Array(R).fill(0)); routes.forEach(r => r && r.forEach((x, t) => c[t][x]++)); return c; }
  function doorLog(routes, sensors) { const d = {}; sensors.forEach(k => d[k] = Array(T - 1).fill(0)); routes.forEach(r => { if (!r) return; for (let t = 1; t < T; t++) { const a = r[t - 1], b = r[t]; if (a === b) continue; const k = N.doorKey(a, b); if (d[k]) d[k][t - 1]++; } }); return d; }
  N.counts = counts; N.doorLog = doorLog;

  // inputs[p] = {route, claim, tamper:[{t,to}]}  (innocents: claim = route, tamper = [])
  N.resolve = function (round, inputs) {
    const truth = [], claims = [];
    for (let p = 0; p < round.total; p++) {
      if (p >= round.nHumans) { truth.push(round.npc[p]); claims.push(round.npc[p]); continue; }
      const inp = inputs[p]; truth.push(inp.route); claims.push(p === round.culprit ? inp.claim : inp.route);
    }
    const motion = counts(truth);
    const ci = inputs[round.culprit]; const applied = [];
    for (const tp of (ci.tamper || []).slice(0, 2)) {
      const t = tp.t | 0, to = tp.to | 0; if (t < 1 || t >= T || to < 0 || to >= R) continue;
      const from = ci.route[t]; if (from === to || motion[t][from] <= 0) continue;
      motion[t][from]--; motion[t][to]++; applied.push({ t, from, to });
    }
    const doors = doorLog(truth, round.sensors);
    const claimCounts = counts(claims); const claimDoors = doorLog(claims, round.sensors);
    const mism = []; for (let t = 0; t < T; t++) for (let x = 0; x < R; x++) if (motion[t][x] !== claimCounts[t][x]) mism.push({ t, x, log: motion[t][x], said: claimCounts[t][x] });
    const dmism = []; for (const k of round.sensors) for (let i = 0; i < T - 1; i++) if (doors[k][i] !== claimDoors[k][i]) dmism.push({ k, i, log: doors[k][i], said: claimDoors[k][i] });
    const errandsDone = round.errands.map((e, p) => e == null ? null : truth[p].slice(1).includes(e));
    return { truth, claims, motion, doors, claimCounts, claimDoors, mism, dmism, applied, errandsDone };
  };

  // which humans could logically be the culprit (others honest), given the shown logs
  N.consistentSuspects = function (round, res, budget) {
    budget = budget == null ? 2 : budget; const out = [];
    for (let X = 0; X < round.nHumans; X++) {
      const routes = res.claims.slice(); let ok = false;
      for (const xr of N.allRoutes(round.starts[X])) {
        if (!xr.slice(1).includes(VAULT)) continue; routes[X] = xr;
        const D = doorLog(routes, round.sensors); let same = true; for (const k of round.sensors) for (let i = 0; i < T - 1; i++) if (D[k][i] !== res.doors[k][i]) same = false; if (!same) continue;
        const C = counts(routes); let moves = 0; for (let t = 0; t < T; t++) { let pos = 0; for (let x = 0; x < R; x++) { const d = C[t][x] - res.motion[t][x]; if (d > 0) pos += d; } moves += pos; }
        // tampering only moves the culprit's own presence, so the truth differs from the shown log by <= budget unit moves
        if (moves <= budget) { ok = true; break; }
      }
      if (ok) out.push(X);
    }
    return out;
  };

  // scoring for one round
  N.score = function (round, res, accused) {
    const pts = Array(round.nHumans).fill(0); const caught = accused === round.culprit;
    for (let p = 0; p < round.nHumans; p++) {
      if (p === round.culprit) { if (!caught) pts[p] += 3 + (res.applied.length < 2 ? 1 : 0); }
      else { if (caught) pts[p] += 2; if (res.errandsDone[p]) pts[p] += 1; }
    }
    return { pts, caught };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = N; else root.NightEngine = N;
})(typeof window !== 'undefined' ? window : this);
