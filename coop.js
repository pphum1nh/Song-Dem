/* =========================================================
   Sòng Đêm · CHƠI CÙNG — bảng điều khiển phòng + Blackjack co-op
   Dựa trên SDNet (net.js). Một mã phòng dùng cho: ghé thăm thế giới,
   Blackjack chung bàn, Đua đội F1, chat, tặng tiền, rủ nhau chơi.
   ========================================================= */
(function(){
'use strict';
const SD=window.SD, N=window.SDNet; if(!SD||!N) return;

const MAX_SEATS=4, MIN_BET=10, TEAM_BONUS=.25, TURN_SEC=30, NEXT_SEC=4;
const CHIPS=[10,25,50,100,250], GIFTS=[50,100,500,1000];
const QUICK=['Đến đây chơi!','Rút đi!','Dừng thôi','Đua F1 không?','GG','Cứu tôi với 😭'];
const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=SD.fmt;
const ls={ get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} } };

const RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS=[['♠',false],['♥',true],['♦',true],['♣',false]];
function handVal(h){ let t=0,a=0; for(const c of h){ if(!c) continue; if(c.r==='A'){t+=11;a++;} else if('JQK'.includes(c.r)) t+=10; else t+=+c.r; } while(t>21&&a){t-=10;a--;} return {t,soft:a>0}; }
const scoreText=h=>{ const cs=h.filter(Boolean); if(!cs.length) return ''; const v=handVal(cs); return (v.soft&&v.t<21)?`${v.t-10}/${v.t}`:String(v.t); };

