/* NoliNet — tiny room layer over PeerJS (WebRTC). The host's browser is the hub:
   every guest connects to the host, the host keeps everyone's presence and relays messages.
   API (subset of what the games need):
     const room = await NoliNet.host(game, code) | await NoliNet.join(game, code)
     room.code, room.isHost, room.me (peer id)
     room.presence(patch)            -> merge my presence (null deletes a key)
     room.peers()                    -> [{peer, isMe, sameTab, kind, presence}]
     room.onPeers(fn)                -> unsubscribe; fn({peers})
     room.send(toPeer, data) / room.broadcast(data) / room.onMessage(fn(data, fromPeer))
     room.onStatus(fn(state))        -> 'online' | 'reconnecting' | 'closed'
     room.leave()
*/
(function (root) {
  'use strict';
  const PREFIX = 'nolipan-v1-';
  const GRACE_MS = 45000;
  // Relay (TURN) servers let phones on different mobile networks reach each other.
  // Set TURN_URL to the Open Relay / Metered credentials URL (…/api/v1/turn/credentials?apiKey=…).
  const TURN_URL = root.NOLI_TURN_URL || '';
  let turnList = null, turnPromise = null;
  function ready() {
    if (turnList || !TURN_URL || (root.NOLI_PEER_OPTS && root.NOLI_PEER_OPTS.config)) return Promise.resolve();
    if (!turnPromise) turnPromise = Promise.race([
      fetch(TURN_URL).then(r => r.ok ? r.json() : []).then(list => { turnList = Array.isArray(list) ? list.filter(x => x && x.urls) : []; }).catch(() => { turnList = []; }),
      new Promise(res => setTimeout(res, 4000))
    ]).then(() => { if (!turnList) turnList = []; });
    return turnPromise;
  }
  function opts() {
    const o = Object.assign({ debug: 0 }, root.NOLI_PEER_OPTS || {});
    o.config = o.config || { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }].concat(turnList || [], root.NOLI_TURN || []) };
    return o;
  }
  function makeId(game, code) { return PREFIX + game + '-' + code; }
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function merge(obj, patch) { const o = Object.assign({}, obj); for (const [k, v] of Object.entries(patch || {})) { if (v === null) delete o[k]; else o[k] = clone(v); } return o; }

  function base() {
    const r = { subs: new Set(), msgs: new Set(), stat: new Set(), list: [], mine: {}, closed: false };
    r.api = {
      code: null, isHost: false, me: null,
      peers: () => r.list,
      onPeers(fn) { r.subs.add(fn); setTimeout(() => fn({ peers: r.list }), 0); return () => r.subs.delete(fn); },
      onMessage(fn) { r.msgs.add(fn); return () => r.msgs.delete(fn); },
      onStatus(fn) { r.stat.add(fn); return () => r.stat.delete(fn); }
    };
    r.emitPeers = () => { if (r.pending) return; r.pending = true; setTimeout(() => { r.pending = false; r.subs.forEach(fn => { try { fn({ peers: r.list }); } catch (e) { console.error(e); } }); }, 0); };
    r.emitMsg = (d, from) => r.msgs.forEach(fn => { try { fn(d, from); } catch (e) { console.error(e); } });
    r.emitStat = s => r.stat.forEach(fn => { try { fn(s); } catch (e) { console.error(e); } });
    return r;
  }

  function host(game, code) {
    return ready().then(() => new Promise((resolve, reject) => {
      const r = base(); const id = makeId(game, code);
      const peer = new root.Peer(id, opts());
      const members = new Map(); // peerId -> {presence, conn, away, joinedAt}
      let settled = false;
      function snapshot() { return [...members.entries()].map(([pid, m]) => ({ peer: pid, presence: m.presence, away: !!m.away })); }
      function publish() {
        const snap = snapshot();
        r.list = snap.map(x => ({ peer: x.peer, isMe: x.peer === id, sameTab: x.peer === id, kind: 'viewer', guest: false, away: x.away, presence: x.presence }));
        r.emitPeers();
        for (const [pid, m] of members) if (m.conn && m.conn.open) try { m.conn.send({ t: 'peers', list: snap }); } catch (e) { }
      }
      members.set(id, { presence: {}, conn: null, joinedAt: Date.now() });
      peer.on('open', () => { settled = true; r.api.code = code; r.api.isHost = true; r.api.me = id; r.emitStat('online'); publish(); resolve(r.api); });
      peer.on('error', err => { if (!settled) { settled = true; reject(err); return; } if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'disconnected') { r.emitStat('reconnecting'); try { peer.reconnect(); } catch (e) { } } });
      peer.on('disconnected', () => { if (r.closed) return; r.emitStat('reconnecting'); setTimeout(() => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) { } }, 1500); });
      peer.on('connection', conn => {
        conn.on('data', d => {
          if (!d || typeof d !== 'object') return;
          const pid = conn.peer;
          if (d.t === 'hello') { const m = members.get(pid) || { joinedAt: Date.now(), presence: {} }; m.conn = conn; m.away = false; if (m.timer) clearTimeout(m.timer); m.presence = merge(m.presence, d.presence); members.set(pid, m); publish(); }
          else if (d.t === 'p') { const m = members.get(pid); if (!m) return; m.presence = merge(m.presence, d.patch); publish(); }
          else if (d.t === 'msg') { if (d.to === id) r.emitMsg(d.data, pid); else if (d.to === '*') { r.emitMsg(d.data, pid); for (const [q, m] of members) if (q !== pid && m.conn && m.conn.open) m.conn.send({ t: 'msg', from: pid, data: d.data }); } else { const m = members.get(d.to); if (m && m.conn && m.conn.open) m.conn.send({ t: 'msg', from: pid, data: d.data }); } }
        });
        conn.on('close', () => { const m = members.get(conn.peer); if (!m || m.conn !== conn) return; m.away = true; publish(); m.timer = setTimeout(() => { if (m.away) { members.delete(conn.peer); publish(); } }, GRACE_MS); });
      });
      r.api.presence = patch => { const m = members.get(id); m.presence = merge(m.presence, patch); publish(); return Promise.resolve(); };
      r.api.send = (to, data) => { if (to === id) { r.emitMsg(clone(data), id); return; } const m = members.get(to); if (m && m.conn && m.conn.open) m.conn.send({ t: 'msg', from: id, data }); };
      r.api.broadcast = data => { r.emitMsg(clone(data), id); for (const [q, m] of members) if (q !== id && m.conn && m.conn.open) m.conn.send({ t: 'msg', from: id, data }); };
      r.api.leave = () => { r.closed = true; for (const [, m] of members) if (m.conn) try { m.conn.close(); } catch (e) { } try { peer.destroy(); } catch (e) { } r.emitStat('closed'); return Promise.resolve(); };
      setTimeout(() => { if (!settled) { settled = true; try { peer.destroy(); } catch (e) { } reject({ type: 'timeout' }); } }, 15000);
    }));
  }

  function join(game, code) {
    return ready().then(() => new Promise((resolve, reject) => {
      const r = base(); const hostId = makeId(game, code);
      const peer = new root.Peer(opts());
      let conn = null, settled = false, retry = 0;
      function connect() {
        conn = peer.connect(hostId, { reliable: true, serialization: 'json' });
        const c = conn;
        c.on('open', () => { retry = 0; c.send({ t: 'hello', presence: r.mine }); r.emitStat('online'); if (!settled) { settled = true; r.api.code = code; r.api.isHost = false; r.api.me = peer.id; resolve(r.api); } });
        c.on('data', d => {
          if (!d || typeof d !== 'object') return;
          if (d.t === 'peers') { r.list = d.list.map(x => ({ peer: x.peer, isMe: x.peer === peer.id, sameTab: x.peer === peer.id, kind: 'viewer', guest: false, away: x.away, presence: x.peer === peer.id ? r.mine : x.presence })); r.emitPeers(); }
          else if (d.t === 'msg') r.emitMsg(d.data, d.from);
        });
        c.on('close', () => { if (r.closed || c !== conn) return; r.emitStat('reconnecting'); scheduleRetry(); });
        c.on('error', () => { });
      }
      function scheduleRetry() { if (r.closed) return; retry++; if (retry > 20) { r.emitStat('closed'); return; } setTimeout(() => { if (r.closed) return; try { if (peer.disconnected) peer.reconnect(); } catch (e) { } connect(); }, Math.min(8000, 800 * retry)); }
      peer.on('open', () => connect());
      peer.on('error', err => {
        if (err.type === 'peer-unavailable') { if (!settled) { settled = true; try { peer.destroy(); } catch (e) { } reject({ type: 'not-found' }); } else scheduleRetry(); return; }
        if (!settled) { settled = true; try { peer.destroy(); } catch (e) { } reject(err); return; }
        r.emitStat('reconnecting');
      });
      peer.on('disconnected', () => { if (r.closed) return; setTimeout(() => { try { if (!peer.destroyed && peer.disconnected) peer.reconnect(); } catch (e) { } }, 1500); });
      r.api.presence = patch => { r.mine = merge(r.mine, patch); const self = r.list.find(x => x.isMe); if (self) { self.presence = r.mine; r.list = r.list.slice(); r.emitPeers(); } if (conn && conn.open) conn.send({ t: 'p', patch }); return Promise.resolve(); };
      r.api.send = (to, data) => { if (conn && conn.open) conn.send({ t: 'msg', to, data }); };
      r.api.broadcast = data => { r.emitMsg(clone(data), peer.id); if (conn && conn.open) conn.send({ t: 'msg', to: '*', data }); };
      r.api.leave = () => { r.closed = true; try { conn && conn.close(); } catch (e) { } try { peer.destroy(); } catch (e) { } r.emitStat('closed'); return Promise.resolve(); };
      r.api.hostId = hostId;
      setTimeout(() => { if (!settled) { settled = true; try { peer.destroy(); } catch (e) { } reject({ type: 'timeout' }); } }, 20000);
    }));
  }

  // Create a room with a free random code in [lo, hi]
  async function create(game, lo, hi) {
    let last;
    for (let k = 0; k < 6; k++) {
      const code = String(lo + Math.floor(Math.random() * (hi - lo + 1)));
      try { return await host(game, code); } catch (e) { last = e; if (e && e.type !== 'unavailable-id') break; }
    }
    throw last || { type: 'unknown' };
  }
  root.NoliNet = { host, join, create, available: () => typeof root.Peer === 'function' };
})(typeof window !== 'undefined' ? window : this);
