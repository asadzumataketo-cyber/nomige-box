// のみゲーBOX 本体
// 仕組み:ホストの端末がゲームの状態を全部持ち、プレイヤーごとの画面(HTML)を作って各スマホへ送る。
// ゲストは届いた画面を表示し、ボタン操作だけをホストへ送り返す(PeerJS / WebRTC)。
// 1台モードでは、ホスト端末に「ローカル席」を作り、スマホを渡しながら遊ぶ。
// 勝ち負け:各ゲームは「勝った人・負けた人・一番負けた人」を出し、ホストが決めた範囲の人が飲む(罰を受ける)。
{
const {SAN,ITO,WORDS,WAVE,SOFT}=window.NOMIGE_DATA;
const PROTO=5;
const WEB_URL='https://asadzumataketo-cyber.github.io/nomige-box/';
const GAMES=[
 {id:'san',c:'ベスト3を読め',name:'サンレンタン',min:2,d:'出題者の1〜3位を、順番まで当てる',
  rules:['出題者(順番に交代)はお題の7択から自分の1〜3位を選ぶ','他の人は「この人ならこう選ぶ」と1〜3位を予想','順番まで全部当てたら6点、3つ当てて順番違いは4点、1・2位が順番どおりは3点、2つ当たりは2点、1位だけ当たりは1点','一番点が高い人が勝ち、一番低い人が負け。全員2点未満なら「伝わってない」で出題者も負け']},
 {id:'ito',c:'数字を例えて並べ',name:'ito',min:2,d:'数字を言わずに表現して、小さい順に並ぶ(協力)',
  rules:['全員に1〜100の数字がこっそり配られる','テーマに沿って、数字の大きさを例えで伝える(例:テーマ「強そうな動物」で「ライオン」なら大きめ)','数字そのものは言っちゃダメ','話しながら自分の位置を↑↓で動かし、全員そろったら答え合わせ','全員正しければ全員の勝ち。ズレた人が負け']},
 {id:'ins',c:'裏切り者をさがせ',name:'インサイダー',min:4,d:'質問で答えを当てつつ、答えを知る裏切り者を探す',
  rules:['マスター・インサイダー・庶民の役職が配られる。マスターは公開','お題を知っているのはマスターとインサイダーだけ','マスター以外がはい・いいえで答えられる質問をして、3分以内にお題を当てる','当たったら話し合い(質問にかかった時間に応じて30〜90秒)、インサイダーだと思う人に1回だけ投票','インサイダーが1人で最多票ならインサイダーの負け。逃げ切ったらインサイダーの勝ち。時間切れは全員負け']},
 {id:'wave',c:'ヒントで針を合わせろ',name:'ウェーブレングス',min:2,d:'ヒント1つでメーター上の位置を当てる',
  rules:['ヒント役(順番に交代)だけが、メーター上の正解の位置を見られる','ヒント役は位置を表す言葉を1つ送る(例:「冷たい〜熱い」の右寄りなら「ラーメン」)','他の人はスライダーで位置を予想','一番近い人が勝ち、一番遠い人が負け。誰も近づけなかったらヒント役も負け']},
 {id:'hl',c:'上か下か、外したら脱落',name:'ハイ&ロー',min:1,d:'全員同じカードで上か下か。最後まで残った人の勝ち',
  rules:['全員が同じカードを見て、次のカードが上か下かを選ぶ','外したら脱落。同じ数字ならセーフ','残っている全員が外したら、その回はやり直し','最後の1人が勝ち。最初に脱落した人が一番負け','1人で遊ぶときは5連続で当てたら勝ち']},
 {id:'chin',c:'サイコロ三つで勝負',name:'チンチロ',min:2,d:'全員同時にサイコロ。強い役が勝ち',
  rules:['各自サイコロ3つを、役が出るまで最大3回振る(1タップで自動)','強さ:ピンゾロ(1・1・1)>ゾロ目>シゴロ(4・5・6)>目(2つそろって残りの数)>目なし>ヒフミ(1・2・3)','一番強い人が勝ち、一番弱い人が負け']},
 {id:'rr',c:'引き金を引け',name:'ロシアンルーレット',min:1,d:'6発中1発が当たり。順番に引き金を引く',
  rules:['6発のうち1発だけが当たり。順番に引き金を引いていく','当たった人が負け。それ以外の全員が勝ち']}
];
const SCOPES=[['lose','負けた人'],['worst','一番負けた人だけ'],['notwin','勝った人以外'],['pick','勝った人が指名'],['all','全員']];

/* ================= ユーティリティ ================= */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rnd=n=>Math.floor(Math.random()*n);
const pick=a=>a[rnd(a.length)];
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const range=n=>[...Array(n).keys()];
const uniq=a=>[...new Set(a)];
const fmt=s=>{s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const CARD=c=>['A','2','3','4','5','6','7','8','9','10','J','Q','K'][c-1];
const DIE=d=>'⚀⚁⚂⚃⚄⚅'[d-1];
const rid=()=>Math.random().toString(36).slice(2,10);
const ls={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const PFX='nomige-v3-';
// 合言葉:ひらがな/カタカナ・全角/半角・大文字/小文字・空白の違いは同じ部屋とみなす
const normPw=t=>String(t||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)).slice(0,20);
const h53=(t,seed)=>{let a=0xdeadbeef^seed,b=0x41c6ce57^seed;for(let i=0;i<t.length;i++){const c=t.charCodeAt(i);a=Math.imul(a^c,2654435761);b=Math.imul(b^c,1597334677)}a=Math.imul(a^(a>>>16),2246822507)^Math.imul(b^(b>>>13),3266489909);b=Math.imul(b^(b>>>16),2246822507)^Math.imul(a^(a>>>13),3266489909);return (4294967296*(2097151&b)+(a>>>0)).toString(36)};
const roomId=pw=>PFX+h53(normPw(pw),1)+h53(normPw(pw),7);
const PW_A=['からあげ','たこやき','ぎょうざ','おでん','ラーメン','すきやき','もつなべ','えだまめ','やきとり','ハイボール'];
const PW_B=['パンダ','ペンギン','カピバラ','コアラ','ラッコ','タヌキ','フクロウ','イルカ','ゴリラ','ハムスター'];
const randPw=()=>pick(PW_A)+pick(PW_B)+(10+rnd(90));
let toastT=null;
const toast=t=>{const el=$('#toast');el.textContent=t;clearTimeout(toastT);toastT=setTimeout(()=>el.textContent='',1800)};

/* ================= 端末の機能(音・振動・スリープ防止) ================= */
const native=()=>!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());
const plugs={};
const plug=n=>{if(!native())return null;if(plugs[n]!==undefined)return plugs[n];const C=window.Capacitor;let p=null;try{p=C.registerPlugin?C.registerPlugin(n):(C.Plugins&&C.Plugins[n])||null}catch(e){p=(C.Plugins&&C.Plugins[n])||null}return plugs[n]=p};
const reduceOS=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const dev={peek:ls.get('nm-peek')!==false,snd:ls.get('nm-snd')!==false,vib:ls.get('nm-vib')!==false,motion:ls.get('nm-motion')||(reduceOS?'off':'full')};
const MOTION={full:'標準',lite:'控えめ',off:'オフ'};
const applyMotion=()=>{document.documentElement.dataset.motion=dev.motion;document.documentElement.dataset.peek=dev.peek?'on':'off'};applyMotion();
try{const mq=matchMedia('(prefers-reduced-motion: reduce)');const onMq=()=>{if(ls.get('nm-motion'))return;dev.motion=mq.matches?'off':'full';applyMotion()};mq.addEventListener?mq.addEventListener('change',onMq):mq.addListener&&mq.addListener(onMq)}catch(e){}
let AC=null,NOISE=null;
const unlock=()=>{if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(AC&&AC.state==='suspended')AC.resume().catch(()=>{})};
const tone=(f,d,type='sine',v=.15,when=0)=>{if(!AC)return;const t=AC.currentTime+when,o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g).connect(AC.destination);o.start(t);o.stop(t+d+.02)};
const noise=(d,v,when=0,hp=1200)=>{if(!AC)return;if(!NOISE){NOISE=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);const c=NOISE.getChannelData(0);for(let i=0;i<c.length;i++)c[i]=Math.random()*2-1}
 const t=AC.currentTime+when,s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();s.buffer=NOISE;f.type='highpass';f.frequency.value=hp;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);s.connect(f).connect(g).connect(AC.destination);s.start(t);s.stop(t+d+.02)};
const SFX={
 tap:()=>tone(660,.05,'triangle',.06),
 start:()=>{[523,659,784,1047].forEach((f,i)=>tone(f,.18,'square',.06,i*.08));noise(.3,.08,.32,3000)},
 drum:()=>{for(let i=0;i<14;i++)noise(.04,.05+i*.01,i*.05,900);noise(.8,.22,.75,2500);tone(110,.4,'sine',.3,.75)},
 win:()=>[784,988,1175,1568].forEach((f,i)=>tone(f,.25,'square',.06,i*.1)),
 lose:()=>{[392,311,262,196].forEach((f,i)=>tone(f,.32,'sawtooth',.07,i*.14))},
 drink:()=>{tone(80,.5,'square',.2);noise(.5,.25,0,400);[523,523,392].forEach((f,i)=>tone(f,.15,'square',.08,.5+i*.16))},
 card:()=>{noise(.06,.12,0,4000);tone(880,.09,'triangle',.1,.05)},
 dice:()=>range(9).forEach(i=>{noise(.03,.12,i*.07,2000);tone(160+rnd(380),.03,'square',.04,i*.07)}),
 spin:()=>range(14).forEach(i=>noise(.02,.08,i*.05*(1+i*.08),3000)),
 click:()=>{noise(.05,.3,0,2500);tone(140,.08,'square',.12)},
 bang:()=>{noise(.7,.5,0,200);tone(70,.5,'sawtooth',.25)},
 pick:()=>{tone(1047,.1,'square',.07);tone(1319,.2,'square',.07,.1)},
 tick:()=>tone(1000,.03,'square',.04)
};
const HEAVY=new Set(['lose','bang','drink']);
const buzz=k=>{if(!dev.vib)return;const h=plug('Haptics');
 if(h&&h.impact)h.impact({style:HEAVY.has(k)?'HEAVY':'LIGHT'}).catch(()=>{});
 else if(navigator.vibrate)try{navigator.vibrate(HEAVY.has(k)?[60,40,60,40,120]:15)}catch(e){}};
const sfx=k=>{if(dev.snd&&AC&&SFX[k])try{SFX[k]()}catch(e){}if(!['tap','tick','drum','spin','dice'].includes(k))buzz(k)};
let wl=null;
const awake=async()=>{try{const K=plug('KeepAwake');if(K&&K.keepAwake){await K.keepAwake();return}
 if(navigator.wakeLock&&!wl){wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>{wl=null})}}catch(e){}};