/* ===================== giao diện ===================== */
const css=`
.cpov{position:fixed; inset:0; z-index:78; background:radial-gradient(120% 80% at 50% 0%, #17654a 0%, #0b3a29 55%, #061f16 100%); color:#f5efe4;
  display:flex; flex-direction:column; padding:calc(env(safe-area-inset-top,0px) + 10px) 12px calc(env(safe-area-inset-bottom,0px) + 10px); overflow:auto; -webkit-overflow-scrolling:touch}
.cpov[hidden]{display:none!important}
.cpov .btn{border-color:rgba(230,189,95,.5)} .cpov .btn.primary{background:#e6bd5f; color:#2a1d05; border-color:#e6bd5f}
.cpov .btn:disabled{opacity:.45}
.cp-top{display:flex; align-items:center; gap:8px; margin-bottom:8px}
.cp-top h2{flex:1; margin:0; font-family:var(--f-bungee); font-weight:400; font-size:19px; line-height:1.1}
.cp-top .btn{min-height:38px; font-size:13px; padding:0 12px}
.cp-wrap{width:100%; max-width:560px; margin:0 auto; display:flex; flex-direction:column; gap:10px; flex:1}
.cp-card{background:rgba(0,0,0,.25); border:1px solid rgba(230,189,95,.35); border-radius:16px; padding:14px}
.cp-card h3{margin:0 0 4px; font-size:15px} .cp-card p{margin:0; font-size:13px; color:#c9d6cc}
.cp-lbl{display:block; font-size:11px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:#e6bd5f; margin:0 0 6px}
.cp-in{width:100%; box-sizing:border-box; min-height:48px; border-radius:12px; border:1.5px solid rgba(230,189,95,.5); background:rgba(0,0,0,.3); color:#fff; font:inherit; font-size:16px; padding:0 12px}
.cp-in.code{font-family:var(--f-bungee); letter-spacing:.3em; text-transform:uppercase; text-align:center; font-size:22px}
.cp-row{display:grid; grid-template-columns:1fr auto; gap:8px; align-items:center}
.cp-or{display:flex; align-items:center; gap:10px; color:#9fb5a8; font-size:12px} .cp-or::before,.cp-or::after{content:''; flex:1; height:1px; background:rgba(255,255,255,.15)}
.cp-status{min-height:20px; font-size:13px; color:#ffd9a0; text-align:center; margin:0}
.cp-status.err{color:#ff9f9a}
.cp-codebox{display:flex; align-items:center; gap:8px; justify-content:center; flex-wrap:wrap}
.cp-code{font-family:var(--f-bungee); font-size:22px; letter-spacing:.22em; padding:4px 12px; border-radius:10px; background:rgba(0,0,0,.35); border:1.5px dashed #e6bd5f; color:#ffe08a}
.cp-codebox .btn{min-height:36px; font-size:12.5px; padding:0 10px}
.cp-tabs{display:grid; grid-template-columns:1fr 1fr; gap:6px; padding:4px; border-radius:14px; background:rgba(0,0,0,.28)}
.cp-tabs button{min-height:40px; border:0; border-radius:10px; background:transparent; color:#c9d6cc; font:inherit; font-weight:700; font-size:14px}
.cp-tabs button[aria-pressed="true"]{background:#e6bd5f; color:#2a1d05}
.cp-mem{display:grid; grid-template-columns:36px 1fr auto; gap:10px; align-items:center; padding:10px; border-radius:14px; background:rgba(0,0,0,.24); border:1px solid rgba(255,255,255,.1)}
.cp-mem.me{border-color:rgba(230,189,95,.6)}
.cp-av{width:36px; height:36px; border-radius:50%; display:grid; place-items:center; font-weight:800; color:#1b1d22; font-size:15px}
.cp-mem h4{margin:0; font-size:14px; display:flex; gap:6px; align-items:center; min-width:0} .cp-mem h4 b{overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.cp-mem p{margin:2px 0 0; font-size:12.5px; color:#c9d6cc}
.cp-mem .acts{display:flex; gap:6px} .cp-mem .btn{min-height:34px; font-size:12px; padding:0 10px}
.cp-acts{display:grid; grid-template-columns:1fr 1fr; gap:8px}
.cp-act{display:flex; flex-direction:column; gap:3px; text-align:left; padding:12px; border-radius:14px; border:1px solid rgba(230,189,95,.4); background:rgba(0,0,0,.22); color:#f5efe4; font:inherit}
.cp-act b{font-size:14px} .cp-act span{font-size:12px; color:#c9d6cc}
.cp-act.wide{grid-column:1/-1}
.cp-tag{flex:none; font-size:9.5px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; padding:1px 6px; border-radius:999px; background:rgba(230,189,95,.22); color:#ffe08a}
.cp-dealer{display:flex; flex-direction:column; align-items:center; gap:6px}
.cp-dealer .hand{min-height:88px}
.cp-head{display:flex; align-items:center; gap:8px; font-weight:700; font-size:13px; text-transform:uppercase; letter-spacing:.12em; color:#e6bd5f}
.cp-banner{min-height:22px; text-align:center; font-weight:700; font-size:15px; text-wrap:balance}
.cp-banner.win{color:#f4d272} .cp-banner.lose{color:#ff9f9a}
.cp-seats{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px}
.cp-seat{position:relative; border-radius:14px; padding:8px; background:rgba(0,0,0,.24); border:1.5px solid rgba(255,255,255,.12); display:flex; flex-direction:column; gap:5px; min-width:0}
.cp-seat.me{border-color:rgba(230,189,95,.7)}
.cp-seat.turn{border-color:#ffe08a; box-shadow:0 0 0 2px rgba(255,224,138,.35), 0 0 18px rgba(255,224,138,.25)}
.cp-seat.gone{opacity:.45}
.cp-seat .nm{display:flex; align-items:center; gap:5px; font-weight:700; font-size:13.5px; min-width:0}
.cp-seat .nm b{overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.cp-seat .meta{display:flex; justify-content:space-between; gap:6px; font-size:12px; color:#c9d6cc; font-variant-numeric:tabular-nums}
.cp-seat .hand{min-height:58px; justify-content:flex-start; --ov:18px}
.cp-seat .bjc{width:40px; height:57px; border-radius:6px}
.cp-seat .bjc .cr{font-size:12px; top:3px; left:4px} .cp-seat .bjc .cr i{font-size:9.5px} .cp-seat .bjc .cs{font-size:19px} .cp-seat .bjc .br{display:none}
.cp-seat .bjc.back{border-width:3px}
.cp-seat .st{font-size:12.5px; font-weight:700; min-height:16px}
.cp-seat .st.win{color:#f4d272} .cp-seat .st.lose{color:#ff9f9a} .cp-seat .st.dim{color:#9fb5a8; font-weight:600}
.cp-seat .sc{position:absolute; top:7px; right:8px; font-size:12px; padding:1px 7px; min-width:0}
.cp-empty{display:grid; place-items:center; min-height:120px; border:1.5px dashed rgba(255,255,255,.15); border-radius:14px; color:#9fb5a8; font-size:12.5px; text-align:center; padding:8px}
.cp-ctl{display:flex; flex-direction:column; gap:8px}
.cp-ctl .chips{display:flex; justify-content:center; gap:8px; flex-wrap:wrap}
.cp-ctl .row{display:grid; grid-template-columns:repeat(auto-fit,minmax(0,1fr)); gap:8px}
.cp-ctl .btn{min-height:48px}
.cp-betline{display:flex; justify-content:center; gap:10px; align-items:baseline; font-size:13px; color:#c9d6cc} .cp-betline b{font-size:18px; color:#fff}
.cp-timer{height:4px; border-radius:2px; background:rgba(255,255,255,.12); overflow:hidden} .cp-timer i{display:block; height:100%; background:#ffe08a; transition:width .25s linear}
.cp-chat{display:flex; flex-direction:column; gap:6px}
.cp-log{max-height:120px; overflow:auto; display:flex; flex-direction:column; gap:2px; font-size:12.5px; padding:6px 8px; border-radius:10px; background:rgba(0,0,0,.25)}
.cp-log:empty{display:none}
.cp-log p{margin:0} .cp-log p b{color:#ffe08a} .cp-log p.sys{color:#9fb5a8; font-style:italic}
.cp-quick{display:flex; gap:6px; overflow-x:auto; padding-bottom:2px; scrollbar-width:none} .cp-quick::-webkit-scrollbar{display:none}
.cp-quick button{flex:none; min-height:32px; border-radius:999px; border:1px solid rgba(230,189,95,.45); background:rgba(0,0,0,.25); color:#f5efe4; font:inherit; font-size:12.5px; padding:0 10px}
.cp-chatrow{display:grid; grid-template-columns:1fr auto; gap:6px} .cp-chatrow .cp-in{min-height:40px; font-size:15px} .cp-chatrow .btn{min-height:40px; font-size:13px}
.cp-giftbar{display:flex; gap:6px; flex-wrap:wrap; justify-content:center; align-items:center; font-size:12.5px}
.cp-giftbar .btn{min-height:36px; font-size:12.5px; padding:0 10px}
.cp-help{font-size:12px; color:#9fb5a8; text-align:center; margin:0}
.cp-leave{align-self:center; background:none; border:0; color:#ff9f9a; font:inherit; font-size:13px; text-decoration:underline; padding:6px}
@media (min-width:640px){ .cp-seat .bjc{width:46px; height:65px} .cp-seat .hand{min-height:66px} }
.sdchip{flex:none; position:relative; height:40px; min-width:40px; padding:0 9px; box-sizing:border-box; border-radius:12px; border:1px solid var(--line); background:rgba(0,0,0,.22); color:inherit;
  display:flex; align-items:center; justify-content:center; gap:4px; font:inherit; font-weight:800; font-size:13px; font-variant-numeric:tabular-nums}
.sdchip.on{border-color:#ffd36b; color:#ffd36b; background:rgba(255,211,107,.12)}
.sdchip[hidden]{display:none!important}
.sdchip svg{width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round}
.sdchip i{position:absolute; top:-5px; right:-5px; font-style:normal; min-width:16px; height:16px; border-radius:8px; background:#ff4d5a; color:#fff; font-size:10px; display:grid; place-items:center; padding:0 3px; box-sizing:border-box}
.sdchip i:empty{display:none}
.cp-mem .btn{white-space:nowrap}
`;
const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);

