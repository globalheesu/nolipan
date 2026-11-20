(function () {
  'use strict';
  const N = window.NightEngine;
  const HOME = '../';
  const HEX = ['#2563D9', '#E8761A', '#7C4DDB', '#0E8F84', '#D53F7C', '#8A5A2B'];
  const ICON = ['●', '▲', '■', '★', '◆', '✚'];
  const NPC = [['경비원', '경'], ['청소부', '청'], ['큐레이터', '큐'], ['보안 요원', '보'], ['전기 기사', '전'], ['배달원', '배']];
  const CODE_LO = 7000, CODE_HI = 9999;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function h(tag, attrs, ...kids) { const el = document.createElement(tag); if (attrs) for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') el.className = v; else if (k === 'style') el.style.cssText = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v); } for (const kid of kids.flat()) { if (kid == null || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); } return el; }
  const NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, text) { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v); if (text != null) el.textContent = text; return el; }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('night:' + k)); localStorage.setItem('night:' + k, JSON.stringify(v)); } catch (e) { return null; } }
  function cleanName(x, fb) { const t = String(x || '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g, '').trim().slice(0, 10); return t || fb; }
  const sfx = n => window.NoliSFX && window.NoliSFX.play(n);
  const app = document.getElementById('app');

  let S = Object.assign({ mode: 'local', n: 4, names: ['플레이어 1', '플레이어 2', '플레이어 3', '플레이어 4', '플레이어 5', '플레이어 6'], timer: true, nick: '' }, store('settings') || {});
  const save = () => store('settings', S);
  let G = null; // naming context + local session
  const nameOf = p => p < G.n ? G.names[p] : NPC[p - G.n][0];
  const colorOf = p => p < G.n ? HEX[p] : '#7A7891';
  const iconOf = p => p < G.n ? ICON[p] : NPC[p - G.n][1];
  const routeText = r => r.map((x, t) => t === 0 ? N.ROOMS[x] : (x === r[t - 1] ? '·' : N.ROOMS[x])).join(' → ');
  const roomPair = k => k.split('-').map(Number).map(x => N.ROOMS[x]).join('↔');

  // ---------- floor plan ----------
  const CELL = 96, GAP = 4, OFF = 6, SZ = 92;
  const rx = i => OFF + (i % 3) * CELL, ry = i => OFF + ((i / 3) | 0) * CELL;
  const cx = i => rx(i) + SZ / 2, cy = i => ry(i) + SZ / 2;
  function plan(opts) {
    const sv = s('svg', { class: 'plan', viewBox: '0 0 300 300', role: 'img', 'aria-label': '미술관 평면도' });
    sv.append(s('rect', { x: 0, y: 0, width: 300, height: 300, rx: 8, fill: '#1E1C33' }));
    for (let i = 0; i < 9; i++) {
      const cls = ['room']; if (i === N.VAULT) cls.push('vault'); if (opts.pick && opts.pick.has(i)) cls.push('pick'); if (opts.bad && opts.bad.has(i)) cls.push('bad');
      const r = s('rect', { class: cls.join(' '), x: rx(i), y: ry(i), width: SZ, height: SZ, rx: 4, 'data-room': i });
      if (opts.pick && opts.pick.has(i)) { r.setAttribute('tabindex', '0'); r.setAttribute('role', 'button'); r.setAttribute('aria-label', N.ROOMS[i]); r.addEventListener('click', () => { sfx('step'); opts.onPick(i); }); r.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onPick(i); } }); }
      sv.append(r);
    }
    for (const k of N.doors) { const [a, b] = k.split('-').map(Number); if (b - a === 1) { const x = rx(a) + SZ - 1, y = cy(a); sv.append(s('rect', { x, y: y - 18, width: GAP + 2, height: 36, fill: '#fff' })); } else { const x = cx(a) + 20, y = ry(a) + SZ - 1; sv.append(s('rect', { x: x - 18, y, width: 36, height: GAP + 2, fill: '#fff' })); } }
    for (let i = 0; i < 9; i++) {
      sv.append(s('text', { class: 'rname', x: rx(i) + 7, y: ry(i) + 17 }, N.ROOMS[i]));
      if (opts.counts) sv.append(s('text', { class: 'cnt' + (opts.badCnt && opts.badCnt.has(i) ? ' bad' : ''), x: rx(i) + SZ - 7, y: ry(i) + SZ - 8 }, opts.counts[i]));
    }
    if (opts.sensors) for (const se of opts.sensors) {
      const [a, b] = se.k.split('-').map(Number); const x = b - a === 1 ? rx(a) + SZ + GAP / 2 : cx(a) + 20, y = b - a === 1 ? cy(a) : ry(a) + SZ + GAP / 2;
      const g = s('g'); g.append(s('rect', { class: 'sensor', x: x - 17, y: y - 10, width: 34, height: 20, rx: 5, stroke: se.bad ? '#CF3838' : '#1E1C33', 'stroke-width': se.bad ? 3 : 1.5 })); g.append(s('text', { class: 'stxt', x, y }, se.txt)); sv.append(g);
    }
    if (opts.paths) opts.paths.forEach((pp, k) => {
      const off = (k - (opts.paths.length - 1) / 2) * 8; const upto = pp.upto == null ? pp.route.length - 1 : pp.upto;
      const pts = pp.route.slice(0, upto + 1).map((x, t) => [cx(x) + off + (t * 3 - 6), cy(x) + off]);
      if (pts.length > 1) sv.append(s('polyline', { class: 'path', points: pts.map(p => p.join(',')).join(' '), stroke: pp.color, opacity: pp.dim ? 0.35 : 0.9, 'stroke-dasharray': pp.dash ? '6 6' : '' }));
      pts.forEach(([x, y], t) => { sv.append(s('circle', { cx: x, cy: y, r: 9, fill: pp.color, opacity: pp.dim ? 0.35 : 1 })); sv.append(s('text', { class: 'hr', x, y }, String(t === 0 ? 21 : (21 + t) % 24 || 24).slice(-2))); });
    });
    if (opts.tokens) for (const [room, ps] of Object.entries(opts.tokens)) ps.forEach((p, k) => {
      const x = rx(+room) + 15 + (k % 3) * 22, y = ry(+room) + 38 + Math.floor(k / 3) * 22;
      const g = s('g', { class: 'tok' }); g.append(s('circle', { cx: x, cy: y, r: 10, fill: colorOf(p), stroke: '#fff', 'stroke-width': 1.5 })); g.append(s('text', { x, y }, iconOf(p))); sv.append(g);
    });
    return sv;
  }

  // ---------- chrome ----------
  let keepScroll = false;
  function screen(...cards) { const y = window.scrollY; app.innerHTML = ''; app.append(h('div', { class: 'col' }, ...cards)); window.scrollTo(0, keepScroll ? y : 0); keepScroll = false; }
  function brandLink() { return h('a', { class: 'brand', href: HOME, 'aria-label': '놀이판 홈' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), '놀이판'); }
  function soundBtn() { const b = h('button', { class: 'iconbtn', type: 'button', 'aria-pressed': String(window.NoliSFX.on()), onclick: () => { window.NoliSFX.set(!window.NoliSFX.on()); b.textContent = window.NoliSFX.on() ? '소리' : '무음'; b.setAttribute('aria-pressed', String(window.NoliSFX.on())); } }, window.NoliSFX.on() ? '소리' : '무음'); return b; }
  function top(meta) { return h('div', { class: 'top' }, h('h1', null, '밤의 기록'), h('span', { class: 'meta' }, meta || ''), soundBtn(), h('button', { class: 'iconbtn', type: 'button', onclick: showRules }, '규칙'), h('button', { class: 'iconbtn', type: 'button', onclick: confirmLeave }, '나가기')); }
  function modal(...kids) { const bg = h('div', { class: 'modal-bg', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'card', style: 'max-height:90vh;overflow:auto' }, ...kids)); document.body.append(bg); const f = bg.querySelector('button'); if (f) f.focus(); return bg; }
  function toast(t) { const el = h('div', { class: 'toast', role: 'status' }, t); document.body.append(el); setTimeout(() => el.remove(), 3200); }
  function confirmLeave() { const bg = modal(h('h2', null, '게임을 나갈까요?'), h('p', null, ON.room ? '나가면 다른 플레이어의 게임이 멈춰요.' : '진행 중인 게임은 저장되지 않아요.'), h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { bg.remove(); leaveOnline(); showTitle(); } }, '나가기'), h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => bg.remove() }, '계속하기'))); }

  function showRules() {
    const bg = modal(h('h2', null, '규칙'),
      h('ol', { class: 'rules' },
        h('li', null, '한 판마다 한 명이 몰래 범인이 돼요. 빈자리는 언제나 사실만 말하는 직원이 채워요.'),
        h('li', null, '21시 위치는 모두에게 공개돼요. 22시부터 01시까지 한 시간마다 머물거나 옆 방으로 이동해요.'),
        h('li', null, '범인은 금고에 한 번 이상 들어가야 해요. 거짓 진술을 정하고, 동작 감지 기록에서 자기 흔적을 2칸까지 옮길 수 있어요.'),
        h('li', null, '결백한 사람은 사실대로 진술해요. 볼일이 있는 방에 들르면 1점이에요.'),
        h('li', null, '아침에 모두의 진술, 방별 동작 감지 기록, 문 센서 3개의 통과 횟수가 공개돼요. 문 센서는 조작할 수 없어요.'),
        h('li', null, '정밀 감식은 한 판에 한 번이에요. 고른 사람이 기록상 범인일 수 있는지 알려 줘요.'),
        h('li', null, '범인을 맞히면 결백한 사람 모두 2점, 놓치면 범인이 3점이에요. 범인이 기록을 1칸 이하로 고쳤다면 1점을 더 받아요.')),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => bg.remove() }, '닫기'));
  }

  // ============================================================
  // TITLE
  // ============================================================
  function showTitle() {
    G = null; history.replaceState(null, '', location.pathname);
    const seg = (key, val, label) => h('button', { type: 'button', 'aria-pressed': String(S[key] === val), onclick: () => { S[key] = val; save(); showTitle(); } }, label);
    const body = [];
    if (S.mode === 'online') {
      body.push(h('p', { class: 'lead' }, '각자 자기 폰으로 참가해요. 역할과 행동이 내 화면에만 보여요.'),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => showLobby() }, '계속하기'), h('button', { class: 'btn btn-ghost', type: 'button', onclick: showRules }, '규칙 보기')));
    } else {
      const names = h('div', { class: 'names' });
      for (let i = 0; i < S.n; i++) names.append(h('label', { class: 'namefield', for: 'nm' + i }, h('span', { class: 'sw', style: 'background:' + HEX[i] }, ICON[i]), h('input', { id: 'nm' + i, type: 'text', maxlength: '10', value: S.names[i] || '', 'aria-label': (i + 1) + '번째 플레이어 이름', oninput: e => { S.names[i] = e.target.value; save(); } })));
      body.push(h('div', { class: 'field' }, h('span', { class: 'lab' }, '인원'), h('div', { class: 'seg' }, [3, 4, 5, 6].map(n => seg('n', n, n + '명')))),
        h('div', { class: 'field' }, h('span', { class: 'lab' }, '이름 · 앉은 순서대로'), names),
        h('div', { class: 'field' }, h('label', { class: 'toggle', for: 'tm' }, h('input', { id: 'tm', type: 'checkbox', checked: S.timer, onchange: e => { S.timer = e.target.checked; save(); } }), '토론 3분 타이머')),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: startLocal }, '시작하기'), h('button', { class: 'btn btn-ghost', type: 'button', onclick: showRules }, '규칙 보기')),
        h('p', { class: 'fine', style: 'margin:14px 0 0' }, `기기 하나를 돌려 가며 해요. ${S.n}판 동안 모두 한 번씩 범인이 될 수 있어요.`));
    }
    screen(h('div', { class: 'card hero' }, brandLink(),
      h('div', { class: 'logo' }, '밤의 기록'),
      h('p', { class: 'tagline' }, '미술관 금고가 털렸어요. 범인은 기록을 고쳤고, 지금 이 자리에 있어요.'),
      h('div', { class: 'meta-chips' }, h('span', null, '3–6명'), h('span', null, '한 판 10분'), h('span', null, '12세 이상')),
      h('div', { class: 'field' }, h('span', { class: 'lab' }, '플레이 방식'), h('div', { class: 'seg seg-wide' }, seg('mode', 'local', '한 기기로'), seg('mode', 'online', '온라인'))),
      ...body));
  }

  // ============================================================
  // LOCAL (pass-and-play)
  // ============================================================
  function startLocal() {
    const n = S.n; G = { mode: 'local', n, names: [...Array(n)].map((_, i) => cleanName(S.names[i], '플레이어 ' + (i + 1))), round: 0, rounds: n, total: Array(n).fill(0), seed: Math.floor(Math.random() * 1e9), history: [] };
    G.order = shuffledOrder(n, G.seed); localRound();
  }
  function shuffledOrder(n, seed) { const r = N.rng(seed); const o = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; }
  function makeRound(n, seed, culprit) {
    const rd = N.newRound(n, seed); rd.culprit = culprit;
    const r2 = N.rng(seed + 5); rd.errands = rd.starts.map((st, p) => p < n && p !== culprit ? [0, 1, 2, 3, 4, 5, 6, 7].filter(x => x !== st)[Math.floor(r2() * 7)] : null);
    return rd;
  }
  function localRound() {
    G.rd = makeRound(G.n, G.seed + G.round * 7919, G.order[G.round]); G.inputs = []; G.turn = 0; G.res = null; G.checked = null; G.accused = null;
    intro(G.rd.starts, G.rd.total, () => localTurn());
  }
  function intro(starts, total, onGo, waitText) {
    const tokens = {}; starts.forEach((st, p) => (tokens[st] = tokens[st] || []).push(p));
    screen(top(`${G.round + 1} / ${G.rounds}판`), h('div', { class: 'card' },
      h('p', { class: 'kicker' }, `${G.round + 1}번째 밤 · 21시`),
      h('h2', { class: 'big' }, '오늘 밤, 금고에서 ‘달의 눈물’이 사라져요'),
      plan({ tokens }),
      h('div', { class: 'claims', style: 'margin:14px 0' }, [...Array(total).keys()].map(p => h('div', null, h('span', { class: 'sw', style: 'background:' + colorOf(p) }, iconOf(p)), h('b', null, nameOf(p)), h('span', { class: 'r' }, N.ROOMS[starts[p]] + (p >= G.n ? ' · 직원' : ''))))),
      onGo ? h('button', { class: 'btn btn-primary', type: 'button', onclick: onGo }, waitText || `${nameOf(0)} 님부터 시작`) : h('p', { class: 'waitline' }, waitText)));
  }
  function localTurn() {
    if (G.turn >= G.n) { localMorning(); return; }
    const p = G.turn; const rd = G.rd;
    const cover = h('div', { class: 'cover' }, h('div', { class: 'card' }, h('span', { class: 'sw big', style: 'background:' + HEX[p] }, ICON[p]), h('h2', null, `${nameOf(p)} 님 차례예요`), h('p', null, '다른 사람은 화면을 보지 마세요.'), h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { cover.remove(); sfx('tap'); secretTurn(p, { start: rd.starts[p], isC: p === rd.culprit, errand: rd.errands[p], onDone: inp => { G.inputs[p] = inp; G.turn++; localTurn(); } }); } }, '시작하기')));
    app.innerHTML = ''; document.body.append(cover); cover.querySelector('button').focus();
  }
  function localMorning() {
    G.res = N.resolve(G.rd, G.inputs); G.hour = 1; G.timerEnd = S.timer ? Date.now() + 180000 : null;
    const view = () => ({
      starts: G.rd.starts, sensors: G.rd.sensors, res: G.res, checked: G.checked, timerEnd: G.timerEnd,
      onCheck: p => { G.checked = { p, ok: N.consistentSuspects(G.rd, G.res, 2).includes(p) }; sfx('pop'); morning(view()); },
      vote: { mode: 'group', selected: G.accused, onSelect: p => { G.accused = p; morning(view()); }, onConfirm: () => localReveal() }
    });
    morning(view());
  }
  function localReveal() {
    const rd = G.rd, res = G.res; const sc = N.score(rd, res, G.accused); sc.pts.forEach((v, p) => G.total[p] += v); G.history.push({ culprit: rd.culprit, caught: sc.caught });
    const ci = G.inputs[rd.culprit];
    revealView({ culprit: rd.culprit, route: ci.route, claim: ci.claim, applied: res.applied, pts: sc.pts, total: G.total, errandsDone: res.errandsDone, caught: sc.caught, accused: G.accused, last: G.round + 1 >= G.rounds, canNext: true, onNext: () => { G.round++; localRound(); }, onFinal: () => finalView({ total: G.total, history: G.history, rounds: G.rounds, canAgain: true, onAgain: startLocal }) });
  }

  // ============================================================
  // SHARED VIEWS
  // ============================================================
  function secretTurn(p, ctx) {
    const isC = ctx.isC, start = ctx.start;
    const st = { route: [start, null, null, null, null], step: 1, claim: [start, null, null, null, null], cstep: 1, tamper: new Set(), phase: 'route' };
    const role = isC ? h('div', { class: 'role cul' }, h('b', null, '당신이 범인이에요'), h('span', null, '밤사이 금고에 한 번 이상 들어가세요. 그다음 거짓 진술을 정하고 기록을 고쳐요.'))
      : h('div', { class: 'role inn' }, h('b', null, '당신은 결백해요'), h('span', null, `${N.ROOMS[ctx.errand]}에 들르면 1점. 금고는 잠겨 있어요.`));
    const body = h('div');
    screen(top(`${G.round + 1} / ${G.rounds}판`), h('div', { class: 'card' }, h('div', { class: 'who' }, h('span', { class: 'sw', style: 'background:' + HEX[p] }, ICON[p]), h('b', null, nameOf(p))), role, body));
    if (isC) sfx('stamp');
    const bfs = a => { const d = Array(9).fill(99); d[a] = 0; const q = [a]; while (q.length) { const x = q.shift(); for (const y of N.adj[x]) if (d[y] > d[x] + 1) { d[y] = d[x] + 1; q.push(y); } } return d; };
    const validNext = (r, t, claim) => { const prev = r[t - 1]; return new Set([prev, ...N.adj[prev]].filter(x => !(x === N.VAULT && (!isC || claim)))); };
    const steps = (labels, cur) => h('ol', { class: 'steps', 'aria-label': '진행 단계' }, labels.map((l, i) => h('li', { 'aria-current': i === cur ? 'step' : null, class: i < cur ? 'done' : '' }, l)));
    const stepLabels = isC ? ['경로', '진술', '기록 조작'] : ['경로', '확인'];
    function hoursRow(r, cur, setCur) { return h('div', { class: 'hours' }, N.HOURS.map((hh, t) => h('button', { type: 'button', 'aria-pressed': String(t === cur), disabled: t === 0 || r[t - 1] == null, onclick: () => setCur(t) }, h('span', null, hh), h('small', null, r[t] == null ? '—' : N.ROOMS[r[t]])))); }
    function render() {
      body.innerHTML = '';
      if (st.phase === 'route') {
        const r = st.route; const t = st.step;
        let pick = new Set(); if (t <= 4) { pick = validNext(r, t, false); if (isC) pick = new Set([...pick].filter(x => { const rr = r.slice(); rr[t] = x; return rr.slice(1, t + 1).includes(N.VAULT) || bfs(x)[N.VAULT] <= 4 - t; })); }
        body.append(steps(stepLabels, 0), h('p', { class: 'instr' }, t <= 4 ? [h('b', null, N.HOURS[t]), '에 있을 방을 고르세요'] : '경로를 모두 정했어요'),
          plan({ pick, onPick: x => { r[t] = x; for (let k = t + 1; k < 5; k++) r[k] = null; st.step = Math.min(5, t + 1); render(); }, paths: [{ route: r.filter(x => x != null), color: HEX[p] }] }),
          hoursRow(r, t, k => { st.step = k; for (let j = k; j < 5; j++) r[j] = null; render(); }));
        if (!isC && r.every(x => x != null)) body.append(h('p', { class: 'note' }, r.slice(1).includes(ctx.errand) ? `${N.ROOMS[ctx.errand]}에 들러요 · +1점` : `${N.ROOMS[ctx.errand]}에 들르지 않아요`));
        const done = r.every(x => x != null) && (!isC || r.includes(N.VAULT));
        body.append(h('div', { class: 'row actions' }, h('button', { class: 'btn btn-primary', type: 'button', disabled: !done, onclick: () => { st.phase = isC ? 'claim' : 'confirm'; render(); } }, '다음')));
      } else if (st.phase === 'claim') {
        const c = st.claim; const t = st.cstep; const pick = t <= 4 ? validNext(c, t, true) : new Set();
        body.append(steps(stepLabels, 1), h('p', { class: 'instr' }, t <= 4 ? [h('b', null, N.HOURS[t]), '에 어디 있었다고 말할까요'] : '진술을 모두 정했어요'),
          plan({ pick, onPick: x => { c[t] = x; for (let k = t + 1; k < 5; k++) c[k] = null; st.cstep = Math.min(5, t + 1); render(); }, paths: [{ route: st.route, color: '#CF3838', dim: true }, { route: c.filter(x => x != null), color: HEX[p], dash: true }] }),
          hoursRow(c, t, k => { st.cstep = k; for (let j = k; j < 5; j++) c[j] = null; render(); }),
          h('p', { class: 'fine' }, '흐린 빨간 선이 실제 경로, 점선이 진술이에요.'),
          h('div', { class: 'row actions' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { st.phase = 'route'; render(); } }, '이전'), h('button', { class: 'btn btn-primary', type: 'button', disabled: !c.every(x => x != null), onclick: () => { st.phase = 'tamper'; st.tamper = new Set(); render(); } }, '다음')));
      } else if (st.phase === 'tamper') {
        const diffs = []; for (let t = 1; t < 5; t++) if (st.route[t] !== st.claim[t]) diffs.push(t);
        const left = diffs.filter(t => !st.tamper.has(t));
        body.append(steps(stepLabels, 2), h('p', { class: 'instr' }, '고칠 기록을 2칸까지 고르세요'),
          h('p', { class: 'fine', style: 'margin-top:-6px' }, '고른 시간의 동작 감지 기록에서 내 흔적이 진술한 방으로 옮겨져요. 문 센서는 고칠 수 없어요.'),
          h('div', { class: 'opts' }, diffs.map(t => h('button', { class: 'opt', type: 'button', 'aria-pressed': String(st.tamper.has(t)), disabled: !st.tamper.has(t) && st.tamper.size >= 2, onclick: () => { st.tamper.has(t) ? st.tamper.delete(t) : st.tamper.add(t); sfx('tap'); render(); } }, h('b', null, N.HOURS[t]), h('span', null, `${N.ROOMS[st.route[t]]} → ${N.ROOMS[st.claim[t]]}`)))),
          h('p', { class: 'note' }, left.length ? `고치지 않은 ${left.length}칸은 아침에 기록과 진술이 다른 곳으로 드러나요.` : '진술과 다른 기록을 모두 고쳤어요.', st.tamper.size <= 1 ? ' 1칸 이하로 고치고 들키지 않으면 1점을 더 받아요.' : ''),
          h('div', { class: 'row actions' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { st.phase = 'claim'; render(); } }, '이전'), h('button', { class: 'btn btn-red', type: 'button', onclick: () => ctx.onDone({ route: st.route.slice(), claim: st.claim.slice(), tamper: [...st.tamper].map(t => ({ t, to: st.claim[t] })) }) }, '확정하기')));
      } else {
        body.append(steps(stepLabels, 1), h('p', { class: 'instr' }, '진술은 실제 경로 그대로 남아요'), h('p', { class: 'note' }, routeText(st.route)),
          h('div', { class: 'row actions' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { st.phase = 'route'; render(); } }, '이전'), h('button', { class: 'btn btn-primary', type: 'button', onclick: () => ctx.onDone({ route: st.route.slice(), claim: st.route.slice(), tamper: [] }) }, '확정하기')));
      }
    }
    render();
  }

  // morning view: {starts, sensors, res:{claims,motion,doors,claimDoors,mism,dmism}, checked, timerEnd, onCheck, vote}
  let timerId = null, hourSel = 1;
  let lastMorningKey = null;
  function morning(v) {
    const mk = G.round + ':' + (G.mode || ''); if (mk === lastMorningKey) keepScroll = true; lastMorningKey = mk;
    const res = v.res; const t = hourSel; const total = res.claims.length;
    const tokens = {}; res.claims.forEach((r, p) => (tokens[r[t]] = tokens[r[t]] || []).push(p));
    const bad = new Set(res.mism.filter(m => m.t === t).map(m => m.x));
    const sensors = t >= 1 ? v.sensors.map(k => { const lg = res.doors[k][t - 1], sd = res.claimDoors[k][t - 1]; return { k, txt: `${lg}회`, bad: lg !== sd }; }) : [];
    const dBad = t >= 1 ? v.sensors.filter(k => res.doors[k][t - 1] !== res.claimDoors[k][t - 1]) : [];
    const hours = h('div', { class: 'hours' }, N.HOURS.map((hh, k) => { const nb = res.mism.filter(m => m.t === k).length + (k >= 1 ? res.dmism.filter(d => d.i === k - 1).length : 0); return h('button', { type: 'button', 'aria-pressed': String(k === t), class: nb ? 'warn' : '', onclick: () => { hourSel = k; morning(v); } }, h('span', null, hh), h('small', null, nb ? `불일치 ${nb}` : '일치')); }));
    const claims = h('div', { class: 'claims' }, res.claims.map((r, p) => h('div', null, h('span', { class: 'sw', style: 'background:' + colorOf(p) }, iconOf(p)), h('b', null, nameOf(p)), h('span', { class: 'r' }, routeText(r)))));
    const timerEl = h('span', { class: 'timer', 'aria-live': 'off' });
    const checkBox = h('div');
    if (!v.checked) checkBox.append(h('p', { class: 'fine', style: 'margin:0 0 8px' }, '한 명을 고르면 기록상 범인일 수 있는지 알려 줘요. 한 판에 한 번.'), h('div', { class: 'row' }, [...Array(G.n).keys()].map(p => h('button', { class: 'chip', type: 'button', disabled: !v.onCheck, onclick: () => v.onCheck(p) }, nameOf(p)))));
    else checkBox.append(h('p', { class: 'result ' + (v.checked.ok ? 'warn' : 'ok') }, h('b', null, nameOf(v.checked.p)), v.checked.ok ? ' 님은 기록상 범인일 수 있어요' : ' 님은 기록상 범인일 수 없어요'));
    const vote = v.vote; const voteBox = h('div');
    if (vote.mode === 'group') {
      voteBox.append(h('p', { class: 'fine', style: 'margin:0 0 8px' }, '토론이 끝나면 다 같이 한 명을 고르세요.'), h('div', { class: 'row' }, [...Array(G.n).keys()].map(p => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(vote.selected === p), onclick: () => vote.onSelect(p) }, nameOf(p)))),
        h('div', { class: 'row actions' }, h('button', { class: 'btn btn-red', type: 'button', disabled: vote.selected == null, onclick: vote.onConfirm }, vote.selected == null ? '지목할 사람을 고르세요' : `${nameOf(vote.selected)} 님 지목하기`)));
    } else {
      voteBox.append(h('p', { class: 'fine', style: 'margin:0 0 8px' }, `각자 한 명에게 투표해요. ${vote.count} / ${G.n}명 투표함`),
        h('div', { class: 'row' }, [...Array(G.n).keys()].map(p => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(vote.mine === p), disabled: vote.locked, onclick: () => vote.onVote(p) }, nameOf(p)))));
      if (vote.locked) voteBox.append(h('p', { class: 'waitline', style: 'margin-top:10px' }, (vote.mine != null ? `${nameOf(vote.mine)} 님에게 투표했어요. ` : '투표했어요. ') + '모두 투표하면 결과가 나와요.'));
    }
    screen(top(`${G.round + 1} / ${G.rounds}판`), h('div', { class: 'card' },
      h('div', { class: 'row', style: 'justify-content:space-between;align-items:baseline' }, h('div', null, h('p', { class: 'kicker' }, '다음 날 아침'), h('h2', { class: 'big' }, '기록이 공개됐어요')), v.timerEnd ? timerEl : null),
      h('div', { class: 'legend' }, h('span', null, h('i', { class: 'lg-num' }, '2'), '동작 감지 · 조작 가능'), h('span', null, h('i', { class: 'lg-sensor' }, '1회'), '문 센서 · 조작 불가'), h('span', null, h('i', { class: 'lg-tok' }), '진술한 위치')),
      hours, plan({ counts: res.motion[t], badCnt: bad, bad, tokens, sensors }),
      bad.size || dBad.length ? h('p', { class: 'note warn' }, [bad.size ? `${N.HOURS[t]} 기록과 진술이 다른 방: ${[...bad].map(x => N.ROOMS[x]).join(', ')}.` : '', dBad.length ? ` 문 센서와 맞지 않는 문: ${dBad.map(roomPair).join(', ')}.` : ''].join('')) : h('p', { class: 'fine', style: 'margin-top:10px' }, `${N.HOURS[t]}의 기록과 진술이 일치해요.`)),
      h('div', { class: 'card' }, h('h3', null, '진술'), claims),
      h('div', { class: 'card' }, h('h3', null, '정밀 감식'), checkBox),
      h('div', { class: 'card' }, h('h3', null, '범인 지목'), voteBox));
    if (timerId) clearInterval(timerId);
    if (v.timerEnd) { let warned = false; const tick = () => { const left = Math.max(0, v.timerEnd - Date.now()); const m = Math.floor(left / 60000), sec = Math.floor(left / 1000) % 60; timerEl.textContent = `${m}:${String(sec).padStart(2, '0')}`; timerEl.classList.toggle('low', left < 30000); if (left === 0 && !warned) { warned = true; sfx('tick'); } }; tick(); timerId = setInterval(tick, 500); }
  }

  // reveal view
  function revealView(d) {
    if (timerId) clearInterval(timerId);
    sfx('stamp'); setTimeout(() => sfx(d.caught ? 'win' : 'lose'), 300);
    const step = { t: 0 }; const pl = h('div');
    const draw = () => { pl.innerHTML = ''; pl.append(plan({ paths: [{ route: d.claim, color: '#7A7891', dash: true }, { route: d.route, color: '#CF3838', upto: step.t }] })); };
    draw(); if (!reduceMotion) { const id = setInterval(() => { step.t++; draw(); if (step.t >= 4) clearInterval(id); }, 550); } else { step.t = 4; draw(); }
    const tam = d.applied.length ? d.applied.map(a => `${N.HOURS[a.t]} ${N.ROOMS[a.from]} → ${N.ROOMS[a.to]}`).join(', ') : '없음';
    const c = d.culprit;
    screen(top(`${G.round + 1} / ${G.rounds}판`), h('div', { class: 'card' },
      h('div', { class: 'stampwrap' }, h('span', { class: 'stamp' + (d.caught ? '' : ' miss') }, d.caught ? '검거' : '도주')),
      h('p', { class: 'kicker' }, '범인은'),
      h('h2', { class: 'big' }, `${nameOf(c)} 님이었어요`),
      h('p', null, d.caught ? '기록 속 거짓말을 찾아냈어요.' : (d.accused == null ? '의견이 갈려 아무도 지목하지 못했어요.' : `${nameOf(d.accused)} 님은 결백했어요.`)),
      pl,
      h('dl', { class: 'facts' }, h('dt', null, '실제 경로'), h('dd', null, routeText(d.route)), h('dt', null, '고친 기록'), h('dd', null, tam)),
      h('table', { class: 'score' }, h('thead', null, h('tr', null, h('th', null, '플레이어'), h('th', null, '이번 판'), h('th', null, '볼일'), h('th', null, '합계'))),
        h('tbody', null, [...Array(G.n).keys()].map(p => h('tr', null, h('td', null, h('span', { style: 'color:' + HEX[p] }, ICON[p] + ' '), nameOf(p)), h('td', null, '+' + d.pts[p]), h('td', null, p === c ? '범인' : (d.errandsDone[p] ? '완료' : '—')), h('td', null, d.total[p]))))),
      d.canNext ? h('div', { class: 'row' }, d.last ? h('button', { class: 'btn btn-primary', type: 'button', onclick: d.onFinal }, '최종 결과') : h('button', { class: 'btn btn-primary', type: 'button', onclick: d.onNext }, '다음 밤으로'))
        : h('p', { class: 'waitline' }, d.last ? '방장이 최종 결과를 열면 함께 보여요.' : '방장이 다음 밤을 시작하면 이어서 진행돼요.')));
  }
  function finalView(d) {
    const order = [...Array(G.n).keys()].sort((a, b) => d.total[b] - d.total[a]); const best = d.total[order[0]];
    const winners = order.filter(p => d.total[p] === best); const caught = d.history.filter(x => x.caught).length;
    sfx('win');
    const share = `밤의 기록 ${G.n}명 · ${d.rounds}판 · 범인 검거 ${caught}번 · 우승 ${winners.map(nameOf).join(', ')}`;
    screen(top('최종 결과'), h('div', { class: 'card' },
      h('p', { class: 'kicker' }, `${d.rounds}번의 밤 · 범인 검거 ${caught}번`),
      h('h2', { class: 'big' }, `${winners.map(nameOf).join(', ')} 님 우승`),
      h('ol', { class: 'rank' }, order.map((p, i) => h('li', { class: winners.includes(p) ? 'win' : '' }, h('span', { class: 'n' }, i + 1), h('span', { class: 'sw', style: 'background:' + HEX[p] }, ICON[p]), h('b', null, nameOf(p)), h('span', { class: 'pt' }, d.total[p] + '점')))),
      h('div', { class: 'row' }, d.canAgain ? h('button', { class: 'btn btn-primary', type: 'button', onclick: d.onAgain }, '한 번 더') : null,
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: async e => { const b = e.currentTarget; const url = location.origin + location.pathname; if (navigator.share) { try { await navigator.share({ title: '밤의 기록', text: share, url }); return; } catch (er) { if (er && er.name === 'AbortError') return; } } try { await navigator.clipboard.writeText(share + ' ' + url); b.textContent = '복사했어요'; } catch (er) { b.textContent = '복사하지 못했어요'; } } }, '결과 공유'),
        h('button', { class: 'btn btn-text', type: 'button', onclick: () => { leaveOnline(); showTitle(); } }, '처음으로'))));
  }

  // ============================================================
  // ONLINE (host-authoritative; roles and inputs never leave the host except to their owner)
  // ============================================================
  const ON = { room: null, isHost: false, peers: [], st: null, role: null, sentInput: null, hostState: null };
  function leaveOnline() { if (ON.room) { try { ON.room.leave(); } catch (e) { } } ON.room = null; ON.isHost = false; ON.st = null; ON.role = null; ON.hostState = null; }
  function setUrl(code) { try { history.replaceState(null, '', code ? '?room=' + code : location.pathname); } catch (e) { } }
  function hostId() { return ON.isHost ? ON.room.me : ON.room.hostId; }
  function toHost(msg) { if (ON.room) ON.room.send(hostId(), msg); }

  function showLobby(prefill) {
    leaveOnline();
    const ok = window.NoliNet && window.NoliNet.available();
    const nick = h('input', { id: 'nick', type: 'text', maxlength: '10', value: S.nick || '', placeholder: '닉네임', autocomplete: 'nickname', oninput: e => { S.nick = e.target.value; save(); } });
    const code = h('input', { id: 'code', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '4', placeholder: '0000', value: prefill || '' });
    const msg = h('p', { class: 'formmsg', role: 'alert' });
    const busy = (b, on, l) => { b.disabled = on; if (on) { b.dataset.l = b.textContent; b.textContent = l; } else if (b.dataset.l) b.textContent = b.dataset.l; };
    const create = h('button', { class: 'btn btn-primary', type: 'button', disabled: !ok, onclick: async e => { const b = e.currentTarget; busy(b, true, '만드는 중'); try { ON.room = await window.NoliNet.create('nt', CODE_LO, CODE_HI); ON.isHost = true; afterJoin(); } catch (er) { busy(b, false); msg.textContent = '방을 만들지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.'; } } }, '방 만들기');
    const join = h('button', { class: 'btn btn-ghost', type: 'button', disabled: !ok, onclick: async e => { const b = e.currentTarget; const c = code.value.replace(/\D/g, ''); if (c.length !== 4) { msg.textContent = '4자리 방 코드를 입력하세요.'; code.focus(); return; } busy(b, true, '연결 중'); try { ON.room = await window.NoliNet.join('nt', c); ON.isHost = false; afterJoin(); } catch (er) { busy(b, false); msg.textContent = er && er.type === 'not-found' ? '방을 찾을 수 없어요. 코드를 다시 확인해 주세요.' : '연결하지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.'; } } }, '참가하기');
    code.addEventListener('keydown', e => { if (e.key === 'Enter') join.click(); });
    screen(h('div', { class: 'card hero' }, brandLink(), h('div', { class: 'logo small' }, '밤의 기록'),
      h('h2', { class: 'screen-title' }, prefill ? '초대받은 방에 참가해요' : '온라인으로 함께하기'),
      h('div', { class: 'field' }, h('label', { for: 'nick' }, '닉네임'), nick),
      prefill ? null : h('div', { class: 'block' }, create, h('p', { class: 'fine' }, '방을 만들면 초대 링크를 보낼 수 있어요.')),
      h('div', { class: 'field' }, h('label', { for: 'code' }, '방 코드'), h('div', { class: 'row' }, code, join)), msg,
      ok ? null : h('p', { class: 'formmsg' }, '온라인 기능을 불러오지 못했어요. 페이지를 새로고침해 주세요.'),
      h('button', { class: 'btn btn-text', type: 'button', onclick: showTitle }, '돌아가기')));
    (prefill ? (S.nick ? join : nick) : nick).focus();
  }
  function afterJoin() {
    setUrl(ON.room.code);
    ON.room.presence({ name: cleanName(S.nick, '플레이어'), joinedAt: Date.now(), host: ON.isHost || null });
    ON.room.onPeers(ch => { ON.peers = ch.peers; if (ON.isHost) hostOnPeers(); if (!ON.st || ON.st.phase === 'lobby') lobbyView(); });
    ON.room.onMessage((d, from) => { if (ON.isHost && d && d.k && d.k.startsWith('to-host:')) hostHandle(d, from); else clientHandle(d, from); });
    ON.room.onStatus(st => { if (st === 'online' && !ON.isHost) toHost({ k: 'to-host:hello' }); if (st === 'reconnecting') toast('연결이 불안정해요. 다시 연결하는 중이에요.'); });
    if (!ON.isHost) toHost({ k: 'to-host:hello' });
    lobbyView();
  }
  function lobbyView() {
    if (ON.st && ON.st.phase !== 'lobby') return;
    const members = ON.peers.filter(p => !p.away).sort((a, b) => ((a.presence || {}).joinedAt || 0) - ((b.presence || {}).joinedAt || 0));
    const list = h('div', { class: 'players' }, members.map((p, i) => h('div', { class: 'prow' }, h('span', { class: 'sw', style: 'background:' + HEX[i % 6] }, ICON[i % 6]), h('span', null, cleanName((p.presence || {}).name, '플레이어'), p.sameTab ? h('span', { class: 'tag' }, '나') : null, (p.presence || {}).host ? h('span', { class: 'tag' }, '방장') : null))));
    const n = Math.min(6, members.length);
    const invite = h('button', { class: 'btn btn-primary', type: 'button', onclick: async e => { const b = e.currentTarget; const url = location.origin + location.pathname + '?room=' + ON.room.code; const text = `밤의 기록 같이 해요. 방 코드 ${ON.room.code}`; if (navigator.share) { try { await navigator.share({ title: '밤의 기록', text, url }); return; } catch (er) { if (er && er.name === 'AbortError') return; } } try { await navigator.clipboard.writeText(url); b.textContent = '링크를 복사했어요'; sfx('pop'); setTimeout(() => b.textContent = '초대 링크 보내기', 2000); } catch (er) { b.textContent = url; } } }, '초대 링크 보내기');
    screen(h('div', { class: 'card hero' }, brandLink(),
      h('div', { class: 'roomcode' }, h('span', null, '방 코드'), h('b', null, ON.room.code)),
      h('div', { class: 'row', style: 'margin-bottom:18px' }, invite),
      h('div', { class: 'field' }, h('span', { class: 'lab' }, `참가자 ${members.length}명`), list),
      ON.isHost ? h('div', null,
        h('div', { class: 'field' }, h('label', { class: 'toggle', for: 'tm2' }, h('input', { id: 'tm2', type: 'checkbox', checked: S.timer, onchange: e => { S.timer = e.target.checked; save(); } }), '토론 3분 타이머')),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', disabled: n < 3, onclick: hostStart }, n < 3 ? '3명 이상 모이면 시작할 수 있어요' : `${n}명으로 시작하기`), h('button', { class: 'btn btn-text', type: 'button', onclick: () => showLobby() }, '방 나가기')))
        : h('div', null, h('p', { class: 'waitline' }, '방장이 시작하면 바로 시작돼요.'), h('button', { class: 'btn btn-text', type: 'button', onclick: () => showLobby() }, '방 나가기'))));
  }

  // ----- host side -----
  function hostOnPeers() { const H = ON.hostState; if (!H) return; hostBroadcast(); }
  function hostStart() {
    const members = ON.peers.filter(p => !p.away).sort((a, b) => ((a.presence || {}).joinedAt || 0) - ((b.presence || {}).joinedAt || 0)).slice(0, 6);
    const n = members.length; const seed = Math.floor(Math.random() * 1e9);
    ON.hostState = { players: members.map(p => p.peer), names: members.map(p => cleanName((p.presence || {}).name, '플레이어')), n, round: 0, rounds: n, total: Array(n).fill(0), seed, order: shuffledOrder(n, seed), history: [], timer: S.timer };
    hostNewRound();
  }
  function hostNewRound() {
    const H = ON.hostState; H.rd = makeRound(H.n, H.seed + H.round * 7919, H.order[H.round]); H.inputs = []; H.res = null; H.checked = null; H.votes = {}; H.phase = 'night'; H.reveal = null; H.timerLeft = null;
    hostBroadcast(); H.players.forEach((pid, p) => hostSendRole(p));
  }
  function hostSendRole(p) { const H = ON.hostState; ON.room.send(H.players[p], { k: 'role', round: H.round, p, isC: p === H.rd.culprit, errand: H.rd.errands[p], start: H.rd.starts[p] }); }
  function hostPublic() {
    const H = ON.hostState; const away = H.players.map(pid => { const x = ON.peers.find(q => q.peer === pid); return !x || !!x.away; });
    const pub = { k: 'state', phase: H.phase, round: H.round, rounds: H.rounds, n: H.n, names: H.names, players: H.players, total: H.total, history: H.history, starts: H.rd ? H.rd.starts : null, away, submitted: H.players.map((_, p) => !!H.inputs[p]) };
    if (H.phase === 'morning' || H.phase === 'reveal') { const r = H.res; pub.morning = { sensors: H.rd.sensors, res: { claims: r.claims, motion: r.motion, doors: r.doors, claimDoors: r.claimDoors, mism: r.mism, dmism: r.dmism } }; pub.checked = H.checked; pub.voted = H.players.map((_, p) => H.votes[p] != null); pub.timerLeft = H.timerEnd ? Math.max(0, H.timerEnd - Date.now()) : null; }
    if (H.phase === 'reveal' || H.phase === 'final') pub.reveal = H.reveal;
    return pub;
  }
  function hostBroadcast() { if (!ON.hostState) return; ON.room.broadcast(hostPublic()); }
  function hostHandle(d, from) {
    const H = ON.hostState; const p = H ? H.players.indexOf(from) : -1;
    if (d.k === 'to-host:hello') { if (H) { ON.room.send(from, hostPublic()); if (p >= 0 && H.phase === 'night') hostSendRole(p); } return; }
    if (!H || p < 0) return;
    if (d.k === 'to-host:input' && H.phase === 'night' && d.round === H.round && !H.inputs[p]) {
      const rd = H.rd; const inp = d.inp || {}; const isC = p === rd.culprit;
      const okRoute = N.validRoute(inp.route, rd.starts[p], isC, !isC);
      const okClaim = !isC || N.validRoute(inp.claim, rd.starts[p], false, true);
      if (!okRoute || !okClaim) { ON.room.send(from, { k: 'reject' }); return; }
      H.inputs[p] = { route: inp.route, claim: isC ? inp.claim : inp.route, tamper: isC ? (inp.tamper || []).slice(0, 2) : [] };
      if (H.inputs.filter(Boolean).length === H.n) { H.res = N.resolve(rd, H.inputs); H.phase = 'morning'; H.timerEnd = H.timer ? Date.now() + 180000 : null; }
      hostBroadcast(); return;
    }
    if (d.k === 'to-host:check' && H.phase === 'morning' && !H.checked && Number.isInteger(d.target) && d.target >= 0 && d.target < H.n) { H.checked = { p: d.target, ok: N.consistentSuspects(H.rd, H.res, 2).includes(d.target), by: p }; hostBroadcast(); return; }
    if (d.k === 'to-host:vote' && H.phase === 'morning' && H.votes[p] == null && Number.isInteger(d.target) && d.target >= 0 && d.target < H.n) {
      H.votes[p] = d.target;
      if (Object.keys(H.votes).length === H.n) {
        const tally = Array(H.n).fill(0); Object.values(H.votes).forEach(t => tally[t]++); const mx = Math.max(...tally); const top = tally.map((c, i) => c === mx ? i : -1).filter(i => i >= 0);
        const accused = top.length === 1 ? top[0] : null; const sc = N.score(H.rd, H.res, accused);
        sc.pts.forEach((v, i) => H.total[i] += v); H.history.push({ culprit: H.rd.culprit, caught: sc.caught });
        const ci = H.inputs[H.rd.culprit];
        H.reveal = { culprit: H.rd.culprit, route: ci.route, claim: ci.claim, applied: H.res.applied, pts: sc.pts, total: H.total.slice(), errandsDone: H.res.errandsDone, caught: sc.caught, accused, votes: H.votes, last: H.round + 1 >= H.rounds };
        H.phase = 'reveal';
      }
      hostBroadcast(); return;
    }
    if (d.k === 'to-host:next' && from === ON.room.me) {
      if (H.phase === 'reveal' && H.round + 1 < H.rounds) { H.round++; hostNewRound(); }
      else if (H.phase === 'reveal') { H.phase = 'final'; hostBroadcast(); }
      else if (H.phase === 'final') { hostStart(); }
    }
  }

  // ----- client side (everyone, including host) -----
  function clientHandle(d) {
    if (!d || !d.k) return;
    if (d.k === 'role') { if (!ON.role || ON.role.round !== d.round) { ON.role = d; ON.sentInput = null; } renderOnline(); return; }
    if (d.k === 'reject') { ON.sentInput = null; toast('행동을 다시 정해 주세요.'); renderOnline(); return; }
    if (d.k === 'state') {
      const prev = ON.st; ON.st = d; G = { mode: 'online', n: d.n, names: d.names, round: d.round, rounds: d.rounds };
      if (d.timerLeft != null && (!prev || prev.phase !== 'morning' || prev.round !== d.round || !ON.timerEnd)) ON.timerEnd = Date.now() + d.timerLeft;
      if (d.phase !== 'morning') ON.timerEnd = null;
      if (!prev || prev.phase !== d.phase || prev.round !== d.round) { hourSel = 1; ON.myVote = null; }
      renderOnline();
    }
  }
  function myIndex() { return ON.st ? ON.st.players.indexOf(ON.room.me) : -1; }
  let lastRender = '';
  function renderOnline() {
    const st = ON.st; if (!st || st.phase === 'lobby') return;
    const me = myIndex();
    if (me < 0) { screen(h('div', { class: 'card' }, h('h2', null, '이미 게임이 진행 중이에요'), h('p', null, '다음 게임부터 함께할 수 있어요.'), h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { leaveOnline(); showTitle(); } }, '나가기'))); return; }
    const key = JSON.stringify([st.phase, st.round, st.submitted, st.checked, st.voted, st.away, !!ON.role, ON.sentInput && ON.sentInput.round, ON.myVote]);
    if (key === lastRender && st.phase === 'night' && !st.submitted[me] && !ON.sentInput) return; // don't wipe an in-progress turn
    lastRender = key;
    if (st.phase === 'night') {
      if (!st.submitted[me] && !(ON.sentInput && ON.sentInput.round === st.round)) {
        if (!ON.role || ON.role.round !== st.round) { intro(st.starts, st.starts.length, null, '역할을 받는 중이에요'); return; }
        if (ON.introSeen !== st.round) { ON.introSeen = st.round; intro(st.starts, st.starts.length, () => { lastRender = ''; renderOnline(); }, '내 역할 보기'); return; }
        if (document.querySelector('.who')) return; // turn already on screen
        const r = ON.role;
        secretTurn(me, { start: r.start, isC: r.isC, errand: r.errand, onDone: inp => { ON.sentInput = { round: st.round, inp }; toHost({ k: 'to-host:input', round: st.round, inp }); renderOnline(); } });
        return;
      }
      const waiting = st.names.filter((_, p) => !st.submitted[p]); keepScroll = true;
      screen(top(`${st.round + 1} / ${st.rounds}판`), h('div', { class: 'card' }, h('p', { class: 'kicker' }, '밤이 깊어 가요'), h('h2', { class: 'big' }, '다른 플레이어를 기다리는 중'),
        h('div', { class: 'players', style: 'margin-top:12px' }, st.names.map((nm, p) => h('div', { class: 'prow' }, h('span', { class: 'sw', style: 'background:' + HEX[p] }, ICON[p]), h('span', null, nm, st.away[p] ? h('span', { class: 'tag warn' }, '연결 중') : null), h('span', { class: 'sub' }, st.submitted[p] ? '완료' : '정하는 중'), h('span')))),
        h('p', { class: 'fine', style: 'margin-top:12px' }, waiting.length ? `${waiting.length}명 남았어요` : '곧 아침이 와요')));
      return;
    }
    if (st.phase === 'morning') {
      const mv = { starts: st.starts, sensors: st.morning.sensors, res: st.morning.res, checked: st.checked, timerEnd: ON.timerEnd,
        onCheck: st.checked ? null : p => toHost({ k: 'to-host:check', target: p }),
        vote: { mode: 'each', count: st.voted.filter(Boolean).length, locked: !!st.voted[me] || ON.myVote != null, mine: ON.myVote != null ? ON.myVote : -1, onVote: p => { ON.myVote = p; sfx('tap'); toHost({ k: 'to-host:vote', target: p }); renderOnlineForce(); } } };
      if (mv.vote.mine === -1) mv.vote.mine = null;
      morning(mv); return;
    }
    if (st.phase === 'reveal') {
      const d = Object.assign({}, st.reveal, { canNext: ON.isHost, onNext: () => toHost({ k: 'to-host:next' }), onFinal: () => toHost({ k: 'to-host:next' }) });
      revealView(d); return;
    }
    if (st.phase === 'final') { finalView({ total: st.total, history: st.history, rounds: st.rounds, canAgain: ON.isHost, onAgain: () => toHost({ k: 'to-host:next' }) }); }
  }
  function renderOnlineForce() { lastRender = ''; renderOnline(); }

  // ============================================================
  // BOOT
  // ============================================================
  const q = new URLSearchParams(location.search); const room = (q.get('room') || '').replace(/\D/g, '').slice(0, 4);
  if (room.length === 4) { S.mode = 'online'; showLobby(room); } else showTitle();
  window.__night = { get G() { return G; }, get ON() { return ON; } };
})();