/* ================= 接続まわり ================= */
// 再接続用の合い鍵(128ビット)。暗号学的に安全な乱数だけで作る。作れない端末では通信を使わない
const mkTok=()=>{try{if(!(window.crypto&&crypto.getRandomValues))return null;const a=new Uint8Array(16);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')}catch(e){return null}};
const me={pid:ls.get('nm-pid')||rid(),tok:(/^[0-9a-f]{32}$/.test(ls.get('nm-tok')||'')?ls.get('nm-tok'):mkTok()),name:ls.get('nm-name')||'',adult:ls.get('nm-adult')};
ls.set('nm-pid',me.pid);if(me.tok)ls.set('nm-tok',me.tok);
let mode=null,H=null,peer=null,conn=null,code=null,ever=false,rt=null,tries=0;
const conns=new Map();
const app=$('#app');
const net=t=>{$('#net').textContent=t||''};
let last='';
const played=new Set(),fxSeen=new Set();
// 画面の差し替え。演出(.fx)は同じものを2度再生しない
let scr='',pending=0,sfxTimers=[];
const show=h=>{pending=0;app.classList.remove('busy');if(h===last)return;last=h;
 const keep={},ae=document.activeElement&&document.activeElement.dataset?document.activeElement.dataset.f:null;
 app.querySelectorAll('[data-f]').forEach(i=>keep[i.dataset.f+'|'+i.dataset.k]=i.value);
 const openRules=!!app.querySelector('details.rules[open]');
 app.innerHTML=h;
 const ns=(app.querySelector('[data-scr]')||{}).dataset?.scr||'';if(ns!==scr){scr=ns;sfxTimers.forEach(clearTimeout);sfxTimers=[];app.classList.remove('enter');void app.offsetWidth;app.classList.add('enter');window.scrollTo(0,0)}
 app.querySelectorAll('[data-f]').forEach(i=>{const v=keep[i.dataset.f+'|'+i.dataset.k];if(v!=null)i.value=v;if(i.dataset.f===ae)i.focus()});
 if(openRules){const d=app.querySelector('details.rules');if(d)d.open=true}
 const wr=$('#wr'),wm=$('#wm');if(wr&&wm)wm.style.left=wr.value+'%';
 app.querySelectorAll('[data-rem]').forEach(e=>{e.dataset.end=Date.now()+ +e.dataset.rem;e.textContent=fmt(+e.dataset.rem/1000)});
 app.querySelectorAll('.fx').forEach(e=>{const id=e.dataset.fx;if(fxSeen.has(id))e.classList.add('done');else fxSeen.add(id)});
 app.querySelectorAll('[data-sfx]').forEach(e=>{const id=e.dataset.sid;if(id&&!played.has(id)){played.add(id);const d=dev.motion==='off'?0:(+e.dataset.delay||0);if(dev.motion==='off'&&e.dataset.sfx==='drum')return;d?sfxTimers.push(setTimeout(()=>sfx(e.dataset.sfx),d)):sfx(e.dataset.sfx)}});
 if(played.size>400)played.clear();if(fxSeen.size>400)fxSeen.clear()};
let lastSec=-1;
setInterval(()=>{app.querySelectorAll('[data-end]').forEach(e=>{const r=(+e.dataset.end-Date.now())/1000;e.textContent=fmt(r);const s=Math.ceil(r);if(s<=10&&s>0&&s!==lastSec){lastSec=s;sfx('tick');e.classList.toggle('hurry',true)}})},250);

const urlCode=String(new URLSearchParams(location.search).get('r')||'').trim().slice(0,20);
const joinUrl=c=>{const web=/^https?:$/.test(location.protocol)&&!/^(localhost|127\.|192\.168\.)/.test(location.hostname);return (web?location.origin+location.pathname:WEB_URL)+'?r='+encodeURIComponent(c)};

/* --- ロビー(端末内だけの画面) --- */
const LOGO='<h1 class="logo"><img src="img/logo.jpg" alt="のみゲーBOX" width="120" height="120"></h1>';
const gate=()=>show(`<div class="gate">${LOGO}<p class="center">はじめに確認させてください。</p><div class="card"><p class="q">あなたは20歳以上ですか？</p><p class="muted">20歳未満の人は、罰が「罰ゲーム」になります(お酒の罰は出ません)。</p><div class="row"><button data-l="adult" data-v="1">はい</button><button class="g" data-l="adult" data-v="0">いいえ</button></div></div></div>`);
const lobby=(msg='')=>{mode=null;net('');if(me.adult==null)return gate();
 show(`${LOGO}<p class="muted center">各自のスマホで同時に遊ぶパーティーゲーム集(1〜10人)</p>
${msg?`<p class="pen">${esc(msg)}</p>`:''}
<div class="card"><label for="nmIn"><b>あなたの名前</b></label><input type="text" id="nmIn" maxlength="10" value="${esc(me.name)}" autocomplete="nickname" enterkeyhint="done"></div>
<div class="card"><label for="pwIn"><b>合言葉で遊ぶ</b></label><p class="muted">同じ合言葉を入れた人どうしが、同じ部屋に入れます。最初に入った人がホスト(進行役)</p><input type="text" id="pwIn" maxlength="20" placeholder="例:からあげパンダ42" value="${esc(urlCode)}" aria-label="合言葉" autocomplete="off" enterkeyhint="go"><div class="row"><button data-l="enter" style="flex:2">入る</button><button class="g" data-l="randpw" style="flex:1">おまかせ</button></div><p class="muted">知らない人と被らないよう、少し変わった合言葉がおすすめ</p></div>
<div class="card"><b>1台で遊ぶ</b><p class="muted">通信なし。このスマホを回して遊びます</p><button class="g" data-l="solo">1台で遊ぶ</button></div>
<div class="row"><button class="g" data-l="howto">遊び方</button><button class="g" data-l="snd">音 ${dev.snd?'オン':'オフ'}</button><button class="g" data-l="vib">振動 ${dev.vib?'オン':'オフ'}</button><button class="g" data-l="motion">演出 ${MOTION[dev.motion]}</button><button class="g" data-l="peek">自分のカード ${dev.peek?'伏せる':'いつも表'}</button></div>
<p class="note">年齢の設定は<button class="g mini" data-l="regate">変更</button></p>`)};
const howto=()=>show(`<h1>遊び方</h1><p>全員が同じ合言葉を入れて「入る」を押すと、同じ部屋に集まれます。最初に入った人がホスト(進行役)。QRコードや招待URLからでも入れます。スマホが1台しかない時は「1台で遊ぶ」で、画面の指示に従ってスマホを渡してください。</p>
${GAMES.map(g=>`<div class="card"><h2>${g.name}</h2><p class="muted">${g.min}人から</p><ol>${g.rules.map(r=>`<li>${r}</li>`).join('')}</ol></div>`).join('')}
<div class="card"><h2>勝ち負けと罰</h2><ol><li>どのゲームも「勝った人」「負けた人」「一番負けた人」が決まる</li><li>罰を受ける範囲はホストが選ぶ:負けた人/一番負けた人だけ/勝った人以外/勝った人が指名/全員</li><li>罰は「飲む(20歳以上のみ・1口か2口)」か「罰ゲーム」</li><li>勝ち・負け・罰の回数は「成績」で見られる</li></ol></div>
<button data-l="back">戻る</button>`);
const takeName=()=>{const v=($('#nmIn')?.value||'').trim().slice(0,10);if(!v){lobby('名前を入れてね');return false}me.name=v;ls.set('nm-name',v);return true};
const cleanup=()=>{try{peer&&peer.destroy()}catch(e){}peer=null;conn=null;conns.clear();clearTimeout(rt);rt=null};

const L={
 adult(b){me.adult=b.v==='1';ls.set('nm-adult',me.adult);lobby()},
 regate(){me.adult=null;ls.del('nm-adult');gate()},
 solo(){if(!takeName())return;H=null;startHost(null,false,true)},
 enter(){if(!takeName())return;if(!me.tok){lobby('この端末では安全な接続を作れないため、通信で遊べません。「1台で遊ぶ」を使ってね');return}const c=($('#pwIn')?.value||'').trim().slice(0,20);if(normPw(c).length<2){lobby('合言葉は2文字以上');return}H=null;startGuest(c,true)},
 rejoin(){if(code)startGuest(code,false)},
 randpw(){const i=$('#pwIn');if(i){i.value=randPw();i.focus()}},
 leave(){if(mode==='host')ls.del('nm-host');const K=plug('KeepAwake');K&&K.allowSleep&&K.allowSleep().catch(()=>{});cleanup();if(/^https?:$/.test(location.protocol))history.replaceState(null,'',location.pathname);lobby()},
 howto(){howto()},back(){lobby()},
 snd(){dev.snd=!dev.snd;ls.set('nm-snd',dev.snd);toast('音 '+(dev.snd?'オン':'オフ'));if(!mode)lobby()},
 vib(){dev.vib=!dev.vib;ls.set('nm-vib',dev.vib);toast('振動 '+(dev.vib?'オン':'オフ'));if(!mode)lobby()},
 peek(){dev.peek=!dev.peek;ls.set('nm-peek',dev.peek);applyMotion();toast('自分のカード '+(dev.peek?'伏せる(長押しで見る)':'いつも表'));if(!mode)lobby()},
 motion(){const k=Object.keys(MOTION);dev.motion=k[(k.indexOf(dev.motion)+1)%k.length];ls.set('nm-motion',dev.motion);applyMotion();toast('演出 '+MOTION[dev.motion]);if(!mode)lobby()},
 settings(){openSheet()},
 mclose(){closeSheet()},
 cyes(){const c=confirmAct;closeSheet();if(c)fire(c,true)},
 share(b){const url=b.url;if(navigator.share)navigator.share({title:'のみゲーBOX',text:'合言葉「'+code+'」で入ってね',url}).catch(()=>{});else navigator.clipboard?.writeText(url).then(()=>toast('URLをコピーした'),()=>toast('コピーできませんでした'))}
};

/* --- ホスト --- */
const startHost=(c,resume,offline)=>{cleanup();mode='host';code=offline?null:c;
 if(!H)H={host:me.pid,players:[],local:[],seat:me.pid,hand:null,offline:!!offline,mode:'soft',scope:'lose',sips:1,turn:0,g:null,view:'hub',authV:5};
 H.local=H.local||[];H.offline=!!offline;H.scope=H.scope||'lose';H.sips=H.sips||1;
 if(H.authV!==5){if(H.g){H.g=null;H.view='hub'}H.players.forEach(p=>{if(p.id!==H.host&&!H.local.includes(p.id)&&!p.tok){let n;do{n='old-'+rid()}while(H.players.some(x=>x.id===n));p.oldId=p.id;p.id=n;p.name=(p.name+'(旧)').slice(0,12);p.on=false;p.legacy=true}});H.authV=5}
 H.ep=(H.ep||0)+1;lastBase=null;seenOps.clear();
 H.players.forEach(p=>{p.on=p.id===me.pid||H.local.includes(p.id);p.w=p.w||0;p.l=p.l||0;p.pen=p.pen||0;if(H.local.includes(p.id)&&!p.ageSet){p.adult=false;p.age='unknown';p.ageSet=true}if(H.local.includes(p.id))p.adult=p.age==='adult'});addPlayer(me.pid,me.name,me.adult);
 if(H.mode==='drink'&&!me.adult)H.mode='soft';
 if(offline){net('');bc();return}
 net('部屋を準備中…');bc();
 if(typeof Peer!=='function'){net('通信できません。「1台で遊ぶ」なら遊べます');return}
 peer=new Peer(roomId(c),PEER_OPT);
 peer.on('open',()=>{tries=0;net('');if(/^https?:$/.test(location.protocol))history.replaceState(null,'','?r='+encodeURIComponent(c));bc()});
 peer.on('connection',cn=>{cn.on('data',d=>onData(cn,d));cn.on('close',()=>drop(cn));cn.on('error',()=>drop(cn))});
 peer.on('disconnected',()=>{net('接続が切れた。再接続中…');setTimeout(()=>{try{peer&&!peer.destroyed&&peer.reconnect()}catch(e){}},1500)});
 peer.on('error',e=>{
  if(e.type==='unavailable-id'){if(resume&&tries++<5){net('部屋を復元中…');setTimeout(()=>startHost(c,true,false),3000)}else{tries=0;H=null;startGuest(c,false)}}
  else if(e.type==='peer-unavailable'){}
  else net('通信エラー('+e.type+')。再接続を試しています')});
};
const pl=id=>H.players.find(p=>p.id===id);
const onDevice=id=>id===H.host||H.local.includes(id);
const addPlayer=(id,name,adult)=>{const p=pl(id);if(p){p.name=name;p.on=true;p.adult=!!adult;return true}
 if(H.players.length>=10){const off=H.players.findIndex(x=>!x.on&&!onDevice(x.id)&&!(H.g&&H.g.ps.includes(x.id)));if(off<0)return false;H.players.splice(off,1)}
 H.players.push({id,name,w:0,l:0,pen:0,on:true,adult:!!adult});return true};
const onData=(cn,d)=>{if(!d||typeof d!=='object')return;
 if(d.t==='hello'){if(d.v!==PROTO){try{cn.send({t:'old',v:PROTO})}catch(e){}return}
  const id=String(d.pid||'').slice(0,20),name=String(d.name||'').trim().slice(0,10)||'ゲスト',tok=typeof d.tok==='string'?d.tok:'';if(!id||onDevice(id))return;
  if(!/^[0-9a-f]{32}$/.test(tok)){try{cn.send({t:'old',v:PROTO})}catch(e){}return}
  const known=pl(id);if(known&&known.tok!==tok){try{cn.send({t:'taken'})}catch(e){}return}
  if((H.banned||[]).includes(id)||(H.locked&&!pl(id))){try{cn.send({t:(H.banned||[]).includes(id)?'kicked':'locked'})}catch(e){}return}
  if(!addPlayer(id,name,d.adult===true)){try{cn.send({t:'full'})}catch(e){}return}
  if(!known)pl(id).tok=tok;
  cn.pid=id;const old=conns.get(id);conns.set(id,cn);if(old&&old!==cn)try{old.close()}catch(e){}bc()}
 else if(d.t==='act'&&cn.pid&&conns.get(cn.pid)===cn)doAct(cn.pid,d.a,d.v,d.f,false,d.ctx,d.op)};
const drop=cn=>{if(cn.pid&&conns.get(cn.pid)===cn){conns.delete(cn.pid);const p=pl(cn.pid);if(p)p.on=false;bc()}};
const saveHost=()=>ls.set('nm-host',{code,H});
const bc=()=>{if(mode!=='host')return;syncEp();saveHost();
 if(!pl(H.seat))H.seat=H.host;
 show(H.hand&&pl(H.hand)?handScreen(H.hand):frame(H.seat));
 for(const p of H.players){if(onDevice(p.id))continue;const c=conns.get(p.id);if(c&&c.open)try{c.send({t:'v',h:frame(p.id)})}catch(e){}}};
const HOSTONLY=new Set(['redo','game','menu','settle','reset','mode','scope','sips','force','insGive','insVoteGo','again','next','seat','seatOk','seatNo','addLocal','kick','lock']);
const ctxBase=()=>H.view==='settle'?'settle':!H.g?'hub':`${H.g.id}:${H.g.phase}:${H.g.round||0}:${H.g.n||0}`;
let lastBase=null;const seenOps=new Map();
// 受付単位(画面・ラウンド)が変わるたびに世代番号を進め、重複履歴を捨てる
const syncEp=()=>{const b=ctxBase();if(b!==lastBase){if(lastBase!==null)H.ep=(H.ep||0)+1;lastBase=b;seenOps.clear()}};
const ctxOf=()=>{syncEp();return `${ctxBase()}#${H.ep||0}`};
const doAct=(pid,a,v,f,hostDev,ctx,op)=>{if(typeof a!=='string'||!Object.hasOwn(A,a))return;if(HOSTONLY.has(a)&&!hostDev)return;
 syncEp();if(ctx!==ctxOf()){bc();return}
 {const key=hostDev?'@host':pid,ops=seenOps.get(key)||new Set();if(!op||ops.has(op)||ops.size>=2000){bc();return}ops.add(op);seenOps.set(key,ops)}
 try{A[a](pid,v==null?'':String(v),f&&typeof f==='object'?f:{},hostDev)}catch(e){console.error(e)}bc()};
setInterval(()=>{if(mode!=='host'||!H||!H.g||H.g.type!=='ins')return;const g=H.g;
 if(g.phase==='q'&&Date.now()>=g.end){insFail();bc()}else if(g.phase==='d'&&Date.now()>=g.end){g.phase='vote';bc()}},500);

/* --- ゲスト --- */
const PEER_OPT={config:{iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302','stun:stun.cloudflare.com:3478']},
 {urls:['turn:eu-0.turn.peerjs.com:3478','turn:us-0.turn.peerjs.com:3478'],username:'peerjs',credential:'peerjsp'},
 {urls:['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443','turns:openrelay.metered.ca:443?transport=tcp'],username:'openrelayproject',credential:'openrelayproject'}]}};
let stageT=0;
const stage=(msg,hint)=>{const e=$('#stage');if(e)e.textContent=msg;clearTimeout(stageT);if(hint)stageT=setTimeout(()=>{const h=$('#stageHint');if(h&&mode==='guest'&&!ever)h.hidden=false},hint)};
const startGuest=(c,auto)=>{cleanup();mode='guest';code=c;ever=false;net('接続中…');
 show(`<p>合言葉「${esc(c)}」の部屋を探しています…</p><p class="hint" id="stage">通信サーバーに接続中…(1/2)</p><div class="card" id="stageHint" hidden><b>つながらないとき</b><p>・ホストのスマホでアプリを開いたままにする<br>・2人とも同じWi-Fi、または2人ともモバイル通信にする<br>・LINEなどのアプリ内ではなくSafari/Chromeで開く</p><button data-l="rejoin">もう一度つなぐ</button></div><button class="g" data-l="leave">やめる</button>`);
 if(typeof Peer!=='function'){lobby('通信できません。ネット接続を確認してね');return}
 peer=new Peer(PEER_OPT);stage('通信サーバーに接続中…(1/2)',10000);
 peer.on('open',()=>{stage('ホストのスマホに接続中…(2/2)',12000);connect()});
 peer.on('error',e=>{if(e.type==='peer-unavailable'&&!ever){cleanup();if(auto){H=null;startHost(c,false,false);toast('新しい部屋を作りました。あなたがホストです')}else lobby('部屋が見つかりません。合言葉を確認してね')}else retry()});
 peer.on('disconnected',()=>{try{peer&&!peer.destroyed&&peer.reconnect()}catch(e){}});
};
const connect=()=>{if(!peer||peer.destroyed)return;conn=peer.connect(roomId(code),{reliable:true});const my=conn;
 my.on('open',()=>{ever=true;net('');if(/^https?:$/.test(location.protocol))history.replaceState(null,'','?r='+encodeURIComponent(code));my.send({t:'hello',v:PROTO,pid:me.pid,tok:me.tok,name:me.name,adult:me.adult===true})});
 my.on('data',d=>{if(!d)return;if(d.t==='v'&&typeof d.h==='string')show(d.h);
  else if(d.t==='full'){cleanup();lobby('満員(10人)です')}
  else if(d.t==='locked'){cleanup();lobby('この部屋は締め切られています')}
  else if(d.t==='kicked'){cleanup();if(/^https?:$/.test(location.protocol))history.replaceState(null,'',location.pathname);lobby('ホストに外されました')}
  else if(d.t==='old'){cleanup();lobby('ホストとアプリの版が違います。両方を最新にしてね')}
  else if(d.t==='taken'){cleanup();lobby('この参加者は別の端末で参加中です。同じ端末から入り直してね')}});
 my.on('close',()=>{if(conn===my)retry()});my.on('error',()=>{if(conn===my)retry()})};
const retry=()=>{if(mode!=='guest'||rt)return;net('ホストとの接続が切れた。再接続中…');
 rt=setTimeout(()=>{rt=null;if(!peer||peer.destroyed)return;if(peer.disconnected)try{peer.reconnect()}catch(e){}connect()},2500)};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')return;wl=null;if(mode)awake();
 if(mode==='guest'&&(!conn||!conn.open))retry();
 if(mode==='host'&&peer&&peer.disconnected)try{peer.reconnect()}catch(e){}});

