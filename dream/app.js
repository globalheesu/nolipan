(function () {
  'use strict';
  // ============================================================
  // 꿈 사세요 — the grand edition of 깜깜이 시장
  // Face (dream marble): everyone but the seller sees kind + clarity 1-6.
  // Afterglow (여운): only the seller remembers it, -2..6 (negatives are nightmare residue).
  // Value = clarity + afterglow. Three acts, each player sells twice per act.
  // Secret orders: 3 of a kind +16, 2 of one + 1 of another +12. (Simulation-validated.)
  // ============================================================
  const CODE_LO = 3000, CODE_HI = 3999;
  const KINDS = [
    { name: '용꿈', short: '용', color: '#2F8C7A' },
    { name: '돼지꿈', short: '돼지', color: '#D46A86' },
    { name: '불꿈', short: '불', color: '#D9572F' },
    { name: '달꿈', short: '달', color: '#3E58B0' },
  ];
  const ACTS = [
    { name: '초저녁', line: '막 잠든 사람들의 꿈이 장에 나왔어요. 아직 다들 조심스러워요.' },
    { name: '한밤', line: '깊은 잠의 꿈은 선명해요. 흉몽 기운도 짙어지는 시간이에요.' },
    { name: '새벽', line: '닭이 울기 전에 장이 닫혀요. 의뢰받은 꿈을 마저 모으세요.' },
  ];
  const SET_BONUS = [0, 0, 2, 5, 9, 14, 20, 27, 35];
  const COINS = 25, SALES_PER_ACT = 2, FINE_SLACK = 2, MIN_START = 3, MAX_START = 16, TRI_PTS = 16, PAIR_PTS = 12;
  const TRI_CLIENTS = ['과거 보러 가는 선비', '장사 밑천 구하는 객주', '새 가마를 여는 도공', '먼 바다로 나가는 뱃사공'];
  const PAIR_CLIENTS = ['혼례를 앞둔 신부', '아기를 기다리는 부부', '새 집 짓는 목수', '길 떠나는 나그네', '그림 그리는 화원', '주막집 주모', '장터의 광대', '약초 캐는 의원', '글 읽는 도령', '소원 비는 할머니', '줄 타는 어름사니', '대장간 막내'];
  const BOT_NAMES = ['청운', '해월', '단오', '소담'];
  const SPEEDS = { slow: { label: '느긋하게', tick: 1400, react: [900, 1800], ann: 25000 }, normal: { label: '보통', tick: 1000, react: [500, 1200], ann: 18000 }, fast: { label: '빠르게', tick: 750, react: [250, 800], ann: 12000 } };

  // ---------- helpers ----------
  function h(tag, attrs, ...kids) { const el = document.createElement(tag); if (attrs) for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') el.className = v; else if (k === 'style') el.style.cssText = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'html') el.innerHTML = v; else el.setAttribute(k, v === true ? '' : v); } for (const kid of kids.flat()) { if (kid == null || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); } return el; }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('dream:' + k)); localStorage.setItem('dream:' + k, JSON.stringify(v)); } catch (e) { return null; } }
  function cleanName(x, fb) { const t = String(x || '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g, '').trim().slice(0, 8); return t || fb; }
  const sfx = n => window.NoliSFX && window.NoliSFX.play(n);
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function toast(t) { document.querySelectorAll('.toast').forEach(x => x.remove()); const el = h('div', { class: 'toast', role: 'status' }, t); document.body.append(el); setTimeout(() => el.remove(), 3200); }
  function josa(w, a, b) { const c = String(w).charCodeAt(String(w).length - 1); if (c < 0xAC00 || c > 0xD7A3) return w + a + '(' + b + ')'; return w + (((c - 0xAC00) % 28) ? a : b); }
  const setBonus = n => SET_BONUS[Math.min(n, SET_BONUS.length - 1)];
  const kindCount = (items, k) => items.filter(x => x.k === k).length;
  const orderDone = (o, items) => o.t === 'tri' ? kindCount(items, o.a) >= 3 : kindCount(items, o.a) >= 2 && kindCount(items, o.b) >= 1;
  const orderNeed = o => o.t === 'tri' ? [[o.a, 3]] : [[o.a, 2], [o.b, 1]];
  const setPts = items => [0, 1, 2, 3].reduce((a, k) => a + setBonus(kindCount(items, k)), 0);
  const itemPts = items => items.reduce((a, x) => a + x.v + x.s, 0);
  const orderPts = (orders, items) => orders.reduce((a, o) => a + (orderDone(o, items) ? o.pts : 0), 0);

  // ---------- art ----------
  const MOTIF = [
    // dragon with a pearl
    '<path d="M20 66 C 28 44, 44 72, 54 52 S 72 30, 80 42" fill="none" stroke="#FFF6E2" stroke-width="7" stroke-linecap="round"/><path d="M78 40 l8 -6 M80 46 l9 1" stroke="#FFF6E2" stroke-width="3.5" stroke-linecap="round"/><circle cx="30" cy="32" r="8" fill="#FFD66B"/><circle cx="28" cy="30" r="2.5" fill="#FFF6E2"/>',
    // pig
    '<path d="M34 34 l-4 -12 l12 8 Z M66 34 l4 -12 l-12 8 Z" fill="#FFF6E2"/><circle cx="50" cy="54" r="22" fill="#FFF6E2"/><ellipse cx="50" cy="60" rx="10" ry="7" fill="#F2B8C8"/><circle cx="46" cy="60" r="2" fill="#7A2E44"/><circle cx="54" cy="60" r="2" fill="#7A2E44"/><circle cx="42" cy="48" r="2.4" fill="#7A2E44"/><circle cx="58" cy="48" r="2.4" fill="#7A2E44"/>',
    // flame
    '<path d="M50 18 C 64 36, 72 46, 68 62 C 66 75, 58 82, 50 82 C 39 82, 31 74, 33 61 C 35 50, 44 47, 46 38 C 50 45, 55 49, 53 58 C 60 52, 60 38, 50 18 Z" fill="#FFF6E2"/><path d="M50 56 C 56 63, 56 72, 50 75 C 44 72, 45 64, 50 56 Z" fill="#FFD66B"/>',
    // moon over waves
    '<path d="M60 22 A 20 20 0 1 0 60 62 A 15 15 0 1 1 60 22 Z" fill="#FFF6E2"/><path d="M18 72 q8 -7 16 0 t16 0 t16 0 t16 0" fill="none" stroke="#FFF6E2" stroke-width="4" stroke-linecap="round"/><path d="M26 81 q8 -6 16 0 t16 0 t16 0" fill="none" stroke="#FFF6E2" stroke-width="3" stroke-linecap="round" opacity=".7"/>',
  ];
  function orbSVG(k, cls) {
    const c = KINDS[k].color;
    return `<svg class="${cls || 'orb'}" viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="og${k}" cx="36%" cy="32%" r="75%"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".35" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity=".85"/></radialGradient></defs><circle cx="50" cy="50" r="46" fill="url(#og${k})"/><circle cx="50" cy="50" r="46" fill="none" stroke="#1D1A16" stroke-width="3"/>${MOTIF[k]}<ellipse cx="34" cy="26" rx="12" ry="6" fill="#fff" opacity=".35" transform="rotate(-25 34 26)"/></svg>`;
  }
  function mysteryOrb(cls) { return `<svg class="${cls || 'orb'}" viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="ogq" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#8E8FD8"/><stop offset="1" stop-color="#2A2F66"/></radialGradient></defs><circle cx="50" cy="50" r="46" fill="url(#ogq)" stroke="#0B0F22" stroke-width="3"/><circle cx="34" cy="30" r="10" fill="#fff" opacity=".18"/></svg>`; }
  function dreamCard(f, small) {
    if (!f) return h('div', { class: 'dcard unknown' + (small ? ' small' : ''), 'aria-label': '내 꿈: 나만 몰라요', html: mysteryOrb() + '<span class="q">?</span>' });
    return h('div', { class: 'dcard' + (small ? ' small' : ''), 'aria-label': `${KINDS[f.k].name} 선명함 ${f.v}`, html: `<span class="kn" style="color:${KINDS[f.k].color}">${KINDS[f.k].name}</span>${orbSVG(f.k)}<span class="vv">${f.v}</span>` });
  }
  function slip(v, small) {
    const hidden = v == null;
    return h('div', { class: 'slip' + (hidden ? ' hidden' : '') + (small ? ' small' : ''), 'aria-label': hidden ? '여운: 판 사람만 기억해요' : `여운 ${v}` },
      h('span', { class: 'lb' }, '여운'), h('span', { class: 'vv' }, hidden ? '?' : (v > 0 ? '+' + v : v)), !hidden && v < 0 ? h('span', { class: 'stamp', 'aria-hidden': 'true' }, '흉') : null);
  }
  function orderEl(o, items) {
    const done = items ? orderDone(o, items) : false;
    return h('div', { class: 'order' + (done ? ' done' : '') },
      h('span', { class: 'who' }, o.who),
      h('span', { class: 'pts' }, '+' + o.pts, h('small', null, done ? '완성' : '의뢰')),
      h('span', { class: 'need' }, orderNeed(o).map(([k, n]) => h('span', { style: 'display:inline-flex;align-items:center;gap:4px;color:' + KINDS[k].color }, h('b', null, KINDS[k].short), h('span', { class: 'pip' }, Array.from({ length: n }, (_, i) => h('i', { class: items && kindCount(items, k) > i ? 'on' : null })))))));
  }

  const app = document.getElementById('app');
  let S = Object.assign({ nick: '', speed: 'normal' }, store('settings') || {});
  const save = () => store('settings', S);
  const speed = () => SPEEDS[S.speed] || SPEEDS.normal;
  const tipsOn = () => S.tips !== false;
  const ON = { room: null, isHost: false, solo: false, peers: [], st: null, H: null, bots: 0, seenAct: -1 };

  // ============================================================
  // MENU
  // ============================================================
  function brand(dark) { return h('a', { class: 'brand', href: '../', 'aria-label': '놀이판 홈', style: dark ? 'color:var(--ink)' : null }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), '놀이판'); }
  function speedSeg() { const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': '속도' }); const draw = () => { wrap.innerHTML = ''; Object.entries(SPEEDS).forEach(([k, v]) => wrap.append(h('button', { type: 'button', role: 'radio', 'aria-checked': S.speed === k ? 'true' : 'false', class: S.speed === k ? 'on' : null, onclick: () => { S.speed = k; save(); draw(); } }, v.label))); }; draw(); return wrap; }
  function rulesList() {
    return h('ol', { class: 'rules' },
      h('li', null, h('div', null, h('b', null, '꿈은 구슬과 여운으로 되어 있어요'), h('span', null, '꿈 구슬(종류와 선명함 1~6)은 남들만 봐요. 여운(−2~6)은 판 사람만 기억해요. 꿈 값은 둘을 더한 값이고, 여운이 음수면 흉몽이에요.'))),
      h('li', null, h('div', null, h('b', null, '파는 사람이 시작가를 불러요'), h('span', null, '여운이 좋은 척 비싸게 불러도 돼요. 다만 시작가가 꿈 값보다 3 이상 높았는데 남이 사 가면, 넘친 만큼 허풍 벌금을 내요.'))),
      h('li', null, h('div', null, h('b', null, '값이 떨어지면 먼저 외쳐요'), h('span', null, '먼저 "산다!"를 누른 사람이 그 값에 사요. 파는 사람도 "도로 품기"로 은행에 값을 내고 가질 수 있어요. 0까지 아무도 안 사면 판 사람이 공짜로 가져요.'))),
      h('li', null, h('div', null, h('b', null, '비밀 의뢰서 두 장'), h('span', null, `손님들이 부탁한 꿈이에요. 같은 꿈 3개는 +${TRI_PTS}, 한 꿈 2개와 다른 꿈 1개는 +${PAIR_PTS}. 남들은 끝날 때까지 몰라요.`))),
      h('li', null, h('div', null, h('b', null, '세 막이 지나면 장이 닫혀요'), h('span', null, '초저녁, 한밤, 새벽마다 모두 두 번씩 꿈을 팔아요. 점수는 엽전 + 산 꿈의 값 + 같은 꿈 보너스(2개 +2, 3개 +5, 4개 +9, 5개 +14) + 완성한 의뢰예요.'))));
  }
  function openRules() {
    const m = h('div', { class: 'modal', onclick: e => { if (e.target === m) m.remove(); } },
      h('div', { class: 'sheet', role: 'dialog', 'aria-label': '규칙' }, h('h2', null, '꿈 사세요 규칙'), rulesList(),
        h('div', { class: 'row', style: 'margin-top:14px' }, h('button', { class: 'btn', type: 'button', onclick: () => { S.tips = !tipsOn(); save(); m.remove(); if (ON.st) render(); } }, tipsOn() ? '도움말 끄기' : '도움말 다시 보기'), h('button', { class: 'btn btn-primary', type: 'button', onclick: () => m.remove() }, '닫기'))));
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
    const create = h('button', { class: 'btn', type: 'button', disabled: !ok, onclick: async e => { if (needNick()) return; const b = e.currentTarget; busy(b, true, '만드는 중'); try { ON.room = await window.NoliNet.create('dr', CODE_LO, CODE_HI); ON.isHost = true; afterJoin(); } catch (er) { busy(b, false); msg.textContent = '방을 만들지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.'; } } }, '친구랑 방 만들기');
    const join = h('button', { class: 'btn', type: 'button', disabled: !ok, onclick: async e => { if (needNick()) return; const c = code.value.replace(/\D/g, ''); if (c.length !== 4) { msg.textContent = '4자리 방 코드를 입력하세요.'; code.focus(); return; } const b = e.currentTarget; busy(b, true, '연결 중'); try { ON.room = await window.NoliNet.join('dr', c); ON.isHost = false; afterJoin(); } catch (er) { busy(b, false); msg.textContent = fail(er); } } }, '참가하기');
    code.addEventListener('keydown', e => { if (e.key === 'Enter') join.click(); });
    app.innerHTML = '';
    app.append(
      h('div', { class: 'top' }, brand(), h('span')),
      h('div', { class: 'title-hero' }, h('div', { class: 'moon', 'aria-hidden': 'true' }), h('h1', null, '꿈 사세요'), h('p', { class: 'sub' }, '꿈을 사고파는 밤의 장터'),
        h('p', { class: 'lede' }, '남의 꿈은 훤히 보이는데, 내 꿈은 어렴풋한 여운만 남아요. 손님들이 부탁한 꿈을 모아 새벽이 오기 전에 가장 큰 상인이 되세요.'),
        h('div', { class: 'marbles', 'aria-hidden': 'true', html: [0, 1, 2, 3].map(k => orbSVG(k, 'mb')).join('') })),
      h('div', { class: 'sheet' },
        h('div', { class: 'field' }, h('label', { for: 'nick' }, '닉네임'), nick),
        h('div', { class: 'field' }, h('label', null, '속도'), speedSeg()),
        prefill ? null : h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { if (needNick()) return; startSolo(3); } }, '상인 3명과 장 열기')),
        prefill ? null : h('div', { class: 'row', style: 'margin-top:8px' }, create),
        prefill ? null : h('hr'),
        h('div', { class: 'field' }, h('label', { for: 'code' }, prefill ? '초대받은 장터' : '방 코드로 참가'), h('div', { class: 'row' }, code, join)),
        msg,
        prefill ? h('button', { class: 'btn-text', type: 'button', onclick: () => { history.replaceState(null, '', location.pathname); showTitle(); } }, '처음으로') : null,
        h('details', { class: 'howto', open: prefill ? null : true }, h('summary', null, '규칙 보기 · 3–5명 · 15–25분'), rulesList())));
    window.scrollTo(0, 0);
    if (prefill) (S.nick ? join : nick).focus();
  }

  // ============================================================
  // ROOM
  // ============================================================
  function leaveRoom() { if (ON.room) { const r = ON.room; if (ON.isHost && !ON.solo) { try { r.broadcast({ k: 'bye' }); } catch (e) { } setTimeout(() => { try { r.leave(); } catch (e) { } }, 200); } else { try { r.leave(); } catch (e) { } } } stopHost(); ON.room = null; ON.isHost = false; ON.solo = false; ON.st = null; ON.H = null; ON.seenAct = -1; }
  const hostId = () => ON.isHost ? ON.room.me : ON.room.hostId;
  function toHost(m) { if (ON.room) ON.room.send(hostId(), m); }
  function members() { return ON.peers.filter(p => !p.away).sort((a, b) => ((a.presence || {}).joinedAt || 0) - ((b.presence || {}).joinedAt || 0)); }
  function sheetOnly(...kids) { app.innerHTML = ''; app.append(h('div', { class: 'top' }, brand(), h('span')), h('div', { class: 'sheet' }, ...kids)); window.scrollTo(0, 0); }
  function roomClosed() { try { ON.room && ON.room.leave(); } catch (e) { } ON.room = null; ON.st = null; history.replaceState(null, '', location.pathname); sheetOnly(h('h2', null, '장이 닫혔어요'), h('p', { class: 'fine', style: 'font-size:15px' }, '방장이 나갔거나 연결이 오래 끊겼어요. 방장에게 새 방을 만들어 달라고 하거나, 상인들과 계속해 보세요.'), h('button', { class: 'btn btn-primary', type: 'button', style: 'width:100%;margin-top:12px', onclick: () => showTitle() }, '처음으로')); }
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
    const ms = members().slice(0, 5); const maxBots = Math.max(0, 5 - ms.length); ON.bots = Math.min(ON.bots, maxBots); const total = ms.length + ON.bots;
    const invite = h('button', { class: 'btn btn-primary', type: 'button', onclick: async e => { const b = e.currentTarget; const url = location.origin + location.pathname + '?room=' + ON.room.code; const text = `꿈 사세요 같이 해요. 방 코드 ${ON.room.code}`; if (navigator.share) { try { await navigator.share({ title: '꿈 사세요', text, url }); return; } catch (er) { if (er && er.name === 'AbortError') return; } } try { await navigator.clipboard.writeText(url); b.textContent = '링크를 복사했어요'; setTimeout(() => b.textContent = '초대 링크 보내기', 2000); } catch (er) { b.textContent = url; } } }, '초대 링크 보내기');
    sheetOnly(
      h('div', { class: 'roomcode' }, h('span', null, '방 코드'), h('b', null, ON.room.code)),
      h('div', { class: 'row', style: 'margin:10px 0 16px' }, invite),
      h('h2', { style: 'margin:0' }, `상인 ${ms.length}명`),
      h('div', { class: 'players' }, ms.map(p => h('div', { class: 'p' }, cleanName((p.presence || {}).name, '플레이어'), p.sameTab ? h('span', { class: 'pill' }, '나') : null, (p.presence || {}).host ? h('span', { class: 'pill' }, '방장') : null))),
      ON.isHost ? h('div', { class: 'field' }, h('label', null, '컴퓨터 상인'), h('div', { class: 'stepper' },
        h('button', { type: 'button', 'aria-label': '줄이기', onclick: () => { ON.bots = Math.max(0, ON.bots - 1); lobbyView(); } }, '−'), h('b', null, ON.bots + '명'),
        h('button', { type: 'button', 'aria-label': '늘리기', onclick: () => { ON.bots = Math.min(maxBots, ON.bots + 1); lobbyView(); } }, '+'))) : null,
      ON.isHost ? h('div', { class: 'field' }, h('label', null, '속도'), speedSeg()) : null,
      ON.isHost ? h('button', { class: 'btn btn-primary', type: 'button', style: 'width:100%', disabled: total < 3, onclick: () => hostStart(ms) }, total < 3 ? '사람과 컴퓨터를 합쳐 3명부터 할 수 있어요' : `${total}명으로 장 열기`) : h('p', { class: 'fine' }, '방장이 장을 열면 바로 시작해요.'),
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
  function hostStart(ms) {
    stopHost();
    const players = ms.map(p => ({ id: p.peer, name: cleanName((p.presence || {}).name, '플레이어'), bot: false }));
    const used = new Set(players.map(p => p.name));
    for (let i = 0; i < ON.bots; i++) { let n = BOT_NAMES[i]; while (used.has(n)) n += '2'; used.add(n); players.push({ id: 'bot' + i, name: n, bot: true }); }
    shuffle(players);
    const orders = [];
    for (let a = 0; a < 4; a++) orders.push({ t: 'tri', a, pts: TRI_PTS, who: TRI_CLIENTS[a] });
    let pi = 0; for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (a !== b) orders.push({ t: 'pair', a, b, pts: PAIR_PTS, who: PAIR_CLIENTS[pi++] });
    shuffle(orders);
    const H = ON.H = { players: players.map(p => Object.assign(p, { coins: COINS, items: [], orders: [orders.pop(), orders.pop()] })), faces: [], seals: [], sold: 0, total: players.length * ACTS.length * SALES_PER_ACT, first: Math.floor(Math.random() * players.length), act: -1, phase: 'act', seller: 0, face: null, seal: 0, start: 0, price: 0, deadline: 0, last: null, sp: Object.assign({}, speed()), slapAt: {} };
    for (let k = 0; k < 4; k++) for (let v = 1; v <= 6; v++) for (let c = 0; c < 3; c++) H.faces.push({ k, v });
    for (const v of [-2, -2, -2, -2, -1, -1, -1, -1]) H.seals.push(v); for (let v = 0; v <= 6; v++) for (let c = 0; c < 6; c++) H.seals.push(v);
    shuffle(H.faces); shuffle(H.seals);
    loop = setInterval(hostTick, 100);
    nextAuction();
  }
  function nextAuction() {
    const H = ON.H;
    if (H.sold >= H.total) { H.phase = 'over'; sync(); return; }
    const act = Math.floor(H.sold / (H.players.length * SALES_PER_ACT));
    if (act !== H.act) { H.act = act; H.phase = 'act'; H.deadline = Date.now() + 3300; sync(); return; }
    H.seller = (H.first + H.sold) % H.players.length;
    H.face = H.faces.pop(); H.seal = H.seals.pop(); H.start = 0; H.price = 0; H.phase = 'announce'; H.deadline = Date.now() + H.sp.ann; H.slapAt = {};
    if (H.players[H.seller].bot) later(1300 + Math.random() * 1500, () => { if (ON.H === H && H.phase === 'announce') botAnnounce(); });
    sync();
  }
  function botAnnounce() { const H = ON.H; let st = Math.round(H.seal + 3.5 + 4 + (Math.random() * 2 - 1)); if (Math.random() < 0.2) st += 3; doAnnounce(st); }
  function doAnnounce(st) {
    const H = ON.H; if (H.phase !== 'announce') return;
    H.start = Math.max(MIN_START, Math.min(MAX_START, st | 0)); H.price = H.start; H.phase = 'auction'; H.nextTick = Date.now() + H.sp.tick + 700;
    ON.room.broadcast({ k: 'fx', t: 'go' }); sync(); botsWatch();
  }
  function hostTick() {
    const H = ON.H; if (!H) return; const now = Date.now();
    if (H.phase === 'act' && now >= H.deadline) { H.phase = 'pre'; nextAuctionAfterAct(); }
    else if (H.phase === 'announce' && now >= H.deadline) doAnnounce(Math.round(H.seal + 7.5));
    else if (H.phase === 'auction' && now >= H.nextTick) { H.price--; H.nextTick = now + H.sp.tick; if (H.price < 0) { H.price = 0; settle(H.seller, 0, true); return; } sync(); botsWatch(); }
    else if (H.phase === 'reveal' && now >= H.deadline) nextAuction();
  }
  function nextAuctionAfterAct() { const H = ON.H; H.seller = (H.first + H.sold) % H.players.length; H.face = H.faces.pop(); H.seal = H.seals.pop(); H.start = 0; H.price = 0; H.phase = 'announce'; H.deadline = Date.now() + H.sp.ann; H.slapAt = {}; if (H.players[H.seller].bot) later(1300 + Math.random() * 1500, () => { if (ON.H === H && H.phase === 'announce') botAnnounce(); }); sync(); }
  // structural worth of one more dream of kind k for player P (sets + orders, with partial credit for progress)
  function structVal(P, k) {
    const plus = P.items.concat([{ k, v: 0, s: 0 }]);
    let g = setPts(plus) - setPts(P.items) + orderPts(P.orders, plus) - orderPts(P.orders, P.items);
    for (const o of P.orders) { if (orderDone(o, P.items)) continue; for (const [kk, n] of orderNeed(o)) if (kk === k && kindCount(P.items, kk) < n) g += o.pts * 0.5 / 3; }
    return g;
  }
  function botsWatch() {
    const H = ON.H; if (H.phase !== 'auction') return; const p = H.price;
    const meanSeal = 2.56, estSealB = Math.max(-2, Math.min(6, H.start - 7.5));
    H.players.forEach((P, j) => {
      if (!P.bot || H.slapAt[j] || P.coins < p) return;
      let want;
      if (j === H.seller) { const cap = p + 1 + 2 - estSealB; const estFace = Math.min(3.5, Math.max(1, (1 + Math.min(6, cap)) / 2)); want = estFace + H.seal + structVal(P, H.face.k) - p >= Math.max(p - 1, 0) + 1; }
      else { const est = H.face.v + 0.5 * meanSeal + 0.5 * estSealB + structVal(P, H.face.k); want = est - (2 + (Math.random() < 0.25 ? (Math.random() < 0.5 ? -1 : 1) : 0)) >= p; }
      if (want) { H.slapAt[j] = true; const [lo, hi] = H.sp.react; later(lo + Math.random() * (hi - lo), () => { if (ON.H === H && H.phase === 'auction') doSlap(j); }); }
    });
  }
  function doSlap(j) { const H = ON.H; if (H.phase !== 'auction') return; const P = H.players[j]; if (!P) return; if (P.coins < H.price) { if (!P.bot) ON.room.send(P.id, { k: 'poor' }); return; } settle(j, H.price, false); }
  function settle(j, price, free) {
    const H = ON.H; const S0 = H.players[H.seller]; const B = H.players[j]; const value = H.face.v + H.seal; let fine = 0;
    B.coins -= price; if (j !== H.seller) S0.coins += price;
    if (j !== H.seller && H.start > value + FINE_SLACK) { fine = Math.min(S0.coins, H.start - value - FINE_SLACK); S0.coins -= fine; }
    B.items.push({ k: H.face.k, v: H.face.v, s: H.seal }); H.sold++;
    H.last = { buyer: j, seller: H.seller, price, free, face: H.face, seal: H.seal, value, fine, start: H.start, keep: j === H.seller };
    H.phase = 'reveal'; H.deadline = Date.now() + Math.max(3800, H.sp.tick * 4);
    ON.room.broadcast({ k: 'fx', t: j === H.seller ? 'keep' : 'sold', p: j }); sync();
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
    const H = ON.H; const isSeller = j === H.seller; const reveal = H.phase === 'reveal' || H.phase === 'over'; const over = H.phase === 'over';
    const auctionLive = H.phase === 'announce' || H.phase === 'auction';
    return {
      k: 'st', phase: H.phase === 'pre' ? 'act' : H.phase, me: j, seller: H.seller, solo: ON.solo, act: Math.max(0, H.act), sold: H.sold, total: H.total,
      face: auctionLive ? (isSeller ? null : H.face) : (reveal ? H.face : null), seal: auctionLive ? (isSeller ? H.seal : null) : (reveal ? H.seal : null),
      start: H.start, price: H.price, left: Math.max(0, H.deadline - Date.now()), annTotal: H.sp.ann, last: reveal ? H.last : null,
      players: H.players.map((p, i) => ({ name: p.name, bot: p.bot, coins: p.coins, items: p.items, vis: p.coins + itemPts(p.items) + setPts(p.items),
        orders: over || i === j ? p.orders : null, final: over ? { coins: p.coins, items: itemPts(p.items), sets: setPts(p.items), orders: orderPts(p.orders, p.items) } : null })),
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
      if (d.phase === 'act' && ON.seenAct !== d.act) { ON.seenAct = d.act; curtain(d.act); }
      if (d.phase === 'over' && (!prev || prev.phase !== 'over')) { const ranked = finalRank(d); sfx(ranked[0].i === d.me ? 'win' : 'lose'); if (S.tips !== false) { S.tips = false; save(); } }
      render(prev); return;
    }
    if (d.k === 'fx') { sfx(d.t === 'go' ? 'pop' : 'stamp'); return; }
    if (d.k === 'poor') { toast('엽전이 모자라요.'); sfx('hit'); }
  }
  function curtain(a) { document.querySelectorAll('.curtain').forEach(x => x.remove()); const el = h('div', { class: 'curtain', role: 'status' }, h('div', null, h('div', { class: 'n' }, ['제1막', '제2막', '제3막'][a]), h('h2', null, ACTS[a].name), h('p', null, ACTS[a].line))); document.body.append(el); sfx('flip'); setTimeout(() => el.remove(), 3400); }
  function finalRank(st) { return st.players.map((p, i) => ({ p, i, tot: p.final.coins + p.final.items + p.final.sets + p.final.orders })).sort((a, b) => b.tot - a.tot || b.p.coins - a.p.coins); }
  function render(prev) {
    const st = ON.st; const me = st.me;
    const top = h('div', { class: 'top' }, brand(), h('span', null,
      h('button', { class: 'iconbtn', type: 'button', onclick: openRules }, '규칙'), ' ',
      h('button', { class: 'iconbtn', type: 'button', onclick: e => { const on = !window.NoliSFX.on(); window.NoliSFX.set(on); e.currentTarget.textContent = on ? '소리' : '무음'; } }, window.NoliSFX && window.NoliSFX.on() ? '소리' : '무음'), ' ',
      h('button', { class: 'iconbtn', type: 'button', onclick: () => { if (st.phase === 'over' || window.confirm('장터에서 나갈까요?')) { history.replaceState(null, '', location.pathname); showTitle(); } } }, '나가기')));
    app.innerHTML = '';
    if (st.phase === 'over') { app.append(top, finaleEl(st)); return; }
    const actbar = h('div', { class: 'actbar' }, h('span', { class: 'act' }, `${['제1막', '제2막', '제3막'][st.act]} · ${ACTS[st.act].name}`), h('span', { class: 'prog', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.round(st.sold / st.total * 100)}%` })), h('span', { class: 'cnt' }, `${st.sold}/${st.total}`));
    app.append(...[top, actbar, tipEl(st), stallEl(st, prev), me >= 0 ? myPanel(st) : null, rivalsPanel(st)].filter(Boolean));
    startTimer();
  }
  function tipEl(st) {
    if (!tipsOn() || st.me < 0) return null; const seller = st.seller === st.me; let t = '';
    if (st.phase === 'announce') t = seller ? `꿈 값은 대략 "여운 ${st.seal} + 선명함 평균 3.5"예요. 그보다 조금 높게 부르면 무난하고, 훨씬 높게 부르면 허풍이에요.` : '시작가가 높으면 여운이 좋을 수도, 허풍일 수도 있어요. 그리고 내 의뢰서에 필요한 꿈인지 보세요.';
    else if (st.phase === 'auction') t = seller ? '아무도 안 사면 선명함이 낮다는 신호예요. 너무 싸졌다 싶으면 도로 품으세요.' : `예상 값 = 선명함 ${st.face ? st.face.v : '?'} + 여운 짐작(보통 3). 의뢰서에 필요한 꿈이면 조금 더 써도 돼요.`;
    else if (st.phase === 'reveal') t = '산 꿈은 종류별로 모여요. 의뢰서는 끝날 때 공개돼서 막판에 순위가 뒤집혀요.';
    return t ? h('div', { class: 'tip', role: 'note' }, h('b', null, '도움말'), ' ', t) : null;
  }
  function stallEl(st, prev) {
    const me = st.me; const seller = st.players[st.seller]; const iAmSeller = me === st.seller;
    if (st.phase === 'act') return h('div', { class: 'stall' }, h('h3', null, `${ACTS[st.act].name}의 장이 열려요`), h('p', { class: 'sub' }, ACTS[st.act].line));
    const goods = h('div', { class: 'goods' }, dreamCard(st.face), h('span', { class: 'plus', 'aria-hidden': 'true' }, '+'), slip(st.seal));
    if (st.phase === 'announce') {
      if (iAmSeller) return h('div', { class: 'stall' }, h('h3', null, '내 꿈을 팔 차례예요'), h('p', { class: 'sub' }, `꿈 구슬은 나만 못 봐요. 여운은 ${st.seal > 0 ? '+' : ''}${st.seal}로 기억나요. 시작가를 불러 주세요.`), goods,
        h('div', { class: 'nums' }, Array.from({ length: MAX_START - MIN_START + 1 }, (_, i) => MIN_START + i).map(v => h('button', { type: 'button', onclick: () => { sfx('tap'); toHost({ k: 'h:announce', v }); } }, v))), timerBar());
      return h('div', { class: 'stall' }, h('h3', null, `${seller.name}의 꿈`), h('p', { class: 'sub' }, `${josa(seller.name, '이', '가')} 시작가를 고르는 중이에요. 여운은 판 사람만 알아요.`), goods, timerBar());
    }
    if (st.phase === 'auction') {
      const tick = prev && prev.phase === 'auction' && prev.price !== st.price;
      goods.append(h('div', { class: 'lantern' + (tick ? ' tick' : '') }, h('div', { class: 'body' }, h('small', null, '지금 값'), h('b', null, st.price)), h('div', { class: 'st' }, `시작가 ${st.start}`)));
      const myCoins = st.players[me] ? st.players[me].coins : 0;
      const btn = me < 0 ? null : iAmSeller
        ? h('button', { class: 'slap keep', type: 'button', disabled: myCoins < st.price, onclick: () => { sfx('tap'); toHost({ k: 'h:slap' }); } }, `도로 품기 · ${st.price}냥`)
        : h('button', { class: 'slap', type: 'button', disabled: myCoins < st.price, onclick: () => { sfx('tap'); toHost({ k: 'h:slap' }); } }, `산다! · ${st.price}냥`);
      return h('div', { class: 'stall' }, h('h3', null, iAmSeller ? '내 꿈이 경매 중이에요' : `${seller.name}의 꿈 경매`), h('p', { class: 'sub' }, iAmSeller ? '0이 되면 공짜로 내가 가져요.' : '기다리면 싸지지만, 남이 먼저 외칠 수 있어요.'), goods, btn);
    }
    const L = st.last; const buyer = st.players[L.buyer];
    const line = L.keep ? (L.free ? `아무도 안 사서 ${seller.name}에게 돌아갔어요` : `${josa(seller.name, '이', '가')} ${L.price}냥에 도로 품었어요`) : (L.buyer === me ? `내가 ${L.price}냥에 샀어요` : `${josa(buyer.name, '이', '가')} ${L.price}냥에 샀어요`);
    return h('div', { class: 'stall' }, h('h3', null, line), h('p', { class: 'sub' }, `꿈 값 ${L.value} (선명함 ${L.face.v} + 여운 ${L.seal}) · 시작가 ${L.start}` + (L.seal < 0 ? ' · 흉몽이었어요' : '') + (L.fine ? ` · 허풍 벌금 ${L.fine}냥` : '')),
      h('div', { class: 'goods' }, dreamCard(L.face), h('span', { class: 'plus', 'aria-hidden': 'true' }, '+'), slip(L.seal)), timerBar());
  }
  function myPanel(st) {
    const P = st.players[st.me];
    return h('section', { class: 'panel', 'aria-label': '내 보따리' },
      h('h4', null, '내 보따리', h('span', { class: 'coins' }, h('span', { class: 'coin', 'aria-hidden': 'true' }), `${P.coins}냥`), h('span', { class: 'r' }, `보이는 점수 ${P.vis}`)),
      h('div', { class: 'shelf' }, KINDS.map((K, k) => { const its = P.items.filter(x => x.k === k); return h('div', { class: 'k' }, h('span', { html: orbSVG(k, 'mb') }), h('b', { style: 'color:' + K.color }, K.name), h('span', null, its.length ? `${its.length}개 · ${its.reduce((a, x) => a + x.v + x.s, 0)}점` : '없음')); })),
      h('div', { class: 'orders' }, (P.orders || []).map(o => orderEl(o, P.items))));
  }
  function rivalsPanel(st) {
    return h('section', { class: 'panel', 'aria-label': '상인들' }, h('h4', null, '장터의 상인들', h('span', { class: 'r' }, '의뢰서는 끝날 때 공개')),
      h('div', { class: 'rivals' }, st.players.map((p, i) => i === st.me ? null : h('div', { class: 'rv' + (i === st.seller && st.phase !== 'act' ? ' sell' : '') },
        h('span', { class: 'nm' }, p.name, i === st.seller && st.phase !== 'act' ? h('span', { class: 'pill', style: 'background:var(--lantern);color:var(--ink)' }, '파는 중') : null, h('span', { class: 'coins', style: 'font-weight:700;font-size:13px' }, h('span', { class: 'coin', 'aria-hidden': 'true' }), p.coins)),
        h('span', { class: 'sc' }, p.vis, h('small', null, '보이는 점수')),
        h('span', { class: 'ks' }, KINDS.map((K, k) => { const n = kindCount(p.items, k); return n ? h('span', null, h('i', { class: 'dot', style: 'background:' + K.color }), `${K.short} ${n}`) : null; }), p.items.length ? null : h('span', null, '아직 산 꿈이 없어요'))))));
  }
  function finaleEl(st) {
    const ranked = finalRank(st); const me = st.me;
    return h('div', { class: 'sheet finale' },
      h('h2', null, ranked[0].i === me ? '새벽의 가장 큰 상인!' : `${josa(ranked[0].p.name, '이', '가')} 새벽장을 차지했어요`),
      h('p', { class: 'lead' }, '닭이 울고 장이 닫혔어요. 숨겨 둔 의뢰서를 펼쳐 봐요.'),
      ranked.map((r, n) => h('div', { class: 'rank' + (n === 0 ? ' first' : ''), style: `animation-delay:${0.25 + n * 0.45}s` },
        h('div', { class: 'hd' }, h('span', { class: 'pl' }, n + 1), h('span', { class: 'who' }, r.i === me ? `${r.p.name} (나)` : r.p.name), h('span', { class: 'tot' }, r.tot)),
        h('div', { class: 'bd' }, h('span', null, '엽전 ', h('b', null, r.p.final.coins)), h('span', null, '꿈 값 ', h('b', null, r.p.final.items)), h('span', null, '같은 꿈 ', h('b', null, '+' + r.p.final.sets)), h('span', null, '의뢰 ', h('b', null, '+' + r.p.final.orders))),
        h('div', { class: 'od' }, r.p.orders.map(o => { const ok = orderDone(o, r.p.items); return h('span', { class: ok ? 'ok' : 'no' }, `${o.who} · ${orderNeed(o).map(([k, c]) => KINDS[k].short + ' ' + c).join(' + ')} · +${o.pts}`); })))),
      h('div', { class: 'row', style: 'margin-top:16px' },
        ON.isHost ? h('button', { class: 'btn btn-primary', type: 'button', onclick: () => toHost({ k: 'h:again' }) }, '다시 장 열기') : h('p', { class: 'fine' }, '방장이 다시 장을 열면 이어서 해요.'),
        h('button', { class: 'btn', type: 'button', onclick: () => { history.replaceState(null, '', location.pathname); showTitle(); } }, '처음으로')));
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
  window.__dream = { get ON() { return ON; } };
})();
