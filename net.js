/* =========================================================
   Sòng Đêm · SDNet — lớp "phòng chơi chung" dùng cho mọi chế độ online
   - Một phòng = một mã 5 ký tự. Chủ phòng là trung tâm (host), mọi tin nhắn đi qua chủ phòng.
   - Kết nối P2P qua PeerJS (WebRTC).
   - Kênh (ch): 'room' (thành viên, chat, quà, lời mời) và các kênh riêng: 'world', 'bj', 'f1t'...
   ========================================================= */
(function(){
'use strict';
const VER=2, PREFIX='songdem-room-v2-', CODE_CH='ABCDEFGHJKMNPQRSTUVWXYZ23456789', CODE_LEN=5, MAX=4;
const ICE=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'},{urls:'stun:stun.cloudflare.com:3478'}];
const ls={ get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} } };

function peerOpts(){
  const o={debug:0, config:{iceServers:(window.SD_ICE||ICE)}};
  let q=null; try{ q=new URLSearchParams(location.search).get('peer'); }catch(e){}
  q=q||ls.get('sd-coop-peer');
  if(q){ const [h,p,path]=q.split(':'); o.host=h; o.port=+p||443; o.secure=o.port===443; o.path=path||'/'; }
  return o;
}
const genCode=()=>{ let s=''; for(let i=0;i<CODE_LEN;i++) s+=CODE_CH[Math.floor(Math.random()*CODE_CH.length)]; return s; };
const normCode=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/O/g,'0').replace(/[IL]/g,'1').slice(0,CODE_LEN);
const clip=(s,n)=>String(s==null?'':s).slice(0,n);

let peer=null, host=false, me=null, code=null, hostConn=null, conns={}, seen={}, hb=null;
let members=[];          // [{id,name,host,loc:{m,p,t}}]
/* ID người chơi cố định (v1.9.24): pid là bí mật, chỉ chủ phòng giữ; oid là băm công khai dùng làm khoá sở hữu */
const pids={};
function myPid(){ let p=ls.get('sd-coop-pid'); if(!p||p.length<16){ p=''; for(let i=0;i<4;i++) p+=Math.random().toString(36).slice(2,8); p+=Date.now().toString(36); ls.set('sd-coop-pid',p); } return p; }
function hash53(str,seed){ let h1=0xdeadbeef^(seed||0), h2=0x41c6ce57^(seed||0); for(let i=0;i<str.length;i++){ const ch=str.charCodeAt(i); h1=Math.imul(h1^ch,2654435761); h2=Math.imul(h2^ch,1597334677); }
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909); h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (4294967296*(2097151&h2)+(h1>>>0)).toString(36); }
const toOid=pid=>pid?'o'+hash53('sd|'+pid,7)+hash53(pid,13):'';
let chat=[];             // [{n,m}|{sys,m}]
let unread=0, open=false;
const handlers={}, subs=[];
const emit=(ev,data)=>subs.slice().forEach(f=>{ try{ f(ev,data); }catch(e){ console.error(e); } });

/* ---------- gửi ---------- */
function rawSend(c,msg){ if(c&&c.open){ try{ c.send(msg); return true; }catch(e){} } return false; }
function deliver(ch,msg,from){ const hs=handlers[ch]; if(hs) hs.slice().forEach(f=>{ try{ f(msg,from); }catch(e){ console.error(e); } }); }
const N={
  normCode,
  inRoom:()=>!!(peer&&me&&code&&(host||(hostConn&&hostConn.open))),
  isHost:()=>host, me:()=>me, code:()=>code, members:()=>members.slice(), chat:()=>chat.slice(),
  member:id=>members.find(m=>m.id===id), hostMember:()=>members.find(m=>m.host),
  pid:()=>myPid(), oid:()=>toOid(myPid()),
  /* chủ phòng: oid của một thành viên theo peer id (rỗng nếu không rõ) */
  oidOf:id=>{ const m=members.find(x=>x.id===id); if(m&&m.host) return toOid(myPid()); return toOid(pids[id]||''); },
  name:()=>ls.get('sd-coop-name')||'', setName:n=>ls.set('sd-coop-name',clip(n,16)),
  unread:()=>unread, setOpen:o=>{ open=!!o; if(open){ unread=0; emit('chat'); } },
  on(ch,fn){ (handlers[ch]=handlers[ch]||[]).push(fn); },
  sub(fn){ subs.push(fn); },
  /* khách → chủ phòng (chủ phòng gọi thì xử lý tại chỗ) */
  send(ch,msg){ msg=Object.assign({ch},msg); if(host) deliver(ch,msg,me); else rawSend(hostConn,msg); },
  /* chủ phòng → tất cả (kể cả chính mình) */
  bcast(ch,msg,except){ if(!host) return; msg=Object.assign({ch},msg); for(const id in conns) if(id!==except) rawSend(conns[id],msg); if(except!==me) deliver(ch,msg,me); },
  /* chủ phòng → một người */
  to(id,ch,msg){ if(!host) return; msg=Object.assign({ch},msg); if(id===me) deliver(ch,msg,me); else rawSend(conns[id],msg); },
  setLoc(loc){ const L={m:clip(loc.m,16), p:clip(loc.p||'',16), t:clip(loc.t||'',40)}; const mm=members.find(m=>m.id===me);
    if(mm&&mm.loc&&mm.loc.m===L.m&&mm.loc.p===L.p&&mm.loc.t===L.t) return; N.send('room',{t:'loc',loc:L}); },
  say(m){ m=clip(String(m||'').trim(),80); if(m) N.send('room',{t:'chat',m}); },
  gift(to,amt){ N.send('room',{t:'gift',to,amt:Math.floor(amt)}); },
  invite(act,txt){ N.send('room',{t:'invite',act,txt:clip(txt,60)}); },
  create, join, leave
};
window.SDNet=N;