/* --- 操作の送信 --- */
// 端末だけで完結する小窓(設定・確認)
let confirmAct=null;
const sheetEl=()=>$('#modal');
let opener=null;
const openSheet=(html,focusL)=>{const m=sheetEl();if(!m)return;if(m.hidden)opener=document.activeElement;
 m.innerHTML=`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">${html||`<h2 id="sheetTitle">設定</h2><button class="g" data-l="snd" data-keep="1">音 ${dev.snd?'オン':'オフ'}</button><button class="g" data-l="vib" data-keep="1">振動 ${dev.vib?'オン':'オフ'}</button><button class="g" data-l="motion" data-keep="1">演出 ${MOTION[dev.motion]}</button><button class="g" data-l="peek" data-keep="1">自分のカード ${dev.peek?'伏せる':'いつも表'}</button><button data-l="mclose">閉じる</button>`}</div>`;m.hidden=false;app.inert=true;
 const t=(focusL&&m.querySelector(`button[data-l="${focusL}"]`))||m.querySelector('button');t&&t.focus()};
const closeSheet=()=>{const m=sheetEl();const was=m&&!m.hidden;if(m){m.hidden=true;m.innerHTML=''}confirmAct=null;app.inert=false;
 if(was){const back=opener&&document.contains(opener)?opener:app.querySelector('button');back&&back.focus()}opener=null};
document.addEventListener('keydown',e=>{const m=sheetEl();
 if(m&&!m.hidden){if(e.key==='Escape'){e.preventDefault();closeSheet();return}
  if(e.key==='Tab'){const fs=[...m.querySelectorAll('button,input')];if(!fs.length)return;const i=fs.indexOf(document.activeElement);
   if(e.shiftKey&&(i<=0)){e.preventDefault();fs[fs.length-1].focus()}else if(!e.shiftKey&&i===fs.length-1){e.preventDefault();fs[0].focus()}}return}
 if(e.key==='Escape'&&app.querySelector('.fx:not(.done) .drum,.fx.intro:not(.done)'))skipFx()});
