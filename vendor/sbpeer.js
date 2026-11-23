// Supabase Realtime を使った中継通信。PeerJS と同じ形(Peer / connect / on('data') など)で使える。
// スマホ同士を直接つながないので、携帯回線やWi-Fiの種類に関係なくつながる。
// ・部屋チャンネル nm:<部屋ID> … ホストの在席(presence)と公開鍵だけを置く
// ・参加の申し込みはホストの公開鍵で暗号化し、各参加者専用の秘密のチャンネル名を伝える
// ・ゲームの画面や操作はその専用チャンネルだけを通る(他の参加者には届かない)
(function () {
  'use strict';
  var SB_URL = 'https://ybotqkapbsfkkrlibkyh.supabase.co';
  var SB_KEY = 'sb_publishable_YSSWOpuQNVV9-xXUHf8-bw_LpA8jzws';
  function mkClient() { return window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 40 } } }); }
  function dbg() { if (window.__sbdbg) try { console.log.apply(console, ['[sb]'].concat([].slice.call(arguments))); } catch (e) {} }
  function rid() { var a = new Uint8Array(16); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }
  function b64(buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function members(ch) { var st = ch.presenceState(), out = []; Object.keys(st).forEach(function (k) { st[k].forEach(function (m) { m._key = k; out.push(m); }); }); return out; }
  // presence の最初の同期を待つ(最大 ms)
  function synced(ch, ms) { return new Promise(function (res) { var done = false; ch.on('presence', { event: 'sync' }, function () { if (!done) { done = true; res(); } }); setTimeout(function () { if (!done) { done = true; res(); } }, ms); }); }
  function subscribed(ch, ms) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error('timeout')); }, ms);
      ch.subscribe(function (st, err) { dbg('sub', ch.topic, st, err && err.message); if (st === 'SUBSCRIBED') { clearTimeout(t); res(); } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { clearTimeout(t); rej(new Error(st)); } });
    });
  }

  function Em() { this.h = {}; }
  Em.prototype.on = function (e, f) { (this.h[e] = this.h[e] || []).push(f); return this; };
  Em.prototype.emit = function (e) { var a = Array.prototype.slice.call(arguments, 1); (this.h[e] || []).slice().forEach(function (f) { try { f.apply(null, a); } catch (x) { console.error(x); } }); };

  function Conn(peer, remote, side) { Em.call(this); this.peer = remote; this._p = peer; this._side = side; this.open = false; this._closed = false; this._ch = null; }
  Conn.prototype = Object.create(Em.prototype);
  Conn.prototype.send = function (d) {
    if (!this.open || !this._ch) return;
    this._ch.send({ type: 'broadcast', event: this._side === 'host' ? 'dn' : 'up', payload: { d: d } });
  };
  Conn.prototype.close = function () {
    if (this._closed) return; var ch = this._ch;
    try { ch && ch.send({ type: 'broadcast', event: 'bye', payload: {} }); } catch (e) {}
    this._gone(true);
  };
  Conn.prototype._gone = function (quiet) {
    if (this._closed) return; this._closed = true; this.open = false; var ch = this._ch;
    setTimeout(function () { try { ch && ch.unsubscribe(); } catch (e) {} }, 150);
    this.emit('close');
  };
  // 専用チャンネルにつなぐ(ホスト・参加者で共通)
  Conn.prototype._link = function (inbox, onReady) {
    var self = this, me = this._side === 'host' ? 'h' : 'g', other = me === 'h' ? 'g' : 'h';
    var ch = this._ch = this._p._sb.channel('nm:x:' + inbox, { config: { presence: { key: me + '-' + rid() } } });
    ch.on('broadcast', { event: this._side === 'host' ? 'up' : 'dn' }, function (m) { if (self.open) self.emit('data', m.payload && m.payload.d); });
    ch.on('broadcast', { event: 'bye' }, function () { self._gone(); });
    ch.on('broadcast', { event: 'hi' }, function () { if (self._side === 'guest' && !self.open && !self._closed) { self.open = true; self.emit('open'); } });
    ch.on('presence', { event: 'leave' }, function (ev) { if ((ev.leftPresences || []).some(function (m) { return m.r === other; }) && !members(ch).some(function (m) { return m.r === other; })) self._gone(); });
    return subscribed(ch, 10000).then(function () { return ch.track({ r: me }); }).then(onReady);
  };

  function Peer(id, opts) {
    Em.call(this);
    if (id && typeof id === 'object') id = null;
    this.destroyed = false; this.disconnected = false; this._sb = window.supabase ? mkClient() : null; this._host = !!id; this.id = id || rid(); this._chs = []; this._conns = [];
    var self = this;
    if (!window.supabase || !window.crypto || !crypto.subtle) { setTimeout(function () { self.emit('error', { type: 'browser-incompatible' }); }, 0); return; }
    if (this._host) this._startHost(); else setTimeout(function () { if (!self.destroyed) self.emit('open', self.id); }, 0);
  }
  Peer.prototype = Object.create(Em.prototype);
  Peer.prototype._startHost = function () {
    var self = this, myKey = 'host-' + Date.now().toString(36) + '-' + rid().slice(0, 8);
    crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, false, ['encrypt', 'decrypt'])
      .then(function (k) { self._keys = k; return crypto.subtle.exportKey('spki', k.publicKey); })
      .then(function (spki) {
        if (self.destroyed) return;
        var ch = self._room = self._sb.channel('nm:' + self.id, { config: { presence: { key: myKey } } });
        self._chs.push(ch);
        ch.on('broadcast', { event: 'req' }, function (m) { self._req(m.payload); });
        var sync = synced(ch, 2500);
        return subscribed(ch, 15000).then(function () { return sync; }).then(function () {
          if (self.destroyed) return;
          if (members(ch).some(function (m) { return m.host; })) { self.emit('error', { type: 'unavailable-id' }); self.destroy(); return; }
          return ch.track({ host: true, pk: b64(spki), k: myKey }).then(function () { return sleep(700); }).then(function () {
            if (self.destroyed) return;
            // 同時に2人がホストになったら、キーの小さい方だけ残る
            var hosts = members(ch).filter(function (m) { return m.host; }).map(function (m) { return m.k; }).sort();
            if (hosts.length > 1 && hosts[0] !== myKey) { self.emit('error', { type: 'unavailable-id' }); self.destroy(); return; }
            self.emit('open', self.id);
          });
        });
      })
      .catch(function (e) { dbg('host fail', e && e.message); if (!self.destroyed) self.emit('error', { type: 'network' }); });
  };
  Peer.prototype._req = function (p) {
    var self = this; if (!p || !p.enc || !this._keys) return;
    crypto.subtle.decrypt({ name: 'RSA-OAEP' }, this._keys.privateKey, unb64(p.enc)).then(function (buf) {
      var info = JSON.parse(new TextDecoder().decode(buf)); if (!info || !/^[0-9a-f]{32}$/.test(info.inbox || '')) return;
      if (self._conns.some(function (c) { return c.peer === info.inbox && !c._closed; })) return;
      var c = new Conn(self, info.inbox, 'host'); self._conns.push(c);
      c._link(info.inbox, function () {
        if (self.destroyed || c._closed) return;
        c.open = true; self.emit('connection', c); c.emit('open');
        c._ch.send({ type: 'broadcast', event: 'hi', payload: {} });
      }).catch(function () { c._gone(); });
    }).catch(function () {});
  };
  Peer.prototype.connect = function (hostId) {
    var self = this, c = new Conn(this, hostId, 'guest'), inbox = rid(); this._conns.push(c);
    var room = this._sb.channel('nm:' + hostId, { config: { presence: { key: 'g-' + inbox } } }); this._chs.push(room);
    var sync = synced(room, 3000);
    room.on('presence', { event: 'leave' }, function () { if (c.open && !members(room).some(function (m) { return m.host; })) c._gone(); });
    subscribed(room, 15000).then(function () { return sync; }).then(function () {
      if (self.destroyed) return;
      var host = members(room).filter(function (m) { return m.host; }).sort(function (a, b) { return a.k < b.k ? -1 : 1; })[0];
      if (!host) { self.emit('error', { type: 'peer-unavailable' }); return; }
      return c._link(inbox, function () {
        return crypto.subtle.importKey('spki', unb64(host.pk), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
          .then(function (pk) { return crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pk, new TextEncoder().encode(JSON.stringify({ inbox: inbox }))); })
          .then(function (enc) {
            var tries = 0;
            // 申し込み(返事が来るまで数回送り直す)
            (function ask() { if (c.open || c._closed || self.destroyed) return; if (tries++ >= 4) { c.emit('error', new Error('no answer')); c._gone(); return; } room.send({ type: 'broadcast', event: 'req', payload: { enc: b64(enc) } }); setTimeout(ask, 3000); })();
          });
      });
    }).catch(function () { if (!self.destroyed) { c.emit('error', new Error('network')); c._gone(); } });
    return c;
  };
  Peer.prototype.reconnect = function () {};
  Peer.prototype.destroy = function () {
    if (this.destroyed) return; this.destroyed = true;
    this._conns.forEach(function (c) { try { c.close(); } catch (e) {} });
    var c = this._sb; setTimeout(function () { try { c && c.removeAllChannels(); } catch (e) {} }, 300);
  };
  window.Peer = Peer;
})();
