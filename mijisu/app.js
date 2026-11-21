(function () {
  'use strict';
  const CODE_LO = 4000, CODE_HI = 6999;
  const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'];
  const SUITS = ['♠', '♥', '♦', '♣'];
  const PROPS = {
    even: { label: '짝수?', f: v => v % 2 === 0 },
    ge7: { label: '7 이상?', f: v => v >= 7 },
    le4: { label: '4 이하?', f: v => v <= 4 },
    m3: { label: '3의 배수?', f: v => v % 3 === 0 },
    prime: { label: '소수?', f: v => [2, 3, 5, 7, 11, 13].includes(v) },
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
  function brand() { return h('a', { class: 'brand', href: '../', 'aria-label': '놀이판 홈' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), '놀이판'); }
  function sheet(...kids) { closeModal(); app.innerHTML = ''; app.append(h('div', { class: 'sheet' }, ...kids)); window.scrollTo(0, 0); }
  function showTitle(prefill) {
    leaveRoom();
    const nick = h('input', { id: 'nick', type: 'text', maxlength: '8', value: S.nick || '', placeholder: '닉네임', autocomplete: 'nickname', oninput: e => { S.nick = e.target.value; save(); } });
    const code = h('input', { id: 'code', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '4', placeholder: '0000', value: prefill || '' });
    const msg = h('p', { class: 'msg', role: 'alert' });
    const ok = window.NoliNet && window.NoliNet.available();
    const busy = (b, on, l) => { b.disabled = on; if (on) { b.dataset.l = b.textContent; b.textContent = l; } else if (b.dataset.l) b.textContent = b.dataset.l; };
    const needNick = () => { if (!cleanName(S.nick, '')) { msg.textContent = '닉네임을 입력하세요.'; nick.focus(); return true; } return false; };
    const create = h('button', { class: 'btn', type: 'button', disabled: !ok, onclick: async e => { if (needNick()) return; const b = e.currentTarget; busy(b, true, '만드는 중'); try { ON.room = await window.NoliNet.create('im', CODE_LO, CODE_HI); ON.isHost = true; afterJoin(); } catch (er) { busy(b, false); msg.textContent = '방을 만들지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.'; } } }, '친구랑 방 만들기');
    const join = h('button', { class: 'btn', type: 'button', disabled: !ok, onclick: async e => { if (needNick()) return; const c = code.value.replace(/\D/g, ''); if (c.length !== 4) { msg.textContent = '4자리 방 코드를 입력하세요.'; code.focus(); return; } const b = e.currentTarget; busy(b, true, '연결 중'); try { ON.room = await window.NoliNet.join('im', c); ON.isHost = false; afterJoin(); } catch (er) { busy(b, false); msg.textContent = er && er.type === 'not-found' ? '방을 찾을 수 없어요. 코드를 다시 확인해 주세요.' : (er && er.type === 'timeout' ? '방은 찾았는데 연결이 안 됐어요. 방장 화면이 켜져 있는지 확인하고, 두 폰을 같은 와이파이에 연결하면 대부분 바로 돼요.' : '연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.'); } } }, '참가하기');
    code.addEventListener('keydown', e => { if (e.key === 'Enter') join.click(); });
    sheet(brand(),
      h('div', { class: 'logo' }, h('div', { class: 'mini', 'aria-hidden': 'true' }, 'x'), h('h1', null, '미지수')),
      h('p', { class: 'tag' }, '남의 숫자는 다 보이는데 내 숫자만 몰라요. 친구들의 답으로 내 숫자를 풀어내고 먼저 외치세요.'),
      h('div', { class: 'chips' }, h('span', null, '3–5명'), h('span', null, '한 판 10분'), h('span', null, '컴퓨터와 연습')),
      prefill ? null : h('ol', { class: 'rules' },
        h('li', null, h('div', null, h('b', null, '질문을 골라요'), h('span', null, '차례인 사람이 "짝수?" 같은 질문 하나를 골라요.'))),
        h('li', null, h('div', null, h('b', null, '동시에 답해요'), h('span', null, '내 눈에 보이는 사람 중 해당하는 사람 수를 눌러요.'))),
        h('li', null, h('div', null, h('b', null, '내 카드를 알아내요'), h('span', null, '친구 한 명이 편 수와, 그 친구와 나를 뺀 나머지 중 해당하는 수를 비교해요. 친구 쪽이 1 많으면 내 카드도 해당해요.'))),
        h('li', null, h('div', null, h('b', null, '알았으면 먼저 외쳐요'), h('span', null, `맞히면 1점, 틀리면 1점을 잃어요. ${WIN}점을 먼저 내면 이겨요.`)))),
      h('div', { class: 'field' }, h('label', { for: 'nick' }, '닉네임'), nick),
      h('div', { class: 'field' }, h('label', null, '속도'), speedSeg(), h('p', { class: 'fine', style: 'margin-top:6px' }, '생각할 시간과 컴퓨터가 외치는 속도가 함께 바뀌어요.')),
      prefill ? null : h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { if (needNick()) return; startSolo(3); } }, '컴퓨터 3명과 하기')),
      prefill ? null : h('div', { class: 'row', style: 'margin-top:8px' }, create),
      prefill ? null : h('hr'),
      h('div', { class: 'field' }, h('label', { for: 'code' }, prefill ? '초대받은 방' : '방 코드로 참가'), h('div', { class: 'row' }, code, join)),
      msg,
      ok ? null : h('p', { class: 'fine' }, '온라인 기능을 불러오지 못했어요. 컴퓨터와 하기는 그대로 할 수 있어요.'),
      prefill ? h('button', { class: 'btn-text', type: 'button', onclick: () => { history.replaceState(null, '', location.pathname); showTitle(); } }, '처음으로') : null);
    if (prefill) (S.nick ? join : nick).focus();
  }

  function speedSeg() {
    const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': '컴퓨터 속도' });
    const draw = () => { wrap.innerHTML = ''; Object.entries(SPEEDS).forEach(([k, v]) => wrap.append(h('button', { type: 'button', role: 'radio', 'aria-checked': (S.speed || 'fast') === k ? 'true' : 'false', class: (S.speed || 'fast') === k ? 'on' : null, onclick: () => { S.speed = k; save(); draw(); } }, v.label))); };
    draw(); return wrap;
  }

  // ============================================================
  // ROOM
  // ============================================================
  function leaveRoom() { if (ON.room) { try { ON.room.leave(); } catch (e) { } } stopHost(); ON.room = null; ON.isHost = false; ON.solo = false; ON.st = null; ON.H = null; }
  const hostId = () => ON.isHost ? ON.room.me : ON.room.hostId;
  function toHost(m) { if (ON.room) ON.room.send(hostId(), m); }
  function members() { return ON.peers.filter(p => !p.away).sort((a, b) => ((a.presence || {}).joinedAt || 0) - ((b.presence || {}).joinedAt || 0)); }
  function afterJoin() {
    try { history.replaceState(null, '', '?room=' + ON.room.code); } catch (e) { }
    ON.room.presence({ name: cleanName(S.nick, '플레이어'), joinedAt: Date.now(), host: ON.isHost || null });
    ON.room.onPeers(ch => { ON.peers = ch.peers; if (!ON.st || ON.st.phase === 'lobby') lobbyView(); });
    ON.room.onMessage((d, from) => { if (!d || !d.k) return; if (ON.isHost && d.k.startsWith('h:')) hostHandle(d, from); else clientHandle(d); });
    ON.room.onStatus(st => { if (st === 'online' && !ON.isHost) toHost({ k: 'h:hello' }); if (st === 'reconnecting') toast('연결이 불안정해요. 다시 연결하는 중이에요.'); });
    if (!ON.isHost) toHost({ k: 'h:hello' });
    lobbyView();
  }
  function lobbyView() {
    if (ON.st && ON.st.phase !== 'lobby') return;
    const ms = members().slice(0, 5);
    const maxBots = Math.max(0, 5 - ms.length);
    ON.bots = Math.min(ON.bots, maxBots);
    const total = ms.length + ON.bots;
    const invite = h('button', { class: 'btn btn-primary', type: 'button', onclick: async e => { const b = e.currentTarget; const url = location.origin + location.pathname + '?room=' + ON.room.code; const text = `미지수 같이 해요. 방 코드 ${ON.room.code}`; if (navigator.share) { try { await navigator.share({ title: '미지수', text, url }); return; } catch (er) { if (er && er.name === 'AbortError') return; } } try { await navigator.clipboard.writeText(url); b.textContent = '링크를 복사했어요'; setTimeout(() => b.textContent = '초대 링크 보내기', 2000); } catch (er) { b.textContent = url; } } }, '초대 링크 보내기');
    sheet(brand(),
      h('div', { class: 'roomcode' }, h('span', null, '방 코드'), h('b', null, ON.room.code)),
      h('div', { class: 'row', style: 'margin:10px 0 16px' }, invite),
      h('h2', { style: 'margin:0;font-size:18px' }, `참가자 ${ms.length}명`),
      h('div', { class: 'players' }, ms.map(p => h('div', { class: 'p' }, cleanName((p.presence || {}).name, '플레이어'), p.sameTab ? h('span', { class: 'pill' }, '나') : null, (p.presence || {}).host ? h('span', { class: 'pill' }, '방장') : null))),
      ON.isHost ? h('div', { class: 'field' }, h('label', null, '컴퓨터 플레이어'), h('div', { class: 'stepper' },
        h('button', { type: 'button', 'aria-label': '줄이기', onclick: () => { ON.bots = Math.max(0, ON.bots - 1); lobbyView(); } }, '−'), h('b', null, ON.bots + '명'),
        h('button', { type: 'button', 'aria-label': '늘리기', onclick: () => { ON.bots = Math.min(maxBots, ON.bots + 1); lobbyView(); } }, '+'))) : null,
      ON.isHost ? h('div', { class: 'field' }, h('label', null, '속도'), speedSeg()) : null,
      ON.isHost ? h('button', { class: 'btn btn-primary', type: 'button', style: 'width:100%', disabled: total < 3, onclick: () => hostStart(ms) }, total < 3 ? '사람과 컴퓨터를 합쳐 3명부터 할 수 있어요' : `${total}명으로 시작하기`)
        : h('p', { class: 'fine' }, '방장이 시작하면 바로 게임 화면으로 넘어가요.'),
      h('button', { class: 'btn-text', type: 'button', onclick: () => { history.replaceState(null, '', location.pathname); showTitle(); } }, '방 나가기'));
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
    for (let v = 1; v <= 13; v++) for (let s = 0; s < 4; s++) H.deck.push({ v, s });
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
    const out = []; for (let v = 1; v <= 13; v++) { if (visibleRankCount(j, v) >= 4) continue; if (qs.every(k => PROPS[k].f(v) === PROPS[k].f(P.card.v))) out.push(v); }
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
    v = v | 0; if (v < 1 || v > 13) return;
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
    if (d.k === 'st') {
      const prev = ON.st; ON.st = d; ON.stAt = Date.now();
      if (d.seq !== ON.noteSeq) { ON.notes = []; ON.noteSeq = d.seq; }
      if (!prev || prev.phase !== d.phase || prev.cur !== d.cur) { ON.myAns = null; if (d.phase === 'answer') sfx('flip'); if (d.phase === 'reveal') sfx('pop'); }
      if (d.phase === 'over' && (!prev || prev.phase !== 'over')) sfx(d.winner === d.me ? 'win' : 'lose');
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
    const top = h('div', { class: 'top' }, brand(), h('span', { class: 'meta' }, st.solo ? '연습 · 컴퓨터와' : '방 ' + ON.room.code), h('span', null,
      h('button', { class: 'iconbtn', type: 'button', onclick: e => { const on = !window.NoliSFX.on(); window.NoliSFX.set(on); e.currentTarget.textContent = on ? '소리' : '무음'; } }, window.NoliSFX && window.NoliSFX.on() ? '소리' : '무음'), ' ',
      h('button', { class: 'iconbtn', type: 'button', onclick: () => { if (confirmLeave()) { history.replaceState(null, '', location.pathname); showTitle(); } } }, '나가기')));
    const others = h('div', { class: 'others' }, st.players.map((p, i) => i === me ? null : h('div', { class: 'seat' + (st.cur === i && st.phase !== 'over' ? ' turn' : '') },
      cardEl(p.card), h('span', { class: 'nm' }, p.name), h('span', { class: 'pts' }, `${p.pts}점`),
      st.phase === 'answer' ? h('span', { class: 'finger wait' }, p.answered ? '✓' : '…') : null,
      st.phase === 'reveal' && p.ans != null ? h('span', { class: 'finger', 'aria-label': `손가락 ${p.ans}개` }, p.ans) : null)));
    const myP = st.players[me] || { name: '관전', pts: 0 };
    const mine = h('div', { class: 'me' + (st.cur === me ? ' turn' : '') }, cardEl(null), h('div', null, h('h2', null, `${myP.name} · ${myP.pts}/${st.win}점`), h('p', null, '맞히면 새 카드를 받고 게임은 계속돼요.'),
      st.phase === 'reveal' && st.players[me] && st.players[me].ans != null ? h('p', null, `내가 편 손가락: ${st.players[me].ans}`) : null));
    const board = h('div', { class: 'board', 'aria-label': '점수' }, h('span', { class: 'goal' }, `${st.win}점 먼저 내면 승리`),
      st.players.map((p, i) => h('span', { class: 'sc' + (i === me ? ' mine' : '') }, `${i === me ? '나' : p.name} `, h('b', null, p.pts))));
    app.innerHTML = '';
    app.append(...[top, board, others, mine, stageEl(st), st.phase !== 'over' && me >= 0 ? h('button', { class: 'call', type: 'button', onclick: openCall }, '알았다! 내 숫자 외치기') : null, notesEl(st)].filter(Boolean));
    startTimerBar();
  }
  function confirmLeave() { return !ON.st || ON.st.phase === 'over' || window.confirm('게임에서 나갈까요?'); }
  function stageEl(st) {
    const me = st.me; const n = st.players.length; const curName = st.cur === me ? '내' : st.players[st.cur].name + '의';
    if (st.phase === 'over') {
      const w = st.players[st.winner];
      return h('div', { class: 'stage winner' }, h('b', null, st.winner === me ? '이겼어요!' : `${w.name} 승리`), h('p', { class: 'sub' }, st.players.map(p => `${p.name} ${p.pts}점`).join(' · ')),
        ON.isHost ? h('button', { class: 'btn btn-primary', type: 'button', onclick: () => toHost({ k: 'h:again' }) }, '한 판 더') : h('p', { class: 'sub' }, '방장이 한 판 더를 누르면 다시 시작해요.'));
    }
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
      h('div', { class: 'log' }, st.log.length ? st.log.map(e => h('div', { class: 'e' }, h('b', null, PROPS[e.q].label), others.map(x => h('i', null, `${x.p.name} ${e.ans[x.i]}`)))) : h('p', { class: 'empty' }, '새 카드를 받은 뒤로 나온 질문이 여기에 쌓여요.')),
      piles);
  }
  function closeModal(all) { document.querySelectorAll('.modal').forEach(m => { if (all !== false || !m.dataset.keep) m.remove(); }); }
  function openCall() {
    if (!ON.st || ON.st.phase === 'over') return; sfx('tap');
    const m = h('div', { class: 'modal', 'data-keep': '1', onclick: e => { if (e.target === m) m.remove(); } },
      h('div', { class: 'sheet', role: 'dialog', 'aria-label': '내 숫자 외치기' }, h('h3', { style: 'margin:0 0 4px' }, '내 숫자는?'), h('p', { class: 'fine', style: 'margin:0 0 12px' }, '맞히면 1점, 틀리면 1점을 잃어요.'),
        h('div', { class: 'ranks' }, RANKS.map((r, i) => h('button', { type: 'button', class: ON.notes.includes(i + 1) ? 'x' : null, onclick: () => { m.remove(); toHost({ k: 'h:call', v: i + 1 }); } }, r))),
        h('button', { class: 'btn-text', type: 'button', onclick: () => m.remove() }, '취소')));
    document.body.append(m);
  }

  // ============================================================
  // BOOT
  // ============================================================
  const room = (new URLSearchParams(location.search).get('room') || '').replace(/\D/g, '').slice(0, 4);
  showTitle(room.length === 4 ? room : '');
  window.__ima = { get ON() { return ON; } };
})();