// 演出をすぐ終わらせる(ゲームの進行には関係しない)
const skipFx=()=>{app.querySelectorAll('.fx').forEach(e=>e.classList.add('done'))};
let lastK='',lastT=0,opSeq=0;
const FINAL=new Set(['undo','redo','sanOk','wOk','wClue','insOk','insVote','insGot','insGive','insVoteGo','itoCheck','cRoll','hlCh','rrPull','pickTo','again','next','game','menu','reset','kick','settle','addLocal','force']);
const fire=(c,ok)=>{
 if(c.confirm&&!ok){confirmAct=c;openSheet(`<p class="q" id="sheetTitle">${esc(c.confirm)}</p><div class="row"><button data-l="cyes">はい</button><button class="g" data-l="mclose">やめる</button></div>`);return}
 if(c.l){L[c.l]?.(c);if(c.keep&&!sheetEl().hidden)openSheet(null,c.l);return}
 if(!c.a)return;
 const fin=FINAL.has(c.a),k=c.a+':'+c.v+':'+JSON.stringify(c.f||{});if(fin&&k===lastK&&Date.now()-lastT<400)return;lastK=k;lastT=Date.now();
 const op=me.pid+'-'+(++opSeq)+'-'+rid();
 if(mode==='host')doAct(H.seat,c.a,c.v,c.f,true,c.ctx,op);
 else if(conn&&conn.open){if(fin){if(pending&&Date.now()-pending<1500)return;pending=Date.now();app.classList.add('busy')}conn.send({t:'act',a:c.a,v:c.v,f:c.f,ctx:c.ctx,op})}
 else toast('接続中…少し待ってね')};
document.addEventListener('click',e=>{
 if(gestT&&e.detail>0)return; // ドラッグ直後の指離れはタップ扱いしない
 if(e.target.closest('.intro,.drum')){skipFx();return}
 if(e.target.id==='modal'){closeSheet();return}
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.slide&&e.detail>0&&!b.dataset.gest){toast(b.dataset.slide);b.closest('.slide')?.classList.add('nudge');setTimeout(()=>b.closest('.slide')?.classList.remove('nudge'),400);return}
 unlock();sfx('tap');if(mode)awake();
 if(b.dataset.copy){navigator.clipboard?.writeText(b.dataset.copy).then(()=>toast('コピーした'),()=>toast('コピーできませんでした'));return}
 const f={};app.querySelectorAll('[data-f]').forEach(i=>f[i.dataset.f]=i.value);
 fire({a:b.dataset.a,v:b.dataset.v,l:b.dataset.l,url:b.dataset.url,keep:b.dataset.keep,confirm:b.dataset.confirm,f,ctx:b.dataset.a?(app.querySelector('[data-ctx]')||{dataset:{}}).dataset.ctx:undefined})});
document.addEventListener('input',e=>{if(e.target.id==='wr'){const m=$('#wm');if(m)m.style.left=e.target.value+'%'}});
document.addEventListener('keydown',e=>{if(e.key!=='Enter'||!e.target.matches('input[type=text]'))return;const b=e.target.closest('.card')?.querySelector('button:not(.mini)');if(b){e.preventDefault();b.click()}});


/* ================= 手で触る操作 =================
   入力方法を増やすだけ。最後は必ず既存のボタン(同じアクション)を押すので、判定・合札・重複防止は今までと同じ */
const press=sel=>{const b=sel&&app.querySelector(sel);if(!b||b.disabled)return false;b.dataset.gest='1';b.click();return true};
let gs=null,gestT=0;
const gReset=el=>{if(!el)return;el.style.transform='';el.classList.remove('dragging')};
app.addEventListener('pointerdown',e=>{
 const pk=e.target.closest('.peek');if(pk){pk.classList.add('open');gs={k:'peek',el:pk};return}
 const tr=e.target.closest('.meter .track');if(tr&&$('#wr')){gs={k:'dial',el:tr};dial(tr,e.clientX);e.preventDefault();return}
 const z=e.target.closest('[data-gz]');if(!z||e.button>0)return;
 const k=z.dataset.gz;if(k==='slide'?!e.target.closest('.thumb'):e.target.closest('button'))return;
 gs={k,el:k==='slide'?z.querySelector('.thumb'):z,z,x:e.clientX,y:e.clientY,t:Date.now(),id:e.pointerId};
 try{z.setPointerCapture(e.pointerId)}catch(_){}gs.el.classList.add('dragging');unlock()});
const dial=(tr,x)=>{const r=tr.getBoundingClientRect(),w=$('#wr');if(!w||!r.width)return;w.value=String(Math.round(Math.max(0,Math.min(100,(x-r.left)/r.width*100))));w.dispatchEvent(new Event('input',{bubbles:true}))};
app.addEventListener('pointermove',e=>{if(!gs)return;
 if(gs.k==='dial'){if(gs.el.isConnected)dial(gs.el,e.clientX);return}
 if(gs.k==='peek'||!gs.el.isConnected)return;
 const dx=e.clientX-gs.x,dy=e.clientY-gs.y;
 if(gs.k==='swipe')gs.el.style.transform=`translateY(${Math.max(-70,Math.min(70,dy))}px) rotate(${dy/14}deg)`;
 else if(gs.k==='flick')gs.el.style.transform=`translate(${dx*.6}px,${dy*.6}px) rotate(${dx/6}deg)`;
 else if(gs.k==='drag')gs.el.style.transform=`translateY(${dy}px)`;
 else if(gs.k==='slide'){const max=gs.z.clientWidth-gs.el.offsetWidth-8;gs.max=max;gs.p=Math.max(0,Math.min(1,dx/max));gs.el.style.transform=`translateX(${gs.p*max}px)`}});
const gEnd=e=>{const g=gs;gs=null;if(!g)return;
 if(g.k==='peek'){g.el.classList.remove('open');return}
 if(g.k==='dial'||!g.el.isConnected)return;
 const dx=e.clientX-g.x,dy=e.clientY-g.y,dt=Math.max(1,Date.now()-g.t),dist=Math.hypot(dx,dy),cancel=e.type==='pointercancel';
 let ok=false;if(dist>10){gestT=1;setTimeout(()=>{gestT=0},0)}
 if(!cancel&&g.k==='swipe'&&Math.abs(dy)>45&&Math.abs(dy)>Math.abs(dx))ok=press(dy<0?g.z.dataset.up:g.z.dataset.down);
 else if(!cancel&&g.k==='flick'&&(dist>110||dist>55&&dist/dt>.35)){g.el.classList.add('thrown');ok=press(g.z.dataset.go)}
 else if(!cancel&&g.k==='slide'&&g.p>=.88)ok=press('.slide .thumb');
 else if(!cancel&&g.k==='drag'){const h=g.el.offsetHeight||44,n=Math.round(dy/h);if(n){const ctx=(app.querySelector('[data-ctx]')||{dataset:{}}).dataset.ctx;for(let i=0;i<Math.abs(n);i++)fire({a:'mv',v:n>0?'1':'-1',f:{},ctx});ok=true;sfx('tap')}}
 if(ok)buzz('tap');if(g.el.isConnected)gReset(g.el)};
app.addEventListener('pointerup',gEnd);app.addEventListener('pointercancel',gEnd);
app.addEventListener('contextmenu',e=>{if(e.target.closest('.peek,[data-gz]'))e.preventDefault()});
document.addEventListener('keydown',e=>{const pk=e.target.closest&&e.target.closest('.peek');if(pk&&(e.key===' '||e.key==='Enter')){e.preventDefault();pk.classList.toggle('open')}});
document.addEventListener('focusout',e=>{if(e.target.classList&&e.target.classList.contains('peek'))e.target.classList.remove('open')});

/* ================= 画面の部品 ================= */
const nm=id=>{const p=pl(id);return esc(p?p.name:'?')};
// 自分だけのカード。設定「伏せる」のときは押している間だけ表になる
const peek=(inner,cls='')=>`<div class="card center peek ${cls}" tabindex="0" role="button" aria-label="自分のカード(押している間だけ表示)"><div class="peek-in">${inner}</div><div class="peek-cv" aria-hidden="true"><b>長押しでめくる</b><span>周りに見られないように</span></div></div>`;
const drinkFor=id=>H.mode==='drink'&&!!(pl(id)&&pl(id).adult);
const penText=id=>drinkFor(id)?`${H.sips}口飲む`:pick(SOFT);
const G=(type,pid,phase)=>{const g=H.g;return g&&g.type===type&&g.phase!=='done'&&(!phase||g.phase===phase)&&g.ps.includes(pid)?g:null};
const isHost=pid=>onDevice(pid);
const sound=(k,sid,delay=0)=>`<i hidden data-sfx="${k}" data-sid="${sid}" data-delay="${delay}"></i>`;
const fx=(cls,id,inner='',tag='div',attrs='')=>`<${tag} class="fx ${cls}" data-fx="${id}" ${attrs}>${inner}</${tag}>`;
const passBtn=(pid,id)=>onDevice(pid)&&onDevice(id)&&id!==pid?` <button class="g mini" data-a="seat" data-v="${esc(id)}">${nm(id)}に渡す</button>`:'';
const status=(pid,ids,ok,label='回答状況')=>`<div class="card"><b>${label}</b><p>${ids.map(id=>{const off=pl(id)&&!pl(id).on,d=ok(id);return `<span class="st ${d?'done':off?'off':'todo'}">${d?'✓ ':''}${nm(id)}<small>${d?'回答済み':off?'切断中':'未回答'}</small></span>${d?'':passBtn(pid,id)}`}).join('')}</p>${isHost(pid)&&!ids.every(ok)?'<button class="g" data-a="force">待たずに進める(ホスト)</button>':''}</div>`;
const labelRows=marks=>{const rows=[],out=[];marks.map((m,i)=>({m,i})).sort((a,b)=>a.m.v-b.m.v).forEach(({m,i})=>{if(!m.l){out[i]=0;return}let r=rows.findIndex(end=>m.v-end>=13);if(r<0){r=rows.length;rows.push(-99)}rows[r]=m.v;out[i]=r});return{out,n:Math.max(1,rows.length)}};
const meter=(pair,marks,t,cls='')=>{const LR=labelRows(marks),z=t==null?'':[[15,.25],[9,.45],[4,.7]].map(([w,o])=>`<div class="zone" style="left:${t-w}%;width:${w*2}%;opacity:${o}"></div>`).join('');
 return `<div class="meter ${cls}"><div class="ends"><span>← ${esc(pair[0])}</span><span>${esc(pair[1])} →</span></div><div class="track" style="height:${Math.max(56,LR.n*26+8)}px">${z}${marks.map((m,i)=>`<div class="mk ${m.c||''}" ${m.id?`id="${m.id}"`:''} style="left:${m.v}%;--i:${i}">${m.l?`<span style="top:${4+LR.out[i]*26}px;${m.v>75?'left:auto;right:7px':''}">${m.l}</span>`:''}</div>`).join('')}</div></div>`};
const rulesBox=type=>{const g=GAMES.find(x=>x.id===type);return g?`<details class="rules"><summary>遊び方</summary><ol>${g.rules.map(r=>`<li>${r}</li>`).join('')}</ol></details>`:''};
const badge=type=>`<div class="ghead"><img src="img/games/${type}.png" alt="${GAMES.find(x=>x.id===type).name}"></div>`;
// ゲーム開始の演出(各スマホで1回だけ)
const intro=(g,pid)=>fx('intro',g.id+'i',`<img src="img/games/${g.type}.png" alt=""><p>スタート！</p>`)+sound('start',g.id+'s'+pid);
const confetti=()=>`<div class="confetti">${range(28).map(i=>`<i style="left:${rnd(100)}%;--d:${(rnd(60)/100).toFixed(2)}s;--x:${rnd(80)-40}px;--r:${rnd(720)}deg;background:${pick(['#E2AD48','#C3262B','#FBEFD6','#58B36A','#2F6FC4'])}"></i>`).join('')}</div>`;

