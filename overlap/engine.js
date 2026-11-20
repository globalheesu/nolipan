// OVERLAP rules engine — shared by the simulator (node) and the web game (browser).
(function (root) {
  'use strict';
  const E = {};

  // ---------- RNG ----------
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  E.rng = rng;
  function shuffle(arr, r) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  E.shuffle = shuffle;

  // ---------- Tunable rules ----------
  E.defaultRules = function () {
    return {
      version: 'v1.1',
      treasure: 2,
      star: 5,
      village: [0, 2, 5, 9, 14],      // index = villages owned (4+ capped)
      supplyPoint: 1,
      goalPts4: [5, 2],               // public goal 1st/2nd for 4+ players
      goalPts23: [4],                 // 2-3 players: 1st only
      bountyRound: 4,
      bountyBonus: 2,
      startSupplyLastTwo: 1,
      collisionSupplyCap: 1,
      secretPts: null,                // override secret points: {id: pts}
      rounds: { 2: 7, 3: 7, 4: 7, 5: 6, 6: 6 },
      nMinus: { 2: 0, 3: 1, 4: 0, 5: 1, 6: 1 },
      publicCount: { 2: 3, 3: 2, 4: 3, 5: 2, 6: 2 },
      deck: [
        [2, 'tailwind'], [2, 'calm'], [2, null], [2, null], [2, null],
        [3, 'storm'], [3, 'fork'], [3, 'calm'], [3, null], [3, null], [3, null],
        [4, 'storm'], [4, 'fork'], [4, 'tailwind'], [4, null],
        [5, null]
      ],
      tieRule: 'arrival'              // 'arrival' (v1.1) or 'ruin'
    };
  };

  // ---------- Maps ----------
  // '.' plain, M mountain, ~ sea, T treasure, V village, S golden ruin(star), 1-6 port
  E.MAPS = {
    dunbon: { name: '든본섬', w: 10, h: 10, rows: [
      '~..1..2..~',
      '..T..M..T.',
      '...MV..M..',
      '6.M...T...',
      '.V..TS.MV3',
      '5..M......',
      '.M..V.MT..',
      '..T..M...M',
      '.M.MT..VT.',
      '~..V.4...~'] }
  };

  function parseMap(def) {
    const w = def.w, h = def.h, n = w * h;
    const type = new Array(n); const ports = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = def.rows[y][x]; const i = y * w + x;
      if (/[1-9]/.test(ch)) { type[i] = 'P'; ports.push({ id: +ch, idx: i }); }
      else type[i] = ch;
    }
    ports.sort((a, b) => a.id - b.id);
    return { name: def.name, w, h, n, type, ports };
  }
  E.parseMap = parseMap;

  // Random island generator following design rules.
  E.generateMap = function (size, seed, name) {
    const r = rng(seed);
    for (let attempt = 0; attempt < 500; attempt++) {
      const w = size, h = size, n = w * h;
      const g = new Array(n).fill('.');
      const at = (x, y) => y * w + x;
      [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)].forEach(i => g[i] = '~');
      let portPos;
      if (size === 10) portPos = [[3, 0], [6, 0], [9, 4], [5, 9], [0, 5], [0, 3]];
      else portPos = [[3, 0], [7, 3], [4, 7], [0, 4]];
      portPos.forEach(([x, y], k) => g[at(x, y)] = String(k + 1));
      const c = Math.floor(size / 2);
      const starIdx = at(c - (r() < 0.5 ? 1 : 0), c - (r() < 0.5 ? 1 : 0));
      g[starIdx] = 'S';
      const counts = size === 10 ? { M: 12, T: 8, V: 6 } : { M: 8, T: 5, V: 4 };
      const nearPort = new Set();
      portPos.forEach(([x, y]) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) nearPort.add(at(xx, yy)); } });
      const free = []; for (let i = 0; i < n; i++) if (g[i] === '.') free.push(i);
      shuffle(free, r);
      let k = 0;
      for (const t of ['M', 'T', 'V']) {
        let placed = 0;
        for (let j = 0; j < free.length && placed < counts[t]; j++) {
          const i = free[j]; if (g[i] !== '.') continue;
          if (t === 'M' && nearPort.has(i)) continue;
          if (t === 'M' && Math.abs((i % w) - c) <= 0 && Math.abs(Math.floor(i / w) - c) <= 0) continue;
          g[i] = t; placed++;
        }
        k += placed;
      }
      // connectivity check
      const pass = i => g[i] !== 'M' && g[i] !== '~';
      let start = -1, total = 0; for (let i = 0; i < n; i++) if (pass(i)) { total++; if (start < 0) start = i; }
      const seen = new Uint8Array(n); const q = [start]; seen[start] = 1; let cnt = 0;
      while (q.length) { const i = q.pop(); cnt++; const x = i % w, y = (i / w) | 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) return; const j = at(xx, yy); if (!seen[j] && pass(j)) { seen[j] = 1; q.push(j); } }); }
      if (cnt !== total) continue;
      const rows = []; for (let y = 0; y < h; y++) rows.push(g.slice(y * w, y * w + w).join(''));
      return { name: name || ('Island ' + seed), w, h, rows };
    }
    throw new Error('map gen failed');
  };

  // v1.2 generator: 8 (or 4) rotationally symmetric ports, 2x2 central ruins, 180-degree symmetric terrain.
  E.generateMap2 = function (size, seed, name) {
    const r = rng(seed);
    for (let attempt = 0; attempt < 2000; attempt++) {
      const w = size, h = size, n = w * h; const at = (x, y) => y * w + x;
      const g = new Array(n).fill('.');
      [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)].forEach(i => g[i] = '~');
      const portPos = size === 10 ? [[2, 0], [7, 0], [9, 2], [9, 7], [7, 9], [2, 9], [0, 7], [0, 2]] : [[2, 0], [7, 2], [5, 7], [0, 5]];
      portPos.forEach(([x, y], k) => g[at(x, y)] = String(k + 1));
      const c = size / 2; [[c - 1, c - 1], [c, c - 1], [c - 1, c], [c, c]].forEach(([x, y]) => g[at(x, y)] = 'S');
      const counts = size === 10 ? { M: 12, T: 8, V: 6 } : { M: 6, T: 4, V: 4 };
      const nearPort = new Set();
      portPos.forEach(([x, y]) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) nearPort.add(at(xx, yy)); } });
      const mirror = i => at(w - 1 - (i % w), h - 1 - ((i / w) | 0));
      const half = []; for (let i = 0; i < n; i++) if (g[i] === '.' && i < mirror(i)) half.push(i);
      shuffle(half, r);
      let ok = true;
      for (const t of ['M', 'T', 'V']) {
        let placed = 0;
        for (const i of half) { if (placed >= counts[t] / 2) break; const j = mirror(i); if (g[i] !== '.' || g[j] !== '.') continue;
          if (t === 'M' && (nearPort.has(i) || nearPort.has(j))) continue;
          // avoid clumping same type orthogonally
          if (neighRaw(w, h, i).some(k => g[k] === t)) continue;
          g[i] = t; g[j] = t; placed++; }
        if (placed < counts[t] / 2) ok = false;
      }
      if (!ok) continue;
      const pass = i => g[i] !== 'M' && g[i] !== '~';
      let start = -1, total = 0; for (let i = 0; i < n; i++) if (pass(i)) { total++; if (start < 0) start = i; }
      const seen = new Uint8Array(n); const q = [start]; seen[start] = 1; let cnt = 0;
      while (q.length) { const i = q.pop(); cnt++; for (const j of neighRaw(w, h, i)) if (!seen[j] && pass(j)) { seen[j] = 1; q.push(j); } }
      if (cnt !== total) continue;
      const rows = []; for (let y = 0; y < h; y++) rows.push(g.slice(y * w, y * w + w).join(''));
      return { name: name || ('Isle ' + seed), w, h, rows, seed };
    }
    throw new Error('map gen2 failed');
  };
  function neighRaw(w, h, i) { const out = []; const x = i % w, y = (i / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) out.push(yy * w + xx); } return out; }

  // ---------- Geometry helpers ----------
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const D8 = D4.concat([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
  function neigh(map, i, diag) {
    const out = []; const x = i % map.w, y = (i / map.w) | 0;
    for (const [dx, dy] of (diag ? D8 : D4)) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < map.w && yy < map.h) out.push(yy * map.w + xx); }
    return out;
  }
  E.neigh = neigh;
  function passable(map, i) { const t = map.type[i]; return t !== 'M' && t !== '~'; }
  E.passable = passable;
  function isEdge(map, i) { const x = i % map.w, y = (i / map.w) | 0; return x === 0 || y === 0 || x === map.w - 1 || y === map.h - 1; }
  E.isEdge = isEdge;

  // ---------- Goals ----------
  E.PUBLIC_GOALS = [
    { id: 1, name: '개척자', desc: '영토 칸 수 최다' },
    { id: 2, name: '산악인', desc: '산과 맞닿은 내 칸 최다' },
    { id: 3, name: '해안선', desc: '가장자리 칸 최다' },
    { id: 4, name: '수집가', desc: '보물 칸 최다' },
    { id: 5, name: '외교관', desc: '다른 탐험대와 맞닿은 내 칸 최다' },
    { id: 6, name: '고립주의자', desc: '남과 맞닿은 칸 최소 (8칸 이상만)', low: true },
    { id: 7, name: '직선왕', desc: '가장 긴 가로·세로 직선' },
    { id: 8, name: '폐허 사냥꾼', desc: '폐허와 맞닿은 내 칸 최다' },
    { id: 9, name: '중심부', desc: '중앙 구역 안의 내 칸 최다' },
    { id: 10, name: '넓은 시야', desc: '내 칸이 있는 세로줄 수 최다' },
    { id: 11, name: '모서리 깃발', desc: '네 모서리 3×3 중 도달한 구역 수 최다' },
    { id: 12, name: '원정대', desc: '항구에서 가장 먼 칸까지 거리 최대' }
  ];
  E.SECRET_GOALS = [
    { id: 1, kind: 'zone', zone: 'NW', pts: 5, desc: '북서 모서리 3×3에 2칸' },
    { id: 2, kind: 'zone', zone: 'NE', pts: 5, desc: '북동 모서리 3×3에 2칸' },
    { id: 3, kind: 'zone', zone: 'SW', pts: 5, desc: '남서 모서리 3×3에 2칸' },
    { id: 4, kind: 'zone', zone: 'SE', pts: 5, desc: '남동 모서리 3×3에 2칸' },
    { id: 5, kind: 'zone', zone: 'C', pts: 5, desc: '중앙 구역에 4칸' },
    { id: 6, kind: 'opp', pts: 6, desc: '내 항구 맞은편 가장자리 도달' },
    { id: 7, kind: 'T3', pts: 5, desc: '보물 3개' },
    { id: 8, kind: 'V3', pts: 6, desc: '마을 3개' },
    { id: 9, kind: 'M6', pts: 4, desc: '산과 맞닿은 칸 6개' },
    { id: 10, kind: 'E6', pts: 4, desc: '가장자리 칸 6개' },
    { id: 11, kind: 'touch2', pts: 5, desc: '다른 탐험대 2곳 이상과 맞닿기' },
    { id: 12, kind: 'col3', pts: 5, desc: '충돌로 보급 3번 받기' },
    { id: 13, kind: 'ruin3', pts: 4, desc: '폐허와 맞닿은 칸 3개' },
    { id: 14, kind: 'port', pts: 6, desc: '다른 탐험대의 항구와 맞닿기' },
    { id: 15, kind: 'row5', pts: 5, desc: '가로 직선 5칸' },
    { id: 16, kind: 'colm5', pts: 5, desc: '세로 직선 5칸' },
    { id: 17, kind: 'sq2', pts: 5, desc: '2×2 정사각형 2개' },
    { id: 18, kind: 'loop', pts: 7, desc: '빈칸 하나를 완전히 둘러싸기' }
  ];

  E.SECRET_GOALS_V12 = [
    { id: 1, kind: 'zone', zone: 'NW', n: 3, pts: 4, desc: '북서 모서리 3×3에 3칸' },
    { id: 2, kind: 'zone', zone: 'NE', n: 3, pts: 4, desc: '북동 모서리 3×3에 3칸' },
    { id: 3, kind: 'zone', zone: 'SW', n: 3, pts: 4, desc: '남서 모서리 3×3에 3칸' },
    { id: 4, kind: 'zone', zone: 'SE', n: 3, pts: 4, desc: '남동 모서리 3×3에 3칸' },
    { id: 5, kind: 'zone', zone: 'C', n: 4, pts: 5, desc: '중앙 4×4 구역에 4칸' },
    { id: 6, kind: 'far', n: 8, pts: 6, desc: '항구에서 8칸 이상 떨어진 칸 보유' },
    { id: 7, kind: 'T3', n: 2, pts: 5, desc: '보물 2개' },
    { id: 8, kind: 'V3', n: 2, pts: 7, desc: '마을 2개' },
    { id: 9, kind: 'M6', n: 7, pts: 6, desc: '산과 맞닿은 칸 7개' },
    { id: 10, kind: 'E6', n: 7, pts: 6, desc: '가장자리 칸 7개' },
    { id: 11, kind: 'touchC', n: 5, pts: 5, desc: '다른 탐험대와 맞닿은 칸 5개' },
    { id: 12, kind: 'col3', n: 2, pts: 4, desc: '충돌로 보급 2번 받기' },
    { id: 13, kind: 'hoard', n: 2, pts: 5, desc: '보급 토큰 2개 이상 남기고 끝내기' },
    { id: 14, kind: 'port', pts: 7, desc: '다른 탐험대의 항구와 맞닿기' },
    { id: 15, kind: 'row5', n: 6, pts: 7, desc: '가로 직선 6칸' },
    { id: 16, kind: 'colm5', n: 6, pts: 7, desc: '세로 직선 6칸' },
    { id: 17, kind: 'sq2', n: 3, pts: 4, desc: '2×2 정사각형 3개' },
    { id: 18, kind: 'loop', pts: 8, desc: '내 영토로 칸 하나(빈칸·산·폐허)를 완전히 둘러싸기' }
  ];
  E.PUBLIC_GOALS_V12 = E.PUBLIC_GOALS.map(g => Object.assign({}, g));
  E.PUBLIC_GOALS_V12[3] = { id: 4, name: '수집가', desc: '보물+마을 칸 합계 최다' };
  E.PUBLIC_GOALS_V12[7] = { id: 8, name: '결투가', desc: '충돌에서 이긴 횟수 최다' };
  E.PUBLIC_GOALS_V12[10] = { id: 11, name: '모서리 깃발', desc: '네 모서리 3×3 구역 안의 내 칸 최다' };
  E.secretDefs = function (g) { return g.rules.goalSet === 'v12' ? E.SECRET_GOALS_V12 : E.SECRET_GOALS; };
  E.publicDefs = function (g) { return g.rules.goalSet === 'v12' ? E.PUBLIC_GOALS_V12 : E.PUBLIC_GOALS; };

  function zoneOf(map, zone) {
    const w = map.w, h = map.h, set = new Set();
    let x0, y0, x1, y1;
    if (zone === 'NW') [x0, y0, x1, y1] = [0, 0, 2, 2];
    if (zone === 'NE') [x0, y0, x1, y1] = [w - 3, 0, w - 1, 2];
    if (zone === 'SW') [x0, y0, x1, y1] = [0, h - 3, 2, h - 1];
    if (zone === 'SE') [x0, y0, x1, y1] = [w - 3, h - 3, w - 1, h - 1];
    if (zone === 'C') { const a = Math.floor(w / 2) - 2; [x0, y0, x1, y1] = [a, a, a + 3, a + 3]; }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set.add(y * w + x);
    return set;
  }
  E.zoneOf = zoneOf;

  // ---------- Game creation ----------
  // opts: {nPlayers, mapDef, seed, rules, controllers:[{kind:'ai',strat}|{kind:'human'}]}
  E.newGame = function (opts) {
    const rules = opts.rules || E.defaultRules();
    const r = rng(opts.seed || 1);
    const np = opts.nPlayers;
    const map = parseMap(opts.mapDef);
    const twoExp = np === 2;
    const players = [];
    for (let p = 0; p < np; p++) players.push({ id: p, ctrl: opts.controllers[p], supply: 0, secret: null, secretOffer: null, colSupply: 0, bountyHits: 0, bounty: false });
    const exps = [];
    if (twoExp) { for (let k = 0; k < 4; k++) exps.push({ id: k, player: k < 2 ? k : 3 - k, port: -1 }); }
    else for (let p = 0; p < np; p++) exps.push({ id: p, player: p, port: -1 });
    // port picks: start player picks last
    const start = Math.floor(r() * np);
    const order = [];
    if (twoExp) { const a = start, b = 1 - start; [b, a, a, b].forEach((pp, k) => order.push(exps.find(e => e.player === pp && e.port < 0 && !order.includes(e)))); }
    else for (let k = 1; k <= np; k++) order.push(exps[(start + k) % np]);
    const g = {
      rules, r, map, np, players, exps, twoExp,
      owner: new Int16Array(map.n).fill(-1), // -1 free, -2 ruin, else expedition id
      round: 0, nRounds: rules.rounds[np], deck: [], publicGoals: [], log: [], pickOrder: order, startPlayer: start,
      stats: { collisions: 0, ruins: 0, blocked: 0, shortDraws: 0, collisionsByRound: [], starTaken: -1, starRound: -1 }
    };
    const deck = shuffle(rules.deck.slice(), r).slice(0, g.nRounds);
    g.deck = deck.map(([v, ev]) => ({ v: Math.max(2, v - rules.nMinus[np]), raw: v, ev }));
    g.publicGoals = shuffle(E.publicDefs(g).slice(), r).slice(0, rules.publicCount[np]).map(x => x.id);
    g.secretDeck = shuffle(E.secretDefs(g).map(s => s.id), r);
    return g;
  };

  E.portDistanceScore = function (g, portIdx) {
    let best = 99;
    for (const e of g.exps) if (e.port >= 0) { const d = manh(g.map, e.port, portIdx); if (d < best) best = d; }
    return best;
  };
  function manh(map, a, b) { return Math.abs(a % map.w - b % map.w) + Math.abs(((a / map.w) | 0) - ((b / map.w) | 0)); }
  E.manh = manh;

  E.freePorts = function (g) { return g.map.ports.filter(p => !g.exps.some(e => e.port === p.idx)); };

  E.assignPort = function (g, exp, portIdx) {
    exp.port = portIdx; g.owner[portIdx] = exp.id;
  };

  E.finishSetup = function (g) {
    // last two pickers get supply (not in 2p)
    if (!g.twoExp) { const o = g.pickOrder; const arr = g.rules.startSupplyFromEnd || [g.rules.startSupplyLastTwo, g.rules.startSupplyLastTwo]; arr.forEach((s, k) => { const idx = o.length - 1 - k; if (idx >= 0) g.players[o[idx].player].supply += s; }); }
    for (const p of g.players) p.secretOffer = [g.secretDeck.pop(), g.secretDeck.pop()];
  };

  // ---------- Territory queries ----------
  E.cellsOfPlayer = function (g, p) { const out = []; for (let i = 0; i < g.map.n; i++) { const o = g.owner[i]; if (o >= 0 && g.exps[o].player === p) out.push(i); } return out; };
  E.cellsOfExp = function (g, e) { const out = []; for (let i = 0; i < g.map.n; i++) if (g.owner[i] === e) out.push(i); return out; };

  // legal start cells for an expedition this round
  E.startCells = function (g, exp, opt) {
    const set = new Set(); const map = g.map;
    for (let i = 0; i < map.n; i++) if (g.owner[i] === exp.id) for (const j of neigh(map, i, opt.diag)) if (g.owner[j] === -1 && passable(map, j) && !(opt.block && opt.block.has(j))) set.add(j);
    if (opt.landing) for (let i = 0; i < map.n; i++) if (isEdge(map, i) && g.owner[i] === -1 && passable(map, i) && !(opt.block && opt.block.has(i))) set.add(i);
    return [...set];
  };

  // Is a path legal for exp given options. Returns length of legal prefix.
  E.legalPrefix = function (g, exp, path, opt) {
    const map = g.map; const starts = new Set(E.startCells(g, exp, opt)); const seen = new Set();
    for (let k = 0; k < path.length; k++) {
      const c = path[k];
      if (c < 0 || c >= map.n || !passable(map, c) || g.owner[c] !== -1 || seen.has(c) || (opt.block && opt.block.has(c))) return k;
      if (k === 0) { if (!starts.has(c)) return 0; }
      else if (!neigh(map, path[k - 1], opt.diag).includes(c)) return k;
      seen.add(c);
    }
    return path.length;
  };

  // enumerate simple paths of exact length L
  E.enumPaths = function (g, exp, L, opt, cap, r) {
    const map = g.map; const out = []; const starts = E.startCells(g, exp, opt);
    if (r) shuffle(starts, r);
    const path = []; const used = new Uint8Array(map.n);
    function dfs(c) {
      if (out.length >= cap) return;
      path.push(c); used[c] = 1;
      if (path.length === L) out.push(path.slice());
      else { let nb = neigh(map, c, opt.diag); if (r) nb = shuffle(nb, r); for (const j of nb) if (!used[j] && g.owner[j] === -1 && passable(map, j) && !(opt.block && opt.block.has(j))) dfs(j); }
      path.pop(); used[c] = 0;
    }
    for (const s of starts) { if (out.length >= cap) break; dfs(s); }
    return out;
  };

  // ---------- Round resolution ----------
  // plans: array per expedition: {paths:[[cells...]], usedPlus:bool, landing:bool}
  E.resolveRound = function (g, plans, card) {
    const map = g.map, rules = g.rules;
    const result = { claimed: [], ruins: [], lostBy: new Set(), contested: [], events: [] };
    const contests = new Map(); // cell -> {involved:Set(e), win:e|-1}
    const addContest = (c, es, win) => { let k = contests.get(c); if (!k) { k = { involved: new Set(), win }; contests.set(c, k); } es.forEach(e => k.involved.add(e)); };
    const finalLen = plans.map(pl => pl ? pl.paths.map(() => 0) : []);
    if (rules.tieRule === 'arrival') {
      const taken = new Map(); // cell -> e | 'ruin' | 'calm'
      const alive = plans.map(pl => pl ? pl.paths.map(() => true) : []);
      let maxLen = 0; plans.forEach(pl => pl && pl.paths.forEach(p => maxLen = Math.max(maxLen, p.length)));
      for (let t = 1; t <= maxLen; t++) {
        const arr = new Map();
        plans.forEach((pl, e) => { if (!pl) return; pl.paths.forEach((p, pi) => { if (alive[e][pi] && p.length >= t) { const c = p[t - 1]; if (!arr.has(c)) arr.set(c, []); arr.get(c).push({ e, pi }); } }); });
        for (const [c, list] of arr) {
          if (taken.has(c)) {
            const o = taken.get(c);
            list.forEach(a => { alive[a.e][a.pi] = false; result.lostBy.add(a.e); });
            addContest(c, list.map(a => a.e).concat(typeof o === 'number' ? [o] : []), typeof o === 'number' ? o : -1);
            result.events.push({ t, c, kind: 'late', who: list.map(a => a.e), owner: o });
          } else if (list.length === 1) {
            taken.set(c, list[0].e); finalLen[list[0].e][list[0].pi] = t;
          } else {
            taken.set(c, card.ev === 'calm' ? 'calm' : 'ruin');
            list.forEach(a => { alive[a.e][a.pi] = false; result.lostBy.add(a.e); });
            addContest(c, list.map(a => a.e), -1);
            result.events.push({ t, c, kind: 'tie', who: list.map(a => a.e) });
          }
        }
      }
      for (const [c, o] of taken) { if (typeof o === 'number') { g.owner[c] = o; result.claimed.push({ c, e: o }); } else if (o === 'ruin') { g.owner[c] = -2; result.ruins.push(c); g.stats.ruins++; } }
    } else {
      // v1.0-style: every overlapped cell becomes ruin, paths stop there
      const cnt = new Map();
      plans.forEach((pl, e) => { if (!pl) return; pl.paths.forEach(p => p.forEach(c => { if (!cnt.has(c)) cnt.set(c, new Set()); cnt.get(c).add(e); })); });
      plans.forEach((pl, e) => { if (!pl) return; pl.paths.forEach((p, pi) => {
        let k = 0; while (k < p.length && cnt.get(p[k]).size === 1) k++; finalLen[e][pi] = k;
        if (k < p.length) result.lostBy.add(e);
        for (let j = 0; j < k; j++) { g.owner[p[j]] = e; result.claimed.push({ c: p[j], e }); }
      }); });
      for (const [c, s] of cnt) if (s.size > 1) { addContest(c, [...s], -1); if (card.ev !== 'calm') { g.owner[c] = -2; result.ruins.push(c); g.stats.ruins++; } }
    }
    for (const [c, k] of contests) {
      result.contested.push({ c, involved: [...k.involved], win: k.win });
      g.stats.collisions++;
      if (k.win >= 0) {
        const wp = g.exps[k.win].player; g.players[wp].colWins = (g.players[wp].colWins || 0) + 1;
        const losers = new Set([...k.involved].filter(e => e !== k.win).map(e => g.exps[e].player));
        for (const lp of losers) if (lp !== wp && g.players[lp].bounty) g.players[wp].bountyHits++;
      }
    }
    const lostPlayers = new Set([...result.lostBy].map(e => g.exps[e].player));
    for (const p of lostPlayers) { g.players[p].supply += rules.collisionSupplyCap; g.players[p].colSupply++; }
    result.finalLen = finalLen;
    g.stats.collisionsByRound[g.round] = (g.stats.collisionsByRound[g.round] || 0) + contests.size;
    for (let i = 0; i < map.n; i++) if (map.type[i] === 'S' && g.owner[i] >= 0 && g.stats.starTaken < 0) { g.stats.starTaken = g.exps[g.owner[i]].player; g.stats.starRound = g.round; }
    return result;
  };

  E.applyBounty = function (g) {
    const sizes = g.players.map(p => E.cellsOfPlayer(g, p.id).length);
    const mx = Math.max(...sizes);
    g.players.forEach((p, k) => p.bounty = sizes[k] === mx);
  };

  // ---------- Scoring ----------
  E.playerMetrics = function (g, p) {
    const map = g.map; const cells = E.cellsOfPlayer(g, p); const mine = new Set(cells);
    const isOther = i => g.owner[i] >= 0 && g.exps[g.owner[i]].player !== p;
    const m = { cells: cells.length, T: 0, V: 0, S: 0, madj: 0, edge: 0, touch: 0, touchSet: new Set(), ruinAdj: 0, center: 0, cols: new Set(), corners: 0, far: 0, rowMax: 0, colMax: 0, sq: 0, loop: false, portAdj: false };
    const C = zoneOf(map, 'C'); const corners = ['NW', 'NE', 'SW', 'SE'].map(z => zoneOf(map, z));
    const myPorts = g.exps.filter(e => e.player === p).map(e => e.port);
    const otherPorts = g.exps.filter(e => e.player !== p).map(e => e.port);
    for (const i of cells) {
      const t = map.type[i];
      if (t === 'T') m.T++; if (t === 'V') m.V++; if (t === 'S') m.S++;
      const nb = neigh(map, i, false);
      if (nb.some(j => map.type[j] === 'M')) m.madj++;
      if (isEdge(map, i)) m.edge++;
      let t2 = false; for (const j of nb) if (isOther(j)) { t2 = true; m.touchSet.add(g.owner[j]); }
      if (t2) m.touch++;
      if (nb.some(j => g.owner[j] === -2)) m.ruinAdj++;
      if (C.has(i)) m.center++;
      m.cols.add(i % map.w);
      for (const pi of myPorts) m.far = Math.max(m.far, manh(map, pi, i));
      if (nb.some(j => otherPorts.includes(j))) m.portAdj = true;
    }
    m.corners = corners.filter(z => [...z].some(i => mine.has(i))).length;
    m.cornerHits = corners.map(z => [...z].filter(i => mine.has(i)).length);
    // straight lines
    for (let y = 0; y < map.h; y++) { let run = 0; for (let x = 0; x < map.w; x++) { if (mine.has(y * map.w + x)) { run++; m.rowMax = Math.max(m.rowMax, run); } else run = 0; } }
    for (let x = 0; x < map.w; x++) { let run = 0; for (let y = 0; y < map.h; y++) { if (mine.has(y * map.w + x)) { run++; m.colMax = Math.max(m.colMax, run); } else run = 0; } }
    for (let y = 0; y < map.h - 1; y++) for (let x = 0; x < map.w - 1; x++) { const i = y * map.w + x; if (mine.has(i) && mine.has(i + 1) && mine.has(i + map.w) && mine.has(i + map.w + 1)) m.sq++; }
    for (let i = 0; i < map.n; i++) { if (mine.has(i)) continue; const nb = neigh(map, i, false); if (nb.length === 4 && nb.every(j => mine.has(j))) { if (map.type[i] !== '~' && (g.owner[i] === -1 || g.owner[i] === -2 || map.type[i] === 'M')) { if (g.owner[i] === -1 && map.type[i] !== 'M') m.loopEmpty = true; m.loop = true; } } }
    m.cornerCells = 0; corners.forEach(z => z.forEach(i => { if (mine.has(i)) m.cornerCells++; }));
    // opposite edge
    m.opp = false;
    for (const pi of myPorts) {
      const x = pi % map.w, y = (pi / map.w) | 0;
      for (const i of cells) { const xx = i % map.w, yy = (i / map.w) | 0;
        if ((y === 0 && yy === map.h - 1) || (y === map.h - 1 && yy === 0) || (x === 0 && xx === map.w - 1) || (x === map.w - 1 && xx === 0)) m.opp = true; }
    }
    m.touchN = m.touchSet.size; m.colWins = g.players[p].colWins || 0;
    return m;
  };

  E.publicValue = function (m, id, set) {
    if (set === 'v12') { if (id === 4) return m.T + m.V; if (id === 8) return m.colWins; if (id === 11) return m.cornerCells; }
    switch (id) {
      case 1: return m.cells; case 2: return m.madj; case 3: return m.edge; case 4: return m.T; case 5: return m.touch;
      case 6: return m.cells >= 8 ? m.touch : null; case 7: return Math.max(m.rowMax, m.colMax); case 8: return m.ruinAdj;
      case 9: return m.center; case 10: return m.cols.size; case 11: return m.corners; case 12: return m.far;
    }
  };

  E.secretMet = function (g, p, m, id) {
    const s = E.secretDefs(g)[id - 1];
    if (g.rules.goalSet === 'v12') {
      switch (s.kind) {
        case 'zone': if (s.zone === 'C') return m.center >= s.n; return m.cornerHits[['NW', 'NE', 'SW', 'SE'].indexOf(s.zone)] >= s.n;
        case 'far': return m.far >= s.n; case 'T3': return m.T >= s.n; case 'V3': return m.V >= s.n; case 'M6': return m.madj >= s.n; case 'E6': return m.edge >= s.n;
        case 'touchC': return m.touch >= s.n; case 'col3': return g.players[p].colSupply >= s.n; case 'hoard': return g.players[p].supply >= s.n;
        case 'port': return m.portAdj; case 'row5': return m.rowMax >= s.n; case 'colm5': return m.colMax >= s.n; case 'sq2': return m.sq >= s.n; case 'loop': return m.loop;
      }
    }
    switch (s.kind) {
      case 'zone': if (s.zone === 'C') return m.center >= 4; return m.cornerHits[['NW', 'NE', 'SW', 'SE'].indexOf(s.zone)] >= 2;
      case 'opp': return m.opp; case 'T3': return m.T >= 3; case 'V3': return m.V >= 3; case 'M6': return m.madj >= 6; case 'E6': return m.edge >= 6;
      case 'touch2': return m.touchN >= 2; case 'col3': return g.players[p].colSupply >= 3; case 'ruin3': return m.ruinAdj >= 3;
      case 'port': return m.portAdj; case 'row5': return m.rowMax >= 5; case 'colm5': return m.colMax >= 5; case 'sq2': return m.sq >= 2; case 'loop': return m.loop;
    }
  };
  E.secretPts = function (g, id) { const o = g.rules.secretPts; return (o && o[id] != null) ? o[id] : E.secretDefs(g)[id - 1].pts; };

  E.score = function (g) {
    const rules = g.rules; const np = g.np;
    const ms = g.players.map(p => E.playerMetrics(g, p.id));
    const res = g.players.map((p, k) => {
      const m = ms[k];
      const vil = rules.village[Math.min(m.V, rules.village.length - 1)];
      const secretOk = p.secret ? E.secretMet(g, k, m, p.secret) : false;
      return { player: k, treasure: m.T * rules.treasure, village: vil, star: m.S * rules.star, goals: 0, goalDetail: {}, secret: secretOk ? E.secretPts(g, p.secret) : 0, secretOk, supply: p.supply * rules.supplyPoint, bounty: p.bountyHits * rules.bountyBonus, cells: m.cells, m };
    });
    const pts = np <= 3 ? rules.goalPts23 : rules.goalPts4;
    for (const gid of g.publicGoals) {
      const low = E.publicDefs(g)[gid - 1].low;
      const vals = ms.map(m => E.publicValue(m, gid, rules.goalSet));
      const elig = vals.map((v, k) => ({ v, k })).filter(o => o.v !== null && (low || o.v > 0));
      const distinct = [...new Set(elig.map(o => o.v))].sort((a, b) => low ? a - b : b - a);
      let rankPos = 0;
      for (const v of distinct) {
        if (rankPos >= pts.length) break;
        const who = elig.filter(o => o.v === v);
        for (const o of who) { res[o.k].goals += pts[rankPos]; res[o.k].goalDetail[gid] = pts[rankPos]; }
        rankPos += who.length;
      }
    }
    for (const x of res) x.total = x.treasure + x.village + x.star + x.goals + x.secret + x.supply + x.bounty;
    const best = Math.max(...res.map(x => x.total));
    let cands = res.filter(x => x.total === best);
    if (cands.length > 1) { const mc = Math.max(...cands.map(x => x.cells)); cands = cands.filter(x => x.cells === mc); }
    res.winners = cands.map(x => x.player);
    return res;
  };

  // ---------- AI ----------
  // strategies: 'random', 'greedy', 'smart', 'aggro'
  function bfsArrival(g, expIds, diag) {
    const map = g.map; const dist = new Int16Array(map.n).fill(99); const q = [];
    for (let i = 0; i < map.n; i++) if (g.owner[i] >= 0 && expIds.includes(g.owner[i])) for (const j of neigh(map, i, diag)) if (g.owner[j] === -1 && passable(map, j) && dist[j] > 1) { dist[j] = 1; q.push(j); }
    for (let h = 0; h < q.length; h++) { const i = q[h]; for (const j of neigh(map, i, diag)) if (g.owner[j] === -1 && passable(map, j) && dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; q.push(j); } }
    return dist;
  }
  E.bfsArrival = bfsArrival;

  function cellValues(g, exp, strat, card) {
    const map = g.map, rules = g.rules, p = exp.player; const pl = g.players[p];
    const m = E.playerMetrics(g, p);
    const v = new Float32Array(map.n);
    const corners = ['NW', 'NE', 'SW', 'SE'].map(z => zoneOf(map, z)); const C = zoneOf(map, 'C');
    const sec = pl.secret ? E.secretDefs(g)[pl.secret - 1] : null; const v12 = rules.goalSet === 'v12';
    const secMet = pl.secret ? E.secretMet(g, p, m, pl.secret) : true;
    const otherPorts = g.exps.filter(e => e.player !== p).map(e => e.port);
    const myPort = exp.port;
    for (let i = 0; i < map.n; i++) {
      if (g.owner[i] !== -1 || !passable(map, i)) continue;
      const t = map.type[i]; let val = 0.35; // base: territory has some value (pioneer, goals)
      if (t === 'T') val += rules.treasure;
      if (t === 'S') val += rules.star;
      const nb = neigh(map, i, false);
      for (const gid of g.publicGoals) {
        switch (gid) {
          case 1: val += 0.4; break;
          case 2: if (nb.some(j => map.type[j] === 'M')) val += 0.6; break;
          case 3: if (isEdge(map, i)) val += 0.6; break;
          case 4: if (t === 'T' || (v12 && t === 'V')) val += 1; break;
          case 5: if (nb.some(j => g.owner[j] >= 0 && g.exps[g.owner[j]].player !== p)) val += 0.5; break;
          case 6: if (nb.some(j => g.owner[j] >= 0 && g.exps[g.owner[j]].player !== p)) val -= 0.5; break;
          case 8: if (!v12 && nb.some(j => g.owner[j] === -2)) val += 0.6; break;
          case 9: if (C.has(i)) val += 0.6; break;
          case 10: if (!m.cols.has(i % map.w)) val += 0.8; break;
          case 11: corners.forEach((z, k) => { if (z.has(i) && (v12 || m.cornerHits[k] === 0)) val += v12 ? 0.7 : 1.5; }); break;
          case 12: { const d = manh(map, myPort, i); if (d > m.far) val += 0.25 * (d - m.far); } break;
        }
      }
      if (sec && !secMet && strat !== 'random') {
        switch (sec.kind) {
          case 'zone': { const z = sec.zone === 'C' ? C : zoneOf(map, sec.zone); if (z.has(i)) val += 1.6; break; }
          case 'far': { const d = manh(map, myPort, i); if (d > m.far) val += 0.4 * (d - m.far); break; }
          case 'touchC': if (nb.some(j => g.owner[j] >= 0 && g.exps[g.owner[j]].player !== p)) val += 0.9; break;
          case 'opp': { const x = myPort % map.w, y = (myPort / map.w) | 0, xx = i % map.w, yy = (i / map.w) | 0;
            const toward = (y === 0) ? yy : (y === map.h - 1) ? (map.h - 1 - yy) : (x === 0) ? xx : (map.w - 1 - xx); val += 0.25 * toward; break; }
          case 'T3': if (t === 'T') val += 1.5; break; case 'V3': if (t === 'V') val += 1.5; break;
          case 'M6': if (nb.some(j => map.type[j] === 'M')) val += 0.9; break; case 'E6': if (isEdge(map, i)) val += 0.9; break;
          case 'touch2': case 'col3': if (nb.some(j => g.owner[j] >= 0 && g.exps[g.owner[j]].player !== p)) val += 0.8; break;
          case 'ruin3': if (nb.some(j => g.owner[j] === -2)) val += 1; break;
          case 'port': if (nb.some(j => otherPorts.includes(j))) val += 4; else { let dmin = 99; for (const op of otherPorts) dmin = Math.min(dmin, manh(map, op, i)); val += Math.max(0, 0.4 * (6 - dmin)); } break;
          case 'row5': case 'colm5': case 'sq2': case 'loop': break; // handled path-wise
        }
      }
      // future expansion
      let free = 0; for (const j of nb) if (g.owner[j] === -1 && passable(map, j)) free++;
      val += 0.12 * free;
      v[i] = val;
    }
    return { v, m, sec, secMet };
  }

  function pathShapeBonus(g, path, sec, m, mine) {
    if (!sec) return 0; const w = g.map.w;
    if (sec.kind === 'row5' || sec.kind === 'colm5') {
      const horiz = sec.kind === 'row5'; let run = 0, best = 0;
      const all = new Set(mine); path.forEach(c => all.add(c));
      for (const c of path) { // measure run through c
        let n = 1; let k = c; while (true) { const nx = horiz ? k + 1 : k + w; if (horiz && (nx % w === 0)) break; if (!all.has(nx)) break; n++; k = nx; }
        k = c; while (true) { const nx = horiz ? k - 1 : k - w; if (horiz && (k % w === 0)) break; if (nx < 0 || !all.has(nx)) break; n++; k = nx; }
        best = Math.max(best, n);
      }
      const cur = horiz ? m.rowMax : m.colMax; return best >= 5 && cur < 5 ? 5 : Math.max(0, best - cur) * 0.8;
    }
    if (sec.kind === 'sq2' || sec.kind === 'loop') {
      const all = new Set(mine); path.forEach(c => all.add(c)); let sq = 0;
      for (const c of all) { if (c % w === w - 1) continue; if (all.has(c + 1) && all.has(c + w) && all.has(c + w + 1)) sq++; }
      if (sec.kind === 'sq2') return Math.min(sq, 2) * 1.5 - Math.min(m.sq, 2) * 1.5;
      return (sq - m.sq) * 0.6;
    }
    return 0;
  }

  function pWin(step, d, strat) {
    if (d >= 99) return 1;
    if (strat === 'greedy') return 1;
    if (d > 6) return 1;
    if (step < d) return 0.85;
    if (step === d) return strat === 'aggro' ? 0.5 : 0.35;
    return 0.5;
  }

  E.planAI = function (g, exp, card, strat, r, ownBlock) {
    const pl = g.players[exp.player]; const rules = g.rules;
    let N = card.v; let usedPlus = false, landing = false;
    const diag = card.ev === 'storm';
    const opt = { diag, landing: card.ev === 'tailwind', block: ownBlock };
    const lastRounds = g.round >= g.nRounds - 2;
    // landing if stuck
    if (E.startCells(g, exp, opt).length === 0 && pl.supply >= 2) { landing = true; opt.landing = true; pl.supply -= 2; }
    const hoard = pl.secret && E.secretDefs(g)[pl.secret - 1].kind === 'hoard';
    if (strat === 'random') { if (pl.supply >= 1 && r() < 0.3) { usedPlus = true; } }
    else if (hoard) { if (pl.supply >= 3) usedPlus = true; }
    else if (pl.supply >= 1 && (lastRounds || pl.supply >= 3)) usedPlus = true;
    if (usedPlus) { N += 1; pl.supply -= 1; }
    // compute candidate paths
    let L = N, paths = [];
    while (L > 0) { paths = E.enumPaths(g, exp, L, opt, strat === 'random' ? 60 : 2500, r); if (paths.length) break; L--; }
    if (!paths.length) { if (usedPlus) pl.supply += 1; return { paths: [], usedPlus: false, landing, blocked: true }; }
    if (L < N) g.stats.shortDraws++;
    if (strat === 'random') return { paths: [paths[Math.floor(r() * paths.length)]], usedPlus, landing };
    const { v, m, sec, secMet } = cellValues(g, exp, strat, card);
    const opps = g.exps.filter(e => e.player !== exp.player).map(e => e.id);
    const arr = bfsArrival(g, opps, diag);
    const mine = E.cellsOfPlayer(g, exp.player);
    const vilBase = m.V;
    const bountyNear = g.players.some(p => p.bounty && p.id !== exp.player);
    function evalPath(p) {
      let ev = 0, alive = 1, vil = vilBase;
      for (let k = 0; k < p.length; k++) {
        const c = p[k]; let val = v[c];
        if (g.map.type[c] === 'V') { const tbl = rules.village; const nv = Math.min(vil + 1, tbl.length - 1); val += tbl[nv] - tbl[Math.min(vil, tbl.length - 1)]; vil++; }
        const pw = pWin(k + 1, arr[c], strat);
        alive *= (strat === 'greedy') ? 1 : pw;
        if (strat === 'aggro' && arr[c] <= 6) { val += 0.4; if (bountyNear) val += 0.5; }
        ev += alive * val;
      }
      if (!secMet) ev += pathShapeBonus(g, p, sec, m, mine);
      return ev + r() * 0.05;
    }
    let predicted = null;
    if (strat === 'reader') {
      predicted = new Map(); // cell -> min step of predicted opponent arrival
      const r2 = rng(Math.floor(r() * 1e9));
      for (const oe of g.exps) { if (oe.player === exp.player) continue;
        const op = g.players[oe.player]; const sv = op.supply, sd = g.stats.shortDraws;
        const pp = E.planAI(g, oe, card, 'greedy', r2, null); op.supply = sv; g.stats.shortDraws = sd;
        if (pp.blocked) continue; pp.paths.forEach(path => path.forEach((c, k) => { const prev = predicted.get(c); if (prev === undefined || k + 1 < prev) predicted.set(c, k + 1); })); }
    }
    function evalReader(p) {
      let ev = 0, vil = vilBase;
      for (let k = 0; k < p.length; k++) {
        const c = p[k]; const os = predicted.get(c);
        if (os !== undefined && os <= k + 1) { ev -= 0.3; break; }
        let val = v[c];
        if (g.map.type[c] === 'V') { const tbl = rules.village; const nv = Math.min(vil + 1, tbl.length - 1); val += tbl[nv] - tbl[Math.min(vil, tbl.length - 1)]; vil++; }
        if (os !== undefined) val += 1.0; // denial: we beat them here
        ev += val;
      }
      if (!secMet) ev += pathShapeBonus(g, p, sec, m, mine);
      return ev + r() * 0.05;
    }
    const scorer = strat === 'reader' ? evalReader : evalPath;
    let best = null, bestV = -1e9;
    for (const p of paths) { const s = scorer(p); if (s > bestV) { bestV = s; best = p; } }
    let result = { paths: [best], usedPlus, landing };
    if (card.ev === 'fork' && N >= 2) {
      // try splits
      for (let a = 1; a <= Math.floor(N / 2); a++) {
        const b = N - a;
        const pa = E.enumPaths(g, exp, a, opt, 400, r).map(p => [p, scorer(p)]).sort((x, y) => y[1] - x[1]).slice(0, 8);
        const pb = E.enumPaths(g, exp, b, opt, 800, r).map(p => [p, scorer(p)]).sort((x, y) => y[1] - x[1]).slice(0, 8);
        for (const [p1, s1] of pa) for (const [p2, s2] of pb) { if (p1.some(c => p2.includes(c))) continue; if (s1 + s2 > bestV + 0.01) { bestV = s1 + s2; result = { paths: [p1, p2], usedPlus, landing }; } }
      }
    }
    return result;
  };

  E.pickPortAI = function (g, exp, r) {
    const free = E.freePorts(g);
    let best = null, bv = -1;
    for (const p of free) { const s = E.portDistanceScore(g, p.idx) + r() * 0.5; if (s > bv) { bv = s; best = p; } }
    return best.idx;
  };

  E.pickSecretAI = function (g, p, r, strat) {
    const offer = g.players[p].secretOffer;
    if (strat === 'random') return offer[Math.floor(r() * 2)];
    const map = g.map; const ports = g.exps.filter(e => e.player === p).map(e => e.port);
    function feas(id) {
      const s = E.secretDefs(g)[id - 1]; const pts = E.secretPts(g, id);
      if (s.kind === 'zone') { const z = zoneOf(map, s.zone); let d = 99; for (const pi of ports) for (const i of z) d = Math.min(d, manh(map, pi, i)); return pts / (1 + d / 3); }
      const prior = { far: 0.5, touchC: 0.6, hoard: 0.5, opp: 0.35, T3: 0.6, V3: 0.45, M6: 0.6, E6: 0.6, touch2: 0.6, col3: 0.4, ruin3: 0.45, port: 0.4, row5: 0.45, colm5: 0.45, sq2: 0.5, loop: 0.3 }[s.kind];
      return pts * prior;
    }
    return feas(offer[0]) >= feas(offer[1]) ? offer[0] : offer[1];
  };

  // Full AI game (for simulation)
  E.playAIGame = function (opts) {
    const g = E.newGame(opts);
    const r = g.r;
    for (const exp of g.pickOrder) E.assignPort(g, exp, E.pickPortAI(g, exp, r));
    E.finishSetup(g);
    g.players.forEach((p, k) => { p.secret = E.pickSecretAI(g, k, r, p.ctrl.strat); });
    for (g.round = 0; g.round < g.nRounds; g.round++) {
      const card = g.deck[g.round];
      const plans = [];
      const blockByPlayer = {};
      for (const exp of g.exps) {
        const strat = g.players[exp.player].ctrl.strat;
        const blk = blockByPlayer[exp.player] || new Set();
        const pl = E.planAI(g, exp, card, strat, r, blk);
        if (pl.blocked) { g.players[exp.player].supply += 1; g.stats.blocked++; plans[exp.id] = null; continue; }
        pl.paths.forEach(p => p.forEach(c => blk.add(c))); blockByPlayer[exp.player] = blk;
        plans[exp.id] = pl;
      }
      E.resolveRound(g, plans, card);
      if (g.round + 1 === g.rules.bountyRound) E.applyBounty(g);
    }
    g.final = E.score(g);
    return g;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = E; else root.OverlapEngine = E;
})(typeof window !== 'undefined' ? window : this);
