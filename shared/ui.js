/* 놀이판 shared screens: start screen, lobby, closed room, rules sheet, top bar.
   Every game builds these through NoliUI so the whole site feels like one product. */
(function (root) {
  'use strict';
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v; else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v; else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) { if (kid == null || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); }
    return el;
  }
  const IC = {
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9.2 9a3 3 0 1 1 4.2 2.8c-.9.4-1.4 1.1-1.4 2.1v.4"/><circle cx="12" cy="18" r=".7" fill="currentColor"/></svg>',
    on: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    off: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg>',
    exit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c2.3.1 4 1.6 4.5 4.3"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/></svg>',
    brain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  };
  const AV = ['#E7D3B4', '#BFD9E6', '#EBC4C4', '#D3C8EA', '#C7E2C2', '#EDE2A8'];
  const sfxOn = () => !root.NoliSFX || root.NoliSFX.on();

  function brand() { return h('a', { class: 'brand', href: '../', 'aria-label': '놀이판 홈으로' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), '놀이판'); }
  function iconBtn(icon, label, onclick) { return h('button', { class: 'ib', type: 'button', 'aria-label': label, title: label, onclick, html: IC[icon] }); }
  function soundBtn() {
    const b = iconBtn(sfxOn() ? 'on' : 'off', '소리 켜고 끄기', () => { if (!root.NoliSFX) return; const on = !root.NoliSFX.on(); root.NoliSFX.set(on); b.innerHTML = on ? IC.on : IC.off; });
    return b;
  }
  function topbar(o) {
    o = o || {};
    return h('div', { class: 'top' }, brand(), h('span', { class: 'tools' },
      o.extra || null,
      o.onRules ? iconBtn('help', '규칙', o.onRules) : null,
      o.sound ? soundBtn() : null,
      o.onExit ? iconBtn('exit', '나가기', o.onExit) : null));
  }
  function avatar(name, i, size) { return h('span', { class: 'av' + (size ? ' ' + size : ''), style: `--a:${AV[(i || 0) % AV.length]}`, 'aria-hidden': 'true' }, Array.from(String(name || '?'))[0]); }
  function metaList(items) { return h('ul', { class: 'meta' }, items.map(([ic, t]) => h('li', null, h('span', { html: IC[ic] || '' }), t))); }
  function toast(t) { document.querySelectorAll('.toast').forEach(x => x.remove()); const el = h('div', { class: 'toast', role: 'status' }, t); document.body.append(el); setTimeout(() => el.remove(), 3000); }
  function setTable(on) { document.body.classList.toggle('on-table', !!on); }
  function mount(app, ...nodes) { app.innerHTML = ''; app.append(...nodes.filter(Boolean)); window.scrollTo(0, 0); }
  function netError(er) {
    if (er && er.type === 'not-found') return '방을 찾을 수 없어요. 코드를 다시 확인해 주세요.';
    if (er && er.type === 'timeout') return '방은 찾았는데 연결이 안 됐어요. 방장 화면이 켜져 있는지 확인하고, 같은 와이파이에서 다시 시도해 보세요.';
    return '연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.';
  }
  function cleanName(x, fb) { const t = String(x || '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g, '').trim().slice(0, 8); return t || fb; }
  function busy(b, on, l) { b.disabled = on; if (on) { b.dataset.l = b.textContent; b.textContent = l; } else if (b.dataset.l) b.textContent = b.dataset.l; }

  function rulesSheet(o) {
    const close = () => m.remove();
    const m = h('div', { class: 'modal', 'data-keep': '1', onclick: e => { if (e.target === m) close(); } },
      h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title },
        h('h2', null, o.title), o.body, o.note ? h('p', { class: 'fine', style: 'margin-top:16px' }, o.note) : null,
        h('div', { class: 'row' }, o.toggleTips ? h('button', { class: 'btn', type: 'button', onclick: () => { o.toggleTips(); close(); } }, o.tipsOn ? '도움말 끄기' : '도움말 켜기') : null,
          h('button', { class: 'btn btn-primary', type: 'button', onclick: close }, '닫기'))));
    const onKey = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
    document.body.append(m); m.querySelector('.btn-primary').focus();
    return m;
  }

  /* start screen
     o: { app, name, pitch, meta, art, getNick, setNick, settings:[nodes], soloLabel, onSolo, net:{id, lo, hi}, onRoom(room, isHost), onRules, prefill, onHome, offline } */
  function entry(o) {
    setTable(false);
    const nick = h('input', { id: 'nick', type: 'text', maxlength: '8', value: o.getNick() || '', placeholder: '친구들에게 보일 이름', autocomplete: 'nickname', oninput: e => o.setNick(e.target.value) });
    const msg = h('p', { class: 'msg', role: 'alert' });
    const ok = !!(root.NoliNet && root.NoliNet.available());
    const needNick = () => { if (!cleanName(o.getNick(), '')) { msg.textContent = '이름을 먼저 적어 주세요.'; nick.focus(); return true; } msg.textContent = ''; return false; };
    const code = h('input', { id: 'code', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '4', placeholder: '0000', 'aria-label': '방 코드 4자리', value: o.prefill || '', oninput: e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); } });
    const create = h('button', { class: 'btn btn-primary', type: 'button', disabled: !ok, onclick: async e => { if (needNick()) return; const b = e.currentTarget; busy(b, true, '방 만드는 중…'); try { const room = await root.NoliNet.create(o.net.id, o.net.lo, o.net.hi); o.onRoom(room, true); } catch (er) { busy(b, false); msg.textContent = '방을 만들지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.'; } } }, '방 만들고 초대하기');
    const join = h('button', { class: 'btn', type: 'button', disabled: !ok, onclick: async e => { if (needNick()) return; const c = code.value; if (c.length !== 4) { msg.textContent = '방 코드 4자리를 입력하세요.'; code.focus(); return; } const b = e.currentTarget; busy(b, true, '연결 중…'); try { const room = await root.NoliNet.join(o.net.id, c); o.onRoom(room, false); } catch (er) { busy(b, false); msg.textContent = netError(er); } } }, '참가');
    code.addEventListener('keydown', e => { if (e.key === 'Enter') join.click(); });
    const friends = h('div', { class: 'friends' + (o.prefill ? ' open' : '') },
      o.prefill ? null : h('button', { class: 'btn', type: 'button', style: 'width:100%', 'aria-expanded': 'false', onclick: e => { const open = friends.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', String(open)); if (open) setTimeout(() => friends.querySelector('.panel').scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30); } }, '친구와 하기'),
      h('div', { class: 'panel' },
        o.prefill ? null : create, o.prefill ? null : h('div', { class: 'or' }, '또는 받은 코드로'),
        h('div', { class: 'join-row' }, code, join),
        ok ? null : h('p', { class: 'fine' }, '온라인 연결을 불러오지 못했어요. 컴퓨터와 하기는 그대로 할 수 있어요.')));
    const sheet = h('div', { class: 'sheet' },
      o.prefill ? h('div', { style: 'margin-bottom:18px' }, h('h2', null, '초대받았어요'), h('p', { class: 'lead', style: 'margin:0' }, '이름을 정하고 참가를 누르면 바로 들어가요.')) : null,
      h('div', { class: 'field' }, h('label', { for: 'nick' }, '내 이름'), nick),
      o.prefill ? null : (o.settings || []),
      o.prefill ? null : h('button', { class: 'btn btn-primary', type: 'button', style: 'width:100%', onclick: () => { if (needNick()) return; o.onSolo(); } }, o.soloLabel || '컴퓨터와 시작'),
      o.prefill ? null : h('div', { style: 'height:8px' }),
      friends, msg,
      o.prefill ? h('button', { class: 'btn-text', type: 'button', onclick: o.onHome }, '이 게임 처음 화면으로') : null);
    const cover = h('section', { class: 'cover', 'aria-label': o.name },
      h('div', { class: 'art', 'aria-hidden': 'true', html: o.art }),
      h('h1', null, o.name), h('p', { class: 'pitch' }, o.pitch), metaList(o.meta || []));
    mount(o.app, topbar({ onRules: o.onRules }), o.prefill ? null : cover, sheet);
    if (o.prefill) (o.getNick() ? join : nick).focus();
    return { msg, nick };
  }

  /* lobby
     o: { app, code, people:[{name, me, host}], isHost, bots, maxBots, onBots(n), settings:[nodes], min, max, onStart, onLeave, title, shareText } */
  function lobby(o) {
    setTable(false);
    const total = o.people.length + (o.bots || 0);
    const url = location.origin + location.pathname + '?room=' + o.code;
    const invite = h('button', { class: 'btn btn-primary', type: 'button', style: 'width:100%', html: IC.link + '<span>초대 링크 보내기</span>', onclick: async e => {
      const b = e.currentTarget;
      if (navigator.share) { try { await navigator.share({ title: o.title, text: o.shareText, url }); return; } catch (er) { if (er && er.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(url); b.lastChild.textContent = '링크를 복사했어요'; setTimeout(() => { b.lastChild.textContent = '초대 링크 보내기'; }, 2000); } catch (er) { b.lastChild.textContent = url; }
    } });
    const ppl = h('ul', { class: 'people' },
      o.people.map((p, i) => h('li', null, avatar(p.name, i), h('span', { style: 'flex:1' }, p.name), p.me ? h('span', { class: 'tag' }, '나') : null, p.host ? h('span', { class: 'tag' }, '방장') : null)),
      Array.from({ length: o.bots || 0 }, (_, k) => h('li', { class: 'bot' }, avatar('컴', o.people.length + k), h('span', { style: 'flex:1' }, `컴퓨터 ${k + 1}`))));
    const start = o.isHost
      ? h('button', { class: 'btn btn-accent', type: 'button', style: 'width:100%', disabled: total < o.min, onclick: o.onStart }, total < o.min ? `${o.min}명부터 시작할 수 있어요` : `${total}명으로 시작`)
      : h('p', { class: 'fine', style: 'text-align:center;margin:4px 0 0' }, '방장이 시작하면 바로 게임이 열려요.');
    mount(o.app, topbar({}),
      h('div', { class: 'sheet' },
        h('div', { class: 'code-card' }, h('small', null, `${o.title} 방 코드`), h('b', null, o.code)),
        h('p', { class: 'fine', style: 'text-align:center;margin:4px 0 18px' }, '친구가 링크를 열거나 홈에서 이 코드를 입력하면 들어와요.'),
        invite),
      h('div', { class: 'sheet' },
        h('div', { class: 'split', style: 'margin-bottom:6px' }, h('h2', { style: 'margin:0;font-size:18px' }, `함께하는 사람 ${total}명`), h('span', { class: 'fine', style: 'margin:0' }, `${o.min}–${o.max}명`)),
        ppl,
        o.isHost ? h('div', { class: 'field split' }, h('span', { class: 'lab', style: 'margin:0' }, '컴퓨터 추가'), h('span', { class: 'stepper' },
          h('button', { type: 'button', 'aria-label': '컴퓨터 줄이기', disabled: !o.bots, onclick: () => o.onBots(Math.max(0, o.bots - 1)) }, '−'), h('b', null, o.bots + '명'),
          h('button', { type: 'button', 'aria-label': '컴퓨터 늘리기', disabled: o.bots >= o.maxBots, onclick: () => o.onBots(Math.min(o.maxBots, o.bots + 1)) }, '+'))) : null,
        o.isHost ? (o.settings || []) : null,
        start,
        h('button', { class: 'btn-text', type: 'button', onclick: o.onLeave }, '방 나가기')));
  }

  function closed(o) {
    setTable(false);
    mount(o.app, topbar({}), h('div', { class: 'sheet' },
      h('h2', null, '방이 닫혔어요'), h('p', { class: 'lead' }, '방장이 나갔거나 연결이 오래 끊겼어요. 방장에게 새 방을 부탁하거나 컴퓨터와 계속해 보세요.'),
      h('button', { class: 'btn btn-primary', type: 'button', style: 'width:100%', onclick: o.onHome }, '처음 화면으로')));
  }

  function seg(opts, value, onPick, label) {
    const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label || '' });
    const draw = v => { wrap.innerHTML = ''; opts.forEach(([k, t]) => wrap.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === k), class: v === k ? 'on' : null, onclick: () => { onPick(k); draw(k); } }, t))); };
    draw(value); return wrap;
  }
  function field(label, ...kids) { return h('div', { class: 'field' }, h('span', { class: 'lab' }, label), ...kids); }
  function switchRow(title, sub, checked, onChange) {
    return h('label', { class: 'switch field' }, h('span', { class: 'tx' }, h('b', null, title), sub ? h('span', null, sub) : null), h('input', { type: 'checkbox', role: 'switch', checked: !!checked, onchange: e => onChange(e.target.checked) }));
  }

  root.NoliUI = { h, IC, brand, iconBtn, soundBtn, topbar, avatar, metaList, toast, setTable, mount, entry, lobby, closed, rulesSheet, seg, field, switchRow, netError, cleanName, AV };
})(window);