const nx=(k,t)=>`<div class="nextact ${k}"><span>${{act:'あなたの番',done:'完了',wait:'待機中'}[k]}</span><p>${t}</p></div>`;
const NX={
 san:(g,p)=>g.done[p]?['done','回答済み。みんなを待っています']:['act',p===g.host?'自分の1〜3位を3つ選んで「決定」':`${nm(g.host)}の1〜3位を予想して「決定」`],
 ito:(g,p)=>['act','数字を例えで伝えて、自分の名前をドラッグして並ぶ。全員そろったら「答え合わせ」'],
 ins:(g,p)=>g.phase==='role'?(g.ready[p]?['done','確認済み。みんなを待っています']:['act','役職を確認して「隠す」']):g.phase==='q'?(p===g.m?['act','正解が出たら「正解が出た！」']:['act',`マスター${nm(g.m)}に、はい・いいえで答えられる質問をしよう`]):g.phase==='d'?['act','話し合い。インサイダーは誰？']:(g.votes[p]?['done','投票済み。みんなを待っています']:['act','インサイダーだと思う人に投票']),
 wave:(g,p)=>p===g.psy?(g.phase==='clue'?['act','ヒントを1つ入れて送る']:['wait','みんなの予想を待っています']):g.phase==='clue'?['wait',`${nm(g.psy)}がヒントを考え中`]:(g.gs[p]!=null?['done','予想済み。みんなを待っています']:['act','スライダーで位置を決めて「決定」']),
 hl:(g,p)=>!g.st[p].alive?['wait','脱落。みんなを見守ろう']:g.ch[p]?['done','選択済み。みんなを待っています']:['act','次のカードは上か下か。カードを上下にはじく'],
 chin:(g,p)=>g.hs[p]?['done','確定。みんなを待っています']:['act','お椀をはじいてサイコロを振る'],
 rr:(g,p)=>p===rrCur()?['act','あなたの番。引き金を右へスライド']:['wait',`${nm(rrCur())}の番`]
};
const handScreen=id=>`<i hidden data-ctx="${ctxOf()}"></i><div class="hand"><p class="muted">スマホを渡してください</p><p class="big">${nm(id)}</p><p class="muted">本人以外は画面を見ないで</p><button data-a="seatOk">${nm(id)}です、見る</button><button class="g" data-a="seatNo">やめる</button></div>`;
const frame=pid=>`<i hidden data-ctx="${ctxOf()}"></i>`+frame0(pid);
const frame0=pid=>{const dv=onDevice(pid),seats=dv&&H.local.length?`<div class="seats">${[H.host,...H.local].filter(pl).map(id=>`<button class="g mini ${id===pid?'on':''}" data-a="seat" data-v="${esc(id)}">${nm(id)}</button>`).join('')}</div>`:'';
 return `<div class="top"><span class="who">${H.offline?'1台モード':`<b>${esc(code)}</b>`} ${H.players.filter(p=>p.on).length}人</span><span>${nm(pid)}</span>${dv&&(H.g&&H.g.phase!=='done'||H.view==='settle')?`<button class="g mini" data-a="menu" ${H.g&&H.g.phase!=='done'?'data-confirm="ゲームを中断してメニューに戻りますか？"':''}>中断</button>`:''}<button class="g mini" data-l="settings">設定</button><button class="g mini" data-l="leave" data-confirm="${pid===H.host&&!H.offline?'部屋から出ますか？ホストが出ると部屋が閉じます':'部屋から出ますか？'}">退出</button></div>${seats}${body(pid)}`};
const body=pid=>{const g=H.g;
 if(H.view==='settle')return '<i hidden data-scr="settle"></i>'+settle(pid);
 if(!g)return `<i hidden data-scr="hub-${pid}"></i>`+hub(pid);
 if(g.phase==='done')return `<i hidden data-scr="r-${g.id}-${pid}"></i>`+result(pid);
 if(!g.ps.includes(pid))return `${badge(g.type)}<div class="card"><p>このゲームの途中で入ったので、次のゲームから参加。</p></div>${scores(pid)}`;
 const [k,t]=NX[g.type](g,pid);
 return `<i hidden data-scr="g-${g.id}-${g.phase}-${pid}"></i>`+intro(g,pid)+badge(g.type)+nx(k,t)+P[g.type](pid)+(isHost(pid)?'<button class="g" data-a="redo" data-confirm="結果を残さず、同じゲームを最初からやり直しますか？(お題・カードは配り直し)">配り直してやり直す(ホスト)</button>':'')+rulesBox(g.type)};
const scores=pid=>`<div class="card"><table><tr><th>名前</th><th class="n">勝</th><th class="n">負</th><th class="n">罰</th>${isHost(pid)&&!H.g?'<th></th>':''}</tr>${H.players.map(p=>`<tr><td>${esc(p.name)}${p.on?'':' <span class="muted">(切断)</span>'}${H.local.includes(p.id)?` <span class="muted">(この端末・${p.age==='adult'?'20歳以上':p.age==='minor'?'20歳未満':'年齢未確認'})</span>`:''}</td><td class="n">${p.w}</td><td class="n">${p.l}</td><td class="n">${p.pen}</td>${isHost(pid)&&!H.g?`<td class="n">${p.id!==H.host?`<button class="g mini" data-a="kick" data-v="${esc(p.id)}" aria-label="${esc(p.name)}を外す" data-confirm="${esc(p.name)}を外しますか？">外す</button>`:''}</td>`:''}</tr>`).join('')}</table></div>`;
const qrSvg=url=>{try{if(typeof qrcode!=='function')return'';const q=qrcode(0,'M');q.addData(url);q.make();return q.createSvgTag({cellSize:4,margin:2,scalable:true})}catch(e){return''}};
const hub=pid=>{const on=H.players.filter(p=>p.on).length;
 if(!isHost(pid))return `${nx('wait','ホストがゲームを選んでいます')}<div class="card"><b>今の罰のルール</b><p>${SCOPES.find(s=>s[0]===H.scope)[1]}が罰(${H.mode==='drink'?H.sips+'口':'罰ゲーム'})</p></div>${scores(pid)}`;
 const url=H.offline?'':joinUrl(code);
 const invite=H.offline?'':`<div class="card invite"><div class="inv-top"><div><p class="muted">この合言葉で入ってもらう</p><p class="code">${esc(code)}</p><p class="muted">QRを読むか、招待を送ってね</p></div><div class="qr">${qrSvg(url)}</div></div><div class="row"><button class="g" data-l="share" data-url="${esc(url)}">招待を送る</button><button class="g" data-copy="${esc(url)}">URLをコピー</button></div><button class="g ${H.locked?'on':''}" data-a="lock">${H.locked?'締め切り中(タップで解除)':'部屋を締め切る'}</button></div>`;
 const local=`<div class="card"><b>このスマホで遊ぶ人を追加</b><p class="muted">スマホを持っていない人。順番が来たら画面の指示でスマホを渡します</p><input type="text" data-f="lname" data-k="local" maxlength="10" placeholder="名前" aria-label="追加する人の名前"><p class="muted">その人の年齢を聞いて、当てはまるボタンで追加。20歳未満と未確認の人にはお酒の罰は出ません</p><div class="row wrap3"><button class="g" data-a="addLocal" data-v="1" ${H.players.length>=10?'disabled':''}>20歳以上</button><button class="g" data-a="addLocal" data-v="m" ${H.players.length>=10?'disabled':''}>20歳未満</button><button class="g" data-a="addLocal" data-v="0" ${H.players.length>=10?'disabled':''}>未確認</button></div></div>`;
 const rules=`<div class="card"><b>誰が罰を受ける？</b><div class="row wrap3">${SCOPES.map(([k,l])=>`<button class="g ${H.scope===k?'on':''}" data-a="scope" data-v="${k}">${l}</button>`).join('')}</div>
 <b>罰の中身</b><div class="row"><button class="g ${H.mode==='soft'?'on':''}" data-a="mode" data-v="soft">罰ゲーム</button><button class="g ${H.mode==='drink'?'on':''}" data-a="mode" data-v="drink" ${pl(H.host).adult?'':'disabled'}>飲む(20歳以上)</button></div>
 ${H.mode==='drink'?`<b>飲む量</b><div class="row"><button class="g ${H.sips===1?'on':''}" data-a="sips" data-v="1">1口</button><button class="g ${H.sips===2?'on':''}" data-a="sips" data-v="2">2口</button></div><p class="muted">20歳未満の人には罰ゲームが出ます。一気はなし</p>`:''}</div>`;
 return `${nx('act','ゲームを選んでタップ')}${invite}<h2 class="marquee">ゲームを選ぶ</h2><div class="menu">${GAMES.map(g=>`<button class="game" data-a="game" data-v="${g.id}" ${on<g.min?'disabled':''} aria-label="${g.name}:${g.d}(${g.min}人から)"><img src="img/games/${g.id}.png" alt="" loading="lazy"><b class="gname">${g.name}</b><small>${g.c}</small><em>${g.min}人〜</em></button>`).join('')}</div>
 ${rules}${scores(pid)}${local}<button class="ng" data-a="settle">成績を見る</button>`};

/* --- 結果発表:ドラムロール → ハンコ → 中身 --- */
const waveList=g=>`<div class="card"><b>予想の一覧(正解 ${g.t})</b><table><tr><th>名前</th><th class="n">予想</th><th class="n">ズレ</th></tr>${g.ps.filter(x=>x!==g.psy&&g.gs[x]!=null).sort((a,b)=>Math.abs(g.gs[a]-g.t)-Math.abs(g.gs[b]-g.t)).map(x=>`<tr><td>${nm(x)}</td><td class="n">${g.gs[x]}</td><td class="n">${Math.abs(g.gs[x]-g.t)}</td></tr>`).join('')}</table></div>`;
const result=pid=>{const g=H.g,r=g.res,win=r.win.includes(pid),drink=r.drinkers.some(x=>x.id===pid),lose=r.lose.includes(pid);
 const kind=drink?'drink':win?'win':lose?'safe':'even';
 const stampTxt={drink:drinkFor(pid)?'飲め！':'罰ゲーム！',win:'勝ち！',safe:'負け…でもセーフ',even:'セーフ'}[kind];
 const id=g.id+'r'+pid;
 const canPick=r.pick&&!r.picked&&r.win.some(w=>w===pid||(onDevice(pid)&&onDevice(w)));
 const pickUi=r.pick&&!r.picked?(canPick?`<div class="card pickcard"><b>${r.win.length>1?'勝った人で相談して':nm(r.win[0])+'が'}、飲む人を指名！</b><div class="row wrap3">${g.ps.filter(x=>!r.win.includes(x)||g.ps.length===1).map(x=>`<button data-a="pickTo" data-v="${esc(x)}">${nm(x)}</button>`).join('')}</div></div>`:`<div class="card"><p>${r.win.map(nm).join('・')}が飲む人を指名中…</p></div>`):'';
 const drinkers=r.drinkers.length?`<div class="card drinkers"><b>${H.mode==='drink'?'飲む人':'罰ゲーム'}</b>${r.drinkers.map(x=>`<p class="pen big2">${nm(x.id)}:${esc(x.t)}</p>`).join('')}</div>`:(r.pick&&!r.picked?'':'<div class="card"><b>罰なし</b></div>');
 return `${fx('reveal '+kind,id,`<div class="drum"><span>結果発表</span></div>${kind==='win'?confetti():''}${kind==='drink'?'<div class="flash"></div>':''}<p class="stamp ${kind}">${stampTxt}</p>`)}
 ${sound('drum',id+'d')}${sound(kind==='drink'?'drink':kind==='win'?'win':'reveal',id+'s',800)}
 <div class="fx after" data-fx="${id}a">${badge(g.type)}${canPick?nx('act','飲む人を指名しよう'):''}<h2>${r.title}</h2><div class="card body">${r.body}</div>${g.type==='wave'?waveList(g):''}${pickUi}${drinkers}
 ${isHost(pid)?`<button class="nextbig" data-a="again">次へ(もう1回)</button><div class="row"><button class="g" data-a="next">別のゲーム(おまかせ)</button><button class="g" data-a="menu">メニュー</button></div>`:nx('wait','ホストが次を選んでいます')}${scores(pid)}</div>`};
