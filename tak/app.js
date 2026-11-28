(function () {
  'use strict';
  // ============================================================
  // 탁 — simultaneous alkkagi.
  // Everyone secretly pulls back one stone, then all stones fly at once.
  // Sim (classic/tak_sim*.js): ~6 rounds a game; reading others' shots wins 43-49% vs 25% base,
  // while raw precision barely matters. Clients replay shots with the same deterministic physics.
  // ============================================================
  const P = window.TakPhysics, AI = window.TakAI, U = window.NoliUI, h = U.h;
  const CODE_LO = 3000, CODE_HI = 3999, R0 = P.C.R0, SHRINK = 0.92, RMIN = 140, MAXDRAG = 140;
  const COLORS = [
    { name: '흑', base: '#232428', hi: '#5A5D66', ink: '#fff' },
    { name: '백', base: '#E9E5DA', hi: '#FFFFFF', ink: '#1A1C20' },
    { name: '주', base: '#C23F36', hi: '#F08A7E', ink: '#fff' },
    { name: '옥', base: '#2A8F6C', hi: '#7DD7B2', ink: '#fff' },
    { name: '청', base: '#2E5FC9', hi: '#8DB0F5', ink: '#fff' },
    { name: '금', base: '#D49A2A', hi: '#FBD982', ink: '#1A1C20' },
  ];
  const KIND_NAME = ['무거운 돌', '보통 돌', '가벼운 돌'];
  const BOT_NAMES = ['청운', '해월', '단오', '소담', '도윤'];
  const SPEEDS = { slow: { label: '느긋하게', aim: 22000 }, normal: { label: '보통', aim: 15000 }, fast: { label: '빠르게', aim: 10000 } };
  const R = Math.random;
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('tak:' + k)); localStorage.setItem('tak:' + k, JSON.stringify(v)); } catch (e) { return null; } }
  const cleanName = U.cleanName;
  const sfx = n => window.NoliSFX && window.NoliSFX.play(n);
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { } };
  function josa(w, a, b) { const c = String(w).charCodeAt(String(w).length - 1); if (c < 0xAC00 || c > 0xD7A3) return w + a + '(' + b + ')'; return w + (((c - 0xAC00) % 28) ? a : b); }

  const app = document.getElementById('app');
  let S = Object.assign({ nick: '', speed: 'normal' }, store('settings') || {});
  const save = () => store('settings', S);
  const ON = { room: null, isHost: false, solo: false, peers: [], st: null, H: null, bots: 0 };

  // ============================================================
  // ART
  // ============================================================
  const COVER = (() => {
    const st = (x, y, r, c) => `<circle cx="${x}" cy="${y + 3}" r="${r}" fill="rgba(0,0,0,.25)"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c.base}"/><ellipse cx="${x - r * .3}" cy="${y - r * .38}" rx="${r * .45}" ry="${r * .25}" fill="${c.hi}" opacity=".55"/>`;
    let grid = ''; for (let i = -4; i <= 4; i++) grid += `<path d="M${160 + i * 15} 20 V168 M86 ${94 + i * 15} H234" stroke="rgba(90,58,20,.22)" stroke-width="1"/>`;
    return `<svg viewBox="0 0 320 188"><defs><radialGradient id="cw" cx="45%" cy="38%" r="70%"><stop offset="0" stop-color="#EDCF95"/><stop offset="1" stop-color="#C99A55"/></radialGradient><clipPath id="cc"><circle cx="160" cy="94" r="74"/></clipPath></defs>
      <ellipse cx="160" cy="176" rx="90" ry="8" fill="rgba(0,0,0,.3)"/><circle cx="160" cy="94" r="78" fill="#8A5E2C"/><circle cx="160" cy="94" r="74" fill="url(#cw)"/><g clip-path="url(#cc)">${grid}</g>
      <path d="M118 128 L150 104" stroke="rgba(255,255,255,.55)" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 7"/>
      <path d="M206 64 L182 84" stroke="rgba(255,255,255,.55)" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 7"/>
      ${st(160, 96, 14, COLORS[2])}${st(112, 132, 16, COLORS[0])}${st(210, 60, 12, COLORS[1])}${st(196, 124, 10, COLORS[3])}${st(132, 62, 11, COLORS[4])}
      <g stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".9"><path d="M160 74 v-8"/><path d="M178 80 l6 -5"/><path d="M142 80 l-6 -5"/></g>
      <circle cx="252" cy="152" r="9" fill="${COLORS[5].base}" opacity=".9"/><circle cx="252" cy="152" r="9" fill="none" stroke="rgba(255,255,255,.2)"/></svg>`;
  })();

  // ============================================================
  // MENU / ROOM
  // ============================================================
  function speedSeg() { return U.field('조준 시간', U.seg(Object.entries(SPEEDS).map(([k, v]) => [k, `${v.label} ${v.aim / 1000}초`]), S.speed, k => { S.speed = k; save(); }, '조준 시간')); }
  function rulesList() {
    return h('ol', { class: 'rules' },
      h('li', null, h('div', null, h('b', null, '내 돌 세 개를 지켜요'), h('span', null, '무거운 돌은 세게 밀지만 멀리 못 가고, 가벼운 돌은 멀리 가지만 쉽게 밀려나요.'))),
      h('li', null, h('div', null, h('b', null, '몰래 조준해요'), h('span', null, '내 돌 하나를 잡고 뒤로 당겼다 놓으면 반대쪽으로 튕길 준비가 돼요. 남들은 내가 어디를 노리는지 몰라요.'))),
      h('li', null, h('div', null, h('b', null, '모두 동시에 탁!'), h('span', null, '시간이 끝나면 모든 돌이 한꺼번에 날아가요. 판 밖으로 나간 돌은 탈락이에요. 남이 어디로 쏠지 읽는 게 제일 중요해요.'))),
      h('li', null, h('div', null, h('b', null, '판이 점점 줄어들어요'), h('span', null, '둘째 판부터 매 판 조금씩 작아져요. 마지막까지 돌이 남은 사람이 이겨요. 모두 같이 떨어지면 마지막에 떨어진 사람이 이겨요.'))));
  }
  function openRules() { U.rulesSheet({ title: '탁 규칙', body: rulesList() }); }
  function home() { history.replaceState(null, '', location.pathname); showTitle(); }
  function showTitle(prefill) {
    leaveRoom();
    U.entry({ app, name: '탁', pitch: '모두 몰래 조준하고, 동시에 탁! 남이 어디로 쏠지 읽어서 내 돌은 지키고 남의 돌은 판 밖으로 떨어뜨려요.',
      meta: [['people', '3–6명'], ['clock', '3분'], ['brain', '눈치와 손맛']], art: COVER,
      getNick: () => S.nick, setNick: v => { S.nick = v; save(); }, settings: [speedSeg()], soloLabel: '컴퓨터 3명과 시작', onSolo: () => startSolo(3),
      net: { id: 'tk', lo: CODE_LO, hi: CODE_HI }, onRoom: (room, host) => { ON.room = room; ON.isHost = host; afterJoin(); },
      onRules: openRules, prefill, onHome: home });
  }
  function leaveRoom() { if (ON.room) { const r = ON.room; if (ON.isHost && !ON.solo) { try { r.broadcast({ k: 'bye' }); } catch (e) { } setTimeout(() => { try { r.leave(); } catch (e) { } }, 200); } else { try { r.leave(); } catch (e) { } } } stopHost(); stopDraw(); ON.room = null; ON.isHost = false; ON.solo = false; ON.st = null; ON.H = null; V.reset(); }
  const hostId = () => ON.isHost ? ON.room.me : ON.room.hostId;
  function toHost(m) { if (ON.room) ON.room.send(hostId(), m); }
  function members() { return ON.peers.filter(p => !p.away).sort((a, b) => ((a.presence || {}).joinedAt || 0) - ((b.presence || {}).joinedAt || 0)); }
  function roomClosed() { try { ON.room && ON.room.leave(); } catch (e) { } stopDraw(); ON.room = null; ON.st = null; history.replaceState(null, '', location.pathname); U.closed({ app, onHome: () => showTitle() }); }
  function afterJoin() {
    try { history.replaceState(null, '', '?room=' + ON.room.code); } catch (e) { }
    ON.room.presence({ name: cleanName(S.nick, '플레이어'), joinedAt: Date.now(), host: ON.isHost || null });
    ON.room.onPeers(ch => { ON.peers = ch.peers; if (!ON.st) lobbyView(); });
    ON.room.onMessage((d, from) => { if (!d || !d.k) return; if (ON.isHost && d.k.startsWith('h:')) hostHandle(d, from); else clientHandle(d); });
    ON.room.onStatus(st => { if (st === 'online' && !ON.isHost) toHost({ k: 'h:hello' }); if (st === 'reconnecting') U.toast('연결이 불안정해요. 다시 연결하는 중이에요.'); if (st === 'closed' && !ON.isHost && ON.room) roomClosed(); });
    if (!ON.isHost) toHost({ k: 'h:hello' });
    lobbyView();
  }
  function lobbyView() {
    if (ON.st) return;
    const ms = members().slice(0, 6); const maxBots = Math.max(0, 6 - ms.length); ON.bots = Math.min(ON.bots, maxBots);
    U.lobby({ app, code: ON.room.code, title: '탁', shareText: `탁 같이 해요. 방 코드 ${ON.room.code}`, min: 3, max: 6, isHost: ON.isHost, bots: ON.bots, maxBots,
      people: ms.map(p => ({ name: cleanName((p.presence || {}).name, '플레이어'), me: p.sameTab, host: (p.presence || {}).host })),
      onBots: n => { ON.bots = n; lobbyView(); }, settings: [speedSeg()], onStart: () => hostStart(ms), onLeave: home });
  }
  function startSolo(nBots) {
    leaveRoom(); ON.solo = true; ON.isHost = true;
    ON.room = { me: 'me', code: '연습', isHost: true, hostId: 'me', leave() { },
      send(to, d) { setTimeout(() => { if (d.k && d.k.startsWith('h:')) hostHandle(d, 'me'); else clientHandle(d); }, 0); },
      broadcast(d) { setTimeout(() => clientHandle(d), 0); } };
    ON.bots = nBots; hostStart([{ peer: 'me', presence: { name: cleanName(S.nick, '나') } }]);
  }

  // ============================================================
  // HOST
  // ============================================================
  let loop = null; const timers = new Set();
  function stopHost() { if (loop) clearInterval(loop); loop = null; timers.forEach(t => clearTimeout(t)); timers.clear(); }
  function later(ms, fn) { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); }
  function hostStart(ms) {
    stopHost();
    const players = ms.map(p => ({ id: p.peer, name: cleanName((p.presence || {}).name, '플레이어'), bot: false }));
    const used = new Set(players.map(p => p.name));
    for (let i = 0; i < ON.bots; i++) { let n = BOT_NAMES[i]; while (used.has(n)) n += '2'; used.add(n); players.push({ id: 'bot' + i, name: n, bot: true, smart: i % 2 === 0 }); }
    shuffle(players);
    const n = players.length;
    const H = ON.H = { players: players.map((p, i) => Object.assign(p, { c: i, ko: 0, lost: 0, self: 0, outAt: null })), stones: P.setup(n, R0), R: R0, round: 0, phase: 'aim', deadline: 0, aims: {}, locked: {}, run: null, runSeq: 0, shrink: null, sp: Object.assign({}, SPEEDS[S.speed] || SPEEDS.normal), winners: null, feed: [] };
    loop = setInterval(hostTick, 100);
    startRound();
  }
  const aliveP = H => [...new Set(H.stones.filter(s => !s.out).map(s => s.p))];
  function startRound() {
    const H = ON.H; H.round++; H.phase = 'aim'; H.aims = {}; H.locked = {}; H.deadline = Date.now() + H.sp.aim + (H.round === 1 ? 1500 : 800);
    const alive = aliveP(H);
    H.players.forEach((p, i) => {
      if (!p.bot || !alive.includes(i)) return;
      later(1200 + R() * Math.min(5000, H.sp.aim * 0.45), () => {
        if (ON.H !== H || H.phase !== 'aim') return;
        const plan = p.smart ? AI.planSmart(H.stones, i, H.R) : AI.plan(H.stones, i, H.R, 'normal');
        if (plan) H.aims[i] = plan; H.locked[i] = true; sync();
      });
    });
    sync();
  }
  function hostTick() {
    const H = ON.H; if (!H) return; const now = Date.now();
    if (H.phase === 'aim') { const alive = aliveP(H); if (now >= H.deadline || alive.every(i => H.locked[i])) launch(); }
    else if (H.phase === 'play' && now >= H.playUntil) afterPlay();
  }
  function launch() {
    const H = ON.H; const alive = aliveP(H);
    const shots = [];
    alive.forEach(i => { const a = H.aims[i]; if (!a) return; const s = H.stones.find(x => x.id === a.id && x.p === i && !x.out); if (!s) return; const v = P.toVel(s.k, a.a, a.w); shots.push({ id: s.id, p: i, vx: v.vx, vy: v.vy }); });
    const from = H.stones.map(s => ({ id: s.id, p: s.p, k: s.k, x: Math.round(s.x * 100) / 100, y: Math.round(s.y * 100) / 100, out: s.out }));
    const res = P.simulate(from, shots, H.R, true);
    // who knocked whom: follow the chain of touches
    const owner = new Map(from.map(s => [s.id, s.p])); const last = new Map(); const feed = [];
    for (const e of res.events) {
      if (e.type === 'hit') { const pa = owner.get(e.a), pb = owner.get(e.b); const la = pb !== pa ? pb : last.get(e.b), lb = pa !== pb ? pa : last.get(e.a); if (la != null) last.set(e.a, la); if (lb != null) last.set(e.b, lb); }
      else if (e.type === 'fall') { const by = last.get(e.id); const v = H.players[e.p]; v.lost++; if (by != null && by !== e.p) { H.players[by].ko++; feed.push({ t: e.t, by, p: e.p, id: e.id }); } else { v.self++; feed.push({ t: e.t, by: -1, p: e.p, id: e.id }); } }
    }
    H.stones = res.stones;
    const falls = res.events.filter(e => e.type === 'fall');
    falls.forEach(e => { const p = H.players[e.p]; if (!H.stones.some(s => s.p === e.p && !s.out)) p.outAt = [H.round, e.t]; });
    H.run = { seq: ++H.runSeq, shots, from, R: H.R, feed };
    H.phase = 'play'; H.playUntil = Date.now() + 900 + res.dur + falls.length * 950 + 1600;
    ON.room.broadcast({ k: 'run', run: H.run }); sync();
  }
  function afterPlay() {
    const H = ON.H;
    let alive = aliveP(H);
    H.shrink = null;
    if (alive.length > 1 && H.round >= 1) {
      const nr = Math.max(RMIN, Math.round(H.R * SHRINK)); const ids = [];
      if (nr < H.R) {
        H.stones.forEach(s => { if (!s.out && s.x * s.x + s.y * s.y > nr * nr) { s.out = true; ids.push(s.id); H.players[s.p].lost++; } });
        ids.forEach(id => { const s = H.stones.find(x => x.id === id); const p = H.players[s.p]; if (!H.stones.some(x => x.p === s.p && !x.out) && !p.outAt) p.outAt = [H.round, 99999]; });
        H.shrink = { from: H.R, to: nr, ids, round: H.round + 1 }; H.R = nr;
      }
      alive = aliveP(H);
    }
    if (alive.length <= 1) {
      if (alive.length === 1) H.winners = alive;
      else { let best = -1; H.players.forEach(p => { if (p.outAt && p.outAt[0] === H.round) best = Math.max(best, p.outAt[1]); }); H.winners = H.players.map((p, i) => i).filter(i => H.players[i].outAt && H.players[i].outAt[0] === H.round && H.players[i].outAt[1] === best); }
      H.phase = 'over'; sync(); return;
    }
    startRound();
  }
  function idxOf(id) { return ON.H ? ON.H.players.findIndex(p => p.id === id) : -1; }
  function hostHandle(d, from) {
    const H = ON.H;
    if (d.k === 'h:hello') { if (H) { sendState(from); if (H.phase === 'play' && H.run) ON.room.send(from, { k: 'run', run: H.run, late: true }); } return; }
    if (!H) return; const j = idxOf(from); if (j < 0) return;
    if (d.k === 'h:aim' && H.phase === 'aim' && !H.locked[j]) {
      const s = H.stones.find(x => x.id === (d.id | 0)); if (!s || s.p !== j || s.out) return;
      const a = +d.a, w = +d.w; if (!isFinite(a) || !isFinite(w)) return;
      H.aims[j] = { id: s.id, a, w: Math.max(0, Math.min(1, w)) };
    } else if (d.k === 'h:lock' && H.phase === 'aim') { H.locked[j] = true; sync(); }
    else if (d.k === 'h:again' && from === ON.room.me && H.phase === 'over') { const ms = H.players.filter(p => !p.bot).map(p => ({ peer: p.id, presence: { name: p.name } })); ON.bots = H.players.filter(p => p.bot).length; hostStart(ms); }
  }
  function viewFor(j) {
    const H = ON.H; const n = H.players.length;
    return { k: 'st', phase: H.phase, me: j, n, round: H.round, R: H.R, left: Math.max(0, H.deadline - Date.now()), aimTotal: H.sp.aim, solo: ON.solo,
      stones: H.stones.map(s => ({ id: s.id, p: s.p, k: s.k, x: Math.round(s.x * 100) / 100, y: Math.round(s.y * 100) / 100, out: s.out })),
      players: H.players.map((p, i) => ({ name: p.name, c: p.c, bot: p.bot, left: H.stones.filter(s => s.p === i && !s.out).length, locked: !!H.locked[i], ko: p.ko, lost: p.lost, self: p.self, outAt: p.outAt })),
      myAim: H.aims[j] || null, shrink: H.shrink, winners: H.winners, runSeq: H.runSeq };
  }
  function sendState(id) { ON.room.send(id, viewFor(idxOf(id))); }
  function sync() { const H = ON.H; if (!H) return; const ids = new Set(H.players.filter(p => !p.bot).map(p => p.id)); if (!ON.solo) members().forEach(m => ids.add(m.peer)); ids.forEach(id => sendState(id)); }

  // ============================================================
  // CLIENT — view state, canvas, input
  // ============================================================
  const V = {
    reset() { this.sel = null; this.drag = null; this.aim = null; this.play = null; this.fx = []; this.shake = 0; this.fade = []; this.shrinkAnim = null; this.seenShrink = 0; this.seenRun = 0; this.banner = null; this.feed = ''; this.round = 0; },
  };
  V.reset();
  let canvas = null, ctx = null, raf = 0, cssW = 0;
  function stopDraw() { cancelAnimationFrame(raf); raf = 0; }
  function clientHandle(d) {
    if (d.k === 'bye') { if (!ON.isHost) roomClosed(); return; }
    if (d.k === 'run') { startReplay(d.run); return; }
    if (d.k === 'st') {
      const prev = ON.st; ON.st = d; ON.stAt = Date.now();
      if (d.round !== V.round) { V.round = d.round; V.aim = null; V.sel = null; }
      if (d.myAim && !V.aim && d.phase === 'aim') V.aim = d.myAim;
      if (d.shrink && d.shrink.round !== V.seenShrink && d.phase === 'aim') { V.seenShrink = d.shrink.round; V.shrinkAnim = { from: d.shrink.from, to: d.shrink.to, t0: performance.now() }; d.shrink.ids.forEach(id => { const s = d.stones.find(x => x.id === id); if (s) V.fade.push({ s, t0: performance.now() + 300 }); }); if (d.shrink.ids.length) setTimeout(() => sfx('hit'), 350); }
      if (d.phase === 'over' && (!prev || prev.phase !== 'over')) { const win = (d.winners || []).includes(d.me); setTimeout(() => sfx(win ? 'win' : 'lose'), 300); }
      if (d.phase === 'over' && !V.play) { stopDraw(); renderOver(); return; }
      renderShell(prev);
      return;
    }
  }
  const seatRot = st => Math.PI - (st.players.length ? (2 * Math.PI * seatOf(st) / st.n) : 0);
  function seatOf(st) { return st.me >= 0 ? st.me : 0; }
  // board units -> css px
  function tf(st) { const k = (cssW / 2 - 8) / (R0 * 1.02); const rot = seatRot(st); const c = Math.cos(rot), s = Math.sin(rot); return { k, c, s, cx: cssW / 2, cy: cssW / 2 }; }
  const toS = (T, x, y) => [T.cx + (x * T.c - y * T.s) * T.k, T.cy + (x * T.s + y * T.c) * T.k];
  const toB = (T, X, Y) => { const x = (X - T.cx) / T.k, y = (Y - T.cy) / T.k; return [x * T.c + y * T.s, -x * T.s + y * T.c]; };
  function myAlive(st) { return st.me >= 0 && st.players[st.me] && st.players[st.me].left > 0; }

  function renderShell() {
    const st = ON.st; const me = st.me; U.setTable(true);
    if (!app.querySelector('.stage')) {
      app.innerHTML = '';
      canvas = h('canvas', { 'aria-label': '알까기 판' });
      const stage = h('div', { class: 'stage' }, canvas, h('div', { class: 'banner', id: 'banner' }));
      app.append(U.topbar({ onRules: openRules, sound: true, onExit: () => { if (window.confirm('게임에서 나갈까요?')) home(); } }),
        h('div', { class: 'hud', id: 'hud' }), h('div', { class: 'roster', id: 'roster' }), stage, h('div', { class: 'dock', id: 'dock' }), h('p', { class: 'feed', id: 'feed' }));
      ctx = canvas.getContext('2d'); bindInput(); resize();
      window.addEventListener('resize', resize);
    }
    const hud = document.getElementById('hud'); hud.innerHTML = '';
    hud.append(h('span', { class: 'rd' }, `${st.round}판`), h('span', { class: 'tbar', 'aria-hidden': 'true' }, h('i', { id: 'tbar' })), h('span', { class: 'sec', id: 'sec' }));
    const ro = document.getElementById('roster'); ro.innerHTML = '';
    st.players.map((p, i) => [p, i]).sort((a, b) => (b[1] === me) - (a[1] === me)).forEach(([p, i]) => { const C = COLORS[p.c]; ro.append(h('div', { class: 'pl' + (i === me ? ' me' : '') + (p.left ? '' : ' out') },
      h('span', { class: 'sw', style: `background:${C.base}` }), h('span', null, i === me ? '나' : p.name),
      h('span', { class: 'lf', 'aria-label': `돌 ${p.left}개` }, [0, 1, 2].map(k => h('i', { class: k < p.left ? 'on' : null }))),
      st.phase === 'aim' && p.left ? h('span', { class: 'ok' + (p.locked ? ' on' : ''), 'aria-label': p.locked ? '준비됨' : '조준 중' }) : null)); });
    renderDock();
    if (!raf) raf = requestAnimationFrame(draw);
  }
  function renderDock() {
    const st = ON.st; const dock = document.getElementById('dock'); if (!dock) return; dock.innerHTML = '';
    const me = st.me; const P0 = st.players[me];
    if (V.play) { dock.append(h('div', { class: 'tx' }, h('b', null, '탁!'), h('span', null, '모든 돌이 한꺼번에 날아가요.'))); return; }
    if (!myAlive(st)) { dock.append(h('div', { class: 'tx' }, h('b', null, '내 돌이 모두 떨어졌어요'), h('span', null, '끝까지 구경하고 다음 판에 복수해요.'))); return; }
    if (P0.locked) { dock.append(h('div', { class: 'tx' }, h('b', null, V.aim ? '조준을 확정했어요' : '이번 판은 쉬어요'), h('span', null, '다른 사람을 기다리는 중이에요.'))); return; }
    if (V.aim) {
      const s = st.stones.find(x => x.id === V.aim.id);
      dock.append(h('div', { class: 'tx' }, h('b', null, `${KIND_NAME[s ? s.k : 1]} · 힘 ${Math.round(V.aim.w * 100)}%`), h('span', null, '다시 당기면 바꿀 수 있어요.')),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { sfx('tap'); toHost({ k: 'h:lock' }); } }, '확정'));
    } else {
      dock.append(h('div', { class: 'tx' }, h('b', null, '내 돌을 잡고 뒤로 당기세요'), h('span', null, '놓으면 반대쪽으로 날아갈 준비가 돼요.')),
        h('button', { class: 'btn', type: 'button', onclick: () => { toHost({ k: 'h:lock' }); } }, '쉬기'));
    }
  }
  function resize() { if (!canvas) return; const dpr = Math.min(3, window.devicePixelRatio || 1); cssW = canvas.clientWidth || 360; canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssW * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function bindInput() {
    const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener('pointerdown', e => {
      const st = ON.st; if (!st || st.phase !== 'aim' || V.play || !myAlive(st) || st.players[st.me].locked) return;
      const T = tf(st); const [bx, by] = toB(T, ...pos(e));
      let best = null, bd = 1e9; st.stones.forEach(s => { if (s.out || s.p !== st.me) return; const d = Math.hypot(s.x - bx, s.y - by); if (d < P.KINDS[s.k].r + 26 && d < bd) { bd = d; best = s; } });
      if (!best) return;
      e.preventDefault(); canvas.setPointerCapture(e.pointerId);
      V.sel = best.id; V.drag = { id: best.id, x: bx, y: by, lastW: 0 }; sfx('tap'); buzz(8);
    });
    canvas.addEventListener('pointermove', e => {
      if (!V.drag) return; const st = ON.st; const T = tf(st); const [bx, by] = toB(T, ...pos(e)); const s = st.stones.find(x => x.id === V.drag.id); if (!s) return;
      const dx = bx - s.x, dy = by - s.y; const len = Math.hypot(dx, dy); const w = Math.min(1, len / MAXDRAG);
      V.drag.x = bx; V.drag.y = by; V.drag.a = Math.atan2(-dy, -dx); V.drag.w = w;
      const step = Math.floor(w * 5); if (step !== V.drag.lastW) { V.drag.lastW = step; buzz(4); }
    });
    const up = () => {
      if (!V.drag) return; const d = V.drag; V.drag = null;
      if (d.w == null || d.w < 0.08) { renderDock(); return; }
      V.aim = { id: d.id, a: d.a, w: d.w }; toHost({ k: 'h:aim', id: d.id, a: d.a, w: d.w }); sfx('flip'); buzz(14); renderDock();
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  }

  // ---------- replay ----------
  function startReplay(run) {
    if (run.seq === V.seenRun) return; V.seenRun = run.seq;
    const res = P.simulate(run.from, run.shots, run.R, true);
    const evs = res.events.map(e => Object.assign({}, e, { done: false }));
    V.play = { run, res, evs, t: -900, last: performance.now(), feed: run.feed.slice() };
    V.aim = null; V.sel = null; V.drag = null;
    const b = document.getElementById('banner'); if (b) { b.innerHTML = ''; b.append(h('b', null, '탁!')); }
    sfx('pop'); buzz(20);
    renderDock(); const f = document.getElementById('feed'); if (f) f.textContent = '';
  }
  function slowAt(t) { if (!V.play) return 1; for (const e of V.play.evs) if (e.type === 'fall' && Math.abs(e.t - t) < 170) return 0.28; return 1; }
  function stepReplay(now) {
    const P1 = V.play; const dt = Math.min(50, now - P1.last); P1.last = now;
    const sp = P1.t < 0 ? 1 : slowAt(P1.t); P1.t += dt * sp;
    for (const e of P1.evs) {
      if (e.done || e.t > P1.t) continue; e.done = true;
      if (e.type === 'hit') { V.fx.push({ x: e.x, y: e.y, t0: now, f: e.f }); if (e.f > 0.12) sfx('tap'); if (e.f > 0.4) V.shake = Math.max(V.shake, 4 * e.f); }
      else if (e.type === 'fall') {
        const s = P1.run.from.find(x => x.id === e.id); const k = idxIn(P1, e.id); let pt = null; for (let back = 0; back < 4 && !pt; back++) { const fr = frameAt(P1, e.t - back * 34); if (fr && fr[k]) pt = fr[k]; } if (pt) V.fade.push({ s: Object.assign({}, s, { x: pt[0], y: pt[1] }), t0: now });
        sfx('hit'); V.shake = 9; buzz(30);
        const it = P1.feed.find(f => f.id === e.id); const st = ON.st; const f = document.getElementById('feed');
        if (it && st && f) { const nm = i => i === st.me ? '내' : st.players[i].name + '의'; const kn = KIND_NAME[s.k]; f.innerHTML = ''; f.append(it.by >= 0 ? h('span', null, h('b', null, it.by === st.me ? '내가' : josa(st.players[it.by].name, '이', '가')), ` ${nm(it.p)} ${kn}을 떨어뜨렸어요`) : h('span', null, h('b', null, `${nm(it.p)} ${kn}`), '이 스스로 떨어졌어요')); }
      }
    }
    const end = (P1.res.dur || 0) + 700;
    if (P1.t > end) { V.play = null; const b = document.getElementById('banner'); if (b) b.innerHTML = ''; if (ON.st && ON.st.phase === 'over') { stopDraw(); renderOver(); return false; } renderShell(); }
    return true;
  }
  function idxIn(P1, id) { return P1.run.from.findIndex(s => s.id === id); }
  function frameAt(P1, t) { const fr = P1.res.frames; if (!fr.length) return null; const i = Math.max(0, Math.min(fr.length - 1, Math.floor(t / (1000 / P.C.FPS)))); return fr[i]; }
  function stonesNow() {
    const st = ON.st; if (!V.play) return st.stones;
    const P1 = V.play; if (P1.t < 0) return P1.run.from;
    const fr = P1.res.frames; const ft = P1.t / (1000 / P.C.FPS); const i = Math.floor(ft), u = ft - i;
    const A = fr[Math.min(i, fr.length - 1)], B = fr[Math.min(i + 1, fr.length - 1)];
    return P1.run.from.map((s, k) => { const a = A && A[k], b = B && B[k]; if (s.out || !a) return Object.assign({}, s, { out: true }); const q = b || a; return Object.assign({}, s, { x: a[0] + (q[0] - a[0]) * u, y: a[1] + (q[1] - a[1]) * u, out: false }); });
  }

  // ---------- drawing ----------
  function draw(now) {
    raf = 0; const st = ON.st; if (!st || !ctx) return;
    if (V.play && stepReplay(now) === false) return;
    if (!canvas.isConnected) return;
    const W = cssW; ctx.clearRect(0, 0, W, W);
    const T = tf(st);
    ctx.save();
    if (V.shake > 0.2) { ctx.translate((Math.random() - 0.5) * V.shake, (Math.random() - 0.5) * V.shake); V.shake *= 0.86; } else V.shake = 0;
    // board radius (with shrink animation)
    let Rb = V.play ? V.play.run.R : st.R;
    if (V.shrinkAnim && !V.play) { const u = Math.min(1, (now - V.shrinkAnim.t0) / 900); const e = 1 - Math.pow(1 - u, 3); Rb = V.shrinkAnim.from + (V.shrinkAnim.to - V.shrinkAnim.from) * e; if (u >= 1) V.shrinkAnim = null; }
    drawBoard(T, Rb);
    // stones
    const list = stonesNow();
    for (const s of list) if (!s.out) drawStone(T, s, 1, 1);
    // falling
    V.fade = V.fade.filter(f => { const u = (now - f.t0) / 520; if (u < 0) { drawStone(T, f.s, 1, 1); return true; } if (u > 1) return false; drawStone(T, f.s, 1 - u * 0.65, 1 - u); return true; });
    // hits
    V.fx = V.fx.filter(f => { const u = (now - f.t0) / 380; if (u > 1) return false; const [X, Y] = toS(T, f.x, f.y); ctx.strokeStyle = `rgba(255,246,220,${(1 - u) * 0.9})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, (8 + 26 * u * (0.5 + f.f)) * T.k * 1.4, 0, Math.PI * 2); ctx.stroke(); return true; });
    // aims revealed at launch
    if (V.play && V.play.t < 0) { const a = Math.min(1, (V.play.t + 900) / 300); for (const sh of V.play.run.shots) { const s = V.play.run.from.find(x => x.id === sh.id); const sp = Math.hypot(sh.vx, sh.vy); drawArrow(T, s, Math.atan2(sh.vy, sh.vx), Math.min(sp * sp / (2 * P.C.MU), R0 * 1.4), COLORS[st.players[s.p].c], 0.85 * a, false); } }
    // my aim
    if (!V.play && st.phase === 'aim' && myAlive(st)) {
      const mine = st.stones.filter(s => s.p === st.me && !s.out);
      const t = now / 1000;
      if (!V.aim && !V.drag && !st.players[st.me].locked) for (const s of mine) { const [X, Y] = toS(T, s.x, s.y); ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.25 * Math.sin(t * 3)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, (P.KINDS[s.k].r + 6) * T.k, 0, Math.PI * 2); ctx.stroke(); }
      const a = V.drag && V.drag.w != null ? V.drag : V.aim;
      if (a) { const s = st.stones.find(x => x.id === a.id); if (s) { const C = COLORS[st.players[st.me].c]; drawArrow(T, s, a.a, Math.min(P.travel(s.k, a.w), R0 * 1.4), C, 1, true);
        if (V.drag) { const [X, Y] = toS(T, s.x, s.y); const [DX, DY] = toS(T, V.drag.x, V.drag.y); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.setLineDash([2, 5]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(DX, DY); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = '#fff'; ctx.font = '700 13px Pretendard Variable, Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(Math.round(a.w * 100) + '%', DX, DY - 16); } } }
    }
    ctx.restore();
    // hud timer
    const tb = document.getElementById('tbar'), sec = document.getElementById('sec');
    if (tb && st.phase === 'aim' && !V.play) { const left = Math.max(0, st.left - (Date.now() - ON.stAt)); tb.style.transform = `scaleX(${left / (st.aimTotal + 1500)})`; sec.textContent = Math.ceil(left / 1000) + '초'; if (left < 3500 && left > 0 && Math.ceil(left / 1000) !== V.lastSec) { V.lastSec = Math.ceil(left / 1000); sfx('tick'); } }
    else if (tb) { tb.style.transform = 'scaleX(0)'; sec.textContent = ''; }
    raf = requestAnimationFrame(draw);
  }
  function drawBoard(T, Rb) {
    const [cx, cy] = [T.cx, T.cy]; const r = Rb * T.k;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.06 + 6, r * 1.01, r * 1.0, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7E5426'; ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r * 1.05); g.addColorStop(0, '#F0D49E'); g.addColorStop(0.6, '#E0B877'); g.addColorStop(1, '#C8964F');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    // wood grain
    ctx.strokeStyle = 'rgba(120,78,30,.07)'; ctx.lineWidth = 1.2; for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.ellipse(cx + i * 3, cy - R0 * T.k * 1.3, R0 * T.k * (0.6 + Math.abs(i) * 0.09), R0 * T.k * 2.2, 0, 0, Math.PI * 2); ctx.stroke(); }
    // go grid, fixed to board units so it doesn't shrink
    const sp = (2 * R0) / 18; ctx.strokeStyle = 'rgba(70,44,14,.32)'; ctx.lineWidth = 1;
    for (let i = -9; i <= 9; i++) { const a = toS(T, i * sp, -R0), b = toS(T, i * sp, R0), c = toS(T, -R0, i * sp), d = toS(T, R0, i * sp); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke(); }
    ctx.fillStyle = 'rgba(70,44,14,.5)'; for (const [i, j] of [[-6, -6], [-6, 6], [6, -6], [6, 6], [0, 0], [0, -6], [0, 6], [-6, 0], [6, 0]]) { const [X, Y] = toS(T, i * sp, j * sp); ctx.beginPath(); ctx.arc(X, Y, 2.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,240,210,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r - 1, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
  }
  function drawStone(T, s, scale, alpha) {
    const st = ON.st; const C = COLORS[st.players[s.p] ? st.players[s.p].c : 0]; const r = P.KINDS[s.k].r * T.k * scale; const [X, Y] = toS(T, s.x, s.y);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(X + r * 0.12, Y + r * 0.28, r * 1.02, r * 0.92, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(X - r * 0.35, Y - r * 0.45, r * 0.1, X, Y, r * 1.05); g.addColorStop(0, C.hi); g.addColorStop(0.55, C.base); g.addColorStop(1, shade(C.base, -0.25));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(X - r * 0.3, Y - r * 0.42, r * 0.42, r * 0.22, -0.4, 0, Math.PI * 2); ctx.fill();
    if (s.p === st.me && st.phase !== 'over') { ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X, Y, r + 2.5, 0, Math.PI * 2); ctx.stroke(); }
    if (V.sel === s.id && !V.play) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X, Y, r + 5, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  function drawArrow(T, s, a, len, C, alpha, mine) {
    const [X, Y] = toS(T, s.x, s.y); const ex = s.x + Math.cos(a) * len, ey = s.y + Math.sin(a) * len; const [EX, EY] = toS(T, ex, ey);
    ctx.globalAlpha = alpha; ctx.strokeStyle = mine ? '#fff' : C.hi; ctx.lineWidth = mine ? 3 : 2.5; ctx.setLineDash(mine ? [7, 7] : [4, 6]); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(EX, EY); ctx.stroke(); ctx.setLineDash([]);
    const ang = Math.atan2(EY - Y, EX - X); ctx.fillStyle = mine ? '#fff' : C.hi; ctx.beginPath(); ctx.moveTo(EX + Math.cos(ang) * 6, EY + Math.sin(ang) * 6); ctx.lineTo(EX + Math.cos(ang + 2.5) * 11, EY + Math.sin(ang + 2.5) * 11); ctx.lineTo(EX + Math.cos(ang - 2.5) * 11, EY + Math.sin(ang - 2.5) * 11); ctx.closePath(); ctx.fill();
    if (mine) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(EX, EY, P.KINDS[s.k].r * T.k, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; r = Math.round(r * (1 + f)); g = Math.round(g * (1 + f)); b = Math.round(b * (1 + f)); return `rgb(${Math.max(0, Math.min(255, r))},${Math.max(0, Math.min(255, g))},${Math.max(0, Math.min(255, b))})`; }

  // ---------- result ----------
  function renderOver() {
    const st = ON.st; const me = st.me; U.setTable(false); window.removeEventListener('resize', resize); canvas = null; ctx = null;
    const order = st.players.map((p, i) => ({ p, i, key: p.left ? 1e9 : (p.outAt ? p.outAt[0] * 1e6 + p.outAt[1] : 0) })).sort((a, b) => b.key - a.key || b.p.ko - a.p.ko);
    const win = (st.winners || []).includes(me); const wn = (st.winners || []).map(i => st.players[i].name);
    const P0 = st.players[me];
    app.innerHTML = '';
    app.append(U.topbar({ onRules: openRules, onExit: home }), h('div', { class: 'sheet' },
      h('div', { class: 'result-head' }, h('small', null, `${st.round}판 만에 끝났어요`), h('h2', null, win ? (wn.length > 1 ? '공동 우승이에요' : '내가 이겼어요') : `${wn.join(', ')} 님이 이겼어요`), h('p', null, (st.winners || []).length && !st.players[st.winners[0]].left ? '모두 같이 떨어졌지만 가장 늦게 떨어졌어요.' : '마지막까지 판 위에 남은 사람이 이겨요.')),
      h('ol', { class: 'standings' }, order.map((r, n) => h('li', { class: n === 0 ? 'first' : null }, h('span', { class: 'pl' }, n + 1),
        h('span', { class: 'av', style: `background:${COLORS[r.p.c].base};color:${COLORS[r.p.c].ink}`, 'aria-hidden': 'true' }, Array.from(r.p.name)[0]),
        h('span', { class: 'who' }, h('b', null, r.i === me ? `${r.p.name} (나)` : r.p.name), h('span', null, `떨어뜨린 돌 ${r.p.ko}개, 잃은 돌 ${r.p.lost}개`)), h('span', { class: 'tot' }, (st.winners || []).includes(r.i) ? '우승' : '')))),
      P0 ? h('div', { class: 'kpis' }, h('div', null, h('b', null, P0.ko), h('span', null, '떨어뜨린 돌')), h('div', null, h('b', null, P0.lost), h('span', null, '잃은 돌')), h('div', null, h('b', null, P0.self), h('span', null, '스스로 떨어짐'))) : null,
      h('div', { class: 'row', style: 'margin-top:20px' }, h('button', { class: 'btn', type: 'button', onclick: home }, '처음 화면'),
        ON.isHost ? h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { V.reset(); toHost({ k: 'h:again' }); } }, '한 판 더') : h('p', { class: 'fine', style: 'align-self:center' }, '방장이 한 판 더를 누르면 이어져요.'))));
  }

  const room = (new URLSearchParams(location.search).get('room') || '').replace(/\D/g, '').slice(0, 4);
  showTitle(room.length === 4 ? room : '');
  window.__tak = { get ON() { return ON; }, V, P };
})();
