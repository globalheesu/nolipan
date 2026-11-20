(function () {
  'use strict';
  const CODE_LO = 4000, CODE_HI = 6999;
  const COLORS = ['#FF5A36', '#3D6BFF', '#14B37D', '#A855F7', '#FF3D8B', '#0EA5C6', '#F59E0B', '#64748B'];
  const BR = 34;            // bomb radius (CSS px)
  const EDGE = 34;          // edge zone for linking swipes
  const FRICTION = 1.1;     // velocity decay per second (exp)
  const MAXV = 2600;
  const OPP = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function h(tag, attrs, ...kids) { const el = document.createElement(tag); if (attrs) for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') el.className = v; else if (k === 'style') el.style.cssText = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'html') el.innerHTML = v; else el.setAttribute(k, v === true ? '' : v); } for (const kid of kids.flat()) { if (kid == null || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); } return el; }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('pass:' + k)); localStorage.setItem('pass:' + k, JSON.stringify(v)); } catch (e) { return null; } }
  function cleanName(x, fb) { const t = String(x || '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g, '').trim().slice(0, 8); return t || fb; }
  const sfx = n => window.NoliSFX && window.NoliSFX.play(n);
  function toast(t) { const el = h('div', { class: 'toast', role: 'status' }, t); document.body.append(el); setTimeout(() => el.remove(), 3000); }

  const menu = document.getElementById('menu'), stage = document.getElementById('stage'), cv = document.getElementById('cv');
  const hud = document.getElementById('hud'), banner = document.getElementById('banner'), ctrl = document.getElementById('ctrl');
  const ctx = cv.getContext('2d');
  let S = Object.assign({ nick: '' }, store('settings') || {});
  const save = () => store('settings', S);
  const ON = { room: null, isHost: false, peers: [], st: null, bomb: null, boomFx: 0, boomMine: false, linkFx: [], H: null };

  const BOMB_SVG = '<svg class="bomb" viewBox="0 0 64 64" aria-hidden="true"><circle cx="28" cy="38" r="22" fill="#16151A"/><circle cx="20" cy="30" r="6" fill="#fff" opacity=".35"/><path d="M40 20 Q46 8 56 10" fill="none" stroke="#16151A" stroke-width="4" stroke-linecap="round"/><circle cx="57" cy="9" r="5" fill="#FF5A36"/></svg>';

  // ============================================================
  // MENU SCREENS
  // ============================================================
  function showMenu(...kids) { stage.classList.remove('on'); menu.hidden = false; menu.innerHTML = ''; menu.append(h('div', { class: 'sheet' }, ...kids)); menu.scrollTop = 0; }
  function brandLink() { return h('a', { class: 'brand', href: '../', 'aria-label': '놀이판 홈' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), '놀이판'); }
  function demo() {
    return h('div', { class: 'demo', html: `<svg viewBox="0 0 320 180" aria-hidden="true">
      <rect x="40" y="22" width="112" height="140" rx="14" fill="#fff" stroke="#16151A" stroke-width="3"/>
      <rect x="168" y="22" width="112" height="140" rx="14" fill="#fff" stroke="#16151A" stroke-width="3"/>
      <rect x="48" y="30" width="96" height="124" rx="8" fill="#FFE7DF"/><rect x="176" y="30" width="96" height="124" rx="8" fill="#E2E9FF"/>
      <rect x="140" y="64" width="8" height="56" fill="#FF5A36"/><rect x="172" y="64" width="8" height="56" fill="#3D6BFF"/>
      <path d="M86 116 C 120 90, 170 84, 214 92" fill="none" stroke="#16151A" stroke-width="3" stroke-dasharray="6 7" stroke-linecap="round"/>
      <g><circle cx="222" cy="94" r="14" fill="#16151A"/><path d="M230 82 q4 -8 10 -7" fill="none" stroke="#16151A" stroke-width="3" stroke-linecap="round"/><circle cx="241" cy="75" r="4" fill="#FF5A36"><animate attributeName="r" values="3;6;3" dur=".6s" repeatCount="indefinite"/></circle>
      ${reduceMotion ? '' : '<animateTransform attributeName="transform" type="translate" values="-136 22; 0 0; 0 0" keyTimes="0;.6;1" dur="2.4s" repeatCount="indefinite"/>'}</g>
      <text x="96" y="176" text-anchor="middle" font-weight="800" font-size="12" fill="#16151A">내 폰</text><text x="224" y="176" text-anchor="middle" font-weight="800" font-size="12" fill="#16151A">친구 폰</text></svg>` });
  }
  function showTitle(prefill) {
    leaveRoom();
    const nick = h('input', { id: 'nick', type: 'text', maxlength: '8', value: S.nick || '', placeholder: '닉네임', autocomplete: 'nickname', oninput: e => { S.nick = e.target.value; save(); } });
    const code = h('input', { id: 'code', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '4', placeholder: '0000', value: prefill || '' });
    const msg = h('p', { class: 'msg', role: 'alert' });
    const ok = window.NoliNet && window.NoliNet.available();
    const busy = (b, on, l) => { b.disabled = on; if (on) { b.dataset.l = b.textContent; b.textContent = l; } else if (b.dataset.l) b.textContent = b.dataset.l; };
    const needNick = () => { if (!cleanName(S.nick, '')) { msg.textContent = '닉네임을 입력하세요.'; nick.focus(); return true; } return false; };
    const create = h('button', { class: 'btn btn-primary', type: 'button', disabled: !ok, onclick: async e => { if (needNick()) return; const b = e.currentTarget; busy(b, true, '만드는 중'); try { ON.room = await window.NoliNet.create('ps', CODE_LO, CODE_HI); ON.isHost = true; afterJoin(); } catch (er) { busy(b, false); msg.textContent = '방을 만들지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.'; } } }, '방 만들기');
    const join = h('button', { class: 'btn', type: 'button', disabled: !ok, onclick: async e => { if (needNick()) return; const c = code.value.replace(/\D/g, ''); if (c.length !== 4) { msg.textContent = '4자리 방 코드를 입력하세요.'; code.focus(); return; } const b = e.currentTarget; busy(b, true, '연결 중'); try { ON.room = await window.NoliNet.join('ps', c); ON.isHost = false; afterJoin(); } catch (er) { busy(b, false); msg.textContent = er && er.type === 'not-found' ? '방을 찾을 수 없어요. 코드를 다시 확인해 주세요.' : '연결하지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.'; } } }, '참가하기');
    code.addEventListener('keydown', e => { if (e.key === 'Enter') join.click(); });
    showMenu(brandLink(),
      h('div', { class: 'logo', html: BOMB_SVG + '<span>넘겨!</span>' }),
      h('p', { class: 'tag' }, '폰을 맞대 붙이면 하나의 판이 돼요. 화면을 넘어 굴러다니는 폭탄을 튕겨 넘기세요.'),
      h('div', { class: 'chips' }, h('span', null, '2–8명'), h('span', null, '한 판 3분'), h('span', null, '각자 자기 폰')),
      prefill ? null : demo(),
      prefill ? null : h('ol', { class: 'howto' },
        h('li', null, h('div', null, h('b', null, '한 방에 모여요'), h('span', null, '방을 만들고 같은 자리에 있는 친구를 초대해요.'))),
        h('li', null, h('div', null, h('b', null, '폰을 테이블에 붙여요'), h('span', null, '맞닿은 두 화면을 가로질러 손가락으로 쓸면 이어져요.'))),
        h('li', null, h('div', null, h('b', null, '폭탄을 튕겨 넘겨요'), h('span', null, '내 화면에서 터지면 하트를 잃어요. 마지막까지 남으면 승리.')))),
      h('div', { class: 'field' }, h('label', { for: 'nick' }, '닉네임'), nick),
      prefill ? null : h('div', { class: 'row' }, create),
      prefill ? null : h('hr', { class: 'divider' }),
      h('div', { class: 'field' }, h('label', { for: 'code' }, prefill ? '초대받은 방' : '방 코드로 참가'), h('div', { class: 'row' }, code, join)),
      msg,
      ok ? null : h('p', { class: 'msg' }, '온라인 기능을 불러오지 못했어요. 페이지를 새로고침해 주세요.'),
      prefill ? h('button', { class: 'btn-text', type: 'button', onclick: () => { history.replaceState(null, '', location.pathname); showTitle(); } }, '처음으로') : null);
    if (prefill) (S.nick ? join : nick).focus();
  }

  // ============================================================
  // ROOM
  // ============================================================
  function leaveRoom() { if (ON.room) { try { ON.room.leave(); } catch (e) { } } ON.room = null; ON.isHost = false; ON.st = null; ON.H = null; ON.bomb = null; stopHostLoop(); }
  function hostId() { return ON.isHost ? ON.room.me : ON.room.hostId; }
  function toHost(m) { if (ON.room) ON.room.send(hostId(), m); }
  function afterJoin() {
    try { history.replaceState(null, '', '?room=' + ON.room.code); } catch (e) { }
    ON.room.presence({ name: cleanName(S.nick, '플레이어'), joinedAt: Date.now(), host: ON.isHost || null });
    ON.room.onPeers(ch => { ON.peers = ch.peers; if (ON.isHost && ON.H) hostPeersChanged(); if (!ON.st || ON.st.phase === 'lobby') lobbyView(); });
    ON.room.onMessage((d, from) => { if (!d || !d.k) return; if (ON.isHost && d.k.startsWith('h:')) hostHandle(d, from); else clientHandle(d); });
    ON.room.onStatus(st => { if (st === 'online' && !ON.isHost) { toHost({ k: 'h:hello' }); sendDims(); } if (st === 'reconnecting') toast('연결이 불안정해요. 다시 연결하는 중이에요.'); });
    if (!ON.isHost) toHost({ k: 'h:hello' });
    lobbyView();
  }
  function members() { return ON.peers.filter(p => !p.away).sort((a, b) => ((a.presence || {}).joinedAt || 0) - ((b.presence || {}).joinedAt || 0)); }
  function lobbyView() {
    if (ON.st && ON.st.phase !== 'lobby') return;
    const ms = members().slice(0, 8);
    const invite = h('button', { class: 'btn btn-primary', type: 'button', onclick: async e => { const b = e.currentTarget; const url = location.origin + location.pathname + '?room=' + ON.room.code; const text = `넘겨! 같이 해요. 방 코드 ${ON.room.code}`; if (navigator.share) { try { await navigator.share({ title: '넘겨!', text, url }); return; } catch (er) { if (er && er.name === 'AbortError') return; } } try { await navigator.clipboard.writeText(url); b.textContent = '링크를 복사했어요'; sfx('pop'); setTimeout(() => b.textContent = '초대 링크 보내기', 2000); } catch (er) { b.textContent = url; } } }, '초대 링크 보내기');
    showMenu(brandLink(),
      h('div', { class: 'roomcode' }, h('span', null, '방 코드'), h('b', null, ON.room.code)),
      h('p', { class: 'fine', style: 'margin:4px 0 14px' }, '같은 테이블에 모여 있는 사람끼리 하는 게임이에요.'),
      h('div', { class: 'row', style: 'margin-bottom:16px' }, invite),
      h('h2', null, `참가자 ${ms.length}명`),
      h('div', { class: 'players' }, ms.map((p, i) => h('div', { class: 'p' }, h('span', { class: 'dot', style: 'background:' + COLORS[i] }), cleanName((p.presence || {}).name, '플레이어'), p.sameTab ? h('span', { class: 'pill' }, '나') : null, (p.presence || {}).host ? h('span', { class: 'pill' }, '방장') : null))),
      ON.isHost ? h('button', { class: 'btn btn-primary', type: 'button', disabled: ms.length < 2, onclick: hostOpenLink }, ms.length < 2 ? '2명 이상 모이면 시작할 수 있어요' : '폰 연결하러 가기')
        : h('p', { class: 'fine' }, '방장이 시작하면 바로 폰 연결 화면으로 넘어가요.'),
      h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'btn-text', type: 'button', onclick: () => { history.replaceState(null, '', location.pathname); showTitle(); } }, '방 나가기')));
  }

  // ============================================================
  // HOST (authoritative simulation)
  // ============================================================
  let hostTimer = null, lastBombSend = 0;
  function stopHostLoop() { if (hostTimer) clearInterval(hostTimer); hostTimer = null; }
  function hostOpenLink() {
    const ms = members().slice(0, 8);
    const prev = ON.H;
    ON.H = { phase: 'link', players: ms.map((p, i) => ({ peer: p.peer, name: cleanName((p.presence || {}).name, '플레이어'), color: COLORS[i], w: 0, h: 0, alive: true, hearts: 3 })), links: [], exits: [], enters: [], bomb: null, fuseTotal: 11, winner: null, round: 0 };
    if (prev && prev.players) for (const p of ON.H.players) { const o = prev.players.find(x => x.peer === p.peer); if (o) { p.w = o.w; p.h = o.h; } }
    hostBroadcast(); stopHostLoop(); hostTimer = setInterval(hostTick, 16);
  }
  function pidx(peer) { return ON.H ? ON.H.players.findIndex(p => p.peer === peer) : -1; }
  function hostPublic() { const H = ON.H; return { k: 'state', phase: H.phase, players: H.players.map(p => ({ peer: p.peer, name: p.name, color: p.color, w: p.w, h: p.h, alive: p.alive, hearts: p.hearts })), links: H.links, winner: H.winner, connected: connectedAll(), round: H.round }; }
  function hostBroadcast() { if (ON.H) ON.room.broadcast(hostPublic()); }
  function hostPeersChanged() { /* players who leave keep their seat; the board still has their phone */ }
  function connectedAll() { const H = ON.H; if (!H || H.players.length < 2) return false; const seen = new Set([0]); const q = [0]; while (q.length) { const a = q.pop(); for (const l of H.links) { const o = l.a === a ? l.b : l.b === a ? l.a : -1; if (o >= 0 && !seen.has(o)) { seen.add(o); q.push(o); } } } return seen.size === H.players.length && H.players.every(p => p.w > 0); }
  function hostHandle(d, from) {
    const H = ON.H;
    if (d.k === 'h:hello') { if (H) ON.room.send(from, hostPublic()); return; }
    if (!H) return; const p = pidx(from); if (p < 0) return; const now = Date.now();
    if (d.k === 'h:dims') { H.players[p].w = Math.max(200, Math.min(2000, d.w | 0)); H.players[p].h = Math.max(300, Math.min(3000, d.h | 0)); hostBroadcast(); return; }
    if (d.k === 'h:exit' && H.phase === 'link' && OPP[d.edge]) { H.exits.push({ p, edge: d.edge, pos: +d.pos || 0, t: now }); hostPair(); return; }
    if (d.k === 'h:enter' && H.phase === 'link' && OPP[d.edge]) { H.enters.push({ p, edge: d.edge, pos: +d.pos || 0, t: now }); hostPair(); return; }
    if (d.k === 'h:reset' && from === ON.room.me && H.phase === 'link') { H.links = []; hostBroadcast(); return; }
    if (d.k === 'h:start' && from === ON.room.me && (H.phase === 'link' || H.phase === 'over') && connectedAll()) { hostStartGame(); return; }
    if (d.k === 'h:relink' && from === ON.room.me) { H.phase = 'link'; H.links = []; H.bomb = null; hostBroadcast(); return; }
    if (d.k === 'h:flick' && H.phase === 'play' && H.bomb && H.bomb.p === p) {
      const b = H.bomb; let vx = +d.vx || 0, vy = +d.vy || 0; const sp = Math.hypot(vx, vy); if (sp > MAXV) { vx *= MAXV / sp; vy *= MAXV / sp; }
      const P = H.players[p]; b.x = Math.max(BR, Math.min(P.w - BR, +d.x || b.x)); b.y = Math.max(BR, Math.min(P.h - BR, +d.y || b.y)); b.vx = vx; b.vy = vy; hostSendBomb(true);
    }
  }
  function hostPair() {
    const H = ON.H; const now = Date.now();
    H.exits = H.exits.filter(e => now - e.t < 1500); H.enters = H.enters.filter(e => now - e.t < 1500);
    for (const ex of H.exits.slice()) for (const en of H.enters.slice()) {
      if (ex.p === en.p || OPP[ex.edge] !== en.edge || Math.abs(en.t - ex.t) > 1200) continue;
      H.links = H.links.filter(l => !((l.a === ex.p && l.b === en.p) || (l.a === en.p && l.b === ex.p)));
      H.links.push({ a: ex.p, ea: ex.edge, b: en.p, eb: en.edge, off: Math.round(en.pos - ex.pos) });
      H.exits.splice(H.exits.indexOf(ex), 1); H.enters.splice(H.enters.indexOf(en), 1);
      ON.room.broadcast({ k: 'linked', a: ex.p, b: en.p });
      hostBroadcast(); return;
    }
  }
  function hostStartGame() {
    const H = ON.H; H.players.forEach(p => { p.alive = true; p.hearts = 3; }); H.fuseTotal = 11; H.round = 1; H.winner = null; H.phase = 'play'; H.bomb = null;
    hostBroadcast(); setTimeout(hostSpawn, 1200);
  }
  function hostSpawn() {
    const H = ON.H; if (!H || H.phase !== 'play') return;
    const alive = H.players.map((p, i) => i).filter(i => H.players[i].alive);
    const p = alive[Math.floor(Math.random() * alive.length)]; const P = H.players[p];
    const ang = Math.random() * Math.PI * 2;
    H.bomb = { p, x: P.w / 2, y: P.h / 2, vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260, fuse: H.fuseTotal * (0.75 + Math.random() * 0.5), total: 0 };
    H.bomb.total = H.bomb.fuse;
    hostSendBomb(true);
  }
  function linkAt(p, edge, pos) {
    const H = ON.H;
    for (const l of H.links) {
      let q = -1, off = 0;
      if (l.a === p && l.ea === edge) { q = l.b; off = l.off; } else if (l.b === p && l.eb === edge) { q = l.a; off = -l.off; } else continue;
      const Q = H.players[q]; const len = (edge === 'left' || edge === 'right') ? Q.h : Q.w; const pq = pos + off;
      if (pq >= -6 && pq <= len + 6) return { q, pos: Math.max(BR * 0.6, Math.min(len - BR * 0.6, pq)) };
    }
    return null;
  }
  function hostTick() {
    const H = ON.H; if (!H || H.phase !== 'play' || !H.bomb) return;
    const b = H.bomb; const dt = 0.016; const P = H.players[b.p];
    const k = Math.exp(-FRICTION * dt); b.vx *= k; b.vy *= k; if (Math.hypot(b.vx, b.vy) < 8) { b.vx = 0; b.vy = 0; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    // horizontal edges
    if (b.x < BR && b.vx < 0) { const L = linkAt(b.p, 'left', b.y); if (!L) { b.x = BR; b.vx = -b.vx * 0.75; sfxBounce(); } else if (b.x < 0) { const Q = H.players[L.q]; b.p = L.q; b.x = Q.w + b.x; b.y = L.pos; hostSendBomb(true); } }
    else if (b.x > P.w - BR && b.vx > 0) { const L = linkAt(b.p, 'right', b.y); if (!L) { b.x = P.w - BR; b.vx = -b.vx * 0.75; } else if (b.x > P.w) { b.x = b.x - P.w; b.p = L.q; b.y = L.pos; hostSendBomb(true); } }
    const P2 = H.players[b.p];
    if (b.y < BR && b.vy < 0) { const L = linkAt(b.p, 'top', b.x); if (!L) { b.y = BR; b.vy = -b.vy * 0.75; } else if (b.y < 0) { const Q = H.players[L.q]; b.p = L.q; b.y = Q.h + b.y; b.x = L.pos; hostSendBomb(true); } }
    else if (b.y > P2.h - BR && b.vy > 0) { const L = linkAt(b.p, 'bottom', b.x); if (!L) { b.y = P2.h - BR; b.vy = -b.vy * 0.75; } else if (b.y > P2.h) { b.y = b.y - P2.h; b.p = L.q; b.x = L.pos; hostSendBomb(true); } }
    b.fuse -= dt;
    if (b.fuse <= 0) { hostBoom(); return; }
    if (Date.now() - lastBombSend > 50) hostSendBomb(false);
  }
  function sfxBounce() { }
  function hostSendBomb() { const b = ON.H.bomb; lastBombSend = Date.now(); ON.room.broadcast({ k: 'b', p: b.p, x: Math.round(b.x), y: Math.round(b.y), vx: Math.round(b.vx), vy: Math.round(b.vy), f: +(b.fuse / b.total).toFixed(3), fl: +b.fuse.toFixed(2) }); }
  function hostBoom() {
    const H = ON.H; const p = H.bomb.p; const P = H.players[p]; let hurt = false;
    if (P.alive) { P.hearts--; hurt = true; if (P.hearts <= 0) P.alive = false; }
    H.bomb = null; ON.room.broadcast({ k: 'boom', p, hurt });
    const alive = H.players.filter(x => x.alive);
    if (alive.length <= 1) { H.phase = 'over'; H.winner = alive.length ? H.players.indexOf(alive[0]) : null; setTimeout(hostBroadcast, 900); return; }
    H.fuseTotal = Math.max(4.5, H.fuseTotal * 0.88); H.round++;
    hostBroadcast(); setTimeout(hostSpawn, 2000);
  }

  // ============================================================
  // CLIENT (every phone, host included)
  // ============================================================
  function myIndex() { return ON.st ? ON.st.players.findIndex(p => p.peer === ON.room.me) : -1; }
  function clientHandle(d) {
    if (d.k === 'state') {
      const prev = ON.st; ON.st = d;
      if (d.phase !== 'lobby') { if (!stage.classList.contains('on')) enterStage(); renderOverlay(); }
      if (prev && prev.phase !== d.phase && d.phase === 'play') { sfx('flip'); }
      if (d.phase === 'over' && (!prev || prev.phase !== 'over')) { sfx(d.winner === myIndex() ? 'win' : 'lose'); }
      return;
    }
    if (d.k === 'b') { const was = ON.bomb && ON.bomb.p; ON.bomb = { p: d.p, x: d.x, y: d.y, vx: d.vx, vy: d.vy, f: d.f, fl: d.fl, t: performance.now() }; if (d.p === myIndex() && was !== d.p) sfx('pop'); return; }
    if (d.k === 'boom') { ON.bomb = null; const mine = d.p === myIndex(); ON.boomFx = performance.now(); ON.boomMine = mine; ON.boomWho = d.p; if (mine) sfx('stamp'); else sfx('hit'); return; }
    if (d.k === 'linked') { const me = myIndex(); if (d.a === me || d.b === me) { sfx('pop'); ON.linkFx.push({ t: performance.now(), with: d.a === me ? d.b : d.a }); } return; }
  }

  // ---------- stage ----------
  let dpr = 1, W = 0, Hh = 0, raf = 0, wake = null;
  function enterStage() {
    menu.hidden = true; stage.classList.add('on'); resize(); sendDims(); requestWake();
    if (!raf) raf = requestAnimationFrame(loop);
  }
  async function requestWake() { try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { } }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && stage.classList.contains('on')) requestWake(); });
  function resize() { dpr = Math.min(3, window.devicePixelRatio || 1); W = window.innerWidth; Hh = window.innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr); }
  window.addEventListener('resize', () => { if (stage.classList.contains('on')) { resize(); sendDims(); } });
  function sendDims() { if (ON.room) toHost({ k: 'h:dims', w: Math.round(window.innerWidth), h: Math.round(window.innerHeight) }); }

  function renderOverlay() {
    const st = ON.st; const me = myIndex(); hud.innerHTML = ''; banner.innerHTML = ''; ctrl.innerHTML = '';
    if (me < 0) { banner.append(h('h3', null, '이미 시작된 판이에요'), h('p', null, '다음 판부터 함께할 수 있어요.')); ctrl.append(h('button', { class: 'btn', type: 'button', onclick: () => { showTitle(); } }, '나가기')); return; }
    const P = st.players[me];
    hud.append(h('span', { class: 'dot', style: 'background:' + P.color }), h('span', { class: 'name' }, P.name));
    if (st.phase !== 'link') hud.append(h('span', { class: 'hearts', 'aria-label': `하트 ${P.hearts}개` }, P.alive ? '♥'.repeat(P.hearts) + '♡'.repeat(Math.max(0, 3 - P.hearts)) : '탈락'));
    if (st.phase === 'link') {
      const mine = st.links.filter(l => l.a === me || l.b === me).length;
      banner.append(h('h3', null, mine ? '연결됐어요' : '옆 폰과 연결하세요'), h('p', null, mine ? '다른 폰도 모두 이어지면 시작할 수 있어요.' : '폰을 맞대 놓고, 두 화면을 가로질러 손가락으로 한 번에 쓸어 주세요.'));
      if (ON.isHost) ctrl.append(h('button', { class: 'btn', type: 'button', onclick: () => toHost({ k: 'h:reset' }) }, '연결 초기화'), h('button', { class: 'btn btn-primary', type: 'button', disabled: !st.connected, onclick: () => toHost({ k: 'h:start' }) }, st.connected ? '시작하기' : `${countLinked(st)}/${st.players.length} 연결됨`));
    } else if (st.phase === 'over') {
      const w = st.winner; banner.append(h('h3', null, w === me ? '살아남았어요!' : w != null ? `${st.players[w].name} 승리` : '모두 펑!'), h('p', null, '폰을 그대로 두면 바로 한 판 더 할 수 있어요.'));
      if (ON.isHost) ctrl.append(h('button', { class: 'btn', type: 'button', onclick: () => toHost({ k: 'h:relink' }) }, '배치 바꾸기'), h('button', { class: 'btn btn-primary', type: 'button', onclick: () => toHost({ k: 'h:start' }) }, '한 판 더'));
      ctrl.append(h('button', { class: 'btn', type: 'button', onclick: () => { history.replaceState(null, '', location.pathname); stage.classList.remove('on'); showTitle(); } }, '나가기'));
    } else if (st.phase === 'play' && !P.alive) {
      banner.append(h('h3', null, '탈락'), h('p', null, '폰은 그대로 두세요. 폭탄은 계속 지나가요.'));
    }
  }
  function countLinked(st) { const s = new Set(); st.links.forEach(l => { s.add(l.a); s.add(l.b); }); return s.size; }

  // ---------- input ----------
  let ptr = null;
  function edgeOf(x, y) { const d = [['left', x], ['right', W - x], ['top', y], ['bottom', Hh - y]].sort((a, b) => a[1] - b[1])[0]; return d[1] <= EDGE ? d[0] : null; }
  const along = (edge, x, y) => (edge === 'left' || edge === 'right') ? y : x;
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    e.preventDefault(); try { stage.setPointerCapture(e.pointerId); } catch (er) { }
    ptr = { id: e.pointerId, pts: [{ x: e.clientX, y: e.clientY, t: performance.now() }], startEdge: edgeOf(e.clientX, e.clientY), entered: false, grab: false };
    const st = ON.st; const me = myIndex();
    if (st && st.phase === 'play' && ON.bomb && ON.bomb.p === me) { const b = bombPos(); if (b && Math.hypot(b.x - e.clientX, b.y - e.clientY) < BR * 2.2) { ptr.grab = true; ON.grabbed = true; } }
  });
  stage.addEventListener('pointermove', e => {
    if (!ptr || e.pointerId !== ptr.id) return;
    const p = { x: e.clientX, y: e.clientY, t: performance.now() }; ptr.pts.push(p); if (ptr.pts.length > 30) ptr.pts.shift();
    const st = ON.st;
    if (st && st.phase === 'link' && ptr.startEdge && !ptr.entered) {
      const s = ptr.pts[0]; const dx = p.x - s.x, dy = p.y - s.y; const dist = Math.hypot(dx, dy);
      if (dist > 14) { const away = { left: dx > 0, right: dx < 0, top: dy > 0, bottom: dy < 0 }[ptr.startEdge]; if (away) { ptr.entered = true; toHost({ k: 'h:enter', edge: ptr.startEdge, pos: along(ptr.startEdge, s.x, s.y) }); } }
    }
  });
  function endPtr(e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    const pts = ptr.pts; const last = pts[pts.length - 1]; const now = performance.now();
    const recent = pts.filter(q => now - q.t < 110); const a = recent[0] || last; const dtp = Math.max(0.016, (last.t - a.t) / 1000);
    const vx = (last.x - a.x) / dtp, vy = (last.y - a.y) / dtp;
    const st = ON.st;
    if (st && st.phase === 'link') {
      const ed = edgeOf(last.x, last.y);
      if (ed && pts.length > 2) { const toward = { left: vx < -80, right: vx > 80, top: vy < -80, bottom: vy > 80 }[ed]; if (toward) toHost({ k: 'h:exit', edge: ed, pos: along(ed, last.x, last.y) }); }
    }
    if (st && st.phase === 'play' && ptr.grab) {
      const b = bombPos(); const sp = Math.hypot(vx, vy);
      if (b && sp > 60) { toHost({ k: 'h:flick', x: b.x, y: b.y, vx: vx * 1.15, vy: vy * 1.15 }); sfx('tap'); if (ON.bomb) { ON.bomb.vx = vx; ON.bomb.vy = vy; ON.bomb.x = b.x; ON.bomb.y = b.y; ON.bomb.t = now; } }
    }
    ptr = null; ON.grabbed = false;
  }
  stage.addEventListener('pointerup', endPtr); stage.addEventListener('pointercancel', endPtr);

  // ---------- drawing ----------
  function bombPos() {
    const b = ON.bomb; if (!b) return null; const dt = Math.min(0.25, (performance.now() - b.t) / 1000);
    const k = (1 - Math.exp(-FRICTION * dt)) / FRICTION;
    let x = b.x + b.vx * k, y = b.y + b.vy * k;
    x = Math.max(-BR, Math.min(W + BR, x)); y = Math.max(-BR, Math.min(Hh + BR, y));
    return { x, y, f: b.f - dt / Math.max(0.5, (b.fl || 5) / Math.max(0.01, b.f)) };
  }
  let lastTick = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const st = ON.st; if (!st) return; const me = myIndex(); const P = me >= 0 ? st.players[me] : null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // tile
    ctx.fillStyle = '#FFFDF5'; ctx.fillRect(0, 0, W, Hh);
    if (P) { ctx.fillStyle = P.color; ctx.globalAlpha = 0.12; ctx.fillRect(0, 0, W, Hh); ctx.globalAlpha = 1; }
    // floor grid
    ctx.strokeStyle = 'rgba(22,21,26,.06)'; ctx.lineWidth = 1; for (let x = 24; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, Hh); ctx.stroke(); } for (let y = 24; y < Hh; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // walls & links
    ctx.lineWidth = 10; ctx.strokeStyle = '#16151A'; ctx.strokeRect(5, 5, W - 10, Hh - 10);
    if (me >= 0) for (const l of st.links) {
      let edge, q, off; if (l.a === me) { edge = l.ea; q = l.b; off = l.off; } else if (l.b === me) { edge = l.eb; q = l.a; off = -l.off; } else continue;
      const Q = st.players[q]; const qlen = (edge === 'left' || edge === 'right') ? Q.h : Q.w; const mylen = (edge === 'left' || edge === 'right') ? Hh : W;
      const s0 = Math.max(0, -off), s1 = Math.min(mylen, qlen - off); if (s1 <= s0) continue;
      ctx.strokeStyle = '#FFFDF5'; ctx.lineWidth = 14; line(edge, s0, s1);
      ctx.strokeStyle = Q.color; ctx.lineWidth = 8; ctx.setLineDash([14, 10]); line(edge, s0, s1); ctx.setLineDash([]);
      ctx.fillStyle = Q.color; ctx.font = '800 13px ' + getComputedStyle(document.body).fontFamily; const mid = (s0 + s1) / 2; label(edge, mid, Q.name);
    }
    // link-phase hint arrows
    if (st.phase === 'link') { const t = (now / 900) % 1; ctx.fillStyle = 'rgba(22,21,26,.25)'; for (const e of ['left', 'right', 'top', 'bottom']) arrow(e, t); }
    // mini map
    if (st.phase === 'link' || st.phase === 'over') drawMap(st, me);
    // bomb
    const b = bombPos();
    if (b && ON.bomb && ON.bomb.p === me && st.phase === 'play') {
      const f = Math.max(0, b.f); const danger = f < 0.3;
      if (danger) { ctx.fillStyle = '#FF3B30'; ctx.globalAlpha = 0.12 + 0.12 * Math.sin(now / (60 + 200 * f)); ctx.fillRect(0, 0, W, Hh); ctx.globalAlpha = 1; }
      drawBomb(b.x, b.y, f, now, ON.grabbed);
      const iv = 120 + 700 * f; if (now - lastTick > iv) { lastTick = now; sfx('tick'); }
    }
    // explosion
    const ft = now - ON.boomFx;
    if (ON.boomFx && ft < 1400) {
      const a = 1 - ft / 1400;
      if (ON.boomMine) { ctx.fillStyle = `rgba(255,59,48,${0.85 * a})`; ctx.fillRect(0, 0, W, Hh); ctx.fillStyle = `rgba(22,21,26,${a})`; ctx.font = '900 ' + Math.round(Math.min(W, Hh) * 0.28) + 'px ' + getComputedStyle(document.body).fontFamily; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('펑!', W / 2, Hh / 2); }
      else if (st.players[ON.boomWho]) { ctx.fillStyle = `rgba(22,21,26,${a})`; ctx.font = '800 18px ' + getComputedStyle(document.body).fontFamily; ctx.textAlign = 'center'; ctx.fillText(`${st.players[ON.boomWho].name} 펑!`, W / 2, 90); }
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      if (ft > 700 && ON.boomMine && !ON.boomHud) { ON.boomHud = true; renderOverlay(); }
    } else ON.boomHud = false;
    // link flash
    ON.linkFx = ON.linkFx.filter(x => now - x.t < 900);
    for (const fx of ON.linkFx) { const a = 1 - (now - fx.t) / 900; const Q = st.players[fx.with]; if (!Q) continue; ctx.fillStyle = Q.color; ctx.globalAlpha = 0.35 * a; ctx.fillRect(0, 0, W, Hh); ctx.globalAlpha = 1; }
  }
  function line(edge, s0, s1) { ctx.beginPath(); if (edge === 'left') { ctx.moveTo(5, s0); ctx.lineTo(5, s1); } else if (edge === 'right') { ctx.moveTo(W - 5, s0); ctx.lineTo(W - 5, s1); } else if (edge === 'top') { ctx.moveTo(s0, 5); ctx.lineTo(s1, 5); } else { ctx.moveTo(s0, Hh - 5); ctx.lineTo(s1, Hh - 5); } ctx.stroke(); }
  function label(edge, m, text) { ctx.save(); if (edge === 'left') { ctx.translate(26, m); ctx.rotate(-Math.PI / 2); } else if (edge === 'right') { ctx.translate(W - 26, m); ctx.rotate(Math.PI / 2); } else if (edge === 'top') ctx.translate(m, 30); else ctx.translate(m, Hh - 22); ctx.textAlign = 'center'; ctx.fillText(text, 0, 0); ctx.restore(); }
  function arrow(edge, t) {
    const s = 10; ctx.save();
    const pos = { left: [18 + 10 * t, Hh / 2, Math.PI], right: [W - 18 - 10 * t, Hh / 2, 0], top: [W / 2, 60 + 10 * t, -Math.PI / 2], bottom: [W / 2, Hh - 18 - 10 * t, Math.PI / 2] }[edge];
    ctx.translate(pos[0], pos[1]); ctx.rotate(pos[2]); ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s, -s); ctx.lineTo(-s, s); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function drawBomb(x, y, f, now, grabbed) {
    ctx.save(); ctx.translate(x, y); const sc = grabbed ? 1.08 : 1; ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(22,21,26,.18)'; ctx.beginPath(); ctx.ellipse(4, BR - 2, BR * 0.9, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16151A'; ctx.beginPath(); ctx.arc(0, 0, BR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.arc(-11, -11, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#16151A'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(14, -26); ctx.quadraticCurveTo(22, -44 + 8 * (1 - f), 34, -40); ctx.stroke();
    const flick = 6 + 4 * Math.sin(now / (40 + 120 * f)); ctx.fillStyle = f < 0.3 ? '#FF3B30' : '#FFB020'; ctx.beginPath(); ctx.arc(35, -41, flick, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFF4C2'; ctx.beginPath(); ctx.arc(35, -41, flick * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function layout(st) {
    const pos = { 0: { x: 0, y: 0 } }; const q = [0]; const P = st.players;
    while (q.length) { const a = q.shift(); for (const l of st.links) { let b, ea, off; if (l.a === a) { b = l.b; ea = l.ea; off = l.off; } else if (l.b === a) { b = l.a; ea = l.eb; off = -l.off; } else continue; if (pos[b]) continue; const A = pos[a], B = P[b], AA = P[a];
      if (ea === 'right') pos[b] = { x: A.x + AA.w + 6, y: A.y - off }; else if (ea === 'left') pos[b] = { x: A.x - B.w - 6, y: A.y - off }; else if (ea === 'bottom') pos[b] = { x: A.x - off, y: A.y + AA.h + 6 }; else pos[b] = { x: A.x - off, y: A.y - B.h - 6 }; q.push(b); } }
    return pos;
  }
  function drawMap(st, me) {
    if (!st.players.length || !st.players[0].w) return;
    const pos = layout(st); const ids = Object.keys(pos).map(Number); if (!ids.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const i of ids) { const P = st.players[i]; x0 = Math.min(x0, pos[i].x); y0 = Math.min(y0, pos[i].y); x1 = Math.max(x1, pos[i].x + P.w); y1 = Math.max(y1, pos[i].y + P.h); }
    const boxW = Math.min(W * 0.62, 260), boxH = Math.min(Hh * 0.26, 220); const sc = Math.min(boxW / (x1 - x0), boxH / (y1 - y0));
    const ox = (W - (x1 - x0) * sc) / 2, oy = Hh - 120 - (y1 - y0) * sc;
    ctx.save();
    for (const i of ids) { const P = st.players[i]; const rx = ox + (pos[i].x - x0) * sc, ry = oy + (pos[i].y - y0) * sc; ctx.fillStyle = P.color; ctx.globalAlpha = i === me ? 1 : 0.75; roundRect(rx, ry, P.w * sc, P.h * sc, 6); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = '#16151A'; ctx.lineWidth = i === me ? 3 : 1.5; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = '800 11px ' + getComputedStyle(document.body).fontFamily; ctx.textAlign = 'center'; ctx.fillText(P.name, rx + P.w * sc / 2, ry + P.h * sc / 2 + 4); }
    ctx.textAlign = 'start'; ctx.restore();
  }
  function roundRect(x, y, w, h2, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h2, r); ctx.arcTo(x + w, y + h2, x, y + h2, r); ctx.arcTo(x, y + h2, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // ============================================================
  // BOOT
  // ============================================================
  const room = (new URLSearchParams(location.search).get('room') || '').replace(/\D/g, '').slice(0, 4);
  showTitle(room.length === 4 ? room : '');
  window.__pass = { get ON() { return ON; }, get W() { return W; }, get H() { return Hh; } };
})();