const PEOPLE='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2c2.4-.3 4.4 1.2 5 4.3"/></svg>';
const chip=document.createElement('button'); chip.className='sdchip'; chip.id='sdChip'; chip.hidden=true;
{ const pb=$('phoneBtn'); if(pb&&pb.parentNode) pb.parentNode.insertBefore(chip,pb); else { chip.style.cssText='position:fixed;top:12px;right:12px;z-index:77'; document.body.appendChild(chip); } }

const ov=document.createElement('div'); ov.className='cpov'; ov.id='coopOv'; ov.hidden=true;
ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-label','Chơi cùng bạn bè');
ov.innerHTML=`<div class="cp-wrap">
  <div class="cp-top"><h2 id="cpTitle">Chơi cùng bạn bè</h2><button class="btn" id="cpClose">Đóng</button></div>
  <div id="cpLobby">
    <div class="cp-card" style="margin-bottom:10px"><h3>Mở thế giới cho bạn bè ghé thăm</h3>
      <p>Bạn mở phòng và gửi mã 5 ký tự. Bạn bè nhập mã là vào thành phố của bạn: thấy nhà cửa, cơ ngơi của bạn, thấy nhau đang ở đâu trên bản đồ, chat, tặng tiền, rủ nhau chơi Blackjack, Poker, đua F1, mua cửa hàng trong thế giới của chủ phòng. Mỗi người vẫn dùng ví và đồ của mình. Cần mạng để chơi.</p></div>
    <div class="cp-card" style="display:flex; flex-direction:column; gap:12px">
      <label><span class="cp-lbl">Tên của bạn</span><input class="cp-in" id="cpName" maxlength="16" autocomplete="nickname" placeholder="VD: Ba Râu"></label>
      <button class="btn primary" id="cpCreate">Mở thế giới của tôi</button>
      <div class="cp-or">hoặc ghé thăm bạn bè</div>
      <label><span class="cp-lbl">Mã phòng</span>
        <div class="cp-row"><input class="cp-in code" id="cpCode" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="•••••"><button class="btn" id="cpJoin" style="min-height:48px; padding:0 16px">Ghé thăm</button></div></label>
      <p class="cp-status" id="cpStatus" aria-live="polite"></p>
    </div>
  </div>
  <div id="cpRoom" hidden style="display:flex; flex-direction:column; gap:10px">
    <div class="cp-codebox"><span class="cp-lbl" style="margin:0">Mã phòng</span><span class="cp-code" id="cpCodeShow"></span><button class="btn" id="cpCopy">Sao chép</button><button class="btn" id="cpShare">Mời</button></div>
    <div class="cp-tabs" role="tablist"><button data-tab="room" aria-pressed="true">Phòng</button><button data-tab="bj" aria-pressed="false">Blackjack</button></div>
    <div id="cpRoomTab" style="display:flex; flex-direction:column; gap:10px"></div>
    <div id="cpBjTab" hidden style="display:flex; flex-direction:column; gap:10px">
      <div class="cp-dealer"><div class="cp-head">Nhà cái <span class="score" id="cpDScore"></span></div><div class="hand" id="cpDHand"></div></div>
      <div class="cp-banner" id="cpBanner" aria-live="polite"></div>
      <div class="cp-seats" id="cpSeats"></div>
      <div class="cp-ctl" id="cpCtl"></div>
    </div>
    <div class="cp-chat">
      <div class="cp-log" id="cpLog" aria-live="polite"></div>
      <div class="cp-quick" id="cpQuick">${QUICK.map(q=>`<button data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <div class="cp-chatrow"><input class="cp-in" id="cpMsg" maxlength="80" placeholder="Nhắn cho cả phòng" enterkeyhint="send"><button class="btn" id="cpSend">Gửi</button></div>
    </div>
  </div>