const settle=pid=>{const o=[...H.players].sort((a,b)=>b.w-a.w||a.l-b.l),n=o.length,king=[...H.players].sort((a,b)=>b.l-a.l)[0];
 return `${sound('win','settle'+o.map(p=>p.w+'.'+p.l).join(','))}<h2>今日の成績</h2>${n?`<div class="card center"><p class="muted">MVP</p><p class="big">${esc(o[0].name)}</p><p>${o[0].w}勝${o[0].l}敗</p>${king&&king.l?`<p class="muted">負け王:${esc(king.name)}(${king.l}敗)</p>`:''}</div>`:''}
 <div class="card"><table><tr><th>順位</th><th>名前</th><th class="n">勝</th><th class="n">負</th><th class="n">罰</th></tr>${o.map((p,r)=>`<tr><td>${r+1}</td><td>${esc(p.name)}</td><td class="n">${p.w}</td><td class="n">${p.l}</td><td class="n">${p.pen}</td></tr>`).join('')}</table></div>
 ${isHost(pid)?'<button class="ng" data-a="reset" data-confirm="成績を全部リセットしますか？">成績をリセット</button><button class="g" data-a="menu">メニューへ</button>':''}`};

/* ================= 勝ち負けの決着 ================= */
// win:勝った人 lose:負けた人 worst:一番負けた人 → ホストの設定で罰を受ける人を決める
const finish=(title,body,o)=>{const g=H.g,win=uniq(o.win||[]),lose=uniq(o.lose||[]).filter(x=>!win.includes(x)),worst=uniq(o.worst&&o.worst.length?o.worst:lose);
 win.forEach(id=>{const p=pl(id);if(p)p.w++});lose.forEach(id=>{const p=pl(id);if(p)p.l++});
 let ids=[],pk=false;
 if(H.scope==='lose')ids=lose;else if(H.scope==='worst')ids=worst;else if(H.scope==='notwin')ids=g.ps.filter(x=>!win.includes(x));else if(H.scope==='all')ids=g.ps;
 else if(H.scope==='pick'){if(win.length)pk=true;else ids=lose}
 const drinkers=ids.map(id=>{const p=pl(id);if(p)p.pen++;return{id,t:penText(id)}});
 g.phase='done';g.res={title,body,win,lose,drinkers,pick:pk,picked:null}};
/* ================= ゲーム ================= */
const I={},P={},A={},F={};
A.mode=(p,v)=>{if(v==='soft'||(v==='drink'&&pl(H.host).adult))H.mode=v};
A.scope=(p,v)=>{if(SCOPES.some(s=>s[0]===v))H.scope=v};
A.sips=(p,v)=>{if(v==='1'||v==='2')H.sips=+v};
A.game=(p,v)=>{const gm=GAMES.find(x=>x.id===v);const ps=H.players.filter(x=>x.on).map(x=>x.id);if(!gm||ps.length<gm.min)return;H.view='hub';I[v](ps);H.g.id=rid()};
// 確定の取り消し(全員そろう前だけ。そろった瞬間に結果へ進むので、その後の取り消しは合札違いで無効)
A.undo=pid=>{const g=H.g;if(!g||g.phase==='done'||!g.ps.includes(pid))return;
 if(g.type==='san'&&g.done[pid])delete g.done[pid];
 else if(g.type==='wave'&&g.phase==='guess'&&g.gs[pid]!=null)delete g.gs[pid];
 else if(g.type==='hl'&&g.phase==='play'&&g.ch[pid])delete g.ch[pid]};
// 配り直し:結果を記録せず同じゲームを最初から。出題者の順番は進めない
A.redo=()=>{const g=H.g;if(!g||g.phase==='done')return;if(['san','wave'].includes(g.type))H.turn=Math.max(0,H.turn-1);A.game(H.host,g.type)};
A.again=()=>{if(H.g)A.game(H.host,H.g.type)};
A.next=()=>{const on=H.players.filter(p=>p.on).length,cur=H.g&&H.g.type,ok=GAMES.filter(g=>g.min<=on&&g.id!==cur);if(ok.length)A.game(H.host,pick(ok).id)};
A.menu=()=>{H.g=null;H.view='hub';H.hand=null};
A.settle=()=>{H.view='settle'};
A.reset=()=>{H.players.forEach(p=>{p.w=0;p.l=0;p.pen=0});H.view='hub'};
A.force=()=>{const g=H.g;if(g&&g.phase!=='done'&&F[g.type])F[g.type]()};
A.pickTo=(pid,v,f,hd)=>{const g=H.g,r=g&&g.phase==='done'&&g.res;if(!r||!r.pick||r.picked||!g.ps.includes(v))return;
 if(!r.win.some(w=>w===pid||(hd&&onDevice(w))))return;r.picked=v;const p=pl(v);if(p)p.pen++;r.drinkers.push({id:v,t:penText(v)})};
// 1台モードの席
A.seat=(p,v)=>{if(!pl(v)||!onDevice(v))return;if(v===H.seat){H.hand=null;return}H.hand=v};
A.seatOk=()=>{if(H.hand&&pl(H.hand))H.seat=H.hand;H.hand=null};
A.seatNo=()=>{H.hand=null};
A.addLocal=(p,v,f)=>{const n=String(f.lname||'').trim().slice(0,10);if(!n||H.players.length>=10)return;const id='L'+rid();H.players.push({id,name:n,w:0,l:0,pen:0,on:true,age:v==='1'?'adult':v==='m'?'minor':'unknown',adult:v==='1',ageSet:true});H.local.push(id)};
A.lock=()=>{H.locked=!H.locked};
A.kick=(p,v)=>{if(v===H.host||H.g)return;const i=H.players.findIndex(x=>x.id===v);if(i<0)return;H.players.splice(i,1);H.local=H.local.filter(x=>x!==v);const c=conns.get(v);if(c){try{c.send({t:'kicked'})}catch(e){}setTimeout(()=>{try{c.close()}catch(e){}},300)}conns.delete(v);if(!v.startsWith('L'))(H.banned=H.banned||[]).push(v);if(H.seat===v)H.seat=H.host};

/* --- サンレンタン(全員同時に回答) --- */
I.san=ps=>{const t=pick(SAN);H.g={type:'san',ps,host:ps[H.turn++%ps.length],q:t.q,o:t.o,sel:{},done:{},phase:'pick'}};
P.san=pid=>{const g=H.g,st=status(pid,g.ps,id=>!!g.done[id]);
 const title=pid===g.host?'あなたが出題者:自分の1〜3位':`${nm(g.host)}の1〜3位を予想`;
 if(g.done[pid])return `<h2>${title}</h2><p class="q">${esc(g.q)}</p><p>回答済み。みんなを待っています</p><button class="g" data-a="undo">やっぱり選び直す</button>${st}`;
 const s=g.sel[pid]||[];
 return `<h2>${title}</h2><p class="q">${esc(g.q)}</p>${g.o.map((o,i)=>{const r=s.indexOf(i);return `<button class="opt ${r>=0?'sel':''}" data-a="rank" data-v="${i}"><i>${r>=0?r+1:''}</i>${esc(o)}</button>`}).join('')}
 <p class="muted">タップした順に1位・2位・3位。もう一度タップで取り消し</p><button data-a="sanOk" ${s.length<3?'disabled':''}>決定</button>${st}`};
A.rank=(pid,v)=>{const g=G('san',pid);if(!g||g.done[pid])return;const i=+v;if(!(i>=0&&i<7))return;const s=g.sel[pid]=g.sel[pid]||[],k=s.indexOf(i);if(k>=0)s.splice(k,1);else if(s.length<3)s.push(i)};
A.sanOk=pid=>{const g=G('san',pid);if(!g||g.done[pid]||(g.sel[pid]||[]).length!==3)return;g.done[pid]=[...g.sel[pid]];if(g.ps.every(id=>g.done[id]))sanEnd()};
F.san=()=>{if(!H.g.done[H.g.host])return A.menu();sanEnd()};
const scoreSan=(g,a)=>{const c=g.filter(x=>a.includes(x)).length;
 if(g.every((x,i)=>x===a[i]))return[6,'サンレンタン'];if(c===3)return[4,'サンレンプク'];
 if(g[0]===a[0]&&g[1]===a[1])return[3,'ニレンタン'];if(c===2)return[2,'プクプク'];if(g[0]===a[0])return[1,'タン'];return[0,'ハズレ']};
const sanEnd=()=>{const g=H.g,ans=g.done[g.host],gs=g.ps.filter(id=>id!==g.host&&g.done[id]);
 const Ls=gs.map(id=>[id,...scoreSan(g.done[id],ans)]);
 const mx=Math.max(0,...Ls.map(x=>x[1])),mn=Math.min(...Ls.map(x=>x[1]));
 const win=Ls.filter(x=>x[1]===mx&&mx>0).map(x=>x[0]);
 let lose=mn<mx||mx===0?Ls.filter(x=>x[1]===mn).map(x=>x[0]):[];
 const flop=Ls.length&&mx<2;if(flop)lose=[...lose,g.host];
 if(Ls.some(x=>x[1]===6))win.push(g.host);
 const sh=a=>a.map((x,i)=>`<b>${i+1}位</b> ${esc(g.o[x])}`).join(' ');
 finish('答え合わせ',`<p class="q">${esc(g.q)}</p><p class="answer"><b>${nm(g.host)}の答え</b><br>${sh(ans)}</p>${Ls.map(([id,s,l])=>`<p>${nm(id)}:<b>${l}(${s}点)</b><br><span class="muted">${sh(g.done[id])}</span></p>`).join('')}${flop?`<p class="muted">全員2点未満。${nm(g.host)}も負け</p>`:''}${Ls.some(x=>x[1]===6)?`<p class="muted">サンレンタンが出たので${nm(g.host)}も勝ち</p>`:''}`,{win,lose})};

