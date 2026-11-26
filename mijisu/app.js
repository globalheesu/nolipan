(function () {
  'use strict';
  const CODE_LO = 4000, CODE_HI = 6999;
  const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const SUITS = ['♠', '♥', '♦', '♣'];
  const PROPS = {
    even: { label: '짝수?', f: v => v % 2 === 0 },
    ge7: { label: '7 이상?', f: v => v >= 7 },
    le4: { label: '4 이하?', f: v => v <= 4 },
    m3: { label: '3의 배수?', f: v => v % 3 === 0 },
    prime: { label: '소수?', f: v => [2, 3, 5, 7, 11].includes(v) },
    m4: { label: '4의 배수?', f: v => v % 4 === 0 },
    mid: { label: '5~8?', f: v => v >= 5 && v <= 8 },
    sq: { label: '1·4·9?', f: v => v === 1 || v === 4 || v === 9 },
  };
  const hintOf = k => RANKS.filter((r, i) => PROPS[k].f(i + 1)).join(' ');
  const BOT_NAMES = ['도도', '모모', '쿠키', '보리'];
  const WIN = 5;
  const SPEEDS = { slow: { label: '느긋하게', lo: 7000, hi: 14000, pick: 30000, answer: 25000, reveal: 20000 }, normal: { label: '보통', lo: 3500, hi: 7500, pick: 20000, answer: 15000, reveal: 12000 }, fast: { label: '빠르게', lo: 1600, hi: 4200, pick: 12000, answer: 10000, reveal: 7000 } };
  const speed = () => SPEEDS[S.speed] || SPEEDS.fast;

  // ---------- helpers ----------
  function h(tag, attrs, ...kids) { const el = document.createElement(tag); if (attrs) for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') el.className = v; else if (k === 'style') el.style.cssText = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'html') el.innerHTML = v; else el.setAttribute(k, v === true ? '' : v); } for (const kid of kids.flat()) { if (kid == null || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); } return el; }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('ima:' + k)); localStorage.setItem('ima:' + k, JSON.stringify(v)); } catch (e) { return null; } }
  function cleanName(x, fb) { const t = String(x || '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g, '').trim().slice(0, 8); return t || fb; }
  const sfx = n => window.NoliSFX && window.NoliSFX.play(n);
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function toast(t) { document.querySelectorAll('.toast').forEach(x => x.remove()); const el = h('div', { class: 'toast', role: 'status' }, t); document.body.append(el); setTimeout(() => el.remove(), 2600); }
  function cardEl(c, extra) {
    if (!c) return h('div', { class: 'card ' + (extra || ''), 'aria-label': '내 카드' }, h('span', { class: 'r', style: 'font-family:Georgia,"Times New Roman",serif;font-style:italic;font-weight:700' }, 'x'));
    const red = c.s === 1 || c.s === 2;
    return h('div', { class: 'card' + (red ? ' red' : '') + (extra ? ' ' + extra : ''), 'aria-label': RANKS[c.v - 1] + ' ' + SUITS[c.s] }, h('span', { class: 's' }, SUITS[c.s]), h('span', { class: 'r' }, RANKS[c.v - 1]), h('span', { class: 's2' }, SUITS[c.s]));
  }

  const app = document.getElementById('app');
  let S = Object.assign({ nick: '' }, store('settings') || {});
  const save = () => store('settings', S);
  const ON = { room: null, isHost: false, solo: false, peers: [], st: null, H: null, bots: 0, notes: [], noteSeq: -1, picked: null, myAns: null };

  // ============================================================
  // MENU
  // ============================================================
  const U = window.NoliUI;
  const COVER = (() => { const c = (x, y, r, body, dark) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-32" y="-45" width="64" height="90" rx="9" fill="${dark ? '#34465A' : '#FBFAF6'}"/>${body}</g>`;
    const num = (n, col) => `<text x="0" y="14" text-anchor="middle" font-family="Pretendard Variable, Pretendard, sans-serif" font-weight="800" font-size="38" letter-spacing="-2" fill="${col}">${n}</text>`;
    return `<svg viewBox="0 0 320 188"><ellipse cx="160" cy="176" rx="118" ry="8" fill="rgba(0,0,0,.22)"/>${c(90, 92, -9, num(7, '#C8423C') + '<text x="-22" y="-28" font-size="12" fill="#C8423C">♥</text>')}${c(230, 92, 9, num(12, '#25303B') + '<text x="-22" y="-28" font-size="12" fill="#25303B">♠</text>')}${c(160, 82, 0, '<text x="0" y="16" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-style="italic" font-weight="700" font-size="44" fill="#F4F4F0">x</text>', true)}<g transform="translate(160 146)"><circle r="17" fill="#E8B43A"/><text y="7" text-anchor="middle" font-family="Pretendard Variable, Pretendard, sans-serif" font-weight="800" font-size="19" fill="#1A1C20">2</text></g></svg>`; })();
  function showTitle(prefill) {
    leaveRoom();
    U.entry({ app, name: '미지수', pitch: '남의 숫자는 다 보이는데 내 숫자만 몰라요. 친구들의 답으로 내 숫자를 풀어내고 먼저 외치세요.',
      meta: [['people', '3–5명'], ['clock', '10분'], ['brain', '추리']], art: COVER,
      getNick: () => S.nick, setNick: v => { S.nick = v; save(); },
      settings: [speedSeg(), U.switchRow('고수 모드', '지난 질문 기록을 숨겨요. 기억력도 실력이 돼요.', S.expert, v => { S.expert = v; save(); })],
      soloLabel: '컴퓨터 3명과 시작', onSolo: () => startSolo(3),
      net: { id: 'im', lo: CODE_LO, hi: CODE_HI }, onRoom: (room, host) => { ON.room = room; ON.isHost = host; afterJoin(); },
      onRules: openRules, prefill, onHome: () => { history.replaceState(null, '', location.pathname); showTitle(); } });
  }
  function speedSeg() { return U.field('속도', U.seg(Object.entries(SPEEDS).map(([k, v]) => [k, v.label]), S.speed || 'fast', k => { S.speed = k; save(); }, '속도'), h('p', { class: 'hint' }, '생각할 시간과 컴퓨터가 외치는 속도가 함께 바뀌어요.')); }

  function rulesList() {
    return h('ol', { class: 'rules' },
        h('li', null, h('div', null, h('b', null, '질문을 골라요'), h('span', null, '차례인 사람이 "짝수?" 같은 질문 하나를 골라요.'))),
        h('li', null, h('div', null, h('b', null, '동시에 답해요'), h('span', null, '내 눈에 보이는 사람 중 해당하는 사람 수를 눌러요.'))),
        h('li', null, h('div', null, h('b', null, '내 카드를 알아내요'), h('span', null, '친구 한 명이 편 수와, 그 친구와 나를 뺀 나머지 중 해당하는 수를 비교해요. 친구 쪽이 1 많으면 내 카드도 해당해요.'))),
        h('li', null, h('div', null, h('b', null, '알았으면 먼저 외쳐요'), h('span', null, `맞히면 1점, 틀리면 1점을 잃어요. ${WIN}점을 먼저 내면 이겨요.`))));
  }
  const tipsOn = () => S.tips !== false;
  function josa(w, withB, without) { const c = String(w).charCodeAt(String(w).length - 1); if (c < 0xAC00 || c > 0xD7A3) return w + withB + '(' + without + ')'; return w + (((c - 0xAC00) % 28) ? withB : without); }
  function openRules() { U.rulesSheet({ title: '미지수 규칙', body: rulesList(), note: '같은 숫자는 4장뿐이에요. 남의 카드와 공개된 카드를 세면 후보를 더 빨리 지울 수 있어요.', tipsOn: tipsOn(), toggleTips: ON.st ? () => { S.tips = !tipsOn(); save(); render(); } : null }); }
  function tipEl(st) {
    if (!tipsOn() || st.phase === 'over' || st.me < 0) return null;
    const me = st.me; let t = '';
    if (st.phase === 'pick') t = st.cur === me ? '남들 숫자는 다 보여요. 내 후보는 반으로 줄고, 거의 다 푼 사람은 바로 못 맞히는 질문이 좋아요.' : '질문이 정해지면 내 눈에 보이는 카드만 세요.';
    else if (st.phase === 'answer') t = '내 카드는 빼고, 보이는 카드 중 질문에 해당하는 장수를 눌러요.';
    else if (st.phase === 'reveal') {
      const e = st.log[st.log.length - 1]; const f = PROPS[st.q] && PROPS[st.q].f;
      const j = st.players.findIndex((p, i) => i !== me && e && e.ans[i] != null);
      if (f && j >= 0 && (ON.examples || 0) < 3) {
        if (ON.exampleFor !== st.log.length + ':' + st.seq) { ON.examples = (ON.examples || 0) + 1; ON.exampleFor = st.log.length + ':' + st.seq; }
        const seen = st.players.filter((p, i) => i !== me && i !== j && p.card && f(p.card.v)).length; const a = e.ans[j]; const d = a - seen;
        t = `예시: ${josa(st.players[j].name, '이', '가')} ${a}개를 폈어요. ${josa(st.players[j].name, '과', '와')} 나를 빼고 보이는 해당 카드는 ${seen}장이에요. ${a} − ${seen} = ${d}이니, 내 카드는 "${PROPS[st.q].label.replace('?', '')}"에 ${d === 1 ? '해당해요' : '해당하지 않아요'}. 메모판에서 아닌 숫자를 지워 보세요.`;
      } else t = '후보가 하나만 남으면 "알았다!"를 눌러요. 같은 숫자는 4장뿐이라는 것도 써먹으세요.';
    }
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
    ON.room.onPeers(ch => { ON.peers = ch.peers; if (!ON.st || ON.st.phase === 'lobby') lobbyView(); });
    ON.room.onMessage((d, from) => { if (!d || !d.k) return; if (ON.isHost && d.k.startsWith('h:')) hostHandle(d, from); else clientHandle(d); });
    ON.room.onStatus(st => { if (st === 'online' && !ON.isHost) toHost({ k: 'h:hello' }); if (st === 'reconnecting') toast('연결이 불안정해요. 다시 연결하는 중이에요.'); if (st === 'closed' && !ON.isHost && ON.room) roomClosed(); });
    if (!ON.isHost) toHost({ k: 'h:hello' });
    lobbyView();
  }
  function roomClosed() { try { ON.room && ON.room.leave(); } catch (e) { } ON.room = null; ON.st = null; history.replaceState(null, '', location.pathname); closeModal(); U.closed({ app, onHome: () => showTitle() }); }
  function lobbyView() {
    if (ON.st && ON.st.phase !== 'lobby') return;
    const ms = members().slice(0, 5); const maxBots = Math.max(0, 5 - ms.length); ON.bots = Math.min(ON.bots, maxBots);
    U.lobby({ app, code: ON.room.code, title: '미지수', shareText: `미지수 같이 해요. 방 코드 ${ON.room.code}`, min: 3, max: 5, isHost: ON.isHost, bots: ON.bots, maxBots,
      people: ms.map(p => ({ name: cleanName((p.presence || {}).name, '플레이어'), me: p.sameTab, host: (p.presence || {}).host })),
      onBots: n => { ON.bots = n; lobbyView(); }, settings: [speedSeg()], onStart: () => hostStart(ms),
      onLeave: () => { history.replaceState(null, '', location.pathname); showTitle(); } });
  }
  function startSolo(nBots) {
    leaveRoom();
    ON.solo = true; ON.isHost = true;
    ON.room = { me: 'me', code: '연습', isHost: true, hostId: 'me', leave() { },
      send(to, d) { setTimeout(() => { if (d.k && d.k.startsWith('h:')) hostHandle(d, 'me'); else clientHandle(d); }, 0); },
      broadcast(d) { setTimeout(() => clientHandle(d), 0); } };
    ON.bots = nBots;
    hostStart([{ peer: 'me', presence: { name: cleanName(S.nick, '나') } }]);
  }

  // ============================================================
  // HOST
  // ============================================================
  let timer = null; const botTimers = new Set();
  function stopHost() { if (timer) clearInterval(timer); timer = null; botTimers.forEach(t => clearTimeout(t)); botTimers.clear(); }
  function later(ms, fn) { const t = setTimeout(() => { botTimers.delete(t); fn(); }, ms); botTimers.add(t); }
  function hostStart(ms) {
    stopHost();
    const players = ms.map(p => ({ id: p.peer, name: cleanName((p.presence || {}).name, '플레이어'), bot: false }));
    const used = new Set(players.map(p => p.name));
    for (let i = 0; i < ON.bots; i++) { let n = BOT_NAMES[i]; while (used.has(n)) n += '2'; used.add(n); players.push({ id: 'bot' + i, name: n, bot: true }); }
    shuffle(players);
    const H = ON.H = { players: players.map(p => Object.assign(p, { card: null, pts: 0, taken: [], since: 0, seq: 0, callAt: 0 })), deck: [], piles: [], qdeck: [], faceUp: [], phase: 'pick', cur: Math.floor(Math.random() * players.length), q: null, answers: {}, log: [], deadline: 0, winner: null, wrongs: {} };
    for (let v = 1; v <= 12; v++) for (let s = 0; s < 4; s++) H.deck.push({ v, s });
    shuffle(H.deck);
    H.players.forEach(p => { p.card = H.deck.pop(); });
    while (H.faceUp.length < 3) H.faceUp.push(drawQ());
    timer = setInterval(hostTick, 250);
    startPick(true);
  }
  function drawQ() { const H = ON.H; if (!H.qdeck.length) H.qdeck = shuffle(Object.keys(PROPS).filter(k => !H.faceUp.includes(k))); return H.qdeck.pop(); }
  function drawCard() { const H = ON.H; if (!H.deck.length) { H.deck = shuffle(H.piles.splice(0)); } return H.deck.pop(); }
  function idxOf(id) { return ON.H ? ON.H.players.findIndex(p => p.id === id) : -1; }
  function trueCount(j, k) { const H = ON.H; return H.players.filter((p, i) => i !== j && PROPS[k].f(p.card.v)).length; }
  function startPick(first) {
    const H = ON.H; if (!first) H.cur = (H.cur + 1) % H.players.length;
    H.phase = 'pick'; H.q = null; H.answers = {}; H.ready = {}; H.deadline = Date.now() + speed().pick;
    const P = H.players[H.cur];
    if (P.bot) later(1300 + Math.random() * 1200, () => { if (H.phase === 'pick' && ON.H === H) doPick(botPick(H.cur)); });
    sync();
  }
  function doPick(i) {
    const H = ON.H; if (H.phase !== 'pick') return; i = Math.max(0, Math.min(H.faceUp.length - 1, i | 0));
    H.q = H.faceUp.splice(i, 1)[0]; H.faceUp.push(drawQ());
    H.phase = 'answer'; H.answers = {}; H.deadline = Date.now() + speed().answer;
    H.players.forEach((p, j) => { if (p.bot) later(900 + Math.random() * 2200, () => { if (H.phase === 'answer' && ON.H === H) { H.answers[j] = trueCount(j, H.q); afterAnswer(); } }); });
    sync();
  }
  function afterAnswer() { const H = ON.H; if (Object.keys(H.answers).length >= H.players.length) reveal(); else sync(); }
  function reveal() {
    const H = ON.H; if (H.phase !== 'answer') return;
    H.players.forEach((p, j) => { if (H.answers[j] == null) H.answers[j] = trueCount(j, H.q); });
    H.log.push({ q: H.q, ans: H.players.map((p, j) => H.answers[j]) });
    H.phase = 'reveal'; H.ready = {}; H.deadline = Date.now() + speed().reveal;
    sync(); botsThink();
  }
  function hostTick() {
    const H = ON.H; if (!H || H.phase === 'over') return; const now = Date.now();
    if (!H.deadline || now < H.deadline) return;
    if (H.phase === 'pick') doPick(Math.floor(Math.random() * H.faceUp.length));
    else if (H.phase === 'answer') reveal();
    else if (H.phase === 'reveal') startPick(false);
  }
  function visibleRankCount(j, v) { const H = ON.H; let c = H.players.filter((p, i) => i !== j && p.card.v === v).length; c += H.piles.filter(x => x.v === v).length; H.players.forEach(p => { c += p.taken.filter(x => x.v === v).length; }); return c; }
  function candidates(j) {
    const H = ON.H; const P = H.players[j]; const qs = H.log.slice(P.since).map(e => e.q);
    const out = []; for (let v = 1; v <= 12; v++) { if (visibleRankCount(j, v) >= 4) continue; if (qs.every(k => PROPS[k].f(v) === PROPS[k].f(P.card.v))) out.push(v); }
    return out;
  }
  function botPick(j) {
    const H = ON.H; let best = -1e9, bi = 0; const mine = candidates(j);
    H.faceUp.forEach((k, idx) => {
      const f = PROPS[k].f; const yes = mine.filter(f).length, no = mine.length - yes;
      let sc = 3 * (((yes === 1 ? 1 : 0) + (no === 1 ? 1 : 0)) / Math.max(1, mine.length)) - 0.15 * (yes * yes + no * no) / Math.max(1, mine.length);
      H.players.forEach((p, i) => { if (i === j) return; const c = candidates(i); const after = c.filter(v => f(v) === f(p.card.v)).length; if (c.length > 1 && after === 1) sc -= 1.2 * (1 + 0.6 * p.pts); });
      sc += Math.random() * 0.2;
      if (sc > best) { best = sc; bi = idx; }
    });
    return bi;
  }
  function botsThink() {
    const H = ON.H; if (!H || H.phase === 'over') return;
    H.players.forEach((p, j) => {
      if (!p.bot || p.callAt > Date.now()) return;
      const c = candidates(j); if (c.length !== 1) return;
      const seq = p.seq; p.callAt = Date.now() + 99999;
      const sp = speed(); later(sp.lo + Math.random() * (sp.hi - sp.lo), () => { p.callAt = 0; if (ON.H !== H || H.phase === 'over' || p.seq !== seq) return; const c2 = candidates(j); if (c2.length === 1) doCall(j, c2[0]); });
    });
  }
  function doCall(j, v) {
    const H = ON.H; if (!H || H.phase === 'over') return; const P = H.players[j]; if (!P) return;
    v = v | 0; if (v < 1 || v > 12) return;
    const card = P.card; const ok = card.v === v;
    if (ok) { P.pts++; P.taken.push(card); } else { P.pts = Math.max(0, P.pts - 1); H.piles.push(card); }
    P.card = drawCard(); P.since = H.log.length; P.seq++; P.callAt = 0;
    const over = P.pts >= WIN; ON.room.broadcast({ k: 'ev', p: j, name: P.name, v, ok, card, over });
    if (over) { H.phase = 'over'; H.winner = j; }
    sync(); botsThink();
  }
  function hostHandle(d, from) {
    const H = ON.H;
    if (d.k === 'h:hello') { if (H) sendState(from); return; }
    if (!H) return; const j = idxOf(from); if (j < 0) return;
    if (d.k === 'h:pick' && H.phase === 'pick' && H.cur === j) doPick(d.i);
    else if (d.k === 'h:ans' && H.phase === 'answer' && H.answers[j] == null) {
      const n = d.n | 0; if (n === trueCount(j, H.q)) { H.answers[j] = n; afterAnswer(); } else { H.wrongs[j] = (H.wrongs[j] || 0) + 1; ON.room.send(from, { k: 'badcount' }); }
    }
    else if (d.k === 'h:call') doCall(j, d.v);
    else if (d.k === 'h:ready' && H.phase === 'reveal') { H.ready[j] = true; if (H.players.every((p, i) => p.bot || H.ready[i])) startPick(false); else sync(); }
    else if (d.k === 'h:again' && from === ON.room.me && H.phase === 'over') { const ms = H.players.filter(p => !p.bot).map(p => ({ peer: p.id, presence: { name: p.name } })); ON.bots = H.players.filter(p => p.bot).length; hostStart(ms); }
  }
  function viewFor(j) {
    const H = ON.H; const me = H.players[j];
    const piles = H.piles.concat(...H.players.map(p => p.taken));
    return {
      k: 'st', phase: H.phase, cur: H.cur, q: H.q, faceUp: H.faceUp, left: Math.max(0, H.deadline - Date.now()), total: H.phase === 'pick' ? speed().pick : H.phase === 'answer' ? speed().answer : speed().reveal,
      me: j, seq: me ? me.seq : 0, winner: H.winner, win: WIN, solo: ON.solo,
      timed: !!H.deadline, readyN: Object.keys(H.ready || {}).length, humans: H.players.filter(p => !p.bot).length, iReady: !!(H.ready && H.ready[j]),
      players: H.players.map((p, i) => ({ name: p.name, bot: p.bot, pts: p.pts, card: i === j ? null : p.card, answered: H.answers[i] != null, ans: H.phase === 'reveal' || H.phase === 'over' ? (H.answers[i] == null ? null : H.answers[i]) : null })),
      log: me ? H.log.slice(me.since) : H.log.slice(-6),
      piles: piles.map(c => c.v).sort((a, b) => a - b),
    };
  }
  function sendState(id) { const j = idxOf(id); ON.room.send(id, viewFor(j)); }
  function sync() { const H = ON.H; if (!H) return; const ids = new Set(H.players.filter(p => !p.bot).map(p => p.id)); if (!ON.solo) members().forEach(m => ids.add(m.peer)); ids.forEach(id => sendState(id)); }

  // ============================================================
  // CLIENT
  // ============================================================
  let tick = null;
  function clientHandle(d) {
    if (d.k === 'bye') { if (!ON.isHost) roomClosed(); return; }
    if (d.k === 'st') {
      const prev = ON.st; ON.st = d; ON.stAt = Date.now();
      if (d.seq !== ON.noteSeq) { ON.notes = []; ON.noteSeq = d.seq; }
      if (!prev || prev.phase !== d.phase || prev.cur !== d.cur) { ON.myAns = null; if (d.phase === 'answer') sfx('flip'); if (d.phase === 'reveal') sfx('pop'); }
      if (d.phase === 'over' && (!prev || prev.phase !== 'over')) { sfx(d.winner === d.me ? 'win' : 'lose'); if (S.tips !== false) { S.tips = false; save(); } }
      render();
      return;
    }
    if (d.k === 'badcount') { sfx('hit'); ON.myAns = null; const b = document.querySelector('.pad button.sel'); if (b) { b.classList.remove('sel'); b.classList.add('bad'); } toast('다시 세어 보세요. 내 눈에 보이는 사람만 세요.'); return; }
    if (d.k === 'ev') {
      const mine = ON.st && d.p === ON.st.me;
      sfx(d.ok ? (mine ? 'win' : 'stamp') : 'hit');
      const fl = h('div', { class: 'flash' }, h('div', null, `${mine ? '나' : d.name}: ${RANKS[d.v - 1]}!`, h('small', null, (d.ok ? '정답! +1점' : `틀렸어요. 실제로는 ${RANKS[d.card.v - 1]} · −1점`) + (d.over ? '' : ` · 새 카드를 받고 계속해요`))));
      document.body.append(fl); setTimeout(() => fl.remove(), 1700);
    }
  }
  function render() {
    const st = ON.st; if (!st) return;
    closeModal(false);
    const me = st.me; const n = st.players.length;
    const over = st.phase === 'over';
    U.setTable(!over);
    const top = U.topbar({ onRules: openRules, sound: true, onExit: () => { if (confirmLeave()) { history.replaceState(null, '', location.pathname); showTitle(); } } });
    if (over) { app.innerHTML = ''; app.append(top, finaleEl(st)); return; }
    const others = h('div', { class: 'others' }, st.players.map((p, i) => i === me ? null : h('div', { class: 'seat' + (st.cur === i && st.phase !== 'over' ? ' turn' : '') },
      cardEl(p.card), h('span', { class: 'nm' }, p.name),
      st.phase === 'answer' ? h('span', { class: 'finger wait' }, p.answered ? '✓' : '…') : null,
      st.phase === 'reveal' && p.ans != null ? h('span', { class: 'finger', 'aria-label': `손가락 ${p.ans}개` }, p.ans) : null)));
    const myP = st.players[me] || { name: '관전', pts: 0 };
    const mine = h('div', { class: 'me' + (st.cur === me ? ' turn' : '') }, cardEl(null), h('div', null, h('h2', null, '내 카드'), h('p', null, '나만 못 봐요. 맞히면 새 카드를 받고 계속해요.'),
      st.phase === 'reveal' && st.players[me] && st.players[me].ans != null ? h('p', null, `내가 편 손가락: ${st.players[me].ans}`) : null));
    const board = h('div', { class: 'board', 'aria-label': `점수. ${st.win}점을 먼저 내면 이겨요` },
      st.players.map((p, i) => h('span', { class: 'sc' + (i === me ? ' mine' : '') }, U.avatar(p.name, i, 'sm'), h('span', { class: 'nm' }, i === me ? '나' : p.name), h('span', { class: 'pips', 'aria-hidden': 'true' }, Array.from({ length: st.win }, (_, k) => h('i', { class: k < p.pts ? 'on' : null }))), h('b', null, p.pts))));
    app.innerHTML = '';
    app.append(...[top, board, tipEl(st), others, mine, stageEl(st), st.phase !== 'over' && me >= 0 ? h('button', { class: 'call', type: 'button', onclick: openCall }, '알았다! 내 숫자 외치기') : null, notesEl(st)].filter(Boolean));
    startTimerBar();
  }
  function finaleEl(st) {
    const me = st.me; const rows = st.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.pts - a.p.pts);
    return h('div', { class: 'sheet' },
      h('div', { class: 'result-head' }, h('small', null, '게임 끝'), h('h2', null, st.winner === me ? '내가 이겼어요' : `${st.players[st.winner].name} 님이 이겼어요`), h('p', null, `${st.win}점을 먼저 낸 사람이 이겨요.`)),
      h('ol', { class: 'standings' }, rows.map((r, n) => h('li', { class: n === 0 ? 'first' : null }, h('span', { class: 'pl' }, n + 1), U.avatar(r.p.name, r.i),
        h('span', { class: 'who' }, h('b', null, r.i === me ? `${r.p.name} (나)` : r.p.name), r.p.card ? h('span', null, `마지막 카드 ${RANKS[r.p.card.v - 1]}`) : null), h('span', { class: 'tot' }, r.p.pts)))),
      h('div', { class: 'row', style: 'margin-top:20px' },
        h('button', { class: 'btn', type: 'button', onclick: () => { history.replaceState(null, '', location.pathname); showTitle(); } }, '처음 화면'),
        ON.isHost ? h('button', { class: 'btn btn-primary', type: 'button', onclick: () => toHost({ k: 'h:again' }) }, '한 판 더') : h('p', { class: 'fine', style: 'align-self:center' }, '방장이 한 판 더를 누르면 이어져요.')));
  }
  function confirmLeave() { return !ON.st || ON.st.phase === 'over' || window.confirm('게임에서 나갈까요?'); }
  function stageEl(st) {
    const me = st.me; const n = st.players.length; const curName = st.cur === me ? '내' : st.players[st.cur].name + '의';
    if (st.phase === 'pick') {
      const myTurn = st.cur === me;
      return h('div', { class: 'stage' }, h('h3', null, myTurn ? '내 차례예요. 질문을 골라요' : `${st.players[st.cur].name} 차례 · 질문 고르는 중`),
        h('p', { class: 'sub' }, myTurn ? '내 숫자는 좁혀지고, 남은 바로 맞히지 못하는 질문이 좋아요.' : '고른 질문에 다 같이 손가락으로 답해요.'),
        h('div', { class: 'qs' }, st.faceUp.map((k, i) => h('button', { class: 'q', type: 'button', disabled: !myTurn, onclick: () => { sfx('tap'); toHost({ k: 'h:pick', i }); } }, h('b', null, PROPS[k].label), h('small', null, hintOf(k))))),
        timerBar());
    }
    if (st.phase === 'answer') {
      const done = st.players[me] && st.players[me].answered;
      return h('div', { class: 'stage' }, h('div', { class: 'q big' }, h('b', null, PROPS[st.q].label), h('small', null, hintOf(st.q))),
        h('p', { class: 'sub', style: 'margin-top:10px' }, done ? '다른 사람을 기다리는 중이에요.' : '나를 뺀 사람들 중 해당하는 사람은 몇 명?'),
        done || me < 0 ? null : h('div', { class: 'pad' }, Array.from({ length: n }, (_, i) => h('button', { type: 'button', class: ON.myAns === i ? 'sel' : null, onclick: e => { if (ON.myAns != null) return; ON.myAns = i; e.currentTarget.classList.add('sel'); sfx('tap'); toHost({ k: 'h:ans', n: i }); } }, i))),
        timerBar());
    }
    // reveal
    return h('div', { class: 'stage' }, h('div', { class: 'q big' }, h('b', null, PROPS[st.q].label), h('small', null, hintOf(st.q))),
      h('p', { class: 'sub', style: 'margin-top:10px' }, '친구 한 명이 편 수와, 그 친구와 나를 뺀 나머지 중 해당하는 사람 수를 비교해 보세요. 친구 쪽이 1 많으면 내 카드도 해당해요.'),
      me >= 0 ? h('button', { class: 'btn btn-primary', type: 'button', style: 'width:100%', disabled: st.iReady, onclick: () => { sfx('tap'); toHost({ k: 'h:ready' }); } }, st.iReady ? (st.humans > 1 ? `다른 사람 기다리는 중 (${st.readyN}/${st.humans})` : '넘어가는 중') : '바로 다음 질문') : null,
      timerBar());
  }
  function timerBar() { return ON.st && ON.st.timed ? h('div', { class: 'timer', 'aria-hidden': 'true' }, h('i')) : null; }
  function startTimerBar() {
    if (tick) cancelAnimationFrame(tick);
    const st = ON.st; const bar = document.querySelector('.timer i'); if (!bar || !st) return;
    const step = () => { const left = Math.max(0, st.left - (Date.now() - ON.stAt)); bar.style.transform = `scaleX(${left / st.total})`; if (left > 0 && ON.st === st) tick = requestAnimationFrame(step); };
    step();
  }
  function notesEl(st) {
    const me = st.me; const others = st.players.map((p, i) => ({ p, i })).filter(x => x.i !== me);
    const rk = h('div', { class: 'ranks' }, RANKS.map((r, i) => h('button', { type: 'button', class: ON.notes.includes(i + 1) ? 'x' : null, 'aria-pressed': ON.notes.includes(i + 1) ? 'true' : 'false', onclick: e => { const v = i + 1; const k = ON.notes.indexOf(v); if (k >= 0) ON.notes.splice(k, 1); else ON.notes.push(v); e.currentTarget.classList.toggle('x'); } }, r)));
    const piles = st.piles.length ? h('p', { class: 'empty' }, '공개된 카드: ' + st.piles.map(v => RANKS[v - 1]).join(' ')) : null;
    return h('div', { class: 'notes' }, h('h4', null, '내 메모', h('span', null, '아닌 숫자를 눌러 지워요')), rk,
      S.expert ? h('p', { class: 'empty' }, '고수 모드: 지난 질문 기록이 숨겨져 있어요.') : h('div', { class: 'log' }, st.log.length ? st.log.map(e => h('div', { class: 'e' }, h('b', null, PROPS[e.q].label), others.map(x => h('i', null, `${x.p.name} ${e.ans[x.i]}`)))) : h('p', { class: 'empty' }, '새 카드를 받은 뒤로 나온 질문이 여기에 쌓여요.')),
      piles);
  }
  function closeModal(all) { document.querySelectorAll('.modal').forEach(m => { if (all !== false || !m.dataset.keep) m.remove(); }); }
  function openCall() {
    if (!ON.st || ON.st.phase === 'over') return; sfx('tap');
    const m = h('div', { class: 'modal', 'data-keep': '1', onclick: e => { if (e.target === m) m.remove(); } },
      h('div', { class: 'sheet', role: 'dialog', 'aria-label': '내 숫자 외치기' }, h('h2', { style: 'margin:0 0 4px' }, '내 숫자는?'), h('p', { class: 'fine', style: 'margin:0 0 16px' }, '맞히면 1점, 틀리면 1점을 잃어요. 메모판에서 지운 숫자는 흐리게 보여요.'),
        h('div', { class: 'ranks' }, RANKS.map((r, i) => h('button', { type: 'button', class: ON.notes.includes(i + 1) ? 'x' : null, onclick: () => { m.remove(); toHost({ k: 'h:call', v: i + 1 }); } }, r))),
        h('button', { class: 'btn', type: 'button', style: 'width:100%;margin-top:16px', onclick: () => m.remove() }, '취소')));
    document.body.append(m);
  }

  // ============================================================
  // BOOT
  // ============================================================
  const room = (new URLSearchParams(location.search).get('room') || '').replace(/\D/g, '').slice(0, 4);
  showTitle(room.length === 4 ? room : '');
  window.__ima = { get ON() { return ON; } };
})();