</div>`;
document.body.appendChild(ov);

let tab='room', giftTo=null;
const COLORS=['#ffd36b','#6fdc9c','#7ab8ff','#ff9ad0'];
const colorOf=id=>{ const i=N.members().findIndex(m=>m.id===id); return COLORS[(i<0?0:i)%COLORS.length]; };
window.SDColorOf=colorOf;

/* ===================== bảng Phòng ===================== */
function renderRoomTab(){
  const el=$('cpRoomTab'); if(!N.inRoom()) return;
  const meId=N.me(), H=N.hostMember(), bank=SD.bank();
  let h='';
  if(giftTo){ const t=N.member(giftTo);
    if(t){ h+=`<div class="cp-card"><p style="text-align:center; margin-bottom:8px">Tặng tiền cho <b>${esc(t.name)}</b> (ví bạn: ${fmt(bank)})</p><div class="cp-giftbar">${GIFTS.map(g=>`<button class="btn" data-givea="${g}" ${bank<g?'disabled':''}>${fmt(g)}</button>`).join('')}<button class="btn" data-givex="1">Huỷ</button></div></div>`; }
    else giftTo=null; }
  h+=N.members().map(m=>{ const mine=m.id===meId, loc=m.loc||{};
    const go=!mine&&loc.p&&SD.canGo(loc.p);
    return `<div class="cp-mem${mine?' me':''}"><span class="cp-av" style="background:${colorOf(m.id)}">${esc((m.name||'?').trim().charAt(0).toUpperCase()||'?')}</span>
      <div style="min-width:0"><h4><b>${esc(m.name)}</b>${m.host?'<span class="cp-tag">Chủ thế giới</span>':''}${mine?'<span class="cp-tag">Bạn</span>':''}</h4><p>${esc(loc.t||'Đang dạo phố')}</p></div>
      <div class="acts">${go?`<button class="btn" data-goto="${esc(m.id)}">Đến chỗ</button>`:''}${mine?'':`<button class="btn" data-gift="${esc(m.id)}">Tặng</button>`}</div></div>`; }).join('');
  if(N.members().length<2) h+=`<p class="cp-help">Đang chờ bạn bè vào. Gửi mã <b>${esc(N.code())}</b> cho họ: Sòng Đêm → Chơi cùng bạn bè, hoặc Gara → Chạy xe → Giao hữu.</p>`;
  h+=`<div class="cp-acts">
    <button class="cp-act wide" data-act="city"><b>Dạo thành phố${H&&H.id!==meId?` của ${esc(H.name)}`:' của bạn'}</b><span>${H&&H.id!==meId?'Bạn đang ghé thăm: bản đồ hiện nhà cửa, cơ ngơi của chủ phòng và vị trí mọi người.':'Bạn bè trong phòng sẽ thấy thành phố của bạn và chỗ bạn đang đứng.'}</span></button>
    <button class="cp-act" data-act="bj"><b>Blackjack chung bàn</b><span>Cùng đấu nhà cái, thắng cả bàn có thưởng.</span></button>
    <button class="cp-act" data-act="f1"><b>Đua F1 giao hữu</b><span>Chọn cùng đội hoặc khác đội, mỗi đội 2 xe.</span></button>
  </div>
  <button class="cp-leave" data-act="leave">Rời phòng</button>`;
  el.innerHTML=h;
}
function renderChat(){
  const log=$('cpLog'), atBottom=log.scrollTop+log.clientHeight>=log.scrollHeight-8;
  log.innerHTML=N.chat().slice(-30).map(c=>c.sys?`<p class="sys">${esc(c.m)}</p>`:`<p><b>${esc(c.n)}:</b> ${esc(c.m)}</p>`).join('');
  if(atBottom) log.scrollTop=log.scrollHeight;
}
function renderChip(){
  const inR=N.inRoom(), m=SD.mode();
  const hide=m==='prison'||SD.hell()||(!inR&&!['map','hub'].includes(m));
  chip.hidden=hide; if(hide) return;
  chip.classList.toggle('on',inR);
  const html=inR?`${PEOPLE}<span>${N.members().length}</span><i>${N.unread()||''}</i>`:PEOPLE;
  if(chip._h!==html){ chip._h=html; chip.innerHTML=html; }
  if(inR){ const H=N.hostMember(), visit=H&&H.id!==N.me(); chip.title=chip.ariaLabel=(visit?`Đang ở thế giới của ${H.name}`:`Phòng ${N.code()}`)+` · ${N.members().length} người`; }
  else chip.title=chip.ariaLabel='Chơi cùng bạn bè';
}
chip.addEventListener('click',()=>{ if(SD.busy()){ if(SD.mode()==='race') SD.toast('Đang đua, về đích đã!'); return; } open(); });

/* ===================== mở / đóng ===================== */
function setStatus(m,err){ const el=$('cpStatus'); el.textContent=m||''; el.classList.toggle('err',!!err); }
function busy(b){ $('cpCreate').disabled=b; $('cpJoin').disabled=b; }
function showView(){
  const inR=N.inRoom();
  $('cpLobby').hidden=inR; $('cpRoom').hidden=!inR;
  if(inR){ const H=N.hostMember(); $('cpTitle').textContent=N.isHost()?'Thế giới của bạn':`Thế giới của ${H?H.name:'chủ phòng'}`; $('cpCodeShow').textContent=N.code();
    ov.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));
    $('cpRoomTab').hidden=tab!=='room'; $('cpBjTab').hidden=tab!=='bj';
    renderRoomTab(); renderChat(); if(tab==='bj'){ if(!bjSeated()) send({t:'sit', bank:Math.floor(SD.bank())}); render(); } }
  else { $('cpTitle').textContent='Chơi cùng bạn bè'; busy(false); }
}
function open(opts){
  opts=opts||{};
  if(SD.hell()){ SD.toast('Dưới âm phủ không bắt được sóng. Sống lại rồi chơi online.'); return; }
  $('cpName').value=N.name();
  if(opts.code) $('cpCode').value=N.normCode(opts.code);
  if(opts.tab) tab=opts.tab;
  if(!N.inRoom()) setStatus(opts.code?'Nhập tên rồi bấm Ghé thăm.':'');
  ov.hidden=false; N.setOpen(true); showView(); renderChip();
}
function close(){ ov.hidden=true; N.setOpen(false); if(tab==='bj'&&N.inRoom()&&HS_safePhase()) send({t:'unsit'}); giftTo=null; SD.refresh(); renderChip(); }
const HS_safePhase=()=>{ const me=S&&S.seats.find(s=>s.id===N.me()); return !(S&&S.phase!=='bet'&&me&&me.wager>0); };
async function doCreate(){ const name=myName(); busy(true); setStatus('Đang mở phòng…');
  try{ await N.create(name); tab='room'; showView(); }catch(e){ setStatus(e.message,true); busy(false); } }
async function doJoin(){ const name=myName(), c=$('cpCode').value; busy(true); setStatus('Đang tìm phòng '+N.normCode(c)+'…');
  try{ await N.join(c,name); tab='room'; showView(); }catch(e){ setStatus(e.message,true); busy(false); } }
function myName(){ const n=($('cpName').value||'').trim().slice(0,16)||N.name()||'Khách'; N.setName(n); return n; }
window.SDCoop={open, close, state:()=>S, id:()=>N.me(), tab:t=>{ tab=t; showView(); }};

/* ===================== sự kiện phòng ===================== */
N.sub((ev,data)=>{
  if(ev==='members'||ev==='chat'){ if(!ov.hidden&&N.inRoom()){ if(tab==='room'&&ev==='members') renderRoomTab(); if(ev==='chat') renderChat(); if(ev==='members'&&tab==='bj') render(); } renderChip(); SD.presence&&SD.presence(); }
  if(ev==='joined'){ renderChip(); reportLoc(true); }
  if(ev==='gifted'){ SD.add(data.amt); SD.toast(`${data.from} tặng bạn ${fmt(data.amt)}!`); bjBank(); }
  if(ev==='invited'){ const act=data.act;
    if(SD.busy()){ SD.toast(`${data.from} rủ: ${data.txt}`); return; }
    SD.modal({kick:'Lời mời', good:true, title:`${data.from} rủ bạn`, body:data.txt, yes:act==='f1'?'Vào đua F1':act==='bj'?'Ngồi vào bàn':'Đến chỗ bạn ấy', no:'Để sau',
      yesFn:()=>{ if(act==='f1'){ close(); SD.goF1Team(); } else if(act==='bj'){ open({tab:'bj'}); } else { const m=N.member(data.fromId); if(m&&m.loc&&m.loc.p&&SD.canGo(m.loc.p)){ close(); SD.goPlace(m.loc.p); } } } }); }
  if(ev==='error'){ setStatus(data,true); }
  if(ev==='closed'){ bjLost(); SD.toast(data||'Đã rời phòng.'); giftTo=null; if(!ov.hidden) showView(); renderChip(); SD.presence&&SD.presence(); }
  if(ev==='left'){ S=null; HS=null; renderChip(); SD.presence&&SD.presence(); }
  if(ev==='leave'&&N.isHost()) bjMemberLeft(data.id);
});
/* báo vị trí của mình cho cả phòng */
let lastLoc='';
function reportLoc(force){ if(!N.inRoom()) return; const L=SD.loc(); const k=JSON.stringify(L); if(!force&&k===lastLoc) return; lastLoc=k; N.setLoc(L); }
setInterval(()=>{ reportLoc(false); renderChip(); },1000);

/* ===================== BLACKJACK (kênh 'bj') ===================== */
let S=null, HS=null, shoe=[], hostBusy=false, turnTimer=null, nextTimer=null;
let paid={round:-1, amt:0}, credited=-1, turnDeadline=0, tickTimer=null, seen={};
const send=msg=>N.send('bj',msg);
const bjSeated=()=>!!(S&&S.seats.some(s=>s.id===N.me()));
function buildShoe(){ shoe=[]; for(let d=0;d<4;d++) for(const [s,red] of SUITS) for(const r of RANKS) shoe.push({r,s,red});
  for(let i=shoe.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [shoe[i],shoe[j]]=[shoe[j],shoe[i]]; } }
const draw=()=>{ if(shoe.length<40) buildShoe(); return shoe.pop(); };
const seatOf=id=>HS&&HS.seats.find(s=>s.id===id);
const active=()=>HS.seats.filter(s=>s.wager>0);
function hsInit(){ if(HS) return; HS={round:0, phase:'bet', seats:[], turn:null, dealer:[], hidden:true, msg:'Đặt cược rồi bấm Sẵn sàng. Chủ phòng có thể chia bài sớm.', tone:'', streak:0}; buildShoe(); }
function newSeat(id,bank){ const m=N.member(id); return {id,name:m?m.name:'Khách',bank:Math.max(0,Math.floor(+bank||0)),bet:0,ready:false,hand:[],wager:0,done:false,res:null,pay:0,gone:false,host:!!(m&&m.host)}; }
function publicState(){ const p=JSON.parse(JSON.stringify(HS)); if(p.hidden&&p.dealer.length>1) p.dealer[1]=null; p.turnLeft=HS.turn&&HS.turnAt?Math.max(0,Math.round((HS.turnAt-Date.now())/1000)):0; return p; }
function broadcast(){ if(!N.isHost()||!HS) return; N.bcast('bj',{t:'state', s:publicState()}); }
N.on('bj',(d,from)=>{
  if(!d) return;
  if(d.t==='state'){ onState(d.s); return; }
  if(!N.isHost()) return;
  hsInit();
  const seat=seatOf(from);
  switch(d.t){
    case 'sit':{ if(seat){ seat.gone=false; broadcast(); return; }
      if(HS.seats.filter(s=>!s.gone).length>=MAX_SEATS){ broadcast(); return; }
      HS.seats=HS.seats.filter(s=>!(s.gone&&!s.wager)); const ns=newSeat(from,d.bank); if(from===N.me()) ns.bet=Math.min(lastBet(),SD.bank()>=MIN_BET?Math.floor(SD.bank()):0);
      HS.seats.push(ns); broadcast(); return; }
    case 'unsit': if(seat) bjMemberLeft(from,true); return;
    case 'bank': if(seat){ seat.bank=Math.max(0,Math.floor(+d.bank||0)); broadcast(); } return;
    case 'bet':{ if(!seat||HS.phase!=='bet') return; let a=Math.max(0,Math.floor(+d.amt||0)); if(a&&a<MIN_BET) a=MIN_BET; if(typeof d.bank==='number') seat.bank=Math.floor(d.bank);
      seat.bet=Math.min(a,seat.bank); seat.ready=false; broadcast(); return; }
    case 'ready': if(!seat||HS.phase!=='bet') return; seat.ready=!!d.on; broadcast(); maybeStart(); return;
    case 'start': if(from!==N.me()||HS.phase!=='bet') return; startRound(true); return;
    case 'act': if(HS.phase!=='play'||HS.turn!==from||hostBusy||!seat) return; playerAct(seat,d.a); return;
  }
});
function maybeStart(){ if(HS.phase!=='bet'||hostBusy) return; const live=HS.seats.filter(s=>!s.gone);
  if(live.length&&live.every(s=>s.ready)&&live.some(s=>s.bet>=MIN_BET)) startRound(false); }
async function startRound(force){
  if(HS.phase!=='bet'||hostBusy) return;
  const players=HS.seats.filter(s=>!s.gone&&s.bet>=MIN_BET&&s.bet<=s.bank&&(s.ready||(force&&s.id===N.me())));
  if(!players.length){ HS.msg='Chưa ai đặt cược. Cần ít nhất một người cược từ $10.'; HS.tone='lose'; broadcast(); return; }
  clearTimeout(nextTimer); hostBusy=true;
  HS.round++; HS.phase='play'; HS.dealer=[]; HS.hidden=true; HS.turn=null; HS.turnAt=0; HS.msg='Chia bài…'; HS.tone='';
  for(const s of HS.seats){ s.hand=[]; s.res=null; s.pay=0; s.done=false; s.wager=players.includes(s)?s.bet:0; s.ready=false; }
  broadcast(); await sleep(350);
  for(let k=0;k<2;k++){ for(const s of players){ s.hand.push(draw()); broadcast(); await sleep(260); } HS.dealer.push(draw()); broadcast(); await sleep(260); }
  for(const s of players) if(handVal(s.hand).t===21){ s.done=true; s.res={txt:'Blackjack!',tone:'win'}; }
  hostBusy=false;
  if(handVal(HS.dealer).t===21){ HS.hidden=false; HS.msg='Nhà cái có Blackjack!'; HS.tone='lose'; broadcast(); await sleep(700); return settle(); }
  nextTurn();
}
function armTurn(seat){ clearTimeout(turnTimer); turnTimer=setTimeout(()=>{ if(HS&&HS.turn===seat.id&&HS.phase==='play'){ playerAct(seat,'stand'); } }, TURN_SEC*1000+600); }
function nextTurn(){ clearTimeout(turnTimer); const nx=active().find(s=>!s.done);
  if(!nx){ HS.turn=null; return dealerPlay(); }
  HS.turn=nx.id; HS.turnAt=Date.now()+TURN_SEC*1000; HS.msg=`Lượt của ${nx.name}`; HS.tone=''; armTurn(nx); broadcast(); }
async function playerAct(seat,a){
  if(hostBusy) return; hostBusy=true;
  try{
    if(a==='hit'){ seat.hand.push(draw()); const v=handVal(seat.hand).t;
      if(v>21){ seat.done=true; seat.res={txt:`Quắc ${v}`,tone:'lose'}; } else if(v===21) seat.done=true; else HS.turnAt=Date.now()+TURN_SEC*1000;
      broadcast(); await sleep(300); }
    else if(a==='double'){ if(seat.hand.length!==2||seat.bank<seat.wager) return; seat.wager*=2; seat.hand.push(draw()); seat.done=true;
      const v=handVal(seat.hand).t; if(v>21) seat.res={txt:`Quắc ${v}`,tone:'lose'}; broadcast(); await sleep(380); }
    else seat.done=true;
  } finally { hostBusy=false; }
  if(seat.done) nextTurn(); else { armTurn(seat); broadcast(); }
}
async function dealerPlay(){
  hostBusy=true; HS.phase='dealer'; HS.turn=null; HS.hidden=false; HS.msg='Nhà cái lật bài'; broadcast(); await sleep(650);
  if(active().some(s=>handVal(s.hand).t<=21)) while(handVal(HS.dealer).t<17){ HS.dealer.push(draw()); broadcast(); await sleep(600); }
  hostBusy=false; settle();
}
function settle(){
  clearTimeout(turnTimer);
  const d=handVal(HS.dealer).t, dBJ=d===21&&HS.dealer.length===2, list=active();
  for(const s of list){ const p=handVal(s.hand).t, pBJ=p===21&&s.hand.length===2, w=s.wager; let pay=0, txt, tone;
    if(p>21){ txt=`Quắc ${p} · −${fmt(w)}`; tone='lose'; }
    else if(pBJ&&!dBJ){ pay=w*2.5; txt=`Blackjack! +${fmt(w*1.5)}`; tone='win'; }
    else if(dBJ&&!pBJ){ txt=`Thua BJ · −${fmt(w)}`; tone='lose'; }
    else if(d>21){ pay=w*2; txt=`Nhà quắc · +${fmt(w)}`; tone='win'; }
    else if(p>d){ pay=w*2; txt=`${p}>${d} · +${fmt(w)}`; tone='win'; }
    else if(p<d){ txt=`${p}<${d} · −${fmt(w)}`; tone='lose'; }
    else { pay=w; txt=`Hoà ${p}`; tone=''; }
    s.pay=Math.floor(pay); s.res={txt,tone}; s.done=true; }
  const team=list.length>=2&&list.every(s=>s.pay>s.wager);
  if(team){ HS.streak=(HS.streak||0)+1; for(const s of list){ const b=Math.floor(s.wager*TEAM_BONUS); s.pay+=b; s.res.txt+=` · đội +${fmt(b)}`; } } else if(list.length>=2) HS.streak=0;
  const wins=list.filter(s=>s.pay>s.wager).length;
  HS.msg=team?`Cả bàn cùng thắng! Thưởng đồng đội +25%${HS.streak>1?` · chuỗi ${HS.streak}`:''}`:list.length===1?(wins?'Thắng nhà cái!':'Nhà cái ăn ván này'):`${wins}/${list.length} người thắng nhà cái`;
  HS.tone=wins*2>=list.length?'win':'lose'; HS.phase='done'; HS.turn=null; broadcast();
  clearTimeout(nextTimer);
  nextTimer=setTimeout(()=>{ if(!HS||HS.phase!=='done') return; HS.phase='bet'; HS.msg='Ván mới: đặt cược rồi bấm Sẵn sàng.'; HS.tone='';
    for(const s of HS.seats){ s.ready=false; s.wager=0; if(s.bet>s.bank) s.bet=s.bank>=MIN_BET?Math.floor(s.bank):0; }
    HS.seats=HS.seats.filter(s=>!s.gone); broadcast(); }, NEXT_SEC*1000);
}
function bjMemberLeft(id){
  if(!HS) return; const s=seatOf(id); if(!s) return;
  if(HS.phase==='bet'||!s.wager){ HS.seats=HS.seats.filter(x=>x!==s); broadcast(); maybeStart(); return; }
  s.gone=true; if(HS.phase==='play'&&HS.turn===id){ playerAct(s,'stand'); return; } broadcast();
}

/* ---------- phía người chơi ---------- */
function lastBet(){ return Math.max(MIN_BET, +(ls.get('sd-coop-bet')||50)||50); }
function bjBank(){ if(bjSeated()) send({t:'bank', bank:Math.floor(SD.bank())}); }
function onState(s){
  const prevRound=S&&S.round; S=s; const myId=N.me();
  turnDeadline=s.turn===myId&&s.phase==='play'?Date.now()+(s.turnLeft||0)*1000:0;
  const me=s.seats.find(x=>x.id===myId);
  if(me){
    if(me.wager>0&&s.phase!=='bet'){ if(paid.round!==s.round) paid={round:s.round, amt:0};
      const diff=me.wager-paid.amt; if(diff>0){ SD.add(-diff); paid.amt+=diff; ls.set('sd-coop-bet',String(me.bet)); bjBank(); } }
    if(s.phase==='done'&&me.wager>0&&credited!==s.round&&paid.round===s.round){ credited=s.round; if(me.pay>0) SD.add(me.pay); SD.round(); bjBank();
      const net=me.pay-me.wager; SD.toast(net>0?`Blackjack online: thắng ${fmt(net)}`:net<0?`Blackjack online: thua ${fmt(-net)}`:'Blackjack online: hoà'); }
  }
  if(prevRound!==s.round) seen={};
  if(!ov.hidden&&tab==='bj') render();
}
function bjLost(){ if(paid.round>=0&&credited!==paid.round&&paid.amt>0){ SD.add(paid.amt); SD.toast(`Mất kết nối giữa ván. Hoàn lại ${fmt(paid.amt)} tiền cược.`); } paid={round:-1,amt:0}; }
function cardsHTML(hand,key){ const n=seen[key]||0; let h=''; hand.forEach((c,i)=>{ h+=SD.card(c||{r:'',s:'',red:false},c==null,i>=n).outerHTML; }); seen[key]=hand.length; return h; }
function render(){
  if(ov.hidden||tab!=='bj') return;
  if(!S){ $('cpSeats').innerHTML='<p class="cp-help" style="grid-column:1/-1">Đang vào bàn…</p>'; $('cpCtl').innerHTML=''; return; }
  const myId=N.me(), me=S.seats.find(s=>s.id===myId);
  $('cpDHand').innerHTML=cardsHTML(S.dealer,'d');
  const dv=S.dealer.filter(Boolean); $('cpDScore').textContent=S.dealer.length?scoreText(dv):''; $('cpDScore').classList.toggle('bust',!S.hidden&&handVal(dv).t>21);
  const b=$('cpBanner'); b.textContent=S.msg||''; b.className='cp-banner'+(S.tone?' '+S.tone:'');
  let h='';
  for(const s of S.seats){ const mine=s.id===myId, inR=s.wager>0; let stt='', tone='dim';
    if(s.gone) stt='Đã rời';
    else if(S.phase==='bet'){ stt=s.ready?(s.bet>=MIN_BET?'Sẵn sàng ✓':'Ngồi xem ✓'):(s.bet>=MIN_BET?'Đang đặt cược…':'Chưa cược'); tone=s.ready?'win':'dim'; if(s.res) stt=s.res.txt+' · '+stt; }
    else if(!inR) stt='Chờ ván sau';
    else if(s.res){ stt=s.res.txt; tone=s.res.tone; }
    else if(S.turn===s.id){ stt=mine?'Lượt của bạn!':'Đang suy nghĩ…'; tone='win'; }
    else stt=s.done?'Đã dừng':'Chờ lượt';
    const sc=s.hand.length?scoreText(s.hand):'';
    h+=`<div class="cp-seat${mine?' me':''}${S.turn===s.id?' turn':''}${s.gone?' gone':''}">
      <div class="nm"><b>${esc(s.name)}</b>${s.host?'<span class="cp-tag">Chủ</span>':''}${mine?'<span class="cp-tag">Bạn</span>':''}</div>
      ${sc?`<span class="score sc${handVal(s.hand).t>21?' bust':''}">${sc}</span>`:''}
      <div class="meta"><span>Ví ${fmt(mine?SD.bank():s.bank)}</span><span>${inR&&S.phase!=='bet'?'Cược '+fmt(s.wager):s.bet?'Đặt '+fmt(s.bet):''}</span></div>
      <div class="hand">${cardsHTML(s.hand,'s'+s.id)}</div>
      <div class="st ${tone}">${esc(stt)}</div></div>`; }
  for(let i=S.seats.length;i<MAX_SEATS;i++) h+=`<div class="cp-empty">Ghế trống<br>Rủ bạn trong phòng ngồi vào</div>`;
  $('cpSeats').innerHTML=h; renderCtl(me);
}
function renderCtl(me){
  const el=$('cpCtl'); if(!me){ el.innerHTML=`<button class="btn primary" data-a="sit">Ngồi vào bàn</button>`; return; }
  const bank=SD.bank(), isHost=N.isHost(); let h='';
  if(S.phase==='bet'){ const canBet=bank>=MIN_BET;
    h+=`<div class="cp-betline"><span>Tiền cược</span><b>${fmt(me.bet)}</b><span>· Ví ${fmt(bank)}</span></div>`;
    h+=`<div class="chips">${CHIPS.map(v=>`<button class="chip" data-v="${v}" data-chip="${v}" ${me.ready||!canBet||me.bet+v>bank?'disabled':''}>${v}</button>`).join('')}</div>`;
    h+=`<div class="row"><button class="btn" data-a="clear" ${me.ready||!me.bet?'disabled':''}>Xoá cược</button><button class="btn${me.ready?'':' primary'}" data-a="ready">${me.ready?'Huỷ sẵn sàng':me.bet>=MIN_BET?'Sẵn sàng':'Ngồi xem'}</button>`+
       (isHost?`<button class="btn" data-a="start" ${S.seats.some(s=>!s.gone&&s.bet>=MIN_BET&&(s.ready||s.id===N.me()))?'':'disabled'}>Chia bài</button>`:'')+`</div>`;
    h+=`<p class="cp-help">${canBet?'Bàn tự chia khi mọi người đã Sẵn sàng.'+(isHost?' Bạn là chủ phòng: bấm Chia bài để bắt đầu luôn.':''):'Ví dưới $10: bạn chỉ ngồi xem được. Nhờ đồng đội tặng tiền nhé.'}</p>`;
  } else if(S.phase==='play'&&S.turn===N.me()){ const canD=me.hand.length===2&&bank>=me.wager;
    h+=`<div class="cp-timer"><i id="cpTick" style="width:100%"></i></div><div class="row"><button class="btn" data-a="hit">Rút</button><button class="btn" data-a="double" ${canD?'':'disabled'}>Gấp đôi</button><button class="btn primary" data-a="stand">Dừng</button></div>`;
  } else if(S.phase==='play'&&S.turn){ const t=S.seats.find(s=>s.id===S.turn); h+=`<div class="cp-timer"><i id="cpTick" style="width:100%"></i></div><p class="cp-help">Đang chờ ${esc(t?t.name:'')} quyết định…</p>`; }
  else if(S.phase==='done') h+=`<p class="cp-help">Ván mới bắt đầu sau vài giây…</p>`;
  else h+=`<p class="cp-help">Nhà cái đang rút bài…</p>`;
  el.innerHTML=h;
}
tickTimer=setInterval(()=>{ const i=$('cpTick'); if(!i||!S) return; let left;
  if(S.turn===N.me()) left=Math.max(0,turnDeadline-Date.now());
  else { if(S._tTurn!==S.turn+'|'+S.round){ S._tTurn=S.turn+'|'+S.round; S._tAt=Date.now()+(S.turnLeft||TURN_SEC)*1000; } left=Math.max(0,S._tAt-Date.now()); }
  i.style.width=Math.min(100,left/(TURN_SEC*1000)*100)+'%'; },250);

/* ===================== bấm nút ===================== */
ov.addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b||b.disabled) return;
  if(b.id==='cpClose'){ if(tab==='bj'&&!HS_safePhase()){ SD.toast('Đang có cược trong ván, chờ ván xong đã.'); return; } close(); return; }
  if(b.id==='cpCreate') return doCreate();
  if(b.id==='cpJoin') return doJoin();
  if(b.id==='cpCopy'){ copy(N.code()); return; }
  if(b.id==='cpShare'){ share(); return; }
  if(b.id==='cpSend'){ sendChat(); return; }
  if(b.dataset.q){ N.say(b.dataset.q); return; }
  if(b.dataset.tab){ if(b.dataset.tab===tab) return; if(tab==='bj'&&!HS_safePhase()){ SD.toast('Đang có cược trong ván, chờ ván xong đã.'); return; }
    if(tab==='bj') send({t:'unsit'}); tab=b.dataset.tab; showView(); return; }
  if(b.dataset.gift){ giftTo=b.dataset.gift; renderRoomTab(); return; }
  if(b.dataset.givex){ giftTo=null; renderRoomTab(); return; }
  if(b.dataset.givea){ const amt=+b.dataset.givea, t=N.member(giftTo); giftTo=null; if(t&&SD.bank()>=amt){ SD.add(-amt); N.gift(t.id,amt); bjBank(); } renderRoomTab(); return; }
  if(b.dataset.goto){ const m=N.member(b.dataset.goto); if(m&&m.loc&&m.loc.p&&SD.canGo(m.loc.p)){ close(); SD.goPlace(m.loc.p); } return; }
  if(b.dataset.act){ const a=b.dataset.act;
    if(a==='city'){ close(); SD.goCity(); return; }
    if(a==='bj'){ N.invite('bj','Ngồi vào bàn Blackjack chung không?'); tab='bj'; showView(); return; }
    if(a==='f1'){ N.invite('f1','Vào Gara → Chạy xe → Giao hữu, đua F1 cùng nhé!'); close(); SD.goF1Team(); return; }
    if(a==='leave'){ const go=()=>{ bjLost(); N.leave(); showView(); renderChip(); };
      SD.modal({kick:'Chơi cùng', title:'Rời phòng?', body:N.isHost()?'Bạn là chủ thế giới, rời đi thì phòng đóng với mọi người.':'Bạn sẽ quay về thế giới của mình.', yes:'Rời phòng', yesFn:go, no:'Ở lại'}); return; }
  }
  const a=b.dataset.a;
  if(a==='sit'){ send({t:'sit', bank:Math.floor(SD.bank())}); return; }
  if(!S) return;
  const me=S.seats.find(s=>s.id===N.me());
  if(b.dataset.chip&&me){ send({t:'bet', amt:Math.min(SD.bank(),me.bet+(+b.dataset.chip)), bank:Math.floor(SD.bank())}); return; }
  if(!a||!me) return;
  if(a==='clear') send({t:'bet', amt:0, bank:Math.floor(SD.bank())});
  else if(a==='ready'){ if(!me.ready&&me.bet>SD.bank()){ send({t:'bet', amt:0, bank:Math.floor(SD.bank())}); return; } bjBank(); send({t:'ready', on:!me.ready}); }
  else if(a==='start') send({t:'start'});
  else if(a==='hit'||a==='stand') send({t:'act', a});
  else if(a==='double'){ if(SD.bank()>=me.wager) send({t:'act', a:'double'}); }
});
function sendChat(){ const i=$('cpMsg'), m=i.value.trim(); if(!m) return; N.say(m); i.value=''; }
$('cpMsg').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); sendChat(); } });
$('cpCode').addEventListener('input',e=>{ const v=N.normCode(e.target.value); if(e.target.value!==v) e.target.value=v; });
$('cpCode').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); doJoin(); } });
function share(){ const code=N.code(), url=location.origin+location.pathname+'?room='+code, text=`Vào thế giới Sòng Đêm của mình chơi cùng nhé! Mã phòng: ${code}`;
  if(navigator.share) navigator.share({title:'Sòng Đêm · Chơi cùng', text, url}).catch(()=>{}); else copy(`${text}\n${url}`); }
function copy(t){ const done=()=>SD.toast('Đã sao chép.');
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done,fallback); else fallback();
  function fallback(){ const ta=document.createElement('textarea'); ta.value=t; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); done(); }catch(e){ SD.toast('Mã phòng: '+N.code()); } ta.remove(); } }
window.SDShare={copy:()=>copy(N.code()), share};

const tile=$('goCoop'); if(tile) tile.addEventListener('click',()=>open());
try{ const r=new URLSearchParams(location.search).get('room'); if(r) setTimeout(()=>open({code:r}),1500); }catch(e){}
})();