/* ---------- chủ phòng: xử lý kênh 'room' ---------- */
function pushChat(c){ chat.push(c); if(chat.length>50) chat.splice(0,chat.length-50); }
function hostRoomSync(){ N.bcast('room',{t:'sync', members, chat:chat.slice(-30)}); }
function sysChat(m){ pushChat({sys:1,m}); }
N.on('room',(d,from)=>{
  if(host){
    const mm=members.find(m=>m.id===from);
    switch(d.t){
      case 'hello':{
        if(d.pid) pids[from]=clip(d.pid,64);
        if(mm){ mm.name=clip(d.name||mm.name,16); hostRoomSync(); return; }
        if(members.length>=MAX){ N.to(from,'room',{t:'full'}); setTimeout(()=>{ try{ conns[from]&&conns[from].close(); }catch(e){} },400); return; }
        const nm={id:from, name:clip(d.name||'Khách',16)||'Khách', host:false, loc:d.loc||{m:'map'}};
        members.push(nm); sysChat(`${nm.name} đã vào phòng.`); hostRoomSync(); emit('join',nm); return; }
      case 'loc': if(mm){ mm.loc=d.loc; hostRoomSync(); } return;
      case 'chat':{ const m=clip(String(d.m||'').trim(),80); if(!m||!mm) return; pushChat({n:mm.name,m}); hostRoomSync(); return; }
      case 'gift':{ const to=members.find(m=>m.id===d.to), amt=Math.floor(+d.amt||0); if(!mm||!to||to===mm||amt<=0) return;
        sysChat(`${mm.name} tặng ${to.name} $${amt.toLocaleString('vi-VN')} 💸`); N.to(to.id,'room',{t:'gifted',from:mm.name,amt}); hostRoomSync(); return; }
      case 'invite':{ if(!mm) return; sysChat(`${mm.name} rủ cả phòng: ${clip(d.txt,60)}`); N.bcast('room',{t:'invited',from:mm.name,fromId:mm.id,act:clip(d.act,12),txt:clip(d.txt,60)},from); hostRoomSync(); return; }
    }
  }
  // mọi người (kể cả chủ phòng) nhận các gói sau
  switch(d.t){
    case 'sync':{ const before=chat.length; members=d.members||[]; const old=chat; chat=d.chat||[];
      if(!open&&chat.length&&(!old.length||JSON.stringify(old[old.length-1])!==JSON.stringify(chat[chat.length-1]))&&chat[chat.length-1].n) unread++;
      emit('members'); emit('chat'); return; }
    case 'gifted': emit('gifted',{from:clip(d.from,16), amt:Math.max(0,Math.floor(+d.amt||0))}); return;
    case 'invited': emit('invited',{from:clip(d.from,16), fromId:d.fromId, act:d.act, txt:d.txt}); return;
    case 'full': emit('error','Phòng đã đủ 4 người.'); leave(true); return;
    case 'ping': return;
  }
});

