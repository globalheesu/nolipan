(function () {
  'use strict';
  const E = window.OverlapEngine;
  const D = window.OVERLAP_DATA;
  const HEX = ['#2563D9', '#E8761A', '#7C4DDB', '#0E8F84', '#D53F7C', '#8A5A2B'];
  const ICON = ['●', '▲', '■', '★', '◆', '✚'];
  const AI_NAMES = ['갈매기', '수달', '너구리', '물범', '두루미', '해달'];
  const HOME = '../';
  const SEAT = [[0, 1], [0, -1], [-1, 0], [1, 0], [-1, -1], [1, -1]];
  const EVENTS = {
    storm: ['폭풍', '이번 라운드는 대각선으로도 이어 그릴 수 있어요.'],
    fork: ['갈림길', '칸 수를 두 갈래로 나눠 그려도 돼요.'],
    tailwind: ['순풍', '빈 가장자리 칸 어디서든 새로 상륙해 시작할 수 있어요.'],
    calm: ['고요', '걸음 수가 같아도 폐허가 생기지 않아요.']
  };
  const LEVELS = {
    easy: ['random', 'greedy', 'random', 'greedy', 'random'],
    normal: ['greedy', 'aggro', 'greedy', 'smart', 'aggro'],
    hard: ['reader', 'reader', 'reader', 'reader', 'reader']
  };
  const STRAT_NAME = { random: '초보', greedy: '욕심쟁이', smart: '신중파', aggro: '돌격대', reader: '독심술사' };
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- tiny DOM helper ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) { if (kid == null || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); }
    return el;
  }
  const svgNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs) { const el = document.createElementNS(svgNS, tag); for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v); return el; }
  const sleep = ms => new Promise(r => setTimeout(r, (reduceMotion || ui.instant) ? 0 : ms));
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('overlap:' + k)); localStorage.setItem('overlap:' + k, JSON.stringify(v)); } catch (e) { return null; } }
  function cleanName(x, fallback) { const t = String(x || '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g, '').trim().slice(0, 10); return t || fallback; }

  // ---------- state ----------
  const app = document.getElementById('app');
  const defaults = { mode: 'solo', np: 4, humans: 2, level: 'normal', map: 0, timer: true, names: ['플레이어 1', '플레이어 2', '플레이어 3', '플레이어 4', '플레이어 5', '플레이어 6'], nick: '' };
  let S = { settings: Object.assign({}, defaults, store('settings') || {}), seed: 1, tutorial: false, actions: [], screen: 'title', seats: [] };
  let g = null;
  let ui = {};
  let els = {};

  function rulesFor(tutorial) {
    const R = Object.assign(E.defaultRules(), D.v12);
    if (tutorial) {
      R.deck = R.deck.map(([v]) => [v, null]);
      R.rounds = Object.assign({}, R.rounds, { 4: 5 });
      R.publicCount = Object.assign({}, R.publicCount, { 4: 0 });
    }
    return R;
  }
  function mapPool(np) { return np === 3 ? D.maps.small : D.maps.big; }
  function mapFor(np, idx) { const pool = mapPool(np); return pool[idx % pool.length]; }
  function saveSettings() { store('settings', S.settings); }

  // seats: [{kind:'local'|'remote'|'ai', name, strat?, peer?}]
  const kindOf = p => S.seats[p].kind;
  const nameOf = p => S.seats[p].name;
  const isHuman = p => kindOf(p) !== 'ai';
  const humans = () => S.seats.map((x, p) => p).filter(isHuman);
  const locals = () => S.seats.map((x, p) => p).filter(p => kindOf(p) === 'local');
  const expsOf = p => g.exps.filter(e => e.player === p);
  const online = () => S.mode === 'online';
  const hotseat = () => S.mode === 'hotseat';

  // ============================================================
  // TITLE
  // ============================================================
  function showTitle() {
    S.screen = 'title'; g = null; clearTimer(); closeModal(); leaveTable();
    app.innerHTML = '';
    const st = S.settings;
    const seg = (key, val, label, after) => h('button', { type: 'button', 'aria-pressed': String(st[key] === val), onclick: () => { st[key] = val; if (after) after(); saveSettings(); showTitle(); } }, label);
    const modeRow = h('div', { class: 'seg seg-wide' }, seg('mode', 'solo', '컴퓨터와'), seg('mode', 'hotseat', '한 기기로'), seg('mode', 'online', '온라인'));
    const body = [];
    if (st.mode === 'online') {
      body.push(h('p', { class: 'lead' }, '친구가 각자 자기 폰으로 참가해요. 방을 만들고 초대 링크를 보내세요.'));
      body.push(h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => showOnlineLobby() }, '계속하기'), h('button', { class: 'btn btn-ghost', type: 'button', onclick: showRules }, '규칙 보기')));
    } else {
      if (st.mode === 'hotseat') {
        const maxH = 6; if (st.humans > maxH) st.humans = maxH; if (st.np < st.humans) st.np = st.humans;
        body.push(h('div', { class: 'field' }, h('span', { class: 'lab' }, '사람 수'), h('div', { class: 'seg' }, [2, 3, 4, 5, 6].map(n => seg('humans', n, n + '명', () => { if (st.np < n) st.np = n; })))));
        const names = h('div', { class: 'names' });
        for (let i = 0; i < st.humans; i++) names.append(h('label', { class: 'namefield', for: 'nm-' + i }, h('span', { class: 'sw', style: 'background:' + HEX[i] }, ICON[i]),
          h('input', { id: 'nm-' + i, type: 'text', maxlength: '10', value: st.names[i] || '', 'aria-label': (i + 1) + '번째 플레이어 이름', oninput: e => { st.names[i] = e.target.value; saveSettings(); } })));
        body.push(h('div', { class: 'field' }, h('span', { class: 'lab' }, '이름'), names));
      }
      const minNp = st.mode === 'hotseat' ? st.humans : 2;
      body.push(h('div', { class: 'field' }, h('span', { class: 'lab' }, st.mode === 'hotseat' ? '전체 인원' : '인원'), h('div', { class: 'seg' }, [2, 3, 4, 5, 6].filter(n => n >= minNp).map(n => seg('np', n, n + '명', () => { st.map = 0; })))));
      if (!(st.mode === 'hotseat' && st.np === st.humans)) body.push(h('div', { class: 'field' }, h('span', { class: 'lab' }, '컴퓨터 난이도'), h('div', { class: 'seg' }, seg('level', 'easy', '쉬움'), seg('level', 'normal', '보통'), seg('level', 'hard', '어려움'))));
      body.push(h('div', { class: 'field' }, h('span', { class: 'lab' }, '지도'), h('div', { class: 'seg' }, mapPool(st.np).map((m, i) => seg('map', i, m.name)))));
      body.push(h('div', { class: 'field' }, h('label', { class: 'toggle', for: 'opt-timer' }, h('input', { id: 'opt-timer', type: 'checkbox', checked: st.timer, onchange: e => { st.timer = e.target.checked; saveSettings(); } }), '제한 시간 ' + (st.np === 2 ? '60초' : '45초'))));
      body.push(h('div', { class: 'row' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => startLocal(false) }, '게임 시작'),
        st.mode === 'solo' ? h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => startLocal(true) }, '튜토리얼') : null,
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: showRules }, '규칙 보기')));
      const note = st.mode === 'hotseat' ? '차례가 오면 기기를 받아 몰래 그리고 다음 사람에게 넘겨요.' : (st.np === 2 ? '2인 게임에서는 각자 탐험대 2개를 움직여요.' : null);
      if (note) body.push(h('p', { class: 'fine', style: 'margin:14px 0 0' }, note));
    }
    app.append(h('div', { class: 'title' }, h('div', { class: 'title-sheet' }, brandLink(), logo(),
      h('p', { class: 'tagline' }, '몰래 그린 길을 한꺼번에 겹쳐요. 부딪힌 칸은 먼저 도착한 사람의 것.'),
      h('div', { class: 'meta-chips' }, h('span', null, '2–6명'), h('span', null, '15–20분'), h('span', null, '8세 이상')),
      h('div', { class: 'field' }, h('span', { class: 'lab' }, '플레이 방식'), modeRow), ...body)));
  }
  function brandLink() { return h('a', { class: 'brand', href: HOME, 'aria-label': '놀이판 홈' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), '놀이판'); }
  function logo() { return h('div', { class: 'logo', 'aria-label': 'OVERLAP' }, h('span', { class: 'l1', 'aria-hidden': 'true' }, 'OVERLAP'), h('span', { class: 'l2', 'aria-hidden': 'true' }, 'OVERLAP'), h('span', { class: 'l3' }, 'OVERLAP')); }

  // ============================================================
  // START (solo / hotseat)
  // ============================================================
  function startLocal(tutorial, seed) {
    const st = S.settings;
    S.mode = st.mode === 'hotseat' ? 'hotseat' : 'solo';
    S.tutorial = tutorial && S.mode === 'solo';
    const np = S.tutorial ? 4 : st.np;
    const strats = S.tutorial ? ['greedy', 'random', 'greedy', 'random', 'greedy'] : LEVELS[st.level];
    const nh = S.mode === 'hotseat' ? st.humans : 1;
    S.seats = [];
    let ai = 0;
    for (let p = 0; p < np; p++) {
      if (p < nh) S.seats.push({ kind: 'local', name: S.mode === 'hotseat' ? cleanName(st.names[p], '탐험가 ' + (p + 1)) : '나' });
      else { S.seats.push({ kind: 'ai', strat: strats[ai % strats.length], name: AI_NAMES[ai] }); ai++; }
    }
    S.seed = seed || Math.floor(Math.random() * 1e9); S.actions = []; S.screen = 'game';
    S.cfg = { np, map: S.tutorial ? 0 : st.map, timer: st.timer };
    build(); runPorts();
  }
  function build() {
    const np = S.seats.length;
    const controllers = S.seats.map(x => x.kind === 'ai' ? { kind: 'ai', strat: x.strat } : { kind: x.kind });
    g = E.newGame({ nPlayers: np, mapDef: mapFor(np, S.cfg.map), seed: S.seed, rules: rulesFor(S.tutorial), controllers });
    ui = { phase: 'ports', pickIdx: 0, plans: {}, curExp: null, active: 0, instant: ui.instant, queue: ui.queue || [], coachSeen: {}, newCells: new Set(), viewer: S.mode === 'hotseat' ? null : locals()[0], drawer: null, roundPlans: {}, secretDone: new Set() };
    renderGame();
  }

  // ============================================================
  // GAME SCREEN
  // ============================================================
  function renderGame() {
    app.innerHTML = '';
    const map = g.map;
    els.round = h('span', { class: 'round' });
    els.sound = h('button', { class: 'iconbtn', type: 'button', 'aria-pressed': String(NoliSFX.on()), 'aria-label': '소리', onclick: e => { NoliSFX.set(!NoliSFX.on()); e.currentTarget.setAttribute('aria-pressed', String(NoliSFX.on())); e.currentTarget.textContent = NoliSFX.on() ? '소리' : '무음'; } }, NoliSFX.on() ? '소리' : '무음');
    const top = h('div', { class: 'topbar' }, h('h1', null, 'OVERLAP'), els.round, els.sound,
      h('button', { class: 'iconbtn', type: 'button', onclick: showRules }, '규칙'),
      h('button', { class: 'iconbtn', type: 'button', onclick: confirmQuit }, '나가기'));
    els.board = h('div', { class: 'board', style: `grid-template-columns:repeat(${map.w},1fr);grid-template-rows:repeat(${map.h},1fr)`, role: 'grid', 'aria-label': '섬 지도' });
    els.cells = [];
    for (let i = 0; i < map.n; i++) {
      const t = map.type[i]; const cls = ['cell']; if (t === '~') cls.push('sea'); if (t === 'M') cls.push('mtn');
      const c = h('div', { class: cls.join(' '), 'data-i': i, role: 'gridcell', 'aria-label': cellLabel(i) });
      const glyph = { M: 'g-mtn', T: 'g-tre', V: 'g-vil', S: 'g-ruins', P: 'g-port' }[t];
      if (glyph) { const sv = s('svg', { class: 'glyph', viewBox: '0 0 24 24' }); sv.append(s('use', { href: '#' + glyph })); const f = h('div', { class: 'feat' }); f.append(sv); c.append(f); }
      if (t === 'P') c.append(h('span', { class: 'portno' }, map.ports.find(p => p.idx === i).id));
      els.cells.push(c); els.board.append(c);
    }
    const cx = h('div', { class: 'coords-x', style: `grid-template-columns:repeat(${map.w},1fr)` }); for (let x = 0; x < map.w; x++) cx.append(h('span', null, 'ABCDEFGHIJ'[x]));
    const cy = h('div', { class: 'coords-y', style: `grid-template-rows:repeat(${map.h},1fr)` }); for (let y = 0; y < map.h; y++) cy.append(h('span', null, y + 1));
    els.drawLayer = h('div', { class: 'layer draw-layer' });
    els.fx = h('div', { class: 'layer' });
    els.stamp = h('div', { class: 'stamp', 'aria-hidden': 'true' }, 'OVERLAP!');
    els.cover = h('div', { class: 'cover', hidden: true });
    const boardWrap = h('div', { style: 'position:relative' }, els.board, els.drawLayer, els.fx, els.stamp, els.cover);
    els.dock = h('div', { class: 'dock', 'aria-live': 'polite' });
    els.players = h('div', { class: 'players' });
    els.goals = h('div');
    const legend = h('div', { class: 'legend' }, [['g-tre', '보물 2점'], ['g-vil', '마을 2·5·9·14점'], ['g-ruins', '중앙 유적 칸당 2점'], ['g-mtn', '산: 못 지나감'], ['g-port', '항구: 시작 칸']].map(([id, t]) => { const sv = s('svg', { viewBox: '0 0 24 24' }); sv.append(s('use', { href: '#' + id })); return h('div', null, sv, t); }), h('div', null, h('span', { style: 'width:18px;height:18px;border-radius:4px;background:#262626;display:inline-block' }), '폐허: 못 지나감'));
    els.coachSlot = h('div', { 'aria-live': 'polite' });
    const panel = h('div', { class: 'panel' },
      h('div', { class: 'box' }, h('h2', null, online() ? `플레이어 · 방 ${S.code}` : '플레이어'), els.players),
      h('div', { class: 'box' }, h('h2', null, '목표'), els.goals),
      h('div', { class: 'box' }, h('h2', null, '지도 보는 법'), legend));
    const main = h('div', { class: 'main' }, top, els.coachSlot, h('div', { class: 'table' }, h('div', { class: 'sheet' }, cx, cy, boardWrap)), els.dock);
    app.append(h('div', { class: 'game' }, main, panel));
    bindBoard();
    renderAll();
  }
  function cellLabel(i) { const x = i % g.map.w, y = (i / g.map.w) | 0; const t = { M: '산', '~': '바다', T: '보물', V: '마을', S: '유적', P: '항구', '.': '초원' }[g.map.type[i]]; return 'ABCDEFGHIJ'[x] + (y + 1) + ' ' + t; }

  function renderAll() { if (ui.instant || !els.board) return; renderBoard(); renderDraw(); renderDock(); renderPanel(); els.round.textContent = g.round < g.nRounds ? `${g.round + 1} / ${g.nRounds} 라운드` : '종료'; }

  function renderBoard() {
    const map = g.map; const starts = new Set(ui.phase === 'draw' ? currentStarts() : []);
    const freePorts = new Set(ui.phase === 'ports' && ui.picker != null ? E.freePorts(g).map(p => p.idx) : []);
    for (let i = 0; i < map.n; i++) {
      const c = els.cells[i]; const o = g.owner[i];
      let cube = c.querySelector('.cube');
      const want = o === -2 ? 'ruin' : (o >= 0 ? 'p' + o : '');
      if (cube && cube.dataset.k !== want) { cube.remove(); cube = null; }
      if (!cube && want) {
        cube = h('div', { class: 'cube' + (o === -2 ? ' ruin' : '') + (map.type[i] === 'P' ? ' port' : '') + (ui.newCells.has(i) ? ' pop' : ''), 'data-k': want });
        if (o >= 0) { const p = g.exps[o].player; cube.style.background = HEX[p]; cube.append(h('span', { class: 'ico' }, ICON[p])); }
        c.append(cube);
      }
      const f = c.querySelector('.feat'); if (f) f.style.opacity = o === -1 ? '' : '0.2';
      c.classList.toggle('start', starts.has(i));
      c.classList.toggle('portpick', freePorts.has(i));
    }
    ui.newCells = new Set();
  }

  // ---------- drawing ----------
  function card() { return g.deck[g.round]; }
  function curPlan() { const e = ui.curExp; if (!ui.plans[e]) ui.plans[e] = { paths: [[]], plus: false, landing: false }; return ui.plans[e]; }
  function budget(e) { const pl = ui.plans[e]; return card().v + (pl && pl.plus ? 1 : 0); }
  function used(e) { const pl = ui.plans[e]; return pl ? pl.paths.reduce((a, p) => a + p.length, 0) : 0; }
  function blockSet(exceptPathIdx) {
    const b = new Set();
    for (const ex of expsOf(ui.drawer)) { const pl = ui.plans[ex.id]; if (!pl) continue; pl.paths.forEach((p, pi) => { if (ex.id === ui.curExp && pi === exceptPathIdx) return; p.forEach(c => b.add(c)); }); }
    return b;
  }
  function optFor(e, pathIdx) { const pl = ui.plans[e] || {}; return { diag: card().ev === 'storm', landing: card().ev === 'tailwind' || !!pl.landing, block: blockSet(pathIdx) }; }
  function currentStarts() {
    if (ui.curExp == null) return [];
    const p = curPlan().paths[ui.active];
    if (p.length > 0 || used(ui.curExp) >= budget(ui.curExp)) return [];
    return E.startCells(g, g.exps[ui.curExp], optFor(ui.curExp, ui.active));
  }
  function canExtend(cell) {
    const p = curPlan().paths[ui.active]; const opt = optFor(ui.curExp, ui.active);
    if (used(ui.curExp) >= budget(ui.curExp)) return false;
    if (!E.passable(g.map, cell) || g.owner[cell] !== -1 || p.includes(cell) || opt.block.has(cell)) return false;
    if (p.length === 0) return E.startCells(g, g.exps[ui.curExp], opt).includes(cell);
    return E.neigh(g.map, p[p.length - 1], opt.diag).includes(cell);
  }
  function bindBoard() {
    let down = false, moved = false, downCell = -1;
    const cellAt = (x, y) => { const el = document.elementFromPoint(x, y); const c = el && el.closest && el.closest('.cell'); return c ? +c.dataset.i : -1; };
    els.board.addEventListener('pointerdown', ev => {
      const i = cellAt(ev.clientX, ev.clientY); if (i < 0) return;
      if (ui.phase === 'ports' && ui.picker != null) { if (E.freePorts(g).some(p => p.idx === i)) localPort(i); return; }
      if (ui.phase !== 'draw' || ui.curExp == null) return;
      ev.preventDefault(); down = true; moved = false; downCell = i;
      const p = curPlan().paths[ui.active];
      if (p.length && p[p.length - 1] === i) return;
      if (canExtend(i)) { p.push(i); moved = true; NoliSFX.play('step'); afterEdit(); }
    });
    els.board.addEventListener('pointermove', ev => {
      if (!down) return; const i = cellAt(ev.clientX, ev.clientY); if (i < 0) return;
      const p = curPlan().paths[ui.active];
      if (p.length >= 2 && p[p.length - 2] === i) { p.pop(); moved = true; afterEdit(); return; }
      if (p[p.length - 1] === i) return;
      if (canExtend(i)) { p.push(i); moved = true; NoliSFX.play('step'); afterEdit(); }
    });
    const up = () => { if (!down) return; down = false; const p = ui.phase === 'draw' && ui.curExp != null ? curPlan().paths[ui.active] : null; if (p && !moved && p.length && p[p.length - 1] === downCell) { p.pop(); afterEdit(); } };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  function afterEdit() { renderBoard(); renderDraw(); renderDock(); }

  function renderDraw() {
    els.drawLayer.innerHTML = '';
    if (ui.phase !== 'draw' || ui.drawer == null) return;
    const sv = s('svg', { viewBox: `0 0 ${g.map.w} ${g.map.h}` });
    for (const ex of expsOf(ui.drawer)) { const pl = ui.plans[ex.id]; if (!pl) continue; pl.paths.forEach(p => drawPath(sv, p, HEX[ui.drawer], ex.id === ui.curExp ? 1 : 0.45)); }
    els.drawLayer.append(sv);
  }
  function drawPath(sv, p, color, op) {
    if (!p.length) return;
    const w = g.map.w; const pt = i => [(i % w) + 0.5, ((i / w) | 0) + 0.5];
    const d = p.map((c, k) => (k ? 'L' : 'M') + pt(c).join(' ')).join(' ');
    sv.append(s('path', { d, stroke: color, opacity: op, fill: 'none', 'stroke-width': 0.22, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    p.forEach((c, k) => { const [x, y] = pt(c); sv.append(s('circle', { cx: x, cy: y, r: 0.24, fill: color, opacity: op })); const t = s('text', { x, y, class: 'stepno', fill: '#fff', opacity: op }); t.textContent = k + 1; sv.append(t); });
  }

  // ---------- dock ----------
  function renderDock() {
    const d = els.dock; d.innerHTML = '';
    if (ui.phase === 'ports') {
      if (ui.picker != null) d.append(h('div', { class: 'msg' }, S.mode === 'solo' ? '시작할 항구를 고르세요.' : [h('b', { style: 'color:' + HEX[ui.picker] }, nameOf(ui.picker)), ' 님, 시작할 항구를 고르세요.']));
      else d.append(h('div', { class: 'msg' }, ui.waitMsg || '다른 플레이어가 항구를 고르고 있어요'));
      return;
    }
    if (ui.phase === 'wait') { d.append(h('div', { class: 'msg' }, ui.waitMsg || '잠시만 기다려 주세요')); return; }
    if (ui.phase === 'handoff') return;
    if (ui.phase === 'draw') {
      const c = card(); const ev = EVENTS[c.ev]; const p = ui.drawer; const me = g.players[p];
      d.append(h('div', { class: 'card-now' }, h('div', { class: 'ecard' + (ui.flip ? ' flip' : ''), 'aria-label': c.v + '칸' }, c.v),
        h('div', { class: 'card-text' }, h('strong', null, (hotseat() ? nameOf(p) + ' · ' : '') + `${c.v}칸 길 그리기` + (ev ? ` · ${ev[0]}` : '')), h('span', null, ev ? ev[1] : '빛나는 칸에서 시작해 끌어서 그리세요.'))));
      ui.flip = false;
      const mine = expsOf(p);
      if (mine.length > 1) d.append(h('div', { class: 'actions' }, mine.map((ex, k) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(ui.curExp === ex.id), onclick: () => { ui.curExp = ex.id; ui.active = 0; afterEdit(); } }, `탐험대 ${'AB'[k]} (${used(ex.id)}/${budget(ex.id)})`))));
      const pl = curPlan(); const b = budget(ui.curExp); const u = used(ui.curExp);
      const meter = h('div', { class: 'meter', 'aria-label': `${u}/${b}칸`, style: '--mc:' + HEX[p] }); for (let k = 0; k < b; k++) meter.append(h('i', { class: k < u ? 'on' : '' }));
      d.append(meter);
      if (ui.timerOn) { els.timerBar = h('div'); d.append(h('div', { class: 'timer', 'aria-hidden': 'true' }, els.timerBar)); updateTimerBar(); }
      const supplyLeft = me.supply - mine.reduce((a, ex) => { const q = ui.plans[ex.id]; return a + (q ? (q.plus ? 1 : 0) + (q.landing ? 2 : 0) : 0); }, 0);
      const row = h('div', { class: 'actions' });
      row.append(h('button', { class: 'chip', type: 'button', 'aria-pressed': String(pl.plus), disabled: !pl.plus && supplyLeft < 1, onclick: () => { pl.plus = !pl.plus; trimToBudget(); afterEdit(); } }, '+1칸 · 보급 1'));
      if (c.ev !== 'tailwind') row.append(h('button', { class: 'chip', type: 'button', 'aria-pressed': String(pl.landing), disabled: !pl.landing && supplyLeft < 2, onclick: () => { pl.landing = !pl.landing; if (!pl.landing) { pl.paths = [[]]; ui.active = 0; } afterEdit(); } }, '상륙 · 보급 2'));
      if (c.ev === 'fork') row.append(h('button', { class: 'chip', type: 'button', disabled: pl.paths.length > 1 || !pl.paths[0].length || u >= b, onclick: () => { pl.paths.push([]); ui.active = 1; afterEdit(); } }, '두 번째 갈래'));
      row.append(h('button', { class: 'chip', type: 'button', onclick: () => { pl.paths = [[]]; ui.active = 0; afterEdit(); } }, '지우기'));
      d.append(row);
      const empty = mine.every(ex => used(ex.id) === 0);
      const blocked = mine.filter(ex => used(ex.id) === 0 && !canAnyStart(ex.id)).length;
      d.append(h('div', { class: 'actions' }, h('div', { class: 'msg grow' }, `보급 ${supplyLeft}개` + (blocked ? ' · 갈 곳이 없으면 쉬고 보급 1개를 받아요' : '')),
        h('button', { class: 'overlap-btn', type: 'button', onclick: submitPlan }, empty ? '이번엔 쉬기' : (hotseat() && ui.drawQueue.length ? '다 그렸어요' : '오버랩!'))));
      return;
    }
    if (ui.phase === 'reveal') { d.append(h('div', { class: 'msg' }, ui.revealMsg || '시트를 겹치는 중'), h('div', { class: 'actions' }, h('button', { class: 'chip', type: 'button', onclick: () => { ui.skip = true; } }, '건너뛰기'))); return; }
    if (ui.phase === 'after') {
      d.append(h('div', { class: 'msg' }, ui.revealMsg));
      d.append(h('div', { class: 'actions' }, h('div', { class: 'grow' }), h('button', { class: 'overlap-btn', type: 'button', onclick: nextRound }, g.round >= g.nRounds ? '결과 보기' : '다음 라운드')));
      return;
    }
    if (ui.phase === 'end') d.append(h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: showResults }, '결과 보기'), online() ? null : h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => startLocal(false) }, '한 판 더')));
  }
  function canAnyStart(e) { return E.startCells(g, g.exps[e], optFor(e, 0)).length > 0; }
  function trimToBudget() { const e = ui.curExp; const b = budget(e); const pl = ui.plans[e]; let tot = 0; pl.paths.forEach(p => { while (tot + p.length > b) p.pop(); tot += p.length; }); }

  // ---------- panel ----------
  function renderPanel() {
    const res = E.score(g);
    els.players.innerHTML = '';
    g.players.forEach((p, k) => {
      const r = res[k]; const own = k === ui.viewer; const shown = own ? r.total : r.total - r.secret;
      const tag = kindOf(k) === 'ai' ? ` · ${STRAT_NAME[p.ctrl.strat]}` : (online() ? (kindOf(k) === 'local' ? ' · 나' : (peerPresent(k) ? '' : ' · 연결 끊김')) : '');
      els.players.append(h('div', { class: 'prow' + (k === ui.drawer && ui.phase === 'draw' ? ' turn' : '') }, h('span', { class: 'sw', style: 'background:' + HEX[k] }, ICON[k]),
        h('span', null, nameOf(k) + tag),
        h('span', { class: 'sub' }, `${r.cells}칸 · 보급 ${p.supply}`), h('span', { class: 'num', title: own ? '현재 점수' : '비밀 목표를 뺀 점수' }, shown)));
    });
    els.goals.innerHTML = '';
    if (!g.publicGoals.length && S.tutorial) { els.goals.append(h('p', { class: 'fine', style: 'margin:0' }, '튜토리얼에서는 목표 카드를 쓰지 않아요.')); return; }
    const defs = E.publicDefs(g); const pts = g.np <= 3 ? g.rules.goalPts23 : g.rules.goalPts4; const vp = ui.viewer;
    for (const gid of g.publicGoals) {
      const def = defs[gid - 1]; const vals = res.map(r => E.publicValue(r.m, gid, g.rules.goalSet));
      const valid = vals.filter(v => v != null); const best = valid.length ? (def.low ? Math.min(...valid) : Math.max(...valid)) : '-';
      els.goals.append(h('div', { class: 'goal' }, h('b', null, `${def.name} · 1위 ${pts[0]}점` + (pts[1] ? ` / 2위 ${pts[1]}점` : '')), h('span', null, def.desc),
        h('div', { class: 'you' }, (vp != null ? `${nameOf(vp)} ${vals[vp] == null ? '대상 아님' : vals[vp]} · ` : '') + `현재 1위 ${best}`)));
    }
    if (vp != null && g.players[vp].secret) { const sid = g.players[vp].secret; els.goals.append(h('div', { class: 'goal secret' + (res[vp].secretOk ? ' met' : '') }, h('b', null, `${hotseat() ? nameOf(vp) + '의 ' : ''}비밀 목표 · ${E.secretPts(g, sid)}점`), h('span', null, E.secretDefs(g)[sid - 1].desc))); }
    else if (hotseat() && !S.tutorial) els.goals.append(h('p', { class: 'fine', style: 'margin:8px 0 0' }, '비밀 목표는 자기 차례에만 보여요.'));
  }

  // ============================================================
  // FLOW
  // ============================================================
  function nthPick(p) { let n = 0; for (let k = 0; k < ui.pickIdx; k++) if (g.pickOrder[k].player === p) n++; return n; }
  function applyPort(idx) {
    const exp = g.pickOrder[ui.pickIdx];
    if (!E.freePorts(g).some(p => p.idx === idx)) idx = E.freePorts(g)[0].idx;
    E.assignPort(g, exp, idx); ui.newCells.add(idx); ui.pickIdx++;
  }
  function localPort(idx) {
    const p = ui.picker; if (p == null || ui.pickIdx >= g.pickOrder.length || g.pickOrder[ui.pickIdx].player !== p) return;
    ui.picker = null;
    if (online()) { const mine = (net.myPorts = net.myPorts || []); mine.push(idx); netPresence({ ports: mine.slice() }); }
    S.actions.push({ type: 'port', idx });
    applyPort(idx); renderBoard(); runPorts();
  }
  async function runPorts() {
    if (ui.portsBusy) return; ui.portsBusy = true;
    try { await runPortsInner(); } finally { ui.portsBusy = false; }
  }
  async function runPortsInner() {
    ui.phase = 'ports';
    while (ui.pickIdx < g.pickOrder.length) {
      const exp = g.pickOrder[ui.pickIdx]; const p = exp.player; const k = kindOf(p);
      if (k === 'ai') { ui.picker = null; ui.waitMsg = null; renderAll(); if (!ui.instant) { await sleep(380); if (!g || ui.pickIdx >= g.pickOrder.length || g.pickOrder[ui.pickIdx] !== exp) return; } applyPort(E.pickPortAI(g, exp, g.r)); if (!ui.instant) renderBoard(); continue; }
      if (k === 'local') {
        if (ui.queue.length && ui.queue[0].type === 'port') { applyPort(ui.queue.shift().idx); S.actions.push({ type: 'port', idx: g.pickOrder[ui.pickIdx - 1].port }); continue; }
        ui.picker = p; if (!hotseat()) ui.viewer = p; renderAll(); coach('port'); return;
      }
      const v = remotePort(p, nthPick(p));
      if (v == null) { ui.picker = null; ui.waitMsg = `${nameOf(p)} 님이 항구를 고르고 있어요`; renderAll(); return; }
      applyPort(v);
    }
    ui.picker = null;
    if (ui.portsDone) return; ui.portsDone = true;
    E.finishSetup(g);
    g.players.forEach((pl, k) => { if (kindOf(k) === 'ai') pl.secret = S.tutorial ? null : E.pickSecretAI(g, k, g.r, pl.ctrl.strat); });
    if (S.tutorial) { startRound(); return; }
    runSecrets();
  }
  function runSecrets() {
    for (const p of humans()) {
      if (ui.secretDone.has(p)) continue;
      if (kindOf(p) === 'local') {
        if (ui.queue.length && ui.queue[0].type === 'secret') { const a = ui.queue.shift(); g.players[a.p].secret = a.id; ui.secretDone.add(a.p); S.actions.push(a); continue; }
        ui.phase = 'secret';
        if (ui.instant) return;
        if (hotseat()) handoff(p, '비밀 목표를 고를 차례예요.', () => askSecret(p)); else askSecret(p);
        return;
      }
      if (remoteSecretCommit(p) == null) { ui.phase = 'wait'; ui.waitMsg = `${nameOf(p)} 님이 비밀 목표를 고르고 있어요`; renderAll(); return; }
      ui.secretDone.add(p);
    }
    startRound();
  }
  function askSecret(p) {
    const offer = g.players[p].secretOffer; const defs = E.secretDefs(g);
    ui.viewer = p; renderAll();
    modal(h('h2', null, (hotseat() ? nameOf(p) + ' 님의 ' : '') + '비밀 목표'), h('p', null, '하나를 고르세요. 게임이 끝나면 공개돼요.'),
      h('div', { class: 'choice' }, offer.map(id => h('button', { type: 'button', onclick: async () => {
        closeModal(); g.players[p].secret = id; ui.secretDone.add(p); S.actions.push({ type: 'secret', p, id });
        if (online()) { net.secret = { id, salt: salt() }; netPresence({ sc: await hash(net.secret) }); }
        if (hotseat()) ui.viewer = null;
        runSecrets();
      } }, h('b', null, `${E.secretPts(g, id)}점`), defs[id - 1].desc))));
  }

  function startRound() {
    ui.roundPlans = {}; ui.flip = true;
    if (ui.queue.length && ui.queue[0].type === 'plan') { const a = ui.queue.shift(); S.actions.push(a); doReveal(a.plans); return; }
    if (ui.instant) { ui.phase = 'draw-pending'; return; }
    ui.drawQueue = locals().slice();
    nextDrawer();
  }
  function nextDrawer() {
    const p = ui.drawQueue.shift();
    if (p === undefined) {
      ui.drawer = null;
      if (online()) { commitPlans(); return; }
      S.actions.push({ type: 'plan', plans: ui.roundPlans });
      doReveal(ui.roundPlans); return;
    }
    ui.drawer = p; ui.plans = {};
    const mine = expsOf(p); ui.curExp = mine[0].id; ui.active = 0; mine.forEach(ex => { ui.plans[ex.id] = { paths: [[]], plus: false, landing: false }; });
    if (hotseat()) { ui.viewer = null; handoff(p, `${g.round + 1}라운드 길을 그릴 차례예요.`, beginDraw); }
    else beginDraw();
  }
  function beginDraw() {
    ui.phase = 'draw'; ui.viewer = ui.drawer; renderAll(); startTimer();
    if (g.round === 0) coach('draw'); else if (g.round === 1) coach('score');
    if (card().ev) coach('event-' + card().ev);
  }
  function submitPlan() {
    if (ui.phase !== 'draw') return;
    clearTimer();
    for (const ex of expsOf(ui.drawer)) { const pl = ui.plans[ex.id]; const has = pl.paths.some(p => p.length); ui.roundPlans[ex.id] = { paths: pl.paths.filter(p => p.length).map(p => p.slice()), plus: pl.plus && has, landing: pl.landing && has }; }
    ui.phase = 'handoff'; renderDraw();
    if (hotseat()) ui.viewer = null;
    nextDrawer();
  }

  // ---------- handoff (hotseat) ----------
  function handoff(p, what, then) {
    ui.phase = 'handoff'; renderAll();
    els.cover.hidden = false; els.cover.innerHTML = '';
    els.cover.append(h('div', { class: 'cover-card' }, h('span', { class: 'sw big', style: 'background:' + HEX[p] }, ICON[p]),
      h('h2', null, `${nameOf(p)} 님 차례예요`), h('p', null, what + ' 다른 사람은 화면을 보지 마세요.'),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { els.cover.hidden = true; NoliSFX.play('tap'); then(); } }, '시작하기')));
    const b = els.cover.querySelector('button'); if (b) b.focus();
  }

  // ---------- reveal ----------
  async function doReveal(humanPlans) {
    const oldCoach = document.querySelector('.coach'); if (oldCoach) oldCoach.remove();
    ui.phase = 'reveal'; ui.revealMsg = '상대가 그리는 중'; ui.skip = false; ui.viewer = hotseat() ? null : ui.viewer;
    if (!ui.instant) { renderDock(); renderDraw(); await sleep(60); }
    const c = card(); const plans = [];
    for (const ex of g.exps) {
      if (!isHuman(ex.player)) continue;
      const pl = g.players[ex.player]; const hp = humanPlans[ex.id];
      if (!hp || !hp.paths || !hp.paths.length) { if (E.startCells(g, ex, { diag: c.ev === 'storm', landing: c.ev === 'tailwind' }).length === 0) { pl.supply += 1; g.stats.blocked++; } plans[ex.id] = null; continue; }
      const landOK = !!hp.landing && (c.ev === 'tailwind' || pl.supply >= 2);
      if (landOK && c.ev !== 'tailwind') pl.supply -= 2;
      const plusOK = !!hp.plus && pl.supply >= 1; if (plusOK) pl.supply -= 1;
      const paths = sanitizePaths(ex, { paths: hp.paths, plus: plusOK, landing: landOK }, c);
      plans[ex.id] = paths.length ? { paths, usedPlus: plusOK, landing: landOK } : null;
    }
    const blockByPlayer = {};
    for (const ex of g.exps) {
      if (isHuman(ex.player)) continue;
      const blk = blockByPlayer[ex.player] || new Set();
      const pl = E.planAI(g, ex, c, g.players[ex.player].ctrl.strat, g.r, blk);
      if (pl.blocked) { g.players[ex.player].supply += 1; g.stats.blocked++; plans[ex.id] = null; continue; }
      pl.paths.forEach(p => p.forEach(x => blk.add(x))); blockByPlayer[ex.player] = blk; plans[ex.id] = pl;
    }
    const before = g.owner.slice();
    const res = E.resolveRound(g, plans, c);
    ui.revealMsg = '시트를 겹치는 중'; if (!ui.instant) renderDock();
    if (!ui.instant) await animateReveal(plans, res);
    for (let i = 0; i < g.map.n; i++) if (g.owner[i] !== before[i]) ui.newCells.add(i);
    const vp = ui.viewer != null ? ui.viewer : null;
    const nCol = res.contested.length;
    if (vp != null) {
      const mine = res.claimed.filter(x => g.exps[x.e].player === vp).length; const lost = [...res.lostBy].some(e => g.exps[e].player === vp);
      ui.revealMsg = `충돌 ${nCol}건 · 내 영토 +${mine}칸` + (lost ? ' · 보급 +1' : '') + (res.ruins.length ? ` · 폐허 ${res.ruins.length}칸` : '');
    } else {
      const gains = humans().map(p => `${nameOf(p)} +${res.claimed.filter(x => g.exps[x.e].player === p).length}`).join(' · ');
      ui.revealMsg = `충돌 ${nCol}건 · ${gains}` + (res.ruins.length ? ` · 폐허 ${res.ruins.length}칸` : '');
    }
    g.round++;
    ui.phase = 'after';
    if (g.round >= g.nRounds) g.final = E.score(g);
    if (ui.instant) { startRoundAfterReplay(); return; }
    renderAll();
    if (nCol) coach('collide');
  }
  function startRoundAfterReplay() { if (g.round < g.nRounds && ui.queue.length) startRound(); }
  function sanitizePaths(ex, hp, c) {
    // validate untrusted (or replayed) paths against the board; keep the legal prefix of each
    const out = []; const block = new Set();
    for (const p of hp.paths.slice(0, 2)) {
      if (!Array.isArray(p)) continue;
      const path = p.slice(0, 8).map(x => x | 0);
      const k = E.legalPrefix(g, ex, path, { diag: c.ev === 'storm', landing: c.ev === 'tailwind' || !!hp.landing, block });
      if (k > 0) { const ok = path.slice(0, k); ok.forEach(x => block.add(x)); out.push(ok); }
    }
    let budgetLeft = c.v + (hp.plus ? 1 : 0); return out.map(p => { const q = p.slice(0, Math.max(0, budgetLeft)); budgetLeft -= q.length; return q; }).filter(p => p.length);
  }
  function nextRound() {
    if (g.round >= g.nRounds) { finishGame(); return; }
    startRound();
  }
  async function finishGame() {
    ui.phase = 'end'; ui.viewer = hotseat() ? null : ui.viewer;
    if (online()) {
      netPresence({ sr: net.secret || null });
      ui.phase = 'wait'; ui.endWait = true; ui.waitMsg = '모든 플레이어의 비밀 목표를 확인하는 중'; renderAll(); tryProgress(); return;
    }
    renderAll(); showResults(); coach('end');
  }

  async function animateReveal(plans, res) {
    els.fx.innerHTML = '';
    const w = g.map.w, H = g.map.h;
    const layers = [];
    for (const ex of g.exps.filter(e => plans[e.id])) {
      const p = ex.player; const [dx, dy] = SEAT[p];
      const wrap = h('div', { class: 'layer acetate', style: `transform:translate(${dx * 110}%,${dy * 110}%) rotate(${(dx || 1) * (p % 2 ? -6 : 6)}deg);opacity:0` });
      const sv = s('svg', { viewBox: `-0.1 -0.2 ${w + 0.2} ${H + 0.3}` });
      sv.append(s('rect', { class: 'film', x: 0, y: 0, width: w, height: H, rx: 0.15, stroke: 'none' }));
      sv.append(s('rect', { x: 0, y: -0.14, width: 1.6, height: 0.14, fill: HEX[p] }));
      plans[ex.id].paths.forEach(path => drawPath(sv, path, HEX[p], 0.95));
      wrap.append(sv); els.fx.append(wrap); layers.push(wrap);
    }
    await sleep(30);
    for (const L of layers) { L.style.transform = 'none'; L.style.opacity = '1'; await sleep(140); }
    await sleep(600);
    els.stamp.classList.add('on'); NoliSFX.play('stamp'); await sleep(750); els.stamp.classList.remove('on');
    ui.revealMsg = '도착 순서를 확인하는 중'; renderDock();
    const evs = res.events.slice().sort((a, b) => a.t - b.t);
    const burstSv = s('svg', { viewBox: `0 0 ${w} ${H}` }); const bl = h('div', { class: 'layer' }); bl.append(burstSv); els.fx.append(bl);
    for (const evn of evs) {
      if (ui.skip) break;
      const x = (evn.c % w) + 0.5, y = ((evn.c / w) | 0) + 0.5;
      burstSv.append(s('circle', { cx: x, cy: y, r: 0.6, fill: 'none', stroke: '#1F2A44', 'stroke-width': 0.12, class: 'burst' }));
      const who = evn.who.map(e => nameOf(g.exps[e].player));
      const text = evn.kind === 'tie' ? `${who.join('·')} 동시에 ${evn.t}걸음 · ` + (card().ev === 'calm' ? '고요: 빈칸으로' : '폐허')
        : (typeof evn.owner === 'number' ? `${nameOf(g.exps[evn.owner].player)} 먼저 도착 · ${who.join('·')} 길 끊김` : `${who.join('·')} 막힘`);
      const co = h('div', { class: 'callout', style: `left:${(x / w) * 100}%;top:${(y / H) * 100}%` }, text); els.fx.append(co); NoliSFX.play('hit');
      await sleep(1100); co.remove();
    }
    if (!evs.length && !ui.skip) { const co = h('div', { class: 'callout', style: 'left:50%;top:50%' }, '충돌 없음'); els.fx.append(co); await sleep(900); }
    for (const L of layers) L.style.opacity = '0';
    await sleep(350);
    els.fx.innerHTML = '';
  }

  // ---------- timer ----------
  function startTimer() {
    clearTimer(); ui.timerOn = S.cfg.timer && !S.tutorial; if (!ui.timerOn) return;
    ui.timerTotal = (g.np === 2 ? 60 : 45) * 1000; ui.timerEnd = Date.now() + ui.timerTotal;
    ui.timerId = setInterval(() => { updateTimerBar(); if (Date.now() >= ui.timerEnd) { clearTimer(); if (ui.phase === 'draw') submitPlan(); } }, 200);
    renderDock();
  }
  function updateTimerBar() { if (!els.timerBar || !ui.timerEnd) return; const f = Math.max(0, (ui.timerEnd - Date.now()) / ui.timerTotal); els.timerBar.style.transform = `scaleX(${f})`; els.timerBar.style.background = f < 0.25 ? '#D53F7C' : '#1F2A44'; }
  function clearTimer() { if (ui.timerId) clearInterval(ui.timerId); ui.timerId = null; ui.timerOn = false; }

  // ---------- results ----------
  function showResults() {
    const res = g.final = E.score(g);
    const order = res.map((r, k) => k).sort((a, b) => res[b].total - res[a].total);
    const win = res.winners;
    const tbl = h('table', { class: 'result-table' },
      h('thead', null, h('tr', null, ['탐험대', '보물', '마을', '유적', '목표', '비밀', '보급', '합계'].map(t => h('th', { scope: 'col' }, t)))),
      h('tbody', null, order.map(k => { const r = res[k]; return h('tr', { class: win.includes(k) ? 'win' : '' }, h('td', null, h('span', { style: `color:${HEX[k]}` }, ICON[k] + ' '), nameOf(k)), h('td', null, r.treasure), h('td', null, r.village), h('td', null, r.star), h('td', null, r.goals), h('td', null, r.secret), h('td', null, r.supply), h('td', null, r.total)); })));
    const secrets = g.players.map((p, k) => p.secret ? h('li', null, `${nameOf(k)}: ${E.secretDefs(g)[p.secret - 1].desc} — ${res[k].secretOk ? '달성' : '실패'}`) : null).filter(Boolean);
    const me = S.mode === 'solo' || online() ? locals()[0] : null;
    const title = me != null && win.includes(me) ? '승리했어요' : `${win.map(nameOf).join(' · ')} 님 승리`;
    NoliSFX.play(me != null && !win.includes(me) ? 'lose' : 'win');
    const shareText = `OVERLAP ${g.map.name} ${g.np}인전 — 승자 ${win.map(nameOf).join('·')} (${res[win[0]].total}점). 충돌 ${g.stats.collisions}건, 폐허 ${g.stats.ruins}칸.`;
    modal(h('h2', null, title),
      h('p', { class: 'fine' }, `${g.map.name} · ${g.nRounds}라운드 · 충돌 ${g.stats.collisions}번`),
      h('div', { class: 'scroll-x' }, tbl),
      secrets.length ? h('div', null, h('b', null, '비밀 목표'), h('ul', { style: 'margin:6px 0 12px;padding-left:20px' }, secrets)) : null,
      h('div', { class: 'row' },
        online() ? (net.isHost ? h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { closeModal(); hostRematch(); } }, '한 판 더') : null)
          : h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { closeModal(); startLocal(false); } }, '한 판 더'),
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: async e => { const b = e.currentTarget; const url = location.origin + location.pathname; if (navigator.share) { try { await navigator.share({ title: 'OVERLAP', text: shareText, url }); return; } catch (er) { if (er && er.name === 'AbortError') return; } } try { await navigator.clipboard.writeText(shareText + ' ' + url); b.textContent = '복사했어요'; } catch (er) { b.textContent = '복사하지 못했어요'; } } }, '결과 공유'),
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { closeModal(); showTitle(); } }, '처음으로')));
  }

  // ============================================================
  // ONLINE (room capability: presence-only, commit–reveal for secrets)
  // ============================================================
  const net = { table: null, code: null, isHost: false, tablePeers: [], myPorts: [], secret: null, plan: {}, commits: {}, started: false, cfg: null };
  const CODE_LO = 1000, CODE_HI = 2999;
  function salt() { const a = new Uint32Array(4); crypto.getRandomValues(a); return Array.from(a, x => x.toString(16).padStart(8, '0')).join(''); }
  function canon(v) { if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']'; if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'; return JSON.stringify(v === undefined ? null : v); }
  async function hash(obj) {
    const txt = canon(obj);
    if (crypto.subtle) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)); return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join(''); }
    let h1 = 2166136261; for (let i = 0; i < txt.length; i++) { h1 ^= txt.charCodeAt(i); h1 = Math.imul(h1, 16777619); } return 'f' + (h1 >>> 0).toString(16);
  }
  function myNick() { return cleanName(S.settings.nick, '플레이어'); }
  function netPresence(patch) { if (net.table) net.table.presence(patch).catch(() => {}); }
  function tablePeer(peerId) { return net.tablePeers.find(x => x.peer === peerId); }
  function peerPresent(p) { const sp = S.seats[p]; if (!sp || !sp.peer) return true; const x = tablePeer(sp.peer); return !!x && !x.away; }
  function pres(p) { const sp = S.seats[p]; const x = sp && sp.peer ? tablePeer(sp.peer) : null; return x ? x.presence || {} : null; }
  function remotePort(p, n) { const pr = pres(p); if (!pr || pr.gid !== S.seed || !Array.isArray(pr.ports)) return null; const v = pr.ports[n]; return Number.isInteger(v) ? v : null; }
  function remoteSecretCommit(p) { const pr = pres(p); return pr && pr.gid === S.seed && typeof pr.sc === 'string' ? pr.sc : null; }
  function inviteUrl() { const u = new URL(location.href); u.search = '?room=' + net.code; u.hash = ''; return u.toString(); }
  function setUrlRoom(code) { try { history.replaceState(null, '', code ? '?room=' + code : location.pathname); } catch (e) {} }

  function showOnlineLobby(prefill) {
    S.screen = 'lobby'; leaveTable(); app.innerHTML = '';
    const ok = window.NoliNet && window.NoliNet.available();
    const nick = h('input', { id: 'nick', type: 'text', maxlength: '10', value: S.settings.nick || '', placeholder: '닉네임', autocomplete: 'nickname', oninput: e => { S.settings.nick = e.target.value; saveSettings(); } });
    const code = h('input', { id: 'code', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '4', placeholder: '0000', value: prefill || '' });
    els.lobbyMsg = h('p', { class: 'formmsg', role: 'alert' });
    const createBtn = h('button', { class: 'btn btn-primary', type: 'button', disabled: !ok, onclick: e => createTable(e.currentTarget) }, '방 만들기');
    const joinBtn = h('button', { class: 'btn btn-ghost', type: 'button', disabled: !ok, onclick: e => { const c = code.value.replace(/\D/g, ''); if (c.length !== 4) { els.lobbyMsg.textContent = '4자리 방 코드를 입력하세요.'; code.focus(); return; } joinTable(c, e.currentTarget); } }, '참가하기');
    code.addEventListener('keydown', e => { if (e.key === 'Enter') joinBtn.click(); });
    app.append(h('div', { class: 'title' }, h('div', { class: 'title-sheet' }, brandLink(), logo(),
      h('h2', { class: 'screen-title' }, prefill ? '초대받은 방에 참가해요' : '온라인으로 함께하기'),
      h('div', { class: 'field' }, h('label', { for: 'nick' }, '닉네임'), nick),
      prefill ? null : h('div', { class: 'block' }, createBtn, h('p', { class: 'fine' }, '방을 만들면 초대 링크를 보낼 수 있어요.')),
      h('div', { class: 'field' }, h('label', { for: 'code' }, '방 코드'), h('div', { class: 'row' }, code, joinBtn)),
      els.lobbyMsg,
      ok ? null : h('p', { class: 'formmsg' }, '온라인 기능을 불러오지 못했어요. 페이지를 새로고침해 주세요.'),
      h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'btn btn-text', type: 'button', onclick: () => { setUrlRoom(null); showTitle(); } }, '돌아가기')))));
    (prefill ? (S.settings.nick ? joinBtn : nick) : nick).focus();
  }
  function busy(btn, on, label) { if (!btn) return; btn.disabled = on; if (on) { btn.dataset.label = btn.textContent; btn.textContent = label; } else if (btn.dataset.label) btn.textContent = btn.dataset.label; }
  async function createTable(btn) {
    busy(btn, true, '만드는 중');
    try { net.table = await window.NoliNet.create('ov', CODE_LO, CODE_HI); net.isHost = true; afterJoin(); }
    catch (e) { busy(btn, false); els.lobbyMsg.textContent = '방을 만들지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.'; }
  }
  async function joinTable(code, btn) {
    busy(btn, true, '연결 중');
    try { net.table = await window.NoliNet.join('ov', code); net.isHost = false; afterJoin(); }
    catch (e) { busy(btn, false); els.lobbyMsg.textContent = e && e.type === 'not-found' ? '방을 찾을 수 없어요. 코드를 다시 확인해 주세요.' : e && e.type === 'timeout' ? '방은 찾았는데 연결이 안 됐어요. 방장 화면이 켜져 있는지 확인하고, 두 폰을 같은 와이파이에 연결하면 대부분 바로 돼요.' : '연결하지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.'; }
  }
  function afterJoin() {
    net.code = net.table.code; S.code = net.code; net.started = false; net.cfg = null; net.tablePeers = [];
    net.table.onPeers(ch => { net.tablePeers = ch.peers; onTable(); });
    net.table.onStatus(st => { if (st === 'reconnecting') toast('연결이 불안정해요. 다시 연결하는 중이에요.'); else if (st === 'closed' && S.screen !== 'title') toast('방과의 연결이 끊어졌어요.'); });
    const base = { name: myNick(), joinedAt: Date.now() };
    if (net.isHost) { base.host = true; base.cfg = { np: Math.max(2, Math.min(6, S.settings.np)), level: S.settings.level, map: 0, timer: S.settings.timer, started: false, seats: [], names: [] }; }
    net.table.presence(base);
    setUrlRoom(net.code);
    S.screen = 'table'; renderTable();
  }
  function leaveTable() { if (net.table) { try { net.table.leave(); } catch (e) {} net.table = null; } net.isHost = false; net.tablePeers = []; S.code = null; }
  function me() { return net.tablePeers.find(p => p.sameTab); }
  function hostPeer() { const hs = net.tablePeers.filter(p => p.presence && p.presence.host && p.presence.cfg); hs.sort((a, b) => (a.presence.joinedAt || 0) - (b.presence.joinedAt || 0)); return hs[0] || null; }
  function onTable() {
    const mine = me();
    if (net.isHost && mine && !net.started) {
      const others = net.tablePeers.filter(p => !p.sameTab && !p.away).sort((a, b) => ((a.presence || {}).joinedAt || 0) - ((b.presence || {}).joinedAt || 0));
      const seats = [mine.peer, ...others.map(p => p.peer)].slice(0, 6);
      const cur = (mine.presence && mine.presence.cfg) || {};
      if (JSON.stringify(seats) !== JSON.stringify(cur.seats || [])) net.table.presence({ cfg: Object.assign({}, cur, { seats, np: Math.max(cur.np || 2, seats.length) }) });
    }
    const hp = hostPeer(); net.cfg = hp ? hp.presence.cfg : null;
    if (net.cfg && net.cfg.started && net.cfg.gid && S.seed !== net.cfg.gid && mine && net.cfg.seats.includes(mine.peer)) { startOnline(net.cfg); return; }
    if (S.screen === 'table') renderTable();
    if (S.screen === 'game' && online()) { tryProgress(); if (!ui.instant && els.players) renderPanel(); }
  }
  async function shareInvite(btn) {
    const url = inviteUrl(); const text = `OVERLAP 같이 해요. 방 코드 ${net.code}`;
    if (navigator.share) { try { await navigator.share({ title: 'OVERLAP', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); btn.textContent = '링크를 복사했어요'; NoliSFX.play('pop'); setTimeout(() => { btn.textContent = '초대 링크 보내기'; }, 2000); } catch (e) { btn.textContent = url; }
  }
  function renderTable() {
    app.innerHTML = '';
    const mine = me(); const cfg = net.cfg || {}; const seats = cfg.seats || [];
    const list = h('div', { class: 'players' });
    seats.forEach((pid, i) => { const p = tablePeer(pid); const nm = p ? cleanName((p.presence || {}).name, '플레이어') : '나간 플레이어'; list.append(h('div', { class: 'prow' }, h('span', { class: 'sw', style: 'background:' + HEX[i] }, ICON[i]), h('span', null, nm, p && p.sameTab ? h('span', { class: 'tag' }, '나') : null, p && p.presence && p.presence.host ? h('span', { class: 'tag' }, '방장') : null, p && p.away ? h('span', { class: 'tag warn' }, '연결 중') : null), h('span'), h('span'))); });
    for (let i = seats.length; i < (cfg.np || 0); i++) list.append(h('div', { class: 'prow' }, h('span', { class: 'sw', style: 'background:' + HEX[i] }, ICON[i]), h('span', { class: 'sub' }, '컴퓨터'), h('span'), h('span')));
    const ctl = [];
    if (net.isHost) {
      const set = patch => { net.table.presence({ cfg: Object.assign({}, cfg, patch) }); };
      const seg = (key, val, label) => h('button', { type: 'button', 'aria-pressed': String(cfg[key] === val), onclick: () => set({ [key]: val, ...(key === 'np' ? { map: 0 } : {}) }) }, label);
      ctl.push(h('div', { class: 'field' }, h('span', { class: 'lab' }, '전체 인원'), h('div', { class: 'seg' }, [2, 3, 4, 5, 6].filter(n => n >= Math.max(2, seats.length)).map(n => seg('np', n, n + '명'))), (cfg.np || 0) > seats.length ? h('p', { class: 'fine', style: 'margin:0' }, '빈자리는 컴퓨터가 채워요.') : null));
      if ((cfg.np || 0) > seats.length) ctl.push(h('div', { class: 'field' }, h('span', { class: 'lab' }, '컴퓨터 난이도'), h('div', { class: 'seg' }, seg('level', 'easy', '쉬움'), seg('level', 'normal', '보통'), seg('level', 'hard', '어려움'))));
      ctl.push(h('div', { class: 'field' }, h('span', { class: 'lab' }, '지도'), h('div', { class: 'seg' }, mapPool(cfg.np || 4).map((m, i) => seg('map', i, m.name)))));
      ctl.push(h('div', { class: 'field' }, h('label', { class: 'toggle', for: 'opt-t2' }, h('input', { id: 'opt-t2', type: 'checkbox', checked: cfg.timer !== false, onchange: e => set({ timer: e.target.checked }) }), '제한 시간')));
      ctl.push(h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', disabled: seats.length < 2 && (cfg.np || 0) < 2, onclick: hostStart }, '게임 시작'), h('button', { class: 'btn btn-text', type: 'button', onclick: () => showOnlineLobby() }, '방 나가기')));
    } else ctl.push(h('p', { class: 'waitline' }, cfg.seats ? '방장이 게임을 시작하면 바로 시작돼요.' : '방장과 연결하는 중이에요.'), h('div', { class: 'row' }, h('button', { class: 'btn btn-text', type: 'button', onclick: () => showOnlineLobby() }, '방 나가기')));
    app.append(h('div', { class: 'title' }, h('div', { class: 'title-sheet' }, brandLink(),
      h('div', { class: 'roomcode' }, h('span', null, '방 코드'), h('b', null, net.code)),
      h('div', { class: 'row', style: 'margin-bottom:18px' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: e => shareInvite(e.currentTarget) }, '초대 링크 보내기')),
      h('div', { class: 'field' }, h('span', { class: 'lab' }, `참가자 ${seats.length}명`), list), ...ctl)));
  }
  function hostStart() {
    const cfg = Object.assign({}, net.cfg); const seats = (cfg.seats || []).filter(pid => { const p = tablePeer(pid); return p && !p.away; });
    cfg.seats = seats; cfg.np = Math.max(cfg.np || 2, seats.length, 2);
    cfg.names = seats.map(pid => { const p = tablePeer(pid); return cleanName(p && p.presence && p.presence.name, '플레이어'); });
    cfg.gid = Math.floor(Math.random() * 1e9); cfg.started = true;
    net.table.presence({ cfg });
    startOnline(cfg);
  }
  function hostRematch() { net.started = false; hostStart(); }
  function startOnline(cfg) {
    const mine = me(); if (!mine) return;
    if (S.screen === 'game' && S.seed === cfg.gid) return;
    net.started = true; S.mode = 'online'; S.tutorial = false; S.seed = cfg.gid; S.actions = []; S.screen = 'game';
    net.myPorts = []; net.secret = null; net.plan = {}; net.commits = {};
    const strats = LEVELS[cfg.level] || LEVELS.normal; S.seats = [];
    for (let p = 0; p < cfg.np; p++) {
      const pid = cfg.seats[p];
      if (pid) S.seats.push({ kind: pid === mine.peer ? 'local' : 'remote', peer: pid, name: cleanName(cfg.names[p], '플레이어 ' + (p + 1)) });
      else S.seats.push({ kind: 'ai', strat: strats[(p - cfg.seats.length) % strats.length], name: AI_NAMES[p - cfg.seats.length] });
    }
    S.cfg = { np: cfg.np, map: cfg.map | 0, timer: cfg.timer !== false };
    net.table.presence({ gid: S.seed, ports: [], sc: null, cm: null, rv: null, sr: null });
    ui.queue = []; build(); runPorts();
  }
  async function commitPlans() {
    const r = g.round; const myP = locals()[0];
    const plans = {}; for (const ex of expsOf(myP)) plans[ex.id] = ui.roundPlans[ex.id] || { paths: [] };
    net.plan = { r, plans, salt: salt() };
    const hsh = await hash(net.plan);
    netPresence({ cm: { r, h: hsh } });
    ui.phase = 'wait'; ui.waitMsg = '다른 플레이어를 기다리는 중'; renderAll(); tryProgress();
  }
  let progressing = false;
  async function tryProgress() {
    if (progressing || !g || !online()) return; progressing = true;
    try {
      if (ui.phase === 'ports' && ui.picker == null) { runPorts(); return; }
      if (ui.phase === 'wait' && !ui.endWait && ui.portsDone && ui.secretDone.size < humans().length) { runSecrets(); return; }
      if (ui.phase === 'wait' && ui.endWait) {
        const out = []; for (const p of humans()) { if (kindOf(p) === 'local') continue; const pr = pres(p); if (!pr || !pr.sr) { out.push(p); continue; }
          const sc = remoteSecretCommit(p); if (sc && (await hash(pr.sr)) === sc) g.players[p].secret = pr.sr.id | 0 || null; else g.players[p].secret = null; }
        if (out.length) { ui.waitMsg = `${out.map(nameOf).join(', ')} 님을 기다리는 중`; renderDock(); return; }
        ui.endWait = false; ui.phase = 'end'; renderAll(); showResults(); return;
      }
      if (ui.phase === 'wait' && net.plan && net.plan.r === g.round) {
        const r = g.round; const missing = [];
        for (const p of humans()) { if (kindOf(p) === 'local') continue; const pr = pres(p); const cm = pr && pr.gid === S.seed && pr.cm; if (cm && cm.r === r && typeof cm.h === 'string') { (net.commits[p] = net.commits[p] || {})[r] = cm.h; } if (!(net.commits[p] && net.commits[p][r])) missing.push(p); }
        if (missing.length) { ui.waitMsg = `${missing.map(p => nameOf(p) + (peerPresent(p) ? '' : '(연결 끊김)')).join(', ')} 님을 기다리는 중`; renderDock(); return; }
        const mineP = pres(locals()[0]);
        if (!mineP || !mineP.rv || mineP.rv.r !== r) { netPresence({ rv: net.plan }); }
        const merged = Object.assign({}, net.plan.plans); const waitRv = [];
        for (const p of humans()) { if (kindOf(p) === 'local') continue; const pr = pres(p); const rv = pr && pr.rv; if (!rv || rv.r !== r) { waitRv.push(p); continue; }
          const ok = (await hash(rv)) === net.commits[p][r];
          for (const ex of expsOf(p)) merged[ex.id] = ok && rv.plans && rv.plans[ex.id] ? rv.plans[ex.id] : { paths: [] }; }
        if (waitRv.length) { ui.waitMsg = '시트를 모으는 중'; renderDock(); return; }
        net.plan = { r: -1 };
        progressing = false; doReveal(merged); return;
      }
    } finally { progressing = false; }
  }

  // ============================================================
  // MODAL / COACH / RULES
  // ============================================================
  function modal(...kids) { closeModal(); const bg = h('div', { class: 'modal-bg', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'modal' }, ...kids)); document.body.append(bg); els.modal = bg; const f = bg.querySelector('button'); if (f) f.focus(); }
  function closeModal() { if (els.modal) { els.modal.remove(); els.modal = null; } }
  function toast(t) { const el = h('div', { class: 'toast', role: 'status' }, t); document.body.append(el); setTimeout(() => el.remove(), 3500); }
  function confirmQuit() { modal(h('h2', null, '게임을 나갈까요?'), h('p', null, online() ? '나가면 다른 플레이어의 게임이 멈춰요.' : '진행 중인 게임은 저장되지 않아요.'), h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { closeModal(); showTitle(); } }, '나가기'), h('button', { class: 'btn btn-ghost', type: 'button', onclick: closeModal }, '계속하기'))); }
  function showRules() {
    modal(h('h2', null, '규칙'),
      h('ol', null,
        h('li', null, '카드 숫자(N)만큼, 내 영토에 맞닿은 칸에서 시작해 가로·세로로 이어지는 길을 몰래 그려요.'),
        h('li', null, '모두 다 그리면 오버랩! 투명 시트가 한꺼번에 겹쳐요.'),
        h('li', null, '같은 칸에 여럿이 들어가면 더 적은 걸음으로 도착한 쪽이 가져요. 걸음이 같으면 폐허가 돼요.'),
        h('li', null, '칸을 빼앗긴 쪽은 그 뒤 길도 잃고, 대신 보급을 1개 받아요.'),
        h('li', null, '보급 1개로 +1칸, 2개로 아무 가장자리에서 상륙할 수 있어요. 남은 보급은 1점이에요.'),
        h('li', null, '점수: 보물 2점, 마을 1·2·3·4개에 2·5·9·14점, 중앙 유적 칸당 2점, 공개 목표, 비밀 목표.')),
      h('p', { class: 'fine' }, '이벤트: 폭풍(대각선 허용), 갈림길(두 갈래), 순풍(가장자리 상륙), 고요(동시 도착도 폐허 없음).'),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: closeModal }, '닫기'));
  }
  const COACH = {
    port: ['1/6', '먼저 항구를 골라요. 고른 항구가 첫 영토가 돼요.'],
    draw: ['2/6', '카드 숫자만큼 칸을 이어 길을 그려요. 빛나는 칸에서 시작해 끌어 보세요. 칸 위 숫자가 걸음 순서예요.'],
    collide: ['3/6', '같은 칸에 둘이 들어가면 더 적은 걸음으로 도착한 쪽이 가져요. 걸음이 같으면 폐허가 되고, 진 쪽은 보급을 하나 받아요.'],
    score: ['4/6', '◆ 보물은 2점, ⌂ 마을은 모을수록 크게 늘고(2·5·9·14점), ■ 유적은 칸마다 2점이에요. 남들이 노릴 칸을 읽어 보세요.'],
    'event-storm': ['이벤트', '폭풍: 이번 라운드는 대각선으로도 이어 그릴 수 있어요.'],
    'event-fork': ['이벤트', '갈림길: 칸 수를 두 갈래로 나눠 그릴 수 있어요. 첫 갈래를 그린 뒤 ‘두 번째 갈래’를 누르세요.'],
    'event-tailwind': ['이벤트', '순풍: 빈 가장자리 칸 어디서든 새로 상륙해 시작할 수 있어요.'],
    'event-calm': ['이벤트', '고요: 이번 라운드는 동시에 도착해도 폐허가 생기지 않아요.'],
    end: ['6/6', '튜토리얼을 마쳤어요. 실전에서는 목표 카드와 이벤트 카드가 더해져요.']
  };
  function coach(key) {
    if (ui.instant) return;
    if (!S.tutorial && !key.startsWith('event-')) return;
    const seen = store('coach') || {};
    if (!S.tutorial && seen[key]) return;
    if (ui.coachSeen[key]) return; ui.coachSeen[key] = true;
    if (!S.tutorial) { seen[key] = true; store('coach', seen); }
    const old = document.querySelector('.coach'); if (old) old.remove();
    const c = COACH[key]; if (!c) return;
    const box = h('div', { class: 'coach', role: 'status' }, h('span', { class: 'step' }, c[0]), h('div', null, c[1]), h('button', { type: 'button', onclick: () => box.remove() }, '알겠어요'));
    (els.coachSlot || document.body).append(box);
  }

  // ============================================================
  // BOOT
  // ============================================================
  function start() {
    const q = new URLSearchParams(location.search); const room = (q.get('room') || '').replace(/\D/g, '').slice(0, 4);
    if (room.length === 4) { S.settings.mode = 'online'; showOnlineLobby(room); return; }
    showTitle();
  }
  start();
  window.__overlap = { get g() { return g; }, get ui() { return ui; }, get S() { return S; }, startLocal };
})();
