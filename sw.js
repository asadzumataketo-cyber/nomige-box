// オフラインでも開けるようにアプリ本体をキャッシュする。更新したら VERSION を上げる
const VERSION='nomige-v7-2';
const FILES=['./','index.html','style.css','data.js','app.js','vendor/peerjs.min.js','vendor/qrcode.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','img/logo.jpg','img/games/san.png','img/games/ito.png','img/games/ins.png','img/games/wave.png','img/games/hl.png','img/games/chin.png','img/games/rr.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
// ネット優先、つながらない時はキャッシュ(更新がすぐ届くように)
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
 e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(VERSION).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request,{ignoreSearch:true})))});