/* ---------- tạo / vào / rời ---------- */
function attachHost(c){
  c.on('open',()=>{ conns[c.peer]=c; seen[c.peer]=Date.now(); });
  c.on('data',d=>{ seen[c.peer]=Date.now(); if(d&&typeof d==='object'&&typeof d.ch==='string') deliver(d.ch,d,c.peer); });
  c.on('close',()=>{ if(conns[c.peer]===c) dropMember(c.peer); });
  c.on('error',()=>{});
}
function dropMember(id){
  delete conns[id]; delete seen[id];
  const mm=members.find(m=>m.id===id); if(!mm) return;
  members=members.filter(m=>m!==mm); sysChat(`${mm.name} đã rời phòng.`); hostRoomSync(); emit('leave',mm);
}
function create(name,tries){
  tries=tries||0;
  return new Promise((res,rej)=>{
    if(typeof window.Peer!=='function') return rej(new Error('Thiếu thư viện kết nối. Mở lại game khi có mạng.'));
    leave(true); code=genCode(); N.setName(name);
    const p=peer=new window.Peer(PREFIX+code, peerOpts());
    p.on('open',id=>{ if(p!==peer) return; me=id; host=true;
      members=[{id, name:clip(name||'Chủ phòng',16), host:true, loc:{m:'map'}}]; chat=[]; sysChat('Phòng đã mở. Gửi mã cho bạn bè để vào thế giới của bạn.');
      startHb(); hostRoomSync(); emit('joined'); res(code); });
    p.on('connection',attachHost);
    p.on('error',e=>{ if(p!==peer) return;
      if(e&&e.type==='unavailable-id'&&tries<4){ leave(true); create(name,tries+1).then(res,rej); return; }
      if(!me){ leave(true); rej(new Error(netErr(e))); } });
    p.on('disconnected',()=>{ if(p===peer&&!p.destroyed) try{ p.reconnect(); }catch(e){} });
  });
}
function join(raw,name){
  return new Promise((res,rej)=>{
    if(typeof window.Peer!=='function') return rej(new Error('Thiếu thư viện kết nối. Mở lại game khi có mạng.'));
    const c0=normCode(raw); if(c0.length!==CODE_LEN) return rej(new Error('Mã phòng gồm 5 ký tự.'));
    leave(true); code=c0; N.setName(name); let done=false;
    const fail=m=>{ if(done) return; done=true; clearTimeout(tm); leave(true); rej(new Error(m)); };
    const tm=setTimeout(()=>fail(`Không kết nối được tới phòng ${c0}. Kiểm tra mã, hoặc thử cho một máy dùng Wi-Fi.`),15000);
    const p=peer=new window.Peer(undefined, peerOpts());
    p.on('open',id=>{ if(p!==peer) return; me=id; host=false;
      const c=hostConn=p.connect(PREFIX+c0,{reliable:true, metadata:{v:VER}});
      c.on('open',()=>{ seen.host=Date.now(); rawSend(c,{ch:'room',t:'hello',name:clip(name||'Khách',16),pid:myPid(),v:VER}); });
      c.on('data',d=>{ seen.host=Date.now(); if(!d||typeof d!=='object'||typeof d.ch!=='string') return;
        if(!done&&d.ch==='room'&&d.t==='sync'){ done=true; clearTimeout(tm); startHb(); deliver('room',d,'host'); emit('joined'); res(c0); return; }
        deliver(d.ch,d,'host'); });
      c.on('close',()=>{ if(c!==hostConn) return; if(!done) return fail('Phòng đã đóng.'); lost('Mất kết nối với chủ phòng.'); });
      c.on('error',()=>{});
    });
    p.on('error',e=>{ if(p!==peer) return;
      if(e&&e.type==='peer-unavailable') return fail(`Không có phòng ${c0}. Mã sai hoặc chủ phòng đã đóng.`);
      if(!done) fail(netErr(e)); });
    p.on('disconnected',()=>{ if(p===peer&&!p.destroyed) try{ p.reconnect(); }catch(e){} });
  });
}
function netErr(e){ const t=e&&e.type;
  return t==='network'||t==='server-error'||t==='socket-error'||t==='socket-closed'?'Không vào được máy chủ kết nối. Kiểm tra mạng rồi thử lại.':
         t==='browser-incompatible'?'Trình duyệt này không hỗ trợ chơi online.':'Lỗi kết nối'+(t?` (${t})`:'')+'. Thử lại nhé.'; }
function lost(why){ const was=N.inRoom()||me; leave(true); if(was) emit('closed',why); }
function startHb(){
  clearInterval(hb);
  hb=setInterval(()=>{ const now=Date.now();
    if(host){ for(const id in conns){ rawSend(conns[id],{ch:'room',t:'ping'}); if(now-(seen[id]||now)>20000){ try{ conns[id].close(); }catch(e){} dropMember(id); } } }
    else { rawSend(hostConn,{ch:'room',t:'ping'}); if(now-(seen.host||now)>20000) lost('Mất kết nối với chủ phòng.'); }
  },5000);
}
function leave(silent){
  clearInterval(hb); hb=null;
  const wasIn=!!me;
  if(host) for(const id in conns){ try{ conns[id].close(); }catch(e){} }
  try{ hostConn&&hostConn.close(); }catch(e){}
  try{ peer&&peer.destroy(); }catch(e){}
  peer=null; hostConn=null; conns={}; seen={}; for(const k in pids) delete pids[k]; host=false; me=null; code=null; members=[]; chat=[]; unread=0;
  if(wasIn&&!silent) emit('closed','Bạn đã rời phòng.');
  if(wasIn) emit('left');
}
window.addEventListener('beforeunload',()=>{ try{ peer&&peer.destroy(); }catch(e){} });
})();
