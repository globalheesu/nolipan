(function () {
  'use strict';
  // ============================================================
  // 속셈 — everyone has a secret trigger. Ring the bell when yours is true.
  // Read someone else's trigger from when they ring, and tap them to steal (+2).
  // Simulation (classic/sok*.js): 13 triggers all ~18-19%, deduction player 71% vs 3 plain,
  // pure speed no edge over deduction, ~3 steals per game, ~3 minutes to 10 points.
  // ============================================================
  const CODE_LO = 2000, CODE_HI = 2999, WIN = 10, STEAL = 2, GRACE = 450;
  const CN = ['빨강', '노랑', '초록', '파랑', '보라'];
  const SHAPES = [
    '<circle cx="10" cy="10" r="8"/>',
    '<path d="M10 2 L18.5 17.5 H1.5 Z"/>',
    '<rect x="2.5" y="2.5" width="15" height="15" rx="2"/>',
    '<path d="M10 1 L19 10 L10 19 L1 10 Z"/>',
    '<path d="M10 1.2 L12.6 7.2 L19 7.7 L14.1 11.9 L15.6 18.3 L10 14.9 L4.4 18.3 L5.9 11.9 L1 7.7 L7.4 7.2 Z"/>',
  ];
  const cnt = (b, f) => b.filter(f).length;
  const COND = [
    ...[0, 1, 2, 3, 4].map(c => ({ t: 'c', c, test: b => cnt(b, x => x.c === c) >= 2 })),
    ...[1, 2, 3, 4, 5].map(n => ({ t: 'n', n, test: b => cnt(b, x => x.n === n) >= 2 })),
    { t: 'even', test: b => cnt(b, x => x.n % 2 === 0) >= 3 },
    { t: 'dn', test: b => new Set(b.map(x => x.n)).size === 4 },
    { t: 'dc', test: b => new Set(b.map(x => x.c)).size === 4 },
  ];
  const BOT_NAMES = ['청운', '해월', '단오', '소담', '도윤'];
  const SPEEDS = { slow: { label: '느긋하게', tick: 3200, rt: [1500, 2600] }, normal: { label: '보통', tick: 2400, rt: [1050, 1900] }, fast: { label: '빠르게', tick: 1700, rt: [750, 1350] } };

  // ---------- helpers ----------
  function h(tag, attrs, ...kids) { const el = document.createElement(tag); if (attrs) for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') el.className = v; else if (k === 'style') el.style.cssText = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'html') el.innerHTML = v; else el.setAttribute(k, v === true ? '' : v); } for (const kid of kids.flat()) { if (kid == null || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); } return el; }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('sok:' + k)); localStorage.setItem('sok:' + k, JSON.stringify(v)); } catch (e) { return null; } }
  function cleanName(x, fb) { const t = String(x || '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g, '').trim().slice(0, 8); return t || fb; }
  const sfx = n => window.NoliSFX && window.NoliSFX.play(n);
  const R = Math.random;
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function toast(t) { document.querySelectorAll('.toast').forEach(x => x.remove()); const el = h('div', { class: 'toast', role: 'status' }, t); document.body.append(el); setTimeout(() => el.remove(), 3000); }
  function josa(w, a, b) { const c = String(w).charCodeAt(String(w).length - 1); if (c < 0xAC00 || c > 0xD7A3) return w + a + '(' + b + ')'; return w + (((c - 0xAC00) % 28) ? a : b); }
  const newCard = () => ({ c: R() * 5 | 0, n: 1 + (R() * 5 | 0) });
  const shapeSVG = (c, cls) => `<svg class="${cls || ''}" viewBox="0 0 20 20" fill="var(--c${c})" aria-hidden="true">${SHAPES[c]}</svg>`;
  function cardEl(x, cls) { return h('div', { class: `card k${x.c} ${cls || ''}`, 'aria-label': `${CN[x.c]} ${x.n}`, html: shapeSVG(x.c, 'sh a') + `<span class="n">${x.n}</span>` + shapeSVG(x.c, 'sh b') }); }
  function condText(k) { const C = COND[k]; return C.t === 'c' ? `${CN[C.c]} 2장 이상` : C.t === 'n' ? `숫자 ${C.n}가 2장 이상`.replace('1가', '1이').replace('3가', '3이').replace('5가', '5가') : C.t === 'even' ? '짝수 3장 이상' : C.t === 'dn' ? '숫자가 모두 달라요' : '색이 모두 달라요'; }
  function condEl(k) { const C = COND[k]; return h('span', { class: 'chip' }, C.t === 'c' ? h('span', { html: shapeSVG(C.c) }) : null, condText(k)); }
  function condHelp(k) { const C = COND[k]; return C.t === 'c' ? `${CN[C.c]} 카드가 2장 이상 깔리면` : C.t === 'n' ? `숫자 ${C.n} 카드가 2장 이상 깔리면` : C.t === 'even' ? '2와 4 카드가 합쳐서 3장 이상이면' : C.t === 'dn' ? '네 장의 숫자가 전부 다르면' : '네 장의 색이 전부 다르면'; }
  const BELL = '<svg viewBox="0 0 200 200" aria-hidden="true"><defs><linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6D57E"/><stop offset=".55" stop-color="#E2B04A"/><stop offset="1" stop-color="#B9862A"/></linearGradient><linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3B3631"/><stop offset="1" stop-color="#211E1B"/></linearGradient></defs><ellipse cx="100" cy="170" rx="80" ry="14" fill="rgba(0,0,0,.28)"/><rect x="22" y="142" width="156" height="24" rx="12" fill="url(#bg2)"/><path d="M34 146 C 34 80, 64 46, 100 46 C 136 46, 166 80, 166 146 Z" fill="url(#bg1)"/><path d="M56 112 C 60 84, 76 66, 98 61" fill="none" stroke="#FFF1C7" stroke-width="7" stroke-linecap="round" opacity=".55"/><rect x="92" y="28" width="16" height="20" rx="5" fill="#B9862A"/><circle cx="100" cy="25" r="9" fill="url(#bg1)"/></svg>';

  const avEl = (st, i, lg) => U.avatar(st.players[i].name, i, lg ? 'lg' : 'sm');
  const pipsEl = n => h('span', { class: 'pips', 'aria-hidden': 'true' }, Array.from({ length: WIN }, (_, k) => h('i', { class: k < n ? 'on' : null })));
  const app = document.getElementById('app');
  let S = Object.assign({ nick: '', speed: 'normal' }, store('settings') || {});
  const save = () => store('settings', S);
  const speed = () => SPEEDS[S.speed] || SPEEDS.normal;
  const tipsOn = () => S.tips !== false;
  const ON = { room: null, isHost: false, solo: false, peers: [], st: null, H: null, bots: 0, seenEv: 0 };

  // ============================================================
  // MENU
  // ============================================================
  const U = window.NoliUI;
  const COVER = (() => { const c = (x, y, r, col, n, shape) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-27" y="-38" width="54" height="76" rx="8" fill="#FBFAF6"/><rect x="-27" y="-38" width="54" height="76" rx="8" fill="none" stroke="rgba(0,0,0,.06)"/><text x="0" y="14" text-anchor="middle" font-family="Pretendard Variable, Pretendard, sans-serif" font-weight="800" font-size="38" letter-spacing="-1.5" fill="${col}">${n}</text><g transform="translate(-21 -32) scale(.5)" fill="${col}">${SHAPES[shape]}</g></g>`;
    return `<svg viewBox="0 0 320 188"><ellipse cx="160" cy="176" rx="120" ry="8" fill="rgba(0,0,0,.18)"/>${c(82, 82, -12, '#8650BF', 3, 4)}${c(132, 70, -4, '#D9453F', 5, 0)}${c(188, 70, 4, '#8650BF', 1, 4)}${c(238, 82, 12, '#2F67D8', 4, 3)}<g transform="translate(118 104) scale(.42)">${BELL.replace(/^<svg[^>]*>/, '').replace('</svg>', '')}</g></svg>`; })();
  function speedSeg() { return U.field('속도', U.seg(Object.entries(SPEEDS).map(([k, v]) => [k, v.label]), S.speed, k => { S.speed = k; save(); }, '속도'), h('p', { class: 'hint' }, '카드가 바뀌는 빠르기와 컴퓨터의 반응이 함께 달라져요.')); }
  function rulesList() {
    return h('ol', { class: 'rules' },
      h('li', null, h('div', null, h('b', null, '모두 비밀 조건을 하나씩 받아요'), h('span', null, '"보라 2장 이상", "숫자가 모두 달라요" 같은 조건이에요. 내 조건은 나만 알아요.'))),
      h('li', null, h('div', null, h('b', null, '카드 네 장 중 한 장씩 계속 바뀌어요'), h('span', null, '내 조건이 맞는 순간 종을 치면 1점, 틀리게 치면 1점을 잃어요.'))),
      h('li', null, h('div', null, h('b', null, '남의 속셈을 읽어요'), h('span', null, '누가 종을 치면 그 순간의 카드가 그 사람 칸에 남아요. 겹치는 점을 찾았으면, 그 조건이 맞는 순간 그 사람 칸을 누르세요. 맞으면 2점이고, 들킨 사람은 조건을 새로 받아요.'))),
      h('li', null, h('div', null, h('b', null, `${WIN}점을 먼저 내면 이겨요`), h('span', null, '한 판은 3분 안팎이에요.'))));
  }
  function openRules() { U.rulesSheet({ title: '속셈 규칙', body: rulesList(), tipsOn: tipsOn(), toggleTips: ON.st ? () => { S.tips = !tipsOn(); save(); render(); } : null }); }
  function showTitle(prefill) {
    leaveRoom();
    U.entry({ app, name: '속셈', pitch: '내 비밀 조건이 맞는 순간 종을 쳐요. 남이 언제 치는지 보고 속셈을 읽으면, 그걸로 먼저 쳐서 점수를 뺏어요.',
      meta: [['people', '3–6명'], ['clock', '3분'], ['bolt', '순발력과 추리']], art: COVER,
      getNick: () => S.nick, setNick: v => { S.nick = v; save(); }, settings: [speedSeg()], soloLabel: '컴퓨터 3명과 시작', onSolo: () => startSolo(3),
      net: { id: 'ss', lo: CODE_LO, hi: CODE_HI }, onRoom: (room, host) => { ON.room = room; ON.isHost = host; afterJoin(); },
      onRules: openRules, prefill, onHome: () => { history.replaceState(null, '', location.pathname); showTitle(); } });
  }

  // ============================================================
  // ROOM
  // ============================================================
  function leaveRoom() { if (ON.room) { const r = ON.room; if (ON.isHost && !ON.solo) { try { r.broadcast({ k: 'bye' }); } catch (e) { } setTimeout(() => { try { r.leave(); } catch (e) { } }, 200); } else { try { r.leave(); } catch (e) { } } } stopHost(); ON.room = null; ON.isHost = false; ON.solo = false; ON.st = null; ON.H = null; ON.seenEv = 0; document.querySelectorAll('.pop,.count').forEach(x => x.remove()); }
  const hostId = () => ON.isHost ? ON.room.me : ON.room.hostId;
  function toHost(m) { if (ON.room) ON.room.send(hostId(), m); }
  function members() { return ON.peers.filter(p => !p.away).sort((a, b) => ((a.presence || {}).joinedAt || 0) - ((b.presence || {}).joinedAt || 0)); }
  function roomClosed() { try { ON.room && ON.room.leave(); } catch (e) { } ON.room = null; ON.st = null; history.replaceState(null, '', location.pathname); U.closed({ app, onHome: () => showTitle() }); }
  function afterJoin() {
    try { history.replaceState(null, '', '?room=' + ON.room.code); } catch (e) { }
    ON.room.presence({ name: cleanName(S.nick, '플레이어'), joinedAt: Date.now(), host: ON.isHost || null });
    ON.room.onPeers(ch => { ON.peers = ch.peers; if (!ON.st) lobbyView(); });
    ON.room.onMessage((d, from) => { if (!d || !d.k) return; if (ON.isHost && d.k.startsWith('h:')) hostHandle(d, from); else clientHandle(d); });
    ON.room.onStatus(st => { if (st === 'online' && !ON.isHost) toHost({ k: 'h:hello' }); if (st === 'reconnecting') toast('연결이 불안정해요. 다시 연결하는 중이에요.'); if (st === 'closed' && !ON.isHost && ON.room) roomClosed(); });
    if (!ON.isHost) toHost({ k: 'h:hello' });
    lobbyView();
  }
  function lobbyView() {
    if (ON.st) return;
    const ms = members().slice(0, 6); const maxBots = Math.max(0, 6 - ms.length); ON.bots = Math.min(ON.bots, maxBots);
    U.lobby({ app, code: ON.room.code, title: '속셈', shareText: `속셈 같이 해요. 방 코드 ${ON.room.code}`, min: 3, max: 6, isHost: ON.isHost, bots: ON.bots, maxBots,
      people: ms.map(p => ({ name: cleanName((p.presence || {}).name, '플레이어'), me: p.sameTab, host: (p.presence || {}).host })),
      onBots: n => { ON.bots = n; lobbyView(); }, settings: [speedSeg()], onStart: () => hostStart(ms),
      onLeave: () => { history.replaceState(null, '', location.pathname); showTitle(); } });
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
  function dealCond(H, P) { const used = new Set(H.players.map(p => p.cond).filter(x => x != null)); if (P) P.past.forEach(k => used.add(k)); if (used.size >= COND.length) { used.clear(); H.players.forEach(p => p.cond != null && used.add(p.cond)); } let k; do k = R() * COND.length | 0; while (used.has(k)); return k; }
  function hostStart(ms) {
    stopHost();
    const players = ms.map(p => ({ id: p.peer, name: cleanName((p.presence || {}).name, '플레이어'), bot: false }));
    const used = new Set(players.map(p => p.name));
    for (let i = 0; i < ON.bots; i++) { let n = BOT_NAMES[i]; while (used.has(n)) n += '2'; used.add(n); players.push({ id: 'bot' + i, name: n, bot: true, maxC: i % 2 ? 1 : 2, sharp: 0.8 + R() * 0.15 }); }
    shuffle(players);
    const H = ON.H = { players: players.map(p => Object.assign(p, { pts: 0, cond: null, clues: [], past: [], own: 0, steal: 0, wrong: 0 })), board: [], prev: null, slot: 0, v: 1, flipAt: 0, phase: 'count', until: Date.now() + 3000, nextFlip: 0, ev: null, seq: 0, sp: Object.assign({}, speed()), lock: {}, fresh: true, startAt: Date.now() };
    H.players.forEach(p => p.cond = dealCond(H));
    H.board = [newCard(), newCard(), newCard(), newCard()];
    loop = setInterval(hostTick, 50);
    sync();
  }
  function freshBoard(H) { H.prev = null; H.board = [newCard(), newCard(), newCard(), newCard()]; H.slot = 0; H.v++; H.flipAt = Date.now(); H.fresh = true; H.nextFlip = Date.now() + H.sp.tick + 400; H.lock = {}; H.phase = 'play'; botsPlan(); sync(); }
  function hostTick() {
    const H = ON.H; if (!H) return; const now = Date.now();
    if (H.phase === 'count' && now >= H.until) { H.phase = 'play'; H.v++; H.fresh = true; H.flipAt = now; H.nextFlip = now + H.sp.tick + 400; botsPlan(); sync(); }
    else if (H.phase === 'freeze' && now >= H.until) { if (H.winner != null) { H.phase = 'over'; sync(); } else freshBoard(H); }
    else if (H.phase === 'play' && now >= H.nextFlip) {
      H.prev = H.board.slice(); H.board[H.slot] = newCard(); H.changed = H.slot; H.slot = (H.slot + 1) % 4; H.v++; H.flipAt = now; H.fresh = false; H.nextFlip = now + H.sp.tick; H.lock = {};
      botsPlan(); sync();
    }
  }
  function candidates(H, viewer, j) {
    const P = H.players[j]; if (!P.clues.length) return null;
    return COND.map((_, k) => k).filter(k => k !== H.players[viewer].cond && P.clues.every(b => COND[k].test(b)));
  }
  function botsPlan() {
    const H = ON.H; const v = H.v; const [lo, hi] = H.sp.rt;
    H.players.forEach((P, i) => {
      if (!P.bot) return;
      let best = null;
      if (COND[P.cond].test(H.board) && R() < P.sharp) best = { r: lo + R() * (hi - lo), t: -1 };
      H.players.forEach((O, j) => {
        if (j === i) return; const c = candidates(H, i, j); if (!c || !c.length || c.length > P.maxC) return;
        if (c.every(k => COND[k].test(H.board)) && R() < P.sharp - 0.1) { const r = lo + 250 + R() * (hi - lo); if (!best || r < best.r) best = { r, t: j }; }
      });
      if (best) later(best.r, () => { if (ON.H === H && H.v === v && H.phase === 'play') claim(i, best.t, v); });
    });
  }
  function claim(i, tgt, v) {
    const H = ON.H; if (!H || H.phase !== 'play') return; const P = H.players[i]; if (!P) return;
    if (H.lock[i]) return;
    const steal = tgt >= 0 && tgt !== i; const T = steal ? H.players[tgt] : P; if (!T) return;
    const grace = H.prev && v === H.v - 1 && Date.now() - H.flipAt < GRACE;
    const boardUsed = COND[T.cond].test(H.board) ? H.board : grace && COND[T.cond].test(H.prev) ? H.prev : null;
    const ev = { seq: ++H.seq, i, j: steal ? tgt : i };
    if (!boardUsed) {
      P.pts = Math.max(0, P.pts - 1); P.wrong++; H.lock[i] = true; ev.type = 'miss';
      H.ev = ev; ON.room.broadcast({ k: 'fx', t: 'miss' }); sync(); return;
    }
    if (!steal) { P.pts++; P.own++; P.clues.unshift(boardUsed.slice()); P.clues = P.clues.slice(0, 3); ev.type = 'own'; ev.board = boardUsed.slice(); H.until = Date.now() + 1500; }
    else { P.pts += STEAL; P.steal++; ev.type = 'steal'; ev.cond = T.cond; ev.board = boardUsed.slice(); T.past.push(T.cond); T.cond = null; T.cond = dealCond(H, T); T.clues = []; H.until = Date.now() + 2700; }
    H.phase = 'freeze'; H.ev = ev;
    if (P.pts >= WIN) { H.winner = i; H.until = Date.now() + (steal ? 2700 : 1700); }
    ON.room.broadcast({ k: 'fx', t: ev.type }); sync();
  }
  function idxOf(id) { return ON.H ? ON.H.players.findIndex(p => p.id === id) : -1; }
  function hostHandle(d, from) {
    const H = ON.H;
    if (d.k === 'h:hello') { if (H) sendState(from); return; }
    if (!H) return; const j = idxOf(from); if (j < 0) return;
    if (d.k === 'h:ring') claim(j, typeof d.t === 'number' ? d.t : -1, d.v | 0);
    else if (d.k === 'h:again' && from === ON.room.me && H.phase === 'over') { const ms = H.players.filter(p => !p.bot).map(p => ({ peer: p.id, presence: { name: p.name } })); ON.bots = H.players.filter(p => p.bot).length; hostStart(ms); }
  }
  function viewFor(j) {
    const H = ON.H; const over = H.phase === 'over';
    return {
      k: 'st', phase: H.phase, me: j, solo: ON.solo, v: H.v, board: H.phase === 'count' ? null : H.board, fresh: H.fresh, changed: H.changed, next: H.slot, ev: H.ev, winner: H.winner, locked: !!H.lock[j], left: H.phase === 'count' ? H.until - Date.now() : 0,
      players: H.players.map((p, i) => ({ name: p.name, bot: p.bot, pts: p.pts, clues: p.clues, past: p.past, cond: over || i === j ? p.cond : null, own: p.own, steal: p.steal, wrong: p.wrong })),
    };
  }
  function sendState(id) { ON.room.send(id, viewFor(idxOf(id))); }
  function sync() { const H = ON.H; if (!H) return; const ids = new Set(H.players.filter(p => !p.bot).map(p => p.id)); if (!ON.solo) members().forEach(m => ids.add(m.peer)); ids.forEach(id => sendState(id)); }

  // ============================================================
  // CLIENT
  // ============================================================
  function clientHandle(d) {
    if (d.k === 'bye') { if (!ON.isHost) roomClosed(); return; }
    if (d.k === 'st') {
      const prev = ON.st; ON.st = d;
      if (d.phase === 'count' && (!prev || prev.phase !== 'count')) countdown(d.left);
      if (d.ev && d.ev.seq !== ON.seenEv && (!prev || prev.ev == null || prev.ev.seq !== d.ev.seq)) { ON.seenEv = d.ev.seq; showEvent(d); }
      if (prev && prev.phase === 'play' && d.phase === 'play' && prev.v !== d.v && !d.fresh) sfx('step');
      if (d.phase === 'over' && (!prev || prev.phase !== 'over')) { sfx(d.winner === d.me ? 'win' : 'lose'); if (S.tips !== false) { S.tips = false; save(); } }
      render(prev); return;
    }
    if (d.k === 'fx') { sfx(d.t === 'own' ? 'pop' : d.t === 'steal' ? 'stamp' : 'hit'); }
  }
  function countdown(ms) { document.querySelectorAll('.count').forEach(x => x.remove()); const el = h('div', { class: 'count', 'aria-hidden': 'true' }); document.body.append(el); const t0 = Date.now(); const step = () => { const left = Math.ceil((ms - (Date.now() - t0)) / 1000); if (left <= 0 || !ON.st || ON.st.phase !== 'count') { el.remove(); return; } if (el.dataset.n !== String(left)) { el.dataset.n = left; el.innerHTML = ''; el.append(h('span', null, left)); sfx('tick'); } setTimeout(step, 100); }; step(); }
  function showEvent(st) {
    const e = st.ev; const T = st.players[e.j]; const me = st.me;
    const who = n => n === me ? '내가' : josa(st.players[n].name, '이', '가');
    let big, cls = '', line;
    if (e.type === 'own') { big = '땡!'; line = `${who(e.i)} 맞혔어요 · +1`; }
    else if (e.type === 'steal') { big = '읽었다!'; cls = 'steal'; line = `${who(e.i)} ${e.j === me ? '내' : T.name + '의'} 속셈을 읽었어요 · +${STEAL}`; }
    else { big = '삑!'; cls = 'bad'; line = e.j !== e.i ? `${who(e.i)} ${T.name}의 속셈을 잘못 짚었어요 · −1` : `${who(e.i)} 잘못 쳤어요 · −1`; }
    document.querySelectorAll('.pop').forEach(x => x.remove());
    const el = h('div', { class: 'pop' + (e.type === 'steal' ? ' long' : ''), role: 'status' }, h('div', { class: 'big ' + cls }, big), h('div', null, h('span', { class: 'line' }, avEl(st, e.i), line)),
      e.type === 'steal' ? h('div', null, h('span', { class: 'reveal' }, `${e.j === me ? '내' : T.name + '의'} 속셈은 `, condEl(e.cond))) : null);
    document.body.append(el); setTimeout(() => el.remove(), e.type === 'steal' ? 2700 : 1700);
    if (e.type === 'own' || e.type === 'steal') { const r = document.querySelector('.ring'); if (r) { r.classList.remove('go'); void r.offsetWidth; r.classList.add('go'); } }
  }
  function ring(t) { const st = ON.st; if (!st || st.phase !== 'play' || st.locked) return; sfx('tap'); toHost({ k: 'h:ring', t, v: st.v }); }
  function topBar(st) { return U.topbar({ onRules: openRules, sound: true, onExit: () => { if (st.phase === 'over' || window.confirm('게임에서 나갈까요?')) { history.replaceState(null, '', location.pathname); showTitle(); } } }); }
  function render(prev) {
    const st = ON.st; const me = st.me;
    U.setTable(st.phase !== 'over');
    app.innerHTML = '';
    if (st.phase === 'over') { app.append(topBar(st), finaleEl(st)); return; }
    const play = st.phase === 'play';
    const e = st.ev; const freezeEv = st.phase === 'freeze' && e;
    const others = st.players.map((p, i) => i).filter(i => i !== me);
    const opps = h('div', { class: 'opps', style: `--cols:${Math.min(3, others.length)}` }, others.map(i => {
      const p = st.players[i];
      const fl = freezeEv && e.i === i && e.type === 'own' ? ' flash' : freezeEv && e.j === i && e.type === 'steal' ? ' lost' : '';
      const rows = [0, 1, 2].map(r => p.clues[r] ? h('span', { class: 'clue' }, p.clues[r].map(x => cardEl(x, 'mini'))) : h('span', { class: 'clue empty' }, h('i'), h('i'), h('i'), h('i')));
      return h('button', { class: 'opp' + fl + (play && !st.locked && p.clues.length ? ' ready' : ''), type: 'button', disabled: !play || st.locked, 'aria-label': `${p.name} ${p.pts}점. 눌러서 ${p.name}의 속셈으로 치기`, onclick: () => ring(i) },
        h('span', { class: 'hd' }, avEl(st, i), h('span', { class: 'nm' }, p.name), h('span', { class: 'pt' }, p.pts)),
        pipsEl(p.pts), h('span', { class: 'clues' }, rows));
    }));
    const hitBoard = freezeEv && e.board ? e.board : st.board;
    const newV = !prev || prev.v !== st.v;
    const board = h('div', { class: 'board' + (freezeEv ? ' hit' : '') + (e && e.type === 'miss' && e.i === me && st.locked ? ' miss' : '') },
      [0, 1, 2, 3].map(k => h('div', { class: 'slot' + (play && k === st.next ? ' next' : '') }, hitBoard ? cardEl(hitBoard[k], st.fresh && newV ? 'fresh' : (newV && k === st.changed ? 'new' : '')) : null)));
    if (st.fresh && newV && hitBoard) board.querySelectorAll('.card').forEach((c, k) => c.style.animationDelay = (k * 70) + 'ms');
    const bell = h('button', { class: 'bell', type: 'button', disabled: !play || st.locked, 'aria-label': '종 치기: 내 조건이 맞았어요', onpointerdown: ev => { ev.preventDefault(); ring(-1); }, onclick: ev => { if (ev.detail === 0) ring(-1); }, html: BELL });
    const mineP = st.players[me];
    const firstGame = tipsOn();
    const anyClue = st.players.some((p, i) => i !== me && p.clues.length);
    const status = h('p', { class: 'status' },
      st.phase === 'count' ? '곧 카드가 깔려요' : st.locked ? '잘못 쳤어요. 다음 카드까지 쉬어요.' : st.phase === 'freeze' ? '\u00a0'
        : firstGame && mineP ? (anyClue ? ['단서가 쌓인 칸을 누르면 ', h('b', null, '가로채기'), '예요'] : [condHelp(mineP.cond) + ' ', h('b', null, '종!')]) : '\u00a0');
    const mine = mineP ? h('div', { class: 'mine' },
      h('small', null, '내 속셈 · 나만 봐요'), h('span', { class: 'sc' }, h('b', null, mineP.pts), h('span', null, ` / ${WIN}`)),
      h('span', { class: 'c' }, mineP.cond != null ? condEl(mineP.cond) : '—'), pipsEl(mineP.pts)) : null;
    app.append(topBar(st), opps, h('div', { class: 'mat' }, board), h('div', { class: 'bellrow' }, h('span', { class: 'ring', 'aria-hidden': 'true' }), bell), status, mine);
  }
  function finaleEl(st) {
    const ranked = st.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.pts - a.p.pts || b.p.steal - a.p.steal);
    const me = st.me; const P = st.players[me];
    const condChip = (k, gone) => { const C = COND[k]; return h('span', { class: gone ? 'gone' : null, html: (C.t === 'c' ? shapeSVG(C.c) : '') }, condText(k)); };
    return h('div', { class: 'sheet' },
      h('div', { class: 'result-head' }, h('small', null, '게임 끝'), h('h2', null, st.winner === me ? '내가 이겼어요' : `${josa(st.players[st.winner].name, '이', '가')} 이겼어요`), h('p', null, '모두의 속셈을 공개해요. 줄 그어진 건 들킨 속셈이에요.')),
      h('ol', { class: 'standings' }, ranked.map((r, n) => h('li', { class: n === 0 ? 'first' : null },
        h('span', { class: 'pl' }, n + 1), U.avatar(r.p.name, r.i),
        h('span', { class: 'who' }, h('b', null, r.i === me ? `${r.p.name} (나)` : r.p.name), h('span', { class: 'conds' }, r.p.past.map(k => condChip(k, true)), condChip(r.p.cond))),
        h('span', { class: 'tot' }, r.p.pts)))),
      P ? h('div', { class: 'kpis' }, h('div', null, h('b', null, P.own), h('span', null, '내 조건으로 땡')), h('div', null, h('b', null, P.steal), h('span', null, '가로채기')), h('div', null, h('b', null, P.wrong), h('span', null, '잘못 친 횟수'))) : null,
      h('div', { class: 'row', style: 'margin-top:20px' },
        h('button', { class: 'btn', type: 'button', onclick: () => { history.replaceState(null, '', location.pathname); showTitle(); } }, '처음 화면'),
        ON.isHost ? h('button', { class: 'btn btn-primary', type: 'button', onclick: () => toHost({ k: 'h:again' }) }, '한 판 더') : h('p', { class: 'fine', style: 'align-self:center' }, '방장이 한 판 더를 누르면 이어져요.')));
  }

  const room = (new URLSearchParams(location.search).get('room') || '').replace(/\D/g, '').slice(0, 4);
  showTitle(room.length === 4 ? room : '');
  window.__sok = { get ON() { return ON; }, COND };
})();