/* --- ito(自分の数字は自分のスマホにだけ表示) --- */
I.ito=ps=>{const nums={};shuffle(range(100).map(x=>x+1)).slice(0,ps.length).forEach((n,i)=>nums[ps[i]]=n);H.g={type:'ito',ps,th:pick(ITO),nums,order:shuffle(ps),phase:'play'}};
P.ito=pid=>{const g=H.g,k=g.order.indexOf(pid),others=H.local.length&&onDevice(pid)?`<p class="muted">この端末の人の数字は、上の名前ボタンでスマホを渡して確認</p>`:'';
 return `${peek(`<p class="muted">${nm(pid)}の数字(人に見せない)</p><p class="huge">${g.nums[pid]}</p>`)}<div class="card center"><p class="q">${esc(g.th.t)}</p><p class="muted">1 = ${esc(g.th.lo)} ／ 100 = ${esc(g.th.hi)}</p></div>${others}
 <p>数字は言わずに、テーマに沿った例えで表現。話しながら自分の名前を上下にドラッグ(または↑↓)して、小さい順に並ぼう。</p>
 <div class="card"><b>小さい ↓</b><ul class="ord">${g.order.map((id,i)=>`<li class="${id===pid?'me':''}" ${id===pid?'data-gz="drag"':''}><b>${i+1}</b><span>${nm(id)}</span>${id===pid?`<button class="g mini" data-a="mv" data-v="-1" ${k===0?'disabled':''} aria-label="上へ">↑</button><button class="g mini" data-a="mv" data-v="1" ${k===g.order.length-1?'disabled':''} aria-label="下へ">↓</button>`:''}</li>`).join('')}</ul><b>↑ 大きい</b></div>
 <button data-a="itoCheck">全員並んだ、答え合わせ</button>`};
A.mv=(pid,v)=>{const g=G('ito',pid);if(!g)return;const o=g.order,i=o.indexOf(pid),j=i+(+v>0?1:-1);if(i<0||j<0||j>=o.length)return;[o[i],o[j]]=[o[j],o[i]]};
A.itoCheck=pid=>{const g=G('ito',pid);if(!g)return;const sorted=[...g.order].sort((a,b)=>g.nums[a]-g.nums[b]);
 const wrong=g.order.filter((id,i)=>sorted[i]!==id),right=g.ps.filter(id=>!wrong.includes(id));
 finish(wrong.length?`${wrong.length}人ズレ`:'全員成功！',`<p class="q">${esc(g.th.t)}</p><ul class="ord reveal-list">${g.order.map(id=>`<li><span class="${wrong.includes(id)?'pen':''}">${nm(id)}</span><b>${g.nums[id]}</b></li>`).join('')}</ul>`,{win:wrong.length?right:g.ps,lose:wrong})};

/* --- インサイダー(役職は本人のスマホにだけ) --- */
I.ins=ps=>{const m=pick(ps);H.g={type:'ins',ps,m,ins:pick(ps.filter(x=>x!==m)),w:pick(WORDS),ready:{},votes:{},phase:'role'}};
const roleCard=(g,pid)=>pid===g.m?`<p class="big">マスター</p><p>お題 <b class="big">${esc(g.w)}</b></p><p>質問に「はい・いいえ・わからない」だけで答える</p>`
 :pid===g.ins?`<p class="big pen">インサイダー</p><p>お題 <b class="big">${esc(g.w)}</b></p><p>庶民のふりをして正解に誘導。最後にバレたら負け</p>`
 :`<p class="big">庶民</p><p>マスターに質問して、3分以内にお題を当てよう。答えを知るインサイダーが紛れてる</p>`;
P.ins=pid=>{const g=H.g;
 if(g.phase==='role')return `<h2>${nm(pid)}の役職</h2>${g.ready[pid]?'<div class="card center"><p>確認済み(役職は隠しています)</p></div><p>みんなを待っています</p>':`${peek(roleCard(g,pid),'flipin')}<button data-a="insOk">確認した、隠す</button>`}${status(pid,g.ps,id=>!!g.ready[id],'確認状況')}`;
 if(g.phase==='q')return `<div class="card center"><p>質問タイム ／ マスター:<b>${nm(g.m)}</b></p><p class="huge timer" data-rem="${g.end-Date.now()}"></p></div>
  ${pid===g.m?`<div class="card center"><p>お題 <b class="big">${esc(g.w)}</b></p></div><button data-a="insGot">正解が出た！</button>`:pid===g.ins?`<p class="muted">あなたはインサイダー(お題:${esc(g.w)})</p>`:''}${pid!==g.m&&onDevice(pid)&&onDevice(g.m)?`<button class="g" data-a="insGot">正解が出た！(マスター${nm(g.m)}が判定)</button>`:pid===g.m?'':'<p>マスターに質問して当てよう</p>'}
  ${isHost(pid)?'<button class="ng" data-a="insGive" data-confirm="ギブアップしますか？全員の負けになります">ギブアップ(ホスト)</button>':''}`;
 if(g.phase==='d')return `<div class="card center"><p>お題は「${esc(g.w)}」。インサイダーは誰？</p><p class="huge timer" data-rem="${g.end-Date.now()}"></p><p class="muted">話し合い:質問にかかった時間に応じて30〜90秒</p></div>${isHost(pid)?'<button data-a="insVoteGo">投票へ(ホスト)</button>':''}`;
 if(g.votes[pid])return `<h2>投票済み</h2>${status(pid,g.ps,id=>!!g.votes[id],'投票状況')}`;
 return `<h2>${nm(pid)}の投票:インサイダーは誰？</h2>${g.ps.filter(id=>id!==pid).map(id=>`<button class="g" data-a="insVote" data-v="${esc(id)}" data-confirm="${nm(id)}に投票しますか？(変更できません)">${nm(id)}</button>`).join('')}${status(pid,g.ps,id=>!!g.votes[id],'投票状況')}`};
const insStart=()=>{const g=H.g;g.phase='q';g.t0=Date.now();g.end=g.t0+180000};
A.insOk=pid=>{const g=G('ins',pid,'role');if(!g)return;g.ready[pid]=1;if(g.ps.every(id=>g.ready[id]))insStart()};
A.insGot=pid=>{const g=G('ins',pid,'q');if(!g||(pid!==g.m&&!onDevice(pid)))return;if(Date.now()>=g.end){insFail();return}const used=(Date.now()-g.t0)/1000;g.end=Date.now()+Math.min(90,Math.max(30,Math.round(used)))*1000;g.phase='d'};
A.insGive=()=>{if(H.g&&H.g.type==='ins'&&H.g.phase!=='done')insFail()};
A.insVoteGo=()=>{if(H.g&&H.g.type==='ins'&&H.g.phase==='d')H.g.phase='vote'};
A.insVote=(pid,v)=>{const g=G('ins',pid,'vote');if(!g||g.votes[pid]||v===pid||!g.ps.includes(v))return;g.votes[pid]=v;if(g.ps.every(id=>g.votes[id]))insTally()};
F.ins=()=>{const g=H.g;if(g.phase==='role')insStart();else if(g.phase==='vote')insTally()};
const insFail=()=>{const g=H.g;finish('時間切れ…全員負け',`<p>お題は「${esc(g.w)}」</p><p class="reveal-name">インサイダーは <b>${nm(g.ins)}</b></p>`,{win:[],lose:g.ps,worst:g.ps})};
const insTally=()=>{const g=H.g,cnt={};Object.values(g.votes).forEach(v=>cnt[v]=(cnt[v]||0)+1);
 const mx=Math.max(0,...Object.values(cnt)),top=Object.keys(cnt).filter(k=>cnt[k]===mx),hit=top.length===1&&top[0]===g.ins,others=g.ps.filter(id=>id!==g.ins);
 finish(hit?'インサイダー確保！':'インサイダーの勝ち',`<p>お題「${esc(g.w)}」</p><p class="reveal-name">インサイダーは <b>${nm(g.ins)}</b></p>${g.ps.map(id=>`<p>${nm(id)}:${cnt[id]||0}票</p>`).join('')}`,
  hit?{win:others,lose:[g.ins]}:{win:[g.ins],lose:others,worst:top.filter(x=>x!==g.ins).length?top.filter(x=>x!==g.ins):others})};

/* --- ウェーブレングス(正解位置はヒント役にだけ) --- */
I.wave=ps=>{H.g={type:'wave',ps,psy:ps[H.turn++%ps.length],pair:pick(WAVE),t:5+rnd(91),clue:'',gs:{},phase:'clue'}};
P.wave=pid=>{const g=H.g,gu=g.ps.filter(id=>id!==g.psy),st=status(pid,gu,id=>g.gs[id]!=null,'予想状況');
 if(pid===g.psy){if(g.phase==='clue')return `<h2>${nm(pid)}がヒント役</h2>${meter(g.pair,[{v:g.t,c:'t'}],g.t)}<p>白い線の位置を表すヒントを1つ入れて送ろう(物・人・言葉など)</p><input type="text" data-f="clue" data-k="${g.id}" maxlength="20" placeholder="ヒント" aria-label="ヒント" enterkeyhint="send"><button data-a="wClue">ヒントを送る</button>`;
  return `<h2>ヒント「${esc(g.clue)}」</h2>${meter(g.pair,[{v:g.t,c:'t'}],g.t)}${st}`}
 if(g.phase==='clue')return `<h2>ヒント待ち</h2><p>${nm(g.psy)}がヒントを考え中${passBtn(pid,g.psy)}</p>${meter(g.pair,[])}`;
 if(g.gs[pid]!=null)return `<h2>ヒント「${esc(g.clue)}」</h2><p>予想済み(${g.gs[pid]})。みんなを待っています</p><button class="g" data-a="undo">予想をやり直す</button>${st}`;
 return `<h2>ヒント「${esc(g.clue)}」</h2><p class="muted">${nm(pid)}の予想:${nm(g.psy)}のヒントから位置を当てる</p>${meter(g.pair,[{v:50,id:'wm'}])}<input type="range" id="wr" data-f="pos" data-k="${g.id}-${esc(pid)}" min="0" max="100" value="50" aria-label="予想の位置"><p class="hint">メーターを指でなぞっても動かせる</p><button data-a="wOk">決定</button>`};
A.wClue=(pid,v,f)=>{const g=G('wave',pid,'clue');if(!g||pid!==g.psy)return;const c=String(f.clue||'').trim().slice(0,20);if(!c)return;g.clue=c;g.phase='guess'};
A.wOk=(pid,v,f)=>{const g=G('wave',pid,'guess');if(!g||pid===g.psy||g.gs[pid]!=null)return;const n=Math.round(+f.pos);if(!(n>=0&&n<=100))return;g.gs[pid]=n;if(g.ps.every(id=>id===g.psy||g.gs[id]!=null))waveEnd()};
F.wave=()=>{if(H.g.phase==='clue')return A.menu();waveEnd()};
const waveEnd=()=>{const g=H.g,pt=d=>d<=4?4:d<=9?3:d<=15?2:0;
 const Ls=g.ps.filter(id=>id!==g.psy&&g.gs[id]!=null).map(id=>{const d=Math.abs(g.gs[id]-g.t);return[id,d,pt(d)]});
 if(!Ls.length)return A.menu();
 const mnd=Math.min(...Ls.map(x=>x[1])),mxd=Math.max(...Ls.map(x=>x[1])),best=Ls.filter(x=>x[1]===mnd);
 const win=best.filter(x=>x[2]>0).map(x=>x[0]);let lose=Ls.length>1?Ls.filter(x=>x[1]===mxd&&mxd>mnd).map(x=>x[0]):Ls.filter(x=>x[2]===0).map(x=>x[0]);
 const nobody=Ls.every(x=>x[2]===0);if(nobody)lose=[...Ls.map(x=>x[0]),g.psy];else if(best.some(x=>x[2]>=3))win.push(g.psy);
 finish(`ヒント「${esc(g.clue)}」の結果`,meter(g.pair,[{v:g.t,c:'t',l:'正解'},...Ls.map(([id])=>({v:g.gs[id],l:nm(id)}))],g.t,'sweep')+Ls.map(([id,d])=>`<p>${nm(id)}:ズレ ${d}</p>`).join('')+(nobody?`<p class="muted">誰も近づけなかった。${nm(g.psy)}も負け</p>`:best.some(x=>x[2]>=3)?`<p class="muted">いいヒント！${nm(g.psy)}も勝ち</p>`:''),{win,lose,worst:nobody?[g.psy,...Ls.filter(x=>x[1]===mxd).map(x=>x[0])]:lose})};

