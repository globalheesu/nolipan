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
  const BELL = '<svg viewBox="0 0 200 200" aria-hidden="true"><ellipse cx="100" cy="168" rx="86" ry="20" fill="#0F4638"/><rect x="14" y="140" width="172" height="28" rx="14" fill="#2A2520"/><rect x="14" y="138" width="172" height="20" rx="10" fill="#3A332C"/><path d="M28 142 C 28 70, 62 38, 100 38 C 138 38, 172 70, 172 142 Z" fill="#EDB937"/><path d="M28 142 C 28 70, 62 38, 100 38 C 138 38, 172 70, 172 142 Z" fill="none" stroke="#B8861B" stroke-width="4"/><path d="M50 108 C 54 76, 74 56, 98 52" fill="none" stroke="#FFE08A" stroke-width="9" stroke-linecap="round" opacity=".75"/><rect x="90" y="18" width="20" height="24" rx="6" fill="#B8861B"/><circle cx="100" cy="16" r="10" fill="#EDB937" stroke="#B8861B" stroke-width="3"/></svg>';

  const app = document.getElementById('app');
  let S = Object.assign({ nick: '', speed: 'normal' }, store('settings') || {});
  const save = () => store('settings', S);
  const speed = () => SPEEDS[S.speed] || SPEEDS.normal;
  const tipsOn = () => S.tips !== false;
  const ON = { room: null, isHost: false, solo: false, peers: [], st: null, H: null, bots: 0, seenEv: 0 };

  // ============================================================
  // MENU
  // ============================================================
  function brand() { return h('a', { class: 'brand', href: '../', 'aria-label': '놀이판 홈' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), '놀이판'); }
  function speedSeg() { const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': '속도' }); const draw = () => { wrap.innerHTML = ''; Object.entries(SPEEDS).forEach(([k, v]) => wrap.append(h('button', { type: 'button', role: 'radio', 'aria-checked': S.speed === k ? 'true' : 'false', class: S.speed === k ? 'on' : null, onclick: () => { S.speed = k; save(); draw(); } }, v.label))); }; draw(); return wrap; }
  function rulesList() {
    return h('ol', { class: 'rules' },
      h('li', null, h('div', null, h('b', null, '모두 비밀 조건을 하나씩 받아요'), h('span', null, '예를 들면 "보라 2장 이상", "숫자가 모두 달라요" 같은 조건이에요. 내 조건은 나만 알아요.'))),
      h('li', null, h('div', null, h('b', null, '카드 네 장 중 한 장씩 계속 바뀌어요'), h('span', null, '내 조건이 맞는 순간 종을 치면 +1점이에요. 틀리게 치면 −1점이에요.'))),
      h('li', null, h('div', null, h('b', null, '남의 속셈을 읽어요'), h('span', null, '누가 종을 칠 때마다 그 순간의 카드가 그 사람 칸에 남아요. 조건을 눈치챘으면, 그 조건이 맞는 순간 그 사람 칸을 누르세요. 맞으면 +2점이고, 들킨 사람은 조건을 새로 받아요.'))),
      h('li', null, h('div', null, h('b', null, `${WIN}점을 먼저 내면 이겨요`), h('span', null, '한 판에 3분 정도예요.'))));
  }
  function openRules() {
    const m = h('div', { class: 'modal', onclick: e => { if (e.target === m) m.remove(); } },
      h('div', { class: 'sheet', role: 'dialog', 'aria-label': '규칙' }, h('h2', null, '속셈 규칙'), rulesList(),
        h('div', { class: 'row', style: 'margin-top:16px' }, h('button', { class: 'btn', type: 'button', onclick: () => { S.tips = !tipsOn(); save(); m.remove(); if (ON.st) render(); } }, tipsOn() ? '도움말 끄기' : '도움말 다시 보기'), h('button', { class: 'btn btn-primary', type: 'button', onclick: () => m.remove() }, '닫기'))));
    document.body.append(m);
  }
  function showTitle(prefill) {
    leaveRoom();
    const nick = h('input', { id: 'nick', type: 'text', maxlength: '8', value: S.nick || '', placeholder: '닉네임', autocomplete: 'nickname', oninput: e => { S.nick = e.target.value; save(); } });
    const code = h('input', { id: 'code', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '4', placeholder: '0000', value: prefill || '' });
    const msg = h('p', { class: 'msg', role: 'alert' });
    const ok = window.NoliNet && window.NoliNet.available();
    const busy = (b, on, l) => { b.disabled = on; if (on) { b.dataset.l = b.textContent; b.textContent = l; } else if (b.dataset.l) b.textContent = b.dataset.l; };
    const needNick = () => { if (!cleanName(S.nick, '')) { msg.textContent = '닉네임을 입력하세요.'; nick.focus(); return true; } return false; };
    const fail = er => er && er.type === 'not-found' ? '방을 찾을 수 없어요. 코드를 다시 확인해 주세요.' : er && er.type === 'timeout' ? '방은 찾았는데 연결이 안 됐어요. 방장 화면이 켜져 있는지 확인하고, 두 폰을 같은 와이파이에 연결하면 대부분 바로 돼요.' : '연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.';
    const create = h('button', { class: 'btn', type: 'button', disabled: !ok, onclick: async e => { if (needNick()) return; const b = e.currentTarget; busy(b, true, '만드는 중'); try { ON.room = await window.NoliNet.create('ss', CODE_LO, CODE_HI); ON.isHost = true; afterJoin(); } catch (er) { busy(b, false); msg.textContent = '방을 만들지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.'; } } }, '친구랑 방 만들기');
    const join = h('button', { class: 'btn', type: 'button', disabled: !ok, onclick: async e => { if (needNick()) return; const c = code.value.replace(/\D/g, ''); if (c.length !== 4) { msg.textContent = '4자리 방 코드를 입력하세요.'; code.focus(); return; } const b = e.currentTarget; busy(b, true, '연결 중'); try { ON.room = await window.NoliNet.join('ss', c); ON.isHost = false; afterJoin(); } catch (er) { busy(b, false); msg.textContent = fail(er); } } }, '참가하기');
    code.addEventListener('keydown', e => { if (e.key === 'Enter') join.click(); });
    const demo = [{ c: 4, n: 3, r: '-6deg' }, { c: 0, n: 5, r: '-2deg' }, { c: 4, n: 1, r: '3deg' }, { c: 3, n: 4, r: '7deg' }];
    app.innerHTML = '';
    app.append(
      h('div', { class: 'top' }, brand(), h('span')),
      h('div', { class: 'hero' },
        h('div', { class: 'hero-table', 'aria-hidden': 'true' }, demo.map(d => { const el = cardEl(d); el.style.setProperty('--r', d.r); return el; })),
        h('div', { class: 'hero-bell', 'aria-hidden': 'true', html: BELL }),
        h('h1', null, '속셈'), h('p', { class: 'sub' }, '내 비밀 조건이 맞는 순간 종을 쳐요. 남의 속셈을 읽으면 그걸로 먼저 쳐서 점수를 뺏어요.')),
      h('div', { class: 'sheet' },
        h('div', { class: 'field' }, h('label', { for: 'nick' }, '닉네임'), nick),
        h('div', { class: 'field' }, h('label', null, '속도'), speedSeg()),
        prefill ? null : h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { if (needNick()) return; startSolo(3); } }, '컴퓨터 3명과 하기')),
        prefill ? null : h('div', { class: 'row', style: 'margin-top:8px' }, create),
        prefill ? null : h('hr'),
        h('div', { class: 'field' }, h('label', { for: 'code' }, prefill ? '초대받은 방' : '방 코드로 참가'), h('div', { class: 'row' }, code, join)),
        msg,
        prefill ? h('button', { class: 'btn-text', type: 'button', onclick: () => { history.replaceState(null, '', location.pathname); showTitle(); } }, '처음으로') : null,
        h('details', { class: 'howto', open: prefill ? null : true }, h('summary', null, '규칙 보기 · 3–6명 · 3분'), rulesList())));
    window.scrollTo(0, 0);
    if (prefill) (S.nick ? join : nick).focus();
  }

  // ============================================================
  // ROOM
  // ============================================================
  function leaveRoom() { if (ON.room) { const r = ON.room; if (ON.isHost && !ON.solo) { try { r.broadcast({ k: 'bye' }); } catch (e) { } setTimeout(() => { try { r.leave(); } catch (e) { } }, 200); } else { try { r.leave(); } catch (e) { } } } stopHost(); ON.room = null; ON.isHost = false; ON.solo = false; ON.st = null; ON.H = null; ON.seenEv = 0; document.querySelectorAll('.pop,.count').forEach(x => x.remove()); }
  const hostId = () => ON.isHost ? ON.room.me : ON.room.hostId;
  function toHost(m) { if (ON.room) ON.room.send(hostId(), m); }
  function members() { return ON.peers.filter(p => !p.away).sort((a, b) => ((a.presence || {}).joinedAt || 0) - ((b.presence || {}).joinedAt || 0)); }
  function sheetOnly(...kids) { app.innerHTML = ''; app.append(h('div', { class: 'top' }, brand(), h('span')), h('div', { class: 'sheet' }, ...kids)); window.scrollTo(0, 0); }
  function roomClosed() { try { ON.room && ON.room.leave(); } catch (e) { } ON.room = null; ON.st = null; history.replaceState(null, '', location.pathname); sheetOnly(h('h2', null, '방이 닫혔어요'), h('p', { class: 'fine', style: 'font-size:15px' }, '방장이 나갔거나 연결이 오래 끊겼어요. 방장에게 새 방을 만들어 달라고 하거나, 컴퓨터와 계속해 보세요.'), h('button', { class: 'btn btn-primary', type: 'button', style: 'width:100%;margin-top:12px', onclick: () => showTitle() }, '처음으로')); }
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
    const ms = members().slice(0, 6); const maxBots = Math.max(0, 6 - ms.length); ON.bots = Math.min(ON.bots, maxBots); const total = ms.length + ON.bots;
    const invite = h('button', { class: 'btn btn-primary', type: 'button', onclick: async e => { const b = e.currentTarget; const url = location.origin + location.pathname + '?room=' + ON.room.code; const text = `속셈 같이 해요. 방 코드 ${ON.room.code}`; if (navigator.share) { try { await navigator.share({ title: '속셈', text, url }); return; } catch (er) { if (er && er.name === 'AbortError') return; } } try { await navigator.clipboard.writeText(url); b.textContent = '링크를 복사했어요'; setTimeout(() => b.textContent = '초대 링크 보내기', 2000); } catch (er) { b.textContent = url; } } }, '초대 링크 보내기');
    sheetOnly(
      h('div', { class: 'roomcode' }, h('span', null, '방 코드'), h('b', null, ON.room.code)),
      h('div', { class: 'row', style: 'margin:10px 0 16px' }, invite),
      h('h2', { style: 'margin:0' }, `참가자 ${ms.length}명`),
      h('div', { class: 'players' }, ms.map(p => h('div', { class: 'p' }, cleanName((p.presence || {}).name, '플레이어'), p.sameTab ? h('span', { class: 'pill' }, '나') : null, (p.presence || {}).host ? h('span', { class: 'pill' }, '방장') : null))),
      ON.isHost ? h('div', { class: 'field' }, h('label', null, '컴퓨터'), h('div', { class: 'stepper' },
        h('button', { type: 'button', 'aria-label': '줄이기', onclick: () => { ON.bots = Math.max(0, ON.bots - 1); lobbyView(); } }, '−'), h('b', null, ON.bots + '명'),
        h('button', { type: 'button', 'aria-label': '늘리기', onclick: () => { ON.bots = Math.min(maxBots, ON.bots + 1); lobbyView(); } }, '+'))) : null,
      ON.isHost ? h('div', { class: 'field' }, h('label', null, '속도'), speedSeg()) : null,
      ON.isHost ? h('button', { class: 'btn btn-primary', type: 'button', style: 'width:100%', disabled: total < 3, onclick: () => hostStart(ms) }, total < 3 ? '사람과 컴퓨터를 합쳐 3명부터 할 수 있어요' : `${total}명으로 시작하기`) : h('p', { class: 'fine' }, '방장이 시작하면 바로 카드가 깔려요.'),
      h('button', { class: 'btn-text', type: 'button', onclick: () => { history.replaceState(null, '', location.pathname); showTitle(); } }, '방 나가기'));
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
  function dealCond(H) { const used = new Set(H.players.map(p => p.cond).filter(x => x != null)); let k; do k = R() * COND.length | 0; while (used.has(k)); return k; }
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
    else { P.pts += STEAL; P.steal++; ev.type = 'steal'; ev.cond = T.cond; ev.board = boardUsed.slice(); T.past.push(T.cond); T.cond = null; T.cond = dealCond(H); T.clues = []; H.until = Date.now() + 2700; }
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
  function countdown(ms) { document.querySelectorAll('.count').forEach(x => x.remove()); const el = h('div', { class: 'count', 'aria-hidden': 'true' }); document.body.append(el); const t0 = Date.now(); const step = () => { const left = Math.ceil((ms - (Date.now() - t0)) / 1000); if (left <= 0 || !ON.st || ON.st.phase !== 'count') { el.remove(); return; } el.textContent = left; setTimeout(step, 100); }; step(); }
  function showEvent(st) {
    const e = st.ev; const P = st.players[e.i]; const T = st.players[e.j]; const me = st.me;
    const who = n => n === me ? '내가' : josa(st.players[n].name, '이', '가');
    let big, cls = '', line;
    if (e.type === 'own') { big = '땡!'; line = `${who(e.i)} 맞혔어요 · +1`; }
    else if (e.type === 'steal') { big = '읽었다!'; cls = 'steal'; line = `${who(e.i)} ${e.j === me ? '내' : T.name + '의'} 속셈을 읽었어요 · +${STEAL}`; }
    else { big = '삑!'; cls = 'bad'; line = e.j !== e.i ? `${who(e.i)} ${T.name}의 속셈을 잘못 짚었어요 · −1` : `${who(e.i)} 잘못 쳤어요 · −1`; }
    document.querySelectorAll('.pop').forEach(x => x.remove());
    const el = h('div', { class: 'pop' + (e.type === 'steal' ? ' long' : ''), role: 'status' }, h('div', { class: 'big ' + cls }, big), h('div', null, h('span', { class: 'line' }, line)),
      e.type === 'steal' ? h('div', { style: 'margin-top:6px' }, h('span', { class: 'line', style: 'font-size:14px' }, `${e.j === me ? '내' : T.name + '의'} 속셈: `, condEl(e.cond))) : null);
    document.body.append(el); setTimeout(() => el.remove(), e.type === 'steal' ? 2700 : 1700);
  }
  function ring(t) { const st = ON.st; if (!st || st.phase !== 'play' || st.locked) return; sfx('tap'); toHost({ k: 'h:ring', t, v: st.v }); }
  function render(prev) {
    const st = ON.st; const me = st.me;
    const top = h('div', { class: 'top' }, brand(), h('span', null,
      h('button', { class: 'iconbtn', type: 'button', onclick: openRules }, '규칙'), ' ',
      h('button', { class: 'iconbtn', type: 'button', onclick: e => { const on = !window.NoliSFX.on(); window.NoliSFX.set(on); e.currentTarget.textContent = on ? '소리' : '무음'; } }, window.NoliSFX && window.NoliSFX.on() ? '소리' : '무음'), ' ',
      h('button', { class: 'iconbtn', type: 'button', onclick: () => { if (st.phase === 'over' || window.confirm('게임에서 나갈까요?')) { history.replaceState(null, '', location.pathname); showTitle(); } } }, '나가기')));
    app.innerHTML = '';
    if (st.phase === 'over') { app.append(top, finaleEl(st)); return; }
    const play = st.phase === 'play';
    const e = st.ev; const freezeEv = st.phase === 'freeze' && e;
    const opps = h('div', { class: 'opps' }, st.players.map((p, i) => {
      if (i === me) return null;
      const fl = freezeEv && e.i === i && e.type === 'own' ? ' flash' : freezeEv && e.j === i && e.type === 'steal' ? ' lost' : '';
      return h('button', { class: 'opp' + fl, type: 'button', disabled: !play || st.locked, 'aria-label': `${p.name}의 속셈으로 치기`, onclick: () => ring(i) },
        h('span', { class: 'hd' }, h('span', { class: 'nm' }, p.name), h('span', { class: 'pt' }, p.pts)),
        p.clues.length ? h('span', { class: 'clues' }, p.clues.map(b => h('span', { class: 'clue' }, b.map(x => cardEl(x, 'mini'))))) : h('span', { class: 'none' }, p.past.length ? '조건을 새로 받았어요' : '아직 안 쳤어요'),
        play && p.clues.length ? h('span', { class: 'grab', 'aria-hidden': 'true' }, '눌러서 가로채기') : null);
    }));
    const hitBoard = freezeEv && e.board ? e.board : st.board;
    const board = h('div', { class: 'board' + (freezeEv ? ' hit' : '') + (e && e.type === 'miss' && e.i === me && st.locked ? ' miss' : '') },
      hitBoard ? hitBoard.map((x, k) => cardEl(x, st.fresh && (!prev || prev.v !== st.v) ? 'fresh' : (prev && prev.v !== st.v && k === st.changed ? 'new' : ''))) : [0, 1, 2, 3].map(() => h('div', { class: 'card', style: 'background:rgba(255,255,255,.12);box-shadow:none' })));
    if (st.fresh && hitBoard) board.querySelectorAll('.card').forEach((c, k) => c.style.animationDelay = (k * 70) + 'ms');
    const flow = h('div', { class: 'flow', 'aria-hidden': 'true' }, [0, 1, 2, 3].map(k => h('i', { class: play && k === st.next ? 'next' : null })));
    const bell = h('button', { class: 'bell', type: 'button', disabled: !play || st.locked, 'aria-label': '종 치기: 내 조건이 맞았어요', onpointerdown: e => { e.preventDefault(); ring(-1); }, onclick: e => { if (e.detail === 0) ring(-1); }, html: BELL + '<span class="lb">땡</span>' });
    const status = h('p', { class: 'status' }, st.phase === 'count' ? '곧 카드가 깔려요' : st.locked ? '잘못 쳤어요. 다음 카드까지 쉬어요.' : st.phase === 'freeze' ? '' : ' ');
    const mineP = st.players[me];
    const mine = mineP ? h('div', { class: 'mine' },
      h('div', { class: 'cond' }, h('small', null, '내 속셈'), h('b', null, mineP.cond != null ? condEl(mineP.cond) : '—'), h('div', { class: 'track' }, h('i', { style: `width:${Math.min(100, mineP.pts / WIN * 100)}%` }))),
      h('div', { class: 'score' }, h('b', null, mineP.pts), h('small', null, `/${WIN}점`))) : null;
    const tip = tipsOn() && mineP && mineP.cond != null ? h('div', { class: 'tip', role: 'note' }, h('b', null, '도움말'), ' ', `${condHelp(mineP.cond)} 종을 치세요. 남이 종을 친 순간의 카드는 그 사람 칸에 남아요. 겹치는 점을 찾았으면 그 사람 칸을 누르세요.`) : null;
    app.append(top, opps, h('div', { class: 'board-wrap' }, board, flow), bell, status, mine, tip);
  }
  function finaleEl(st) {
    const ranked = st.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.pts - a.p.pts || b.p.steal - a.p.steal);
    const me = st.me; const P = st.players[me];
    return h('div', { class: 'sheet finale' },
      h('h2', null, st.winner === me ? '속셈 읽기 1등!' : `${josa(st.players[st.winner].name, '이', '가')} 이겼어요`),
      h('p', { class: 'lead' }, '모두의 속셈을 공개해요.'),
      ranked.map((r, n) => h('div', { class: 'rank' + (n === 0 ? ' first' : '') },
        h('span', { class: 'pl' }, n + 1),
        h('span', { class: 'who' }, h('b', null, r.i === me ? `${r.p.name} (나)` : r.p.name), h('span', null, condEl(r.p.cond), r.p.past.length ? ` · 들킨 속셈 ${r.p.past.map(condText).join(', ')}` : '')),
        h('span', { class: 'tot' }, r.p.pts))),
      P ? h('div', { class: 'stats' }, h('div', null, h('b', null, P.own), h('span', null, '내 조건으로 땡')), h('div', null, h('b', null, P.steal), h('span', null, '가로채기')), h('div', null, h('b', null, P.wrong), h('span', null, '잘못 친 횟수'))) : null,
      h('div', { class: 'row', style: 'margin-top:16px' },
        ON.isHost ? h('button', { class: 'btn btn-primary', type: 'button', onclick: () => toHost({ k: 'h:again' }) }, '한 판 더') : h('p', { class: 'fine' }, '방장이 한 판 더 누르면 이어서 해요.'),
        h('button', { class: 'btn', type: 'button', onclick: () => { history.replaceState(null, '', location.pathname); showTitle(); } }, '처음으로')));
  }

  const room = (new URLSearchParams(location.search).get('room') || '').replace(/\D/g, '').slice(0, 4);
  showTitle(room.length === 4 ? room : '');
  window.__sok = { get ON() { return ON; }, COND };
})();
