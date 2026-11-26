(function () {
  'use strict';
  const CODE_LO = 7000, CODE_HI = 9999;
  const COLORS = ['var(--c0)', 'var(--c1)', 'var(--c2)', 'var(--c3)'];
  const CNAMES = ['빨강', '파랑', '초록', '보라'];
  const BONUS = [0, 0, 2, 5, 9, 14, 20, 27, 35];
  const COINS = 20, ROUNDS = 4, FINE_SLACK = 2, MIN_START = 4, MAX_START = 16;
  const BOT_NAMES = ['도도', '모모', '쿠키', '보리'];
  const SPEEDS = { slow: { label: '느긋하게', tick: 1400, react: [900, 1800], ann: 25000 }, normal: { label: '보통', tick: 1000, react: [500, 1200], ann: 18000 }, fast: { label: '빠르게', tick: 750, react: [250, 800], ann: 12000 } };

  function h(tag, attrs, ...kids) { const el = document.createElement(tag); if (attrs) for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') el.className = v; else if (k === 'style') el.style.cssText = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'html') el.innerHTML = v; else el.setAttribute(k, v === true ? '' : v); } for (const kid of kids.flat()) { if (kid == null || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); } return el; }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('market:' + k)); localStorage.setItem('market:' + k, JSON.stringify(v)); } catch (e) { return null; } }
  function cleanName(x, fb) { const t = String(x || '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g, '').trim().slice(0, 8); return t || fb; }
  const sfx = n => window.NoliSFX && window.NoliSFX.play(n);
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function toast(t) { document.querySelectorAll('.toast').forEach(x => x.remove()); const el = h('div', { class: 'toast', role: 'status' }, t); document.body.append(el); setTimeout(() => el.remove(), 3200); }
  const bonus = n => BONUS[Math.min(n, BONUS.length - 1)];

  const app = document.getElementById('app');
  let S = Object.assign({ nick: '', speed: 'normal' }, store('settings') || {});
  const save = () => store('settings', S);
  const speed = () => SPEEDS[S.speed] || SPEEDS.normal;
  const ON = { room: null, isHost: false, solo: false, peers: [], st: null, H: null, bots: 0 };

  function faceCard(f, cls) { return h('div', { class: 'card ' + (cls || ''), style: 'background:' + COLORS[f.c], 'aria-label': `${CNAMES[f.c]} ${f.v}` }, h('span', { class: 'k' }, CNAMES[f.c]), h('span', { class: 'v' }, f.v)); }
  function unknownCard(label) { return h('div', { class: 'card unknown', 'aria-label': label || '내 앞면 카드: 나만 몰라요' }, h('span', { class: 'v' }, '?')); }
  function sealCard(v, cls) { return h('div', { class: 'card seal' + (v == null ? ' hidden' : '') + (cls ? ' ' + cls : ''), 'aria-label': v == null ? '봉인 카드: 판매자만 알아요' : `봉인 ${v}` }, h('span', { class: 'k' }, '봉인'), h('span', { class: 'v' }, v == null ? '?' : v)); }

  // ============================================================
  // MENU
  // ============================================================
  const U = window.NoliUI;
  const COVER = `<svg viewBox="0 0 320 188"><ellipse cx="160" cy="176" rx="118" ry="8" fill="rgba(0,0,0,.22)"/>
    <g transform="translate(88 96) rotate(-7)"><rect x="-36" y="-50" width="72" height="100" rx="10" fill="#E0663F"/><text x="-26" y="-32" font-family="Pretendard Variable, Pretendard, sans-serif" font-weight="700" font-size="11" fill="rgba(255,255,255,.85)">빨강</text><text x="0" y="18" text-anchor="middle" font-family="Pretendard Variable, Pretendard, sans-serif" font-weight="800" font-size="46" letter-spacing="-2" fill="#fff">5</text></g>
    <g transform="translate(168 98) rotate(4)"><rect x="-36" y="-50" width="72" height="100" rx="10" fill="#F4EFE4"/><rect x="-36" y="-50" width="72" height="100" rx="10" fill="none" stroke="#CFC6B3" stroke-dasharray="5 4" stroke-width="1.5"/><text x="0" y="16" text-anchor="middle" font-family="Pretendard Variable, Pretendard, sans-serif" font-weight="800" font-size="42" fill="#B4AA96">?</text><circle cx="22" cy="34" r="10" fill="#B5473A"/></g>
    <g transform="translate(250 72) rotate(8)"><path d="M-30 -24 H24 a8 8 0 0 1 8 8 V24 a8 8 0 0 1 -8 8 H-30 a8 8 0 0 1 -8 -8 V-16 a8 8 0 0 1 8 -8 Z" fill="#E8B43A"/><circle cx="-28" cy="-14" r="3.2" fill="#232845"/><text x="0" y="16" text-anchor="middle" font-family="Pretendard Variable, Pretendard, sans-serif" font-weight="800" font-size="34" letter-spacing="-1" fill="#1A1C20">9</text></g>
    <g fill="none" stroke="rgba(244,244,240,.5)" stroke-width="2" stroke-linecap="round"><path d="M250 118 v28"/><path d="M243 139 l7 7 7-7"/></g></svg>`;
  function speedSeg() { return U.field('속도', U.seg(Object.entries(SPEEDS).map(([k, v]) => [k, v.label]), S.speed, k => { S.speed = k; save(); }, '속도'), h('p', { class: 'hint' }, '가격이 떨어지는 빠르기와 컴퓨터의 반응이 함께 달라져요.')); }
  function showTitle(prefill) {
    leaveRoom();
    U.entry({ app, name: '깜깜이 시장', pitch: '내 물건 값만 나만 몰라요. 가격은 계속 떨어지고, 먼저 치는 사람이 임자예요.',
      meta: [['people', '3–5명'], ['clock', '10–20분'], ['brain', '눈치와 흥정']], art: COVER,
      getNick: () => S.nick, setNick: v => { S.nick = v; save(); }, settings: [speedSeg()], soloLabel: '컴퓨터 3명과 시작', onSolo: () => startSolo(3),
      net: { id: 'mk', lo: CODE_LO, hi: CODE_HI }, onRoom: (room, host) => { ON.room = room; ON.isHost = host; afterJoin(); },
      onRules: openRules, prefill, onHome: () => { history.replaceState(null, '', location.pathname); showTitle(); } });
  }

  function rulesList() {
    return h('ol', { class: 'rules' },
      h('li', null, h('div', null, h('b', null, '물건은 카드 두 장이에요'), h('span', null, '앞면 카드는 남들만 보고, 봉인 카드는 파는 사람만 봐요. 값은 두 장을 더한 거예요.'))),
      h('li', null, h('div', null, h('b', null, '파는 사람이 시작가를 불러요'), h('span', null, '봉인이 좋은 척 비싸게 불러도 돼요. 단, 시작가가 실제 값보다 3 이상 높았는데 남이 사 가면 넘친 만큼 벌금이에요.'))),
      h('li', null, h('div', null, h('b', null, '가격이 떨어지면 먼저 치세요'), h('span', null, '먼저 친 사람이 그 값에 사요. 파는 사람도 쳐서 자기가 가질 수 있어요. 0까지 아무도 안 사면 파는 사람이 공짜로 가져요.'))),
      h('li', null, h('div', null, h('b', null, '같은 색을 모으면 보너스'), h('span', null, `한 사람이 ${ROUNDS}번씩 팔면 끝나요. 코인 + 물건 값 + 색 보너스(같은 색 2장 +2, 3장 +5, 4장 +9, 5장 +14)가 제일 높은 사람이 이겨요.`))));
  }
  function openRules() { U.rulesSheet({ title: '깜깜이 시장 규칙', body: rulesList(), tipsOn: tipsOn(), toggleTips: ON.st ? () => { S.tips = !tipsOn(); save(); render(); } : null }); }
  const tipsOn = () => S.tips !== false;
  function tipEl(st) {
    if (!tipsOn() || st.phase === 'over' || st.me < 0) return null;
    const me = st.me, seller = st.seller === me; let t = '';
    if (st.phase === 'announce') t = seller ? `물건 값은 대략 "봉인 ${st.seal} + 앞면 평균 3.5" 정도예요. 그보다 조금 높게 부르면 무난하고, 훨씬 높게 부르면 허세예요.` : '판매자가 높게 부르면 봉인이 좋을 수도, 허세일 수도 있어요. 시작가를 잘 보세요.';
    else if (st.phase === 'auction') t = seller ? '아무도 안 사면 앞면이 낮다는 신호예요. 너무 싸졌다 싶으면 직접 가져가세요.' : `내 예상 값 = 앞면 ${st.face ? st.face.v : '?'} + 봉인 짐작(보통 3쯤). 가격이 그보다 1~2 아래로 내려오면 치세요. 기다리면 남이 먼저 쳐요.`;
    else if (st.phase === 'reveal') t = '산 물건은 색별로 모여요. 같은 색이 많을수록 보너스가 커져요.';
    return t ? h('div', { class: 'tip', role: 'note' }, h('b', null, '도움말'), h('span', null, t)) : null;
  }

  // ============================================================
  // ROOM
  // ============================================================
  function leaveRoom() { if (ON.room) { const r = ON.room; if (ON.isHost && !ON.solo) { try { r.broadcast({ k: 'bye' }); } catch (e) { } setTimeout(() => { try { r.leave(); } catch (e) { } }, 200); } else { try { r.leave(); } catch (e) { } } } stopHost(); ON.room = null; ON.isHost = false; ON.solo = false; ON.st = null; ON.H = null; }
  const hostId = () => ON.isHost ? ON.room.me : ON.room.hostId;
  function toHost(m) { if (ON.room) ON.room.send(hostId(), m); }
  function members() { return ON.peers.filter(p => !p.away).sort((a, b) => ((a.presence || {}).joinedAt || 0) - ((b.presence || {}).joinedAt || 0)); }
  function afterJoin() {
    try { history.replaceState(null, '', '?room=' + ON.room.code); } catch (e) { }
    ON.room.presence({ name: cleanName(S.nick, '플레이어'), joinedAt: Date.now(), host: ON.isHost || null });
    ON.room.onPeers(ch => { ON.peers = ch.peers; if (!ON.st) lobbyView(); });
    ON.room.onMessage((d, from) => { if (!d || !d.k) return; if (ON.isHost && d.k.startsWith('h:')) hostHandle(d, from); else clientHandle(d); });
    ON.room.onStatus(st => { if (st === 'online' && !ON.isHost) toHost({ k: 'h:hello' }); if (st === 'reconnecting') toast('연결이 불안정해요. 다시 연결하는 중이에요.'); if (st === 'closed' && !ON.isHost && ON.room) roomClosed(); });
    if (!ON.isHost) toHost({ k: 'h:hello' });
    lobbyView();
  }
  function roomClosed() { try { ON.room && ON.room.leave(); } catch (e) { } ON.room = null; ON.st = null; history.replaceState(null, '', location.pathname); U.closed({ app, onHome: () => showTitle() }); }
  function lobbyView() {
    if (ON.st) return;
    const ms = members().slice(0, 5); const maxBots = Math.max(0, 5 - ms.length); ON.bots = Math.min(ON.bots, maxBots);
    U.lobby({ app, code: ON.room.code, title: '깜깜이 시장', shareText: `깜깜이 시장 같이 해요. 방 코드 ${ON.room.code}`, min: 3, max: 5, isHost: ON.isHost, bots: ON.bots, maxBots,
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
  function newDecks(H) {
    H.faces = []; for (let c = 0; c < 4; c++) for (let v = 1; v <= 6; v++) for (let k = 0; k < 2; k++) H.faces.push({ v, c });
    H.seals = []; for (let v = 0; v <= 6; v++) for (let k = 0; k < 6; k++) H.seals.push(v);
    shuffle(H.faces); shuffle(H.seals);
  }
  function hostStart(ms) {
    stopHost();
    const players = ms.map(p => ({ id: p.peer, name: cleanName((p.presence || {}).name, '플레이어'), bot: false }));
    const used = new Set(players.map(p => p.name));
    for (let i = 0; i < ON.bots; i++) { let n = BOT_NAMES[i]; while (used.has(n)) n += '2'; used.add(n); players.push({ id: 'bot' + i, name: n, bot: true }); }
    shuffle(players);
    const H = ON.H = { players: players.map(p => Object.assign(p, { coins: COINS, items: [] })), seller: 0, sold: 0, total: players.length * ROUNDS, phase: 'announce', face: null, seal: 0, start: 0, price: 0, deadline: 0, last: null, sp: Object.assign({}, speed()) };
    newDecks(H);
    loop = setInterval(hostTick, 100);
    nextAuction(true);
  }
  function score(p) { const cnt = [0, 0, 0, 0]; let v = 0; p.items.forEach(it => { cnt[it.c]++; v += it.v + it.s; }); return p.coins + v + cnt.reduce((a, n) => a + bonus(n), 0); }
  function colorCount(p, c) { return p.items.filter(it => it.c === c).length; }
  function bonusGain(p, c) { const n = colorCount(p, c); return bonus(n + 1) - bonus(n); }
  function nextAuction(first) {
    const H = ON.H;
    if (!first) H.seller = (H.seller + 1) % H.players.length;
    if (H.sold >= H.total) { H.phase = 'over'; sync(); return; }
    if (!H.faces.length || !H.seals.length) newDecks(H);
    H.face = H.faces.pop(); H.seal = H.seals.pop(); H.start = 0; H.price = 0; H.phase = 'announce'; H.deadline = Date.now() + H.sp.ann; H.slapAt = {};
    const S0 = H.players[H.seller];
    if (S0.bot) later(1200 + Math.random() * 1400, () => { if (ON.H === H && H.phase === 'announce') botAnnounce(); });
    sync();
  }
  function botAnnounce() { const H = ON.H; let st = Math.round(H.seal + 3.5 + 4 + (Math.random() * 2 - 1)); if (Math.random() < 0.2) st += 3; doAnnounce(st); }
  function doAnnounce(st) {
    const H = ON.H; if (H.phase !== 'announce') return;
    H.start = Math.max(MIN_START, Math.min(MAX_START, st | 0)); H.price = H.start; H.phase = 'auction'; H.nextTick = Date.now() + H.sp.tick + 600;
    ON.room.broadcast({ k: 'fx', t: 'go' });
    sync(); botsWatch();
  }
  function hostTick() {
    const H = ON.H; if (!H) return; const now = Date.now();
    if (H.phase === 'announce' && now >= H.deadline) doAnnounce(Math.round(3 + 3.5 + 4));
    else if (H.phase === 'auction' && now >= H.nextTick) {
      H.price--; H.nextTick = now + H.sp.tick;
      if (H.price < 0) { H.price = 0; settle(H.seller, 0, true); return; }
      sync(); botsWatch();
    } else if (H.phase === 'reveal' && now >= H.deadline) nextAuction(false);
  }
  function botsWatch() {
    const H = ON.H; if (H.phase !== 'auction') return; const p = H.price;
    H.players.forEach((P, j) => {
      if (!P.bot || H.slapAt[j]) return;
      let want = false;
      if (j === H.seller) {
        if (P.coins < p) return;
        const estSealB = Math.max(0, Math.min(6, H.start - 7.5));
        const cap = p + 1 + 2 - estSealB; const estFace = Math.min(3.5, Math.max(1, (1 + Math.min(6, cap)) / 2));
        const own = estFace + H.seal + bonusGain(P, H.face.c);
        want = own - p >= Math.max(p - 1, 0) + 1;
      } else {
        if (P.coins < p) return;
        const estSeal = 0.5 * 3 + 0.5 * Math.max(0, Math.min(6, H.start - 7.5));
        const est = H.face.v + estSeal + bonusGain(P, H.face.c);
        P.margin = P.margin == null ? 2 : P.margin;
        want = est - (P.margin + (Math.random() < 0.25 ? (Math.random() < 0.5 ? -1 : 1) : 0)) >= p;
      }
      if (want) { H.slapAt[j] = true; const [lo, hi] = H.sp.react; later(lo + Math.random() * (hi - lo), () => { if (ON.H === H && H.phase === 'auction') doSlap(j); }); }
    });
  }
  function doSlap(j) {
    const H = ON.H; if (H.phase !== 'auction') return; const P = H.players[j]; if (!P) return;
    if (P.coins < H.price) { if (!P.bot) ON.room.send(P.id, { k: 'poor' }); return; }
    settle(j, H.price, false);
  }
  function settle(j, price, free) {
    const H = ON.H; const S0 = H.players[H.seller]; const B = H.players[j];
    const value = H.face.v + H.seal; let fine = 0;
    B.coins -= price; if (j !== H.seller) S0.coins += price;
    if (j !== H.seller && H.start > value + FINE_SLACK) { fine = Math.min(S0.coins, H.start - value - FINE_SLACK); S0.coins -= fine; }
    B.items.push({ v: H.face.v, s: H.seal, c: H.face.c });
    H.sold++;
    H.last = { buyer: j, seller: H.seller, price, free, face: H.face, seal: H.seal, value, fine, start: H.start, keep: j === H.seller };
    H.phase = 'reveal'; H.deadline = Date.now() + Math.max(3500, H.sp.tick * 4);
    ON.room.broadcast({ k: 'fx', t: j === H.seller ? 'keep' : 'sold' });
    sync();
  }
  function idxOf(id) { return ON.H ? ON.H.players.findIndex(p => p.id === id) : -1; }
  function hostHandle(d, from) {
    const H = ON.H;
    if (d.k === 'h:hello') { if (H) sendState(from); return; }
    if (!H) return; const j = idxOf(from); if (j < 0) return;
    if (d.k === 'h:announce' && j === H.seller) doAnnounce(d.v);
    else if (d.k === 'h:slap' && H.phase === 'auction') doSlap(j);
    else if (d.k === 'h:again' && from === ON.room.me && H.phase === 'over') { const ms = H.players.filter(p => !p.bot).map(p => ({ peer: p.id, presence: { name: p.name } })); ON.bots = H.players.filter(p => p.bot).length; hostStart(ms); }
  }
  function viewFor(j) {
    const H = ON.H; const isSeller = j === H.seller; const reveal = H.phase === 'reveal' || H.phase === 'over';
    return {
      k: 'st', phase: H.phase, me: j, seller: H.seller, solo: ON.solo,
      face: reveal || !isSeller ? H.face : null, seal: reveal || isSeller ? H.seal : null,
      start: H.start, price: H.price, left: Math.max(0, H.deadline - Date.now()), annTotal: H.sp.ann,
      round: Math.min(ROUNDS, Math.floor(H.sold / H.players.length) + 1), rounds: ROUNDS, sold: H.sold, total: H.total,
      last: reveal ? H.last : null,
      players: H.players.map(p => ({ name: p.name, bot: p.bot, coins: p.coins, items: p.items, score: score(p) })),
    };
  }
  function sendState(id) { ON.room.send(id, viewFor(idxOf(id))); }
  function sync() { const H = ON.H; if (!H) return; const ids = new Set(H.players.filter(p => !p.bot).map(p => p.id)); if (!ON.solo) members().forEach(m => ids.add(m.peer)); ids.forEach(id => sendState(id)); }

  // ============================================================
  // CLIENT
  // ============================================================
  let raf = 0;
  function clientHandle(d) {
    if (d.k === 'bye') { if (!ON.isHost) roomClosed(); return; }
    if (d.k === 'st') {
      const prev = ON.st; ON.st = d; ON.stAt = Date.now();
      if (prev && prev.phase === 'auction' && d.phase === 'auction' && prev.price !== d.price) sfx('tick');
      if (d.phase === 'announce' && (!prev || prev.phase !== 'announce') && d.seller === d.me) sfx('flip');
      if (d.phase === 'over' && (!prev || prev.phase !== 'over')) { if (S.tips !== false) { S.tips = false; save(); } const top = Math.max(...d.players.map(p => p.score)); sfx(d.players[d.me] && d.players[d.me].score === top ? 'win' : 'lose'); }
      render(prev); return;
    }
    if (d.k === 'fx') { sfx(d.t === 'go' ? 'pop' : 'stamp'); return; }
    if (d.k === 'poor') { toast('코인이 모자라요.'); sfx('hit'); }
  }
  function render(prev) {
    const st = ON.st;
    const over = st.phase === 'over';
    U.setTable(!over);
    const top = U.topbar({ onRules: openRules, sound: true, onExit: () => { if (over || window.confirm('게임에서 나갈까요?')) { history.replaceState(null, '', location.pathname); showTitle(); } } });
    app.innerHTML = '';
    if (over) { app.append(top, finaleEl(st)); return; }
    const round = h('div', { class: 'round' }, h('span', null, `${st.round}바퀴째`), h('span', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.round(st.sold / st.total * 100)}%` })), h('span', null, `${Math.min(st.sold + 1, st.total)} / ${st.total}`));
    app.append(...[top, round, stallEl(st, prev), tipEl(st), peopleEl(st)].filter(Boolean), h('p', { class: 'help' }, '점수는 코인, 산 물건 값, 같은 색 보너스(2장 +2, 3장 +5, 4장 +9, 5장 +14)를 더해요.'));
    startTimer();
  }
  function finaleEl(st) {
    const me = st.me;
    const rows = st.players.map((p, i) => { const items = p.items.reduce((a, it) => a + it.v + it.s, 0); return { p, i, items, bonus: p.score - p.coins - items }; }).sort((a, b) => b.p.score - a.p.score);
    const P = rows.find(r => r.i === me);
    return h('div', { class: 'sheet' },
      h('div', { class: 'result-head' }, h('small', null, '장이 닫혔어요'), h('h2', null, rows[0].i === me ? '내가 이겼어요' : `${rows[0].p.name} 님이 이겼어요`), h('p', null, '점수는 코인, 물건 값, 같은 색 보너스를 더한 값이에요.')),
      h('ol', { class: 'standings' }, rows.map((r, n) => h('li', { class: n === 0 ? 'first' : null }, h('span', { class: 'pl' }, n + 1), U.avatar(r.p.name, r.i),
        h('span', { class: 'who' }, h('b', null, r.i === me ? `${r.p.name} (나)` : r.p.name), h('span', null, `코인 ${r.p.coins} · 물건 ${r.items} · 보너스 ${r.bonus}`)), h('span', { class: 'tot' }, r.p.score)))),
      P ? h('div', { class: 'kpis' }, h('div', null, h('b', null, P.p.coins), h('span', null, '남은 코인')), h('div', null, h('b', null, P.p.items.length), h('span', null, '산 물건')), h('div', null, h('b', null, '+' + P.bonus), h('span', null, '색 보너스'))) : null,
      h('div', { class: 'row', style: 'margin-top:20px' },
        h('button', { class: 'btn', type: 'button', onclick: () => { history.replaceState(null, '', location.pathname); showTitle(); } }, '처음 화면'),
        ON.isHost ? h('button', { class: 'btn btn-primary', type: 'button', onclick: () => toHost({ k: 'h:again' }) }, '한 판 더') : h('p', { class: 'fine', style: 'align-self:center' }, '방장이 한 판 더를 누르면 이어져요.')));
  }
  function stallEl(st, prev) {
    const me = st.me; const seller = st.players[st.seller]; const iAmSeller = me === st.seller;
    const goods = h('div', { class: 'goods' }, st.face ? faceCard(st.face) : unknownCard(), h('span', { class: 'plus', 'aria-hidden': 'true' }, '+'), sealCard(st.seal));
    if (st.phase === 'announce') {
      if (iAmSeller) {
        return h('div', { class: 'stall' }, h('h3', null, '내 물건을 팔 차례예요'), h('p', { class: 'sub' }, `앞면은 나만 몰라요. 봉인은 ${st.seal}이에요. 시작가를 불러 주세요.`), goods,
          h('div', { class: 'nums' }, Array.from({ length: MAX_START - MIN_START + 1 }, (_, i) => MIN_START + i).map(v => h('button', { type: 'button', onclick: () => { sfx('tap'); toHost({ k: 'h:announce', v }); } }, v))),
          h('p', { class: 'fine' }, `시작가가 실제 값보다 ${FINE_SLACK + 1} 이상 높았는데 남이 사 가면, 넘친 만큼 벌금을 내요.`), timerBar());
      }
      return h('div', { class: 'stall' }, h('h3', null, `${seller.name} 님이 시작가를 고르는 중`), h('p', { class: 'sub' }, '앞면은 보이죠? 봉인은 판매자만 알아요. 시작가로 봉인을 짐작해 보세요.'), goods, timerBar());
    }
    if (st.phase === 'auction') {
      const tick = prev && prev.phase === 'auction' && prev.price !== st.price;
      const priceBox = h('div', { class: 'pricebox' }, h('div', { class: 'price' + (tick ? ' tick' : '') }, h('small', null, '지금 가격'), h('b', null, st.price)), h('div', { class: 'startlbl' }, `시작가 ${st.start}`));
      goods.append(priceBox);
      const myCoins = st.players[me] ? st.players[me].coins : 0;
      const btn = me < 0 ? null : iAmSeller
        ? h('button', { class: 'slap keep', type: 'button', disabled: myCoins < st.price, onclick: () => { sfx('tap'); toHost({ k: 'h:slap' }); } }, `내가 가질래 · ${st.price}코인`)
        : h('button', { class: 'slap', type: 'button', disabled: myCoins < st.price, onclick: () => { sfx('tap'); toHost({ k: 'h:slap' }); } }, `산다! · ${st.price}코인`);
      return h('div', { class: 'stall' }, h('h3', null, iAmSeller ? '내 물건 경매 중' : `${seller.name}의 물건 경매 중`), h('p', { class: 'sub' }, iAmSeller ? '아무도 안 사면 앞면이 낮다는 뜻일지도 몰라요. 0이 되면 공짜로 내가 가져요.' : '기다리면 싸지지만, 남이 먼저 칠 수 있어요.'), goods, btn);
    }
    // reveal
    const L = st.last; const buyer = st.players[L.buyer];
    const line = L.keep ? (L.free ? `아무도 안 사서 판매자 ${seller.name}에게 공짜로 돌아갔어요` : `판매자 ${seller.name} 님이 ${L.price}코인에 직접 가졌어요`) : (L.buyer === me ? `내가 ${L.price}코인에 샀어요` : `${buyer.name} 님이 ${L.price}코인에 샀어요`);
    return h('div', { class: 'stall result' }, h('h3', null, line), h('p', { class: 'sub' }, `실제 값 ${L.value} (앞면 ${L.face.v} + 봉인 ${L.seal}) · 시작가 ${L.start}` + (L.fine ? ` · 과장 광고 벌금 ${L.fine}` : '')),
      h('div', { class: 'goods' }, faceCard(L.face), h('span', { class: 'plus', 'aria-hidden': 'true' }, '+'), sealCard(L.seal)), timerBar());
  }
  function peopleEl(st) {
    return h('div', { class: 'ppl' }, st.players.map((p, i) => {
      const cnt = [0, 0, 0, 0]; p.items.forEach(it => cnt[it.c]++);
      return h('div', { class: 'pp' + (i === st.seller && st.phase !== 'over' ? ' sell' : '') },
        h('div', { class: 'hd' }, U.avatar(p.name, i, 'sm'), h('b', null, i === st.me ? `${p.name} (나)` : p.name), i === st.seller ? h('span', { class: 'selling' }, '판매 중') : null, h('span', { class: 'coin' }, `코인 ${p.coins}`), h('span', { class: 'sc' }, `${p.score}점`)),
        p.items.length ? h('div', { class: 'col' }, p.items.slice().sort((a, b) => a.c - b.c).map(it => h('div', { class: 'card small', style: 'background:' + COLORS[it.c], 'aria-label': `${CNAMES[it.c]} ${it.v + it.s}` }, h('span', { class: 'v' }, it.v + it.s)))) : h('p', { class: 'empty' }, '아직 산 물건이 없어요'));
    }));
  }
  function timerBar() { return h('div', { class: 'timer', 'aria-hidden': 'true' }, h('i')); }
  function startTimer() {
    cancelAnimationFrame(raf); const st = ON.st; const bar = document.querySelector('.timer i'); if (!bar) return;
    const total = st.phase === 'announce' ? st.annTotal : Math.max(1, st.left);
    const step = () => { const left = Math.max(0, st.left - (Date.now() - ON.stAt)); bar.style.transform = `scaleX(${left / total})`; if (left > 0 && ON.st === st) raf = requestAnimationFrame(step); };
    step();
  }

  const room = (new URLSearchParams(location.search).get('room') || '').replace(/\D/g, '').slice(0, 4);
  showTitle(room.length === 4 ? room : '');
  window.__mk = { get ON() { return ON; } };
})();