/* --- ハイ&ロー(サバイバル) --- */
I.hl=ps=>{const st={};ps.forEach(id=>st[id]={alive:true,out:0});H.g={type:'hl',ps,st,ch:{},card:1+rnd(13),prev:0,round:0,log:'',phase:'play',streak:0}};
P.hl=pid=>{const g=H.g,s=g.st[pid],alive=g.ps.filter(id=>g.st[id].alive),solo=g.ps.length===1;
 const hi=Math.round((13-g.card)/13*100),lo=Math.round((g.card-1)/13*100);
 let mine;if(!s.alive)mine=`<p class="pen">脱落(${s.out}回目)。みんなを見守ろう</p>`;
 else if(g.ch[pid])mine=`<p>選択:<b>${{h:'ハイ',l:'ロー'}[g.ch[pid]]}</b>。みんなを待っています</p><button class="g" data-a="undo">選び直す</button>`;
 else mine=`<p class="hint">カードを上にはじくとハイ、下でロー</p><div class="row"><button data-a="hlCh" data-v="h">ハイ ${hi}%</button><button data-a="hlCh" data-v="l">ロー ${lo}%</button></div>`;
 return `${g.round?sound('card',g.id+'c'+g.round):''}<div class="card center" ${s.alive&&!g.ch[pid]?'data-gz="swipe" data-up="[data-a=hlCh][data-v=h]" data-down="[data-a=hlCh][data-v=l]"':''}><p class="muted">${g.log||'最初のカード'}</p>${fx('flip huge',g.id+'c'+g.round+pid,CARD(g.card),'p')}<p>${solo?`${g.streak}連続(5連続で勝ち)`:`残り ${alive.length}人`}</p></div>${mine}<p class="muted">同じ数字はセーフ</p>${status(pid,alive,id=>!!g.ch[id],'選択状況')}`};
A.hlCh=(pid,v)=>{const g=G('hl',pid,'play'),s=g&&g.st[pid];if(!s||!s.alive||g.ch[pid]||!['h','l'].includes(v))return;g.ch[pid]=v;if(g.ps.filter(id=>g.st[id].alive).every(id=>g.ch[id]))hlResolve()};
F.hl=()=>{const g=H.g;g.ps.forEach(id=>{if(g.st[id].alive&&!g.ch[id])g.ch[id]=pick(['h','l'])});hlResolve()};
const hlResolve=()=>{const g=H.g,prev=g.card,nx=1+rnd(13),alive=g.ps.filter(id=>g.st[id].alive);g.round++;
 const miss=alive.filter(id=>nx!==prev&&!((g.ch[id]==='h'&&nx>prev)||(g.ch[id]==='l'&&nx<prev)));
 g.card=nx;g.ch={};const solo=g.ps.length===1;
 if(solo){if(miss.length){g.st[g.ps[0]].alive=false;return finish('ハイ&ロー:外れ',`<p>${CARD(prev)} → <b>${CARD(nx)}</b></p><p>${g.streak}連続で終了</p>`,{win:[],lose:g.ps})}
  g.streak++;g.log=`${CARD(prev)} → ${CARD(nx)} 当たり！`;if(g.streak>=5)return finish('ハイ&ロー:5連続！',`<p>${CARD(prev)} → <b>${CARD(nx)}</b></p>`,{win:g.ps,lose:[]});return}
 if(miss.length===alive.length){g.log=`${CARD(prev)} → ${CARD(nx)} 全員ハズレ！やり直し`;return}
 miss.forEach(id=>{g.st[id].alive=false;g.st[id].out=g.round});
 g.log=`${CARD(prev)} → ${CARD(nx)}${miss.length?' '+miss.map(nm).join('・')+'が脱落':' 全員セーフ'}`;
 const left=g.ps.filter(id=>g.st[id].alive);
 if(left.length<=1){const outs=g.ps.filter(id=>!g.st[id].alive),first=Math.min(...outs.map(id=>g.st[id].out));
  finish(`${left.map(nm).join('')}の勝ち！`,`<p class="muted">最後:${g.log}</p>${[...outs].sort((a,b)=>g.st[b].out-g.st[a].out).map(id=>`<p>${nm(id)}:${g.st[id].out}回目で脱落</p>`).join('')}`,{win:left,lose:outs,worst:outs.filter(id=>g.st[id].out===first)})}};

/* --- チンチロ(全員同時) --- */
const hand=d=>{const[a,b,c]=[...d].sort((x,y)=>x-y);
 if(a===b&&b===c)return a===1?{r:100,n:'ピンゾロ'}:{r:90+a,n:`${a}のゾロ目`};
 if(a===4&&b===5&&c===6)return{r:80,n:'シゴロ'};
 if(a===1&&b===2&&c===3)return{r:-1,n:'ヒフミ'};
 if(a===b)return{r:c,n:`${c}の目`};if(b===c)return{r:a,n:`${a}の目`};
 return{r:0,n:'目なし'}};
I.chin=ps=>{H.g={type:'chin',ps,d:{},rolls:{},tries:{},hs:{},phase:'roll'}};
P.chin=pid=>{const g=H.g,d=g.d[pid],h=g.hs[pid],t=g.tries[pid]||0;
 return `${t?sound('dice',g.id+pid+t):''}<h2>チンチロ</h2><div class="card center tray" ${h?'':'data-gz="flick" data-go="[data-a=cRoll]"'}><p class="muted">${nm(pid)}</p>${d?fx('roll dice',g.id+'d'+pid+t,d.map(DIE).join(''),'p'):'<p class="dice">－ － －</p>'}<p class="big handname">${h?h.n:''}</p></div>
 ${(g.rolls[pid]||[]).length>1?`<p class="muted center">目なし:${g.rolls[pid].slice(0,-1).map(d=>d.map(DIE).join('')).join('、')}</p>`:''}${h?'<p>確定。みんなを待っています</p>':'<p class="hint">お椀(上の枠)をはじいてサイコロを振る</p><button class="g" data-a="cRoll">ボタンで振る(目が出るまで最大3回)</button>'}
 <div class="card"><b>みんなの役</b>${g.ps.map(id=>`<p>${nm(id)}:${g.hs[id]?`<b>${g.hs[id].n}</b>`:`<span class="st ${pl(id)&&!pl(id).on?'off':'todo'}">${pl(id)&&!pl(id).on?'切断中':'まだ'}</span>${passBtn(pid,id)}`}</p>`).join('')}${isHost(pid)&&!g.ps.every(id=>g.hs[id])?'<button class="g" data-a="force">待たずに進める(ホスト)</button>':''}</div>`};
A.cRoll=pid=>{const g=G('chin',pid);if(!g||g.hs[pid])return;const rs=g.rolls[pid]=[];let h;do{const d=[0,0,0].map(()=>1+rnd(6));rs.push(d);g.d[pid]=d;h=hand(d)}while(h.r===0&&rs.length<3);g.tries[pid]=rs.length;g.hs[pid]=h;if(g.ps.every(id=>g.hs[id]))chinEnd()};
F.chin=()=>{const g=H.g;g.ps.forEach(id=>{if(!g.hs[id])g.hs[id]=g.d[id]?hand(g.d[id]):{r:0,n:'目なし'}});chinEnd()};
const chinEnd=()=>{const g=H.g,hs=g.hs,ps=g.ps,rs=ps.map(id=>hs[id].r),mx=Math.max(...rs),mn=Math.min(...rs);
 const lines=[...ps].sort((a,b)=>hs[b].r-hs[a].r).map(id=>`<p>${nm(id)}:${g.d[id]?g.d[id].map(DIE).join(''):''} <b>${hs[id].n}</b></p>`).join('');
 if(mx===mn)return finish('全員同じ役で引き分け',lines,{win:[],lose:[]});
 finish(`${ps.filter(id=>hs[id].r===mx).map(nm).join('・')}の勝ち！`,lines,{win:ps.filter(id=>hs[id].r===mx),lose:ps.filter(id=>hs[id].r===mn)})};

/* --- ロシアンルーレット(手番制) --- */
I.rr=ps=>{H.g={type:'rr',ps,b:rnd(6),pos:0,ci:H.turn%ps.length,msg:'',n:0,phase:'play'}};
const rrCur=()=>H.g.ps[H.g.ci];
const rrNext=()=>{const g=H.g;g.ci=(g.ci+1)%g.ps.length;g.n++};
const cyl=(g,pid)=>fx('cyl',g.id+'y'+g.pos+pid,range(6).map(i=>`<i class="${i<g.pos?'fired':''}" style="--a:${i*60}deg"></i>`).join('')+'<b></b>');
P.rr=pid=>{const g=H.g,left=6-g.pos,cur=rrCur();
 return `${g.n?sound('click',g.id+'p'+g.n):''}<div class="card center">${cyl(g,pid)}<p>残り ${left} 発中 1発が当たり</p><p class="huge">${Math.round(100/left)}%</p><p class="big">${nm(cur)} の番${pl(cur)&&!pl(cur).on?' <span class="st off">切断中</span>':''}</p>${g.msg?`<p>${g.msg}</p>`:''}</div>
 ${pid===cur?`<div class="slide" data-gz="slide"><span aria-hidden="true">引き金を右へスライド ›››</span><button class="ng thumb" data-a="rrPull" data-slide="右へスライドして引いてね" aria-label="引き金を引く">●</button></div>`:`<p>${nm(cur)}が引くのを待っています${passBtn(pid,cur)}</p>`}
 ${isHost(pid)&&pid!==cur&&!onDevice(cur)?'<button class="g" data-a="force">この人を飛ばす(ホスト)</button>':''}`};
A.rrPull=pid=>{const g=G('rr',pid);if(!g||pid!==rrCur())return;
 if(g.pos===g.b){H.turn=g.ci+1;return finish(`当たり！ ${nm(pid)}`,`${sound('bang',g.id+'bang')}<p>${g.pos+1}発目で当たった</p>`,{win:g.ps.filter(x=>x!==pid),lose:[pid]})}
 g.msg=`${nm(pid)}:セーフ`;g.pos++;rrNext()};
F.rr=()=>{H.g.msg=`${nm(rrCur())}を飛ばした`;rrNext()};

/* ================= 起動 ================= */
if('serviceWorker' in navigator&&/^https:$/.test(location.protocol)&&!native())navigator.serviceWorker.register('sw.js').catch(()=>{});
const saved=ls.get('nm-host');
if(saved&&saved.H&&saved.H.host===me.pid&&saved.H.scope&&(saved.H.offline||(urlCode&&normPw(saved.code)===normPw(urlCode)))){H=saved.H;startHost(saved.code,true,saved.H.offline)}
else if(urlCode&&me.name&&me.adult!=null)startGuest(urlCode,true);
else lobby();
window.__nomige={get H(){return H},get mode(){return mode},get pid(){return me.pid}};
}
