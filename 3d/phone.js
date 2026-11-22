// Điện thoại (giao diện giống bản 2D): Ví của tôi, BruhBank, Bản đồ, Cài đặt.
import { icon } from './icons.js';

export const fmt = (n) => (n < 0 ? '−$' : '$') + Math.abs(Math.floor(n)).toLocaleString('vi-VN');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ICON = {
  wallet: icon('credit-card'), bank: icon('bank'), map: icon('map'), set: icon('settings'), loan: icon('sycee'),
};

export function createPhone(ctx) {
  const ov = document.createElement('div');
  ov.className = 'phone-ov'; ov.hidden = true;
  ov.innerHTML = `<div class="phone" role="dialog" aria-modal="true" aria-label="Điện thoại">
    <div class="ph-status"><span id="phTime">21:00</span><span class="isl"></span><span>5G</span></div>
    <div class="ph-screen" id="phScreen"></div>
    <button class="ph-homebar" type="button" aria-label="Về màn hình chính"></button></div>
    <button class="ph-close" type="button">Cất điện thoại</button>`;
  document.body.appendChild(ov);
  const scr = ov.querySelector('#phScreen');
  let view = 'home';

  const head = (t, extra = '') => `<div class="ph-head"><button data-ph="home">‹ Màn hình</button><h4>${t}</h4>${extra}</div>`;
  // amt là thay đổi tiền mặt trong ví; app ngân hàng hiển thị theo góc nhìn tài khoản (đảo dấu)
  const logRows = (list, sign = 1) => list.length
    ? `<div class="ph-list">${list.slice(0, 12).map((e) => { const v = e.amt * sign; return `<div class="ph-row tx"><div><h5>${esc(e.text)}</h5><p>${esc(e.when)}</p></div><b class="px ${v < 0 ? 'neg' : 'pos'}">${v < 0 ? '−' : '+'}${fmt(Math.abs(v))}</b></div>`; }).join('')}</div>`
    : '<p class="ph-note">Chưa có giao dịch nào.</p>';

  const meTransform = (p) => `translate(${p.x.toFixed(1)} ${p.z.toFixed(1)}) rotate(${(-p.heading * 180 / Math.PI + 180).toFixed(0)})`;
  function mapSvg() {
    const p = ctx.player();
    const places = ctx.places();
    const blocks = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) blocks.push(`<rect x="${i * 48 - 18}" y="${j * 48 - 18}" width="36" height="36" rx="3" class="mb"/>`);
    const pins = places.map((pl, k) => `<g class="mp${ctx.waypoint() === pl.id ? ' on' : ''}" data-wp="${pl.id}"><circle cx="${pl.x}" cy="${pl.z}" r="12" class="hit"/><circle cx="${pl.x}" cy="${pl.z}" r="4.2" style="fill:${pl.color}"/><text x="${pl.x}" y="${pl.z - 7}">${esc(pl.name)}</text></g>`).join('');
    return `<svg class="ph-map" viewBox="-80 -80 160 160" role="img" aria-label="Bản đồ khu phố">
      <rect x="-80" y="-80" width="160" height="160" class="mroad"/>${blocks.join('')}${pins}
      <g id="phMe" transform="${meTransform(p)}"><path d="M0 -5 L3.6 4 L0 2.2 L-3.6 4 Z" class="me"/></g></svg>`;
  }

  function render() {
    ov.querySelector('#phTime').textContent = ctx.time();
    const m = ctx.money();
    if (view === 'home') {
      scr.innerHTML = `<div class="ph-clock"><b>${ctx.time()}</b><span>Ngày ${ctx.day()} · Ví ${fmt(m.cash)}</span></div>
        <div class="apps">
          <button class="papp" data-ph="wallet"><i style="background:linear-gradient(135deg,#5b7cff,#3a3fbf)">${ICON.wallet}</i>Ví của tôi</button>
          <button class="papp" data-ph="bank"><i style="background:linear-gradient(135deg,#4aa3ff,#1d4fb8)">${ICON.bank}</i>BruhBank</button>
          <button class="papp" data-ph="map"><i style="background:linear-gradient(135deg,#3fc7b0,#1d7a8a)">${ICON.map}</i>Bản đồ</button>
          <button class="papp" data-ph="loan"><i style="background:linear-gradient(135deg,#4a1820,#120608)">${ICON.loan}${ctx.loan().debt ? '<span class="zbadge"></span>' : ''}</i>Ngân hàng Đêm</button>
          <button class="papp" data-ph="set"><i style="background:linear-gradient(135deg,#8a94a8,#454c5c)">${ICON.set}</i>Cài đặt</button>
        </div>`;
    } else if (view === 'wallet') {
      scr.innerHTML = head('Ví của tôi') + `<div class="ph-card"><p>Tiền mặt trong ví</p><b class="ph-big">${fmt(m.cash)}</b>
        <p>Tài khoản BruhBank: <b>${fmt(m.bank)}</b> · Tổng tài sản: <b>${fmt(m.cash + m.bank)}</b></p></div>
        <p class="ph-sub">Giao dịch gần đây</p>${logRows(m.log)}`;
    } else if (view === 'bank') {
      const open = ctx.bankOpen();
      scr.innerHTML = head('BruhBank', `<span class="ph-pill${open ? '' : ' closed'}">${open ? 'Quầy mở' : 'Quầy đóng'}</span>`) +
        `<div class="ph-card"><p>Số dư tài khoản</p><b class="ph-big">${fmt(m.bank)}</b>
        <p>Gửi và rút tiền ở ATM trước BruhBank (24/7, tối đa ${fmt(2000)} mỗi lần rút) hoặc tại quầy (8:00–17:00, không giới hạn).</p>
        <button class="btn go" data-act="route-bank">Chỉ đường tới BruhBank</button></div>
        <p class="ph-sub">Lịch sử tài khoản</p>${logRows(m.log.filter((e) => e.bank), -1)}`;
    } else if (view === 'map') {
      const wp = ctx.waypoint();
      scr.innerHTML = head('Bản đồ') + `<div class="ph-card map">${mapSvg()}
        <p>Chọn một địa điểm để bật chỉ đường. Cột sáng sẽ hiện ở đó.</p>
        <div class="ph-places">${ctx.places().map((pl) => `<button class="btn${wp === pl.id ? ' go' : ''}" data-wp="${pl.id}"><i style="background:${pl.color}"></i>${esc(pl.name)}</button>`).join('')}</div>
        ${wp ? '<button class="btn" data-act="clear-wp">Tắt chỉ đường</button>' : ''}</div>`;
    } else if (view === 'loan') {
      const L = ctx.loan();
      scr.innerHTML = head('Ngân hàng Đêm', `<span class="ph-pill${L.debt ? ' closed' : ''}">${L.debt ? 'Đang nợ' : 'Không nợ'}</span>`) +
        `<div class="ph-card"><p>Dư nợ hiện tại</p><b class="ph-big">${L.debt ? fmt(L.debt) : 'Không nợ'}</b>
        <p>Mỗi lần vay ${fmt(500)}, phải trả ${fmt(600)}. Nợ tối đa ${fmt(3000)}.${L.debt ? ` Còn <b>${L.daysLeft} ngày</b> trước khi bị siết nợ (trừ vào tài khoản rồi tới ví).` : ' Quá 5 ngày không trả sẽ bị siết nợ.'}</p>
        <div class="ph-two"><button class="btn go" data-act="borrow" ${L.debt + 600 > 3000 ? 'disabled' : ''}>Vay ${fmt(500)}</button><button class="btn" data-act="repay" ${L.debt ? '' : 'disabled'}>Trả nợ</button></div></div>`;
    } else if (view === 'set') {
      scr.innerHTML = head('Cài đặt') + `<div class="ph-list">
        <div class="ph-card"><h5>Tốc độ thời gian</h5><p>Mặc định 20 giây ngoài đời = 1 phút trong game. Tua ×30 để xem nhanh ngày và đêm.</p>
          <button class="btn${ctx.speed() !== 1 ? ' go' : ''}" data-act="speed">${ctx.speed() === 1 ? 'Bật tua ×30' : 'Tắt tua (về ×1)'}</button></div>
        <div class="ph-card"><h5>Menu chính</h5><p>Chơi mới hoặc đổi nhân vật. Game tự lưu trên máy này.</p>
          <button class="btn go" data-act="menu">Về menu chính</button></div></div>`;
    }
  }

  ov.addEventListener('click', (e) => {
    if (e.target === ov || e.target.closest('.ph-close')) { close(); return; }
    if (e.target.closest('.ph-homebar')) { view = 'home'; render(); return; }
    const nav = e.target.closest('[data-ph]');
    if (nav) { view = nav.dataset.ph; render(); scr.scrollTop = 0; return; }
    const wp = e.target.closest('[data-wp]');
    if (wp) { ctx.setWaypoint(wp.dataset.wp); render(); return; }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const a = act.dataset.act;
    if (a === 'speed') { ctx.toggleSpeed(); render(); }
    else if (a === 'menu') { close(); ctx.openMenu(); }
    else if (a === 'clear-wp') { ctx.setWaypoint(null); render(); }
    else if (a === 'route-bank') { ctx.setWaypoint('bank'); close(); }
    else if (a === 'borrow') { ctx.borrow(); render(); }
    else if (a === 'repay') { ctx.repay(); render(); }
  });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !ov.hidden) { e.stopImmediatePropagation(); close(); } }, true);

  let timer = null;
  function open() {
    view = 'home'; render(); ov.hidden = false; ctx.onOpen();
    // Chỉ cập nhật chữ giờ và mũi tên vị trí, không vẽ lại cả màn hình (tránh mất nút đang bấm)
    timer = setInterval(() => {
      ov.querySelector('#phTime').textContent = ctx.time();
      const clk = scr.querySelector('.ph-clock b'); if (clk) clk.textContent = ctx.time();
      const me = scr.querySelector('#phMe'); if (me) me.setAttribute('transform', meTransform(ctx.player()));
    }, 500);
  }
  function close() { if (ov.hidden) return; ov.hidden = true; clearInterval(timer); ctx.onClose(); }
  return { open, close, get isOpen() { return !ov.hidden; } };
}
