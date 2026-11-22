// Sáu trò trong Sòng Đêm, luật theo bản 2D: Blackjack, Poker Texas Hold'em, Xếp bài Vegas,
// Đua ngựa, Roulette, Máy slot. Mỗi ván tốn 10 phút trong game.
import { icon } from './icons.js';
import { fmt } from './phone.js';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const red = (s) => s === 1 || s === 2;
const rnd = (n) => Math.floor(Math.random() * n);
function deck(n = 1) {
  const d = [];
  for (let k = 0; k < n; k++) for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) d.push({ r, s });
  for (let i = d.length - 1; i > 0; i--) { const j = rnd(i + 1); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
function cardHTML(c, hidden = false, extra = '') {
  if (hidden || !c) return `<span class="cd back ${extra}"></span>`;
  return `<span class="cd ${red(c.s) ? 'rd' : ''} ${extra}"><b>${RANKS[c.r]}</b><i>${SUITS[c.s]}&#xFE0E;</i></span>`;
}
const chipsBar = (sel, list = [10, 50, 100, 500]) => `<div class="cg-chips">${list.map((v) => `<button class="chip${v === sel ? ' on' : ''}" data-chip="${v}">${v >= 1000 ? v / 1000 + 'k' : v}</button>`).join('')}</div>`;

// ---------------- Đánh giá tay 5–7 lá (dùng cho Poker) ----------------
const HAND_NAMES = ['Mậu thầu', 'Một đôi', 'Hai đôi', 'Sám cô', 'Sảnh', 'Thùng', 'Cù lũ', 'Tứ quý', 'Thùng phá sảnh'];
function rank5(cs) {
  const rs = cs.map((c) => c.r).sort((a, b) => b - a);
  const flush = cs.every((c) => c.s === cs[0].s);
  const uniq = [...new Set(rs)];
  let straight = -1;
  if (uniq.length === 5) {
    if (rs[0] - rs[4] === 4) straight = rs[0];
    else if (rs.join() === '12,3,2,1,0') straight = 3;
  }
  const cnt = {}; rs.forEach((r) => { cnt[r] = (cnt[r] || 0) + 1; });
  const groups = Object.entries(cnt).map(([r, n]) => [n, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const kick = groups.map((g) => g[1]);
  let cat;
  if (straight >= 0 && flush) cat = 8;
  else if (groups[0][0] === 4) cat = 7;
  else if (groups[0][0] === 3 && groups[1][0] === 2) cat = 6;
  else if (flush) cat = 5;
  else if (straight >= 0) cat = 4;
  else if (groups[0][0] === 3) cat = 3;
  else if (groups[0][0] === 2 && groups[1][0] === 2) cat = 2;
  else if (groups[0][0] === 2) cat = 1;
  else cat = 0;
  const tie = straight >= 0 && (cat === 4 || cat === 8) ? [straight] : kick;
  return cat * 1e10 + tie.reduce((a, v, i) => a + v * Math.pow(15, 4 - i), 0);
}
function best7(cs) {
  let best = -1;
  for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) {
    const five = cs.filter((_, i) => i !== a && i !== b);
    const v = rank5(five); if (v > best) best = v;
  }
  return best;
}
const handName = (v) => HAND_NAMES[Math.floor(v / 1e10)];

export function createCasinoGames(ctx) {
  const ov = document.createElement('div');
  ov.className = 'cg-ov'; ov.hidden = true;
  ov.innerHTML = `<div class="cg-panel" role="dialog" aria-modal="true">
    <header class="cg-head"><h3 class="cg-title"></h3><span class="cg-cash"></span><button class="cg-x" type="button">Rời bàn</button></header>
    <div class="cg-body"></div><p class="cg-msg" role="status" aria-live="polite"></p></div>`;
  document.body.appendChild(ov);
  const body = ov.querySelector('.cg-body'), msgEl = ov.querySelector('.cg-msg');
  const titleEl = ov.querySelector('.cg-title'), cashEl = ov.querySelector('.cg-cash');
  let current = null;
  const say = (t, good) => { msgEl.textContent = t; msgEl.className = 'cg-msg' + (good === true ? ' good' : good === false ? ' bad' : ''); };
  const showCash = () => { cashEl.innerHTML = `${icon('credit-card')} ${fmt(ctx.cash())}`; };
  const pay = (v, text) => { ctx.pay(v, text); showCash(); };
  const canBet = (v) => { if (ctx.cash() >= v) return true; say(`Ví không đủ ${fmt(v)}. Mở điện thoại → Ngân hàng Đêm để vay, hoặc rút tiền ở ATM.`, false); return false; };
  const round = () => ctx.advance(10);

  ov.querySelector('.cg-x').addEventListener('click', () => close());
  body.addEventListener('click', (e) => { const b = e.target.closest('button,[data-tap]'); if (b && current?.click) current.click(b, e); });

  // ================= BLACKJACK =================
  function blackjack() {
    let shoe = deck(6), bet = 10, ph = [], dh = [], state = 'bet', stake = 0;
    const val = (h) => { let v = 0, a = 0; for (const c of h) { v += c.r === 12 ? 11 : Math.min(10, c.r + 2); if (c.r === 12) a++; } while (v > 21 && a) { v -= 10; a--; } return v; };
    const draw = () => { if (shoe.length < 30) shoe = deck(6); return shoe.pop(); };
    const render = () => {
      const hideHole = state === 'play';
      body.innerHTML = `<div class="felt bj">
        <div class="seat"><p class="lbl">Nhà cái ${hideHole ? '' : dh.length ? '· ' + val(dh) : ''}</p><div class="hand">${dh.map((c, i) => cardHTML(c, hideHole && i === 1)).join('')}</div></div>
        <p class="felt-note">BLACKJACK TRẢ 3 ĂN 2 · NHÀ CÁI DỪNG Ở 17</p>
        <div class="seat"><p class="lbl">Bạn ${ph.length ? '· ' + val(ph) : ''} ${stake ? '· cược ' + fmt(stake) : ''}</p><div class="hand">${ph.map((c) => cardHTML(c)).join('')}</div></div></div>
        ${state === 'play'
          ? `<div class="cg-acts"><button class="btn primary" data-a="hit">Rút bài</button><button class="btn" data-a="stand">Dằn</button>${ph.length === 2 && ctx.cash() >= stake ? '<button class="btn" data-a="dbl">Gấp đôi</button>' : ''}</div>`
          : `${chipsBar(bet)}<div class="cg-acts"><button class="btn primary" data-a="deal">Chia bài · ${fmt(bet)}</button></div>`}`;
    };
    const finish = () => {
      while (val(dh) < 17) dh.push(draw());
      const p = val(ph), d = val(dh);
      let win = 0, t;
      if (p > 21) t = `Quắc ${p}. Mất ${fmt(stake)}.`;
      else if (d > 21 || p > d) { win = stake * 2; t = `Bạn ${p}, nhà cái ${d > 21 ? 'quắc' : d}. Thắng ${fmt(stake)}!`; }
      else if (p === d) { win = stake; t = `Hoà ${p}. Trả lại tiền cược.`; }
      else t = `Nhà cái ${d} thắng ${p}. Mất ${fmt(stake)}.`;
      if (win) pay(win, 'Blackjack: thắng');
      say(t, win > stake ? true : win === stake ? undefined : false);
      state = 'bet'; stake = 0; round(); render();
    };
    return {
      title: 'Blackjack', mount() { say('Chọn mức cược rồi bấm Chia bài.'); render(); },
      click(b) {
        if (b.dataset.chip) { bet = +b.dataset.chip; render(); return; }
        const a = b.dataset.a;
        if (a === 'deal') {
          if (!canBet(bet)) return;
          pay(-bet, 'Blackjack: đặt cược'); stake = bet;
          ph = [draw(), draw()]; dh = [draw(), draw()]; state = 'play'; say('Rút thêm hay dằn?');
          if (val(ph) === 21) {
            state = 'done';
            if (val(dh) === 21) { pay(stake, 'Blackjack: hoà'); say('Cả hai cùng Blackjack. Hoà.'); }
            else { pay(stake + Math.floor(stake * 1.5), 'Blackjack: Blackjack'); say(`Blackjack! Thắng ${fmt(Math.floor(stake * 1.5))}.`, true); }
            state = 'bet'; stake = 0; round();
          }
          render();
        } else if (a === 'hit') { ph.push(draw()); if (val(ph) >= 21) finish(); else render(); }
        else if (a === 'stand') finish();
        else if (a === 'dbl') { pay(-stake, 'Blackjack: gấp đôi'); stake *= 2; ph.push(draw()); finish(); }
      },
    };
  }

  // ================= ROULETTE =================
  function roulette() {
    let self = null;
    const alive = () => current === self;
    const sayA = (t, g) => { if (alive()) say(t, g); };
    const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
    const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
    let chip = 10, bets = {}, spinning = false, last = null, angle = 0;
    const total = () => Object.values(bets).reduce((a, v) => a + v, 0);
    const wheelSvg = () => {
      const seg = 360 / 37;
      const parts = WHEEL.map((n, i) => {
        const a0 = (i * seg - 90) * Math.PI / 180, a1 = ((i + 1) * seg - 90) * Math.PI / 180;
        const col = n === 0 ? '#1f8a4c' : REDS.has(n) ? '#c0303a' : '#1d1c22';
        const tx = 50 + 41 * Math.cos((a0 + a1) / 2), ty = 50 + 41 * Math.sin((a0 + a1) / 2);
        return `<path d="M50 50 L${50 + 48 * Math.cos(a0)} ${50 + 48 * Math.sin(a0)} A48 48 0 0 1 ${50 + 48 * Math.cos(a1)} ${50 + 48 * Math.sin(a1)} Z" fill="${col}" stroke="#d6a743" stroke-width=".3"/><text x="${tx}" y="${ty}" transform="rotate(${i * seg + seg / 2} ${tx} ${ty})">${n}</text>`;
      }).join('');
      return `<svg class="wheel" viewBox="0 0 100 100" style="transform:rotate(${angle}deg)">${parts}<circle cx="50" cy="50" r="22" fill="#6b3a1a" stroke="#d6a743" stroke-width="1.5"/><circle cx="50" cy="50" r="6" fill="#d6a743"/></svg>`;
    };
    const cell = (key, label, cls = '') => `<button class="rc ${cls}${bets[key] ? ' has' : ''}" data-bet="${key}">${label}${bets[key] ? `<em>${bets[key]}</em>` : ''}</button>`;
    const render0 = () => {
      let grid = '';
      for (let row = 2; row >= 0; row--) for (let c = 0; c < 12; c++) { const n = c * 3 + row + 1; grid += cell('n' + n, n, REDS.has(n) ? 'r' : 'b'); }
      body.innerHTML = `<div class="felt rl"><div class="wheel-wrap"><span class="ptr"></span>${wheelSvg()}<b class="rl-last">${last === null ? '–' : last}</b></div>
        <div class="rl-board"><div class="rl-zero">${cell('n0', '0', 'z')}</div><div class="rl-grid">${grid}</div></div>
        <div class="rl-out">${cell('dozen1', '1–12')}${cell('dozen2', '13–24')}${cell('dozen3', '25–36')}${cell('low', '1–18')}${cell('even', 'Chẵn')}${cell('red', 'Đỏ', 'r')}${cell('black', 'Đen', 'b')}${cell('odd', 'Lẻ')}${cell('high', '19–36')}</div></div>
        ${chipsBar(chip)}<div class="cg-acts"><button class="btn primary" data-a="spin" ${spinning ? 'disabled' : ''}>Quay · cược ${fmt(total())}</button><button class="btn" data-a="clear" ${spinning ? 'disabled' : ''}>Xoá cược</button></div>`;
    };
    const payout = (key, n) => {
      if (key[0] === 'n') return +key.slice(1) === n ? 36 : 0;
      if (n === 0) return 0;
      if (key.startsWith('dozen')) return Math.ceil(n / 12) === +key.slice(5) ? 3 : 0;
      const ok = { low: n <= 18, high: n >= 19, even: n % 2 === 0, odd: n % 2 === 1, red: REDS.has(n), black: !REDS.has(n) }[key];
      return ok ? 2 : 0;
    };
    const render = (...a) => { if (alive()) render0(...a); };
    return self = {
      title: 'Roulette', mount() { say('Chọn chip, chạm vào ô để đặt cược, rồi bấm Quay. Số đơn trả 35 ăn 1.'); render(); },
      click(b) {
        if (spinning) return;
        if (b.dataset.chip) { chip = +b.dataset.chip; render(); return; }
        if (b.dataset.bet) { if (!canBet(total() + chip)) return; bets[b.dataset.bet] = (bets[b.dataset.bet] || 0) + chip; render(); return; }
        if (b.dataset.a === 'clear') { bets = {}; render(); return; }
        if (b.dataset.a === 'spin') {
          const t = total(); if (!t) { say('Hãy đặt ít nhất một cược.'); return; }
          if (!canBet(t)) return;
          pay(-t, 'Roulette: đặt cược'); spinning = true;
          const n = WHEEL[rnd(37)], idx = WHEEL.indexOf(n), seg = 360 / 37;
          angle = angle - (angle % 360) + 360 * 5 + (360 - (idx * seg + seg / 2));
          render(); say('Bóng đang lăn…');
          setTimeout(() => {
            spinning = false; last = n;
            const win = Object.entries(bets).reduce((a, [k, v]) => a + v * payout(k, n), 0);
            if (win) pay(win, 'Roulette: thắng');
            sayA(`Số ${n} ${n === 0 ? '(xanh)' : REDS.has(n) ? 'đỏ' : 'đen'}. ${win ? 'Thắng ' + fmt(win - t > 0 ? win - t : win) + (win - t > 0 ? ' lãi' : ' về') + '!' : 'Mất ' + fmt(t) + '.'}`, win > t ? true : win ? undefined : false);
            bets = {}; round(); render();
          }, 3200);
        }
      },
    };
  }

  // ================= MÁY SLOT =================
  function slots() {
    let self = null;
    const alive = () => current === self;
    const sayA = (t, g) => { if (alive()) say(t, g); };
    const SYM = [
      { k: '7', w: 1, p3: 200, html: '<b class="s7">7</b>' }, { k: 'crown', w: 2, p3: 50, html: icon('crown') },
      { k: 'dia', w: 3, p3: 25, html: icon('diamond-card') }, { k: 'coin', w: 4, p3: 15, html: icon('star-coin') },
      { k: 'heart', w: 5, p3: 10, html: icon('heart-card') }, { k: 'club', w: 6, p3: 4, html: icon('club-card') },
    ];
    const bag = SYM.flatMap((s, i) => Array(s.w).fill(i));
    let bet = 10, reels = [0, 1, 2], spinning = false;
    const render0 = (cls = '') => {
      body.innerHTML = `<div class="felt sl"><div class="slot-machine"><div class="slot-top">SÒNG ĐÊM · 777</div>
        <div class="reels ${cls}">${reels.map((r) => `<div class="reel">${SYM[r].html}</div>`).join('')}</div>
        <p class="pays">7-7-7 ×200 · vương miện ×50 · rô ×25 · xu ×15 · cơ ×10 · nhép ×4 · hai ô giống nhau ×1</p></div></div>
        ${chipsBar(bet, [10, 50, 100])}<div class="cg-acts"><button class="btn primary" data-a="spin" ${spinning ? 'disabled' : ''}>Quay · ${fmt(bet)}</button></div>`;
    };
    const render = (...a) => { if (alive()) render0(...a); };
    return self = {
      title: 'Máy slot', mount() { say('3 cuộn, ba số 7 ăn gấp 200.'); render(); },
      click(b) {
        if (spinning) return;
        if (b.dataset.chip) { bet = +b.dataset.chip; render(); return; }
        if (b.dataset.a !== 'spin' || !canBet(bet)) return;
        pay(-bet, 'Slot: quay'); spinning = true;
        const res = [bag[rnd(bag.length)], bag[rnd(bag.length)], bag[rnd(bag.length)]];
        let ticks = 0;
        const iv = setInterval(() => {
          ticks++;
          reels = reels.map((r, i) => (ticks > 6 + i * 4 ? res[i] : rnd(SYM.length)));
          render('spin');
          if (ticks > 14) {
            clearInterval(iv); spinning = false;
            let mult = 0;
            if (res[0] === res[1] && res[1] === res[2]) mult = SYM[res[0]].p3;
            else if (res[0] === res[1] || res[1] === res[2] || res[0] === res[2]) mult = 1;
            if (mult) pay(bet * mult, 'Slot: thắng');
            sayA(mult > 1 ? `Trúng ×${mult}! Nhận ${fmt(bet * mult)}.` : mult === 1 ? 'Hai ô giống nhau, hoàn lại tiền cược.' : 'Không trúng.', mult > 1 ? true : mult ? undefined : false);
            round(); render();
          }
        }, 90);
      },
    };
  }

  // ================= ĐUA NGỰA =================
  function horses() {
    let self = null;
    const alive = () => current === self;
    const sayA = (t, g) => { if (alive()) say(t, g); };
    const NAMES = ['Gió Bắc', 'Hắc Mã', 'Tia Chớp', 'Lúa Vàng', 'Bão Đêm', 'Ngọc Trai'];
    const COLORS = ['#e2b24b', '#3a3f4c', '#4aa3ff', '#ff9a3c', '#a04ad8', '#e8e8e8'];
    let stage = ctx.horseStage(), odds = [], pick = 0, bet = 50, racing = false, pos = [0, 0, 0, 0, 0, 0], winner = -1;
    const newOdds = () => {
      const base = [1.8, 2.6, 3.5, 5, 8, 14].sort(() => Math.random() - 0.5);
      odds = base.map((o) => Math.round(o * (0.9 + Math.random() * 0.25) * 10) / 10);
    };
    newOdds();
    const render0 = () => {
      body.innerHTML = `<div class="felt hr"><p class="felt-note">CHẶNG ${stage} · 6 NGỰA</p><div class="track">${NAMES.map((n, i) => `
        <div class="lane${i === winner ? ' win' : ''}"><span class="no">${i + 1}</span><span class="horse" style="left:calc(${pos[i]}% - ${pos[i] * 0.3}px);color:${COLORS[i]}">${icon('horse')}</span></div>`).join('')}<span class="finish"></span></div>
        <div class="odds">${NAMES.map((n, i) => `<button class="odd${i === pick ? ' on' : ''}" data-h="${i}" ${racing ? 'disabled' : ''}><b>${i + 1}. ${n}</b><small>×${odds[i]}</small></button>`).join('')}</div></div>
        ${chipsBar(bet, [10, 50, 100, 500])}<div class="cg-acts"><button class="btn primary" data-a="race" ${racing ? 'disabled' : ''}>Xuất phát · ${fmt(bet)} vào số ${pick + 1}</button></div>`;
    };
    const render = (...a) => { if (alive()) render0(...a); };
    return self = {
      title: 'Đua ngựa', mount() { say('Chọn ngựa và mức cược. Tỉ lệ đổi theo từng chặng.'); render(); },
      click(b) {
        if (racing) return;
        if (b.dataset.chip) { bet = +b.dataset.chip; render(); return; }
        if (b.dataset.h) { pick = +b.dataset.h; render(); return; }
        if (b.dataset.a !== 'race' || !canBet(bet)) return;
        pay(-bet, `Đua ngựa: cược số ${pick + 1}`); racing = true; winner = -1; pos = [0, 0, 0, 0, 0, 0];
        // Chọn ngựa thắng theo xác suất ~ 1/tỉ lệ (có phần lợi nhà cái)
        const w = odds.map((o) => 1 / o), sum = w.reduce((a, v) => a + v, 0);
        let r = Math.random() * sum, win = 0; while (r > w[win]) { r -= w[win]; win++; }
        const speed = odds.map((_, i) => (i === win ? 1.0 : 0.82 + Math.random() * 0.15));
        say('Các ngựa đã xuất phát!');
        const iv = setInterval(() => {
          for (let i = 0; i < 6; i++) pos[i] = Math.min(100, pos[i] + speed[i] * (1.2 + Math.random() * 1.6));
          if (pos[win] >= 100) {
            clearInterval(iv); racing = false; winner = win;
            const got = win === pick ? Math.floor(bet * odds[pick]) : 0;
            if (got) pay(got, 'Đua ngựa: thắng');
            sayA(`Số ${win + 1} ${NAMES[win]} về nhất. ${got ? 'Bạn thắng ' + fmt(got) + '!' : 'Mất ' + fmt(bet) + '.'}`, got ? true : false);
            stage = ctx.horseStage(stage + 1); newOdds(); round();
          }
          render();
        }, 60);
      },
    };
  }

  // ================= XẾP BÀI VEGAS (Klondike, rút 1 lá) =================
  function solitaire() {
    let st = null, sel = null;
    const deal = () => {
      const d = deck(1).map((c) => ({ ...c, up: false }));
      const tab = [];
      for (let i = 0; i < 7; i++) { tab.push(d.splice(0, i + 1)); tab[i][i].up = true; }
      st = { stock: d, waste: [], found: [[], [], [], []], tab, earned: 0 };
    };
    const canFound = (c) => { const f = st.found[c.s]; return f.length ? f[f.length - 1].r === c.r - 1 : c.r === 12; };
    const fRank = (c) => (c.r === 12 ? 0 : c.r + 1); // A=0 trên đích
    const canFound2 = (c) => { const f = st.found[c.s]; return fRank(c) === f.length; };
    const canTab = (c, col) => { const t = st.tab[col]; if (!t.length) return c.r === 11; const top = t[t.length - 1]; return top.up && red(top.s) !== red(c.s) && (top.r === 12 ? false : top.r === c.r + 1); };
    const flip = () => st.tab.forEach((t) => { if (t.length && !t[t.length - 1].up) t[t.length - 1].up = true; });
    const toFound = (c) => { st.found[c.s].push(c); st.earned += 5; pay(5, 'Xếp bài: lá lên đích'); };
    const render = () => {
      const top = (a) => a[a.length - 1];
      body.innerHTML = `<div class="felt so"><div class="so-top">
        <button class="pile" data-a="stock">${st.stock.length ? cardHTML(null, true) : '<span class="cd empty">↺</span>'}</button>
        <button class="pile" data-a="waste">${st.waste.length ? cardHTML(top(st.waste), false, sel === 'w' ? 'sel' : '') : '<span class="cd empty"></span>'}</button><span class="gap"></span>
        ${st.found.map((f, i) => `<span class="pile">${f.length ? cardHTML(top(f)) : `<span class="cd empty">${SUITS[i]}&#xFE0E;</span>`}</span>`).join('')}</div>
        <div class="so-tab">${st.tab.map((t, ci) => `<div class="col" data-col="${ci}" data-tap="1">${t.length ? t.map((c, k) => `<span class="slot" data-c="${ci}" data-k="${k}" data-tap="1">${cardHTML(c, !c.up, sel === ci + ':' + k ? 'sel' : '')}</span>`).join('') : '<span class="cd empty">K</span>'}</div>`).join('')}</div></div>
        <div class="cg-acts"><button class="btn" data-a="new">Ván mới · $52</button><span class="earn">Ván này: ${fmt(st.earned)}</span></div>`;
    };
    const tryMove = (cards, fromCol) => {
      const c = cards[0];
      if (cards.length === 1 && canFound2(c)) { toFound(c); return 'found'; }
      for (let col = 0; col < 7; col++) if (col !== fromCol && canTab(c, col)) { st.tab[col].push(...cards); return 'tab'; }
      return null;
    };
    return {
      title: 'Xếp bài Vegas',
      mount() {
        if (!st) { say('Mua ván $52. Mỗi lá lên đích được +$5. Chạm vào lá để tự chuyển tới chỗ hợp lệ.'); body.innerHTML = '<div class="felt so"><p class="felt-note">XẾP BÀI VEGAS · MUA VÁN $52 · MỖI LÁ +$5</p></div><div class="cg-acts"><button class="btn primary" data-a="new">Mua ván · $52</button></div>'; }
        else render();
      },
      click(b) {
        const a = b.dataset.a;
        if (a === 'new') { if (!canBet(52)) return; pay(-52, 'Xếp bài: mua ván'); deal(); round(); say('Chạm vào lá để chuyển. Lật bài ở góc trái.'); render(); return; }
        if (!st) return;
        if (a === 'stock') { if (st.stock.length) { const c = st.stock.pop(); c.up = true; st.waste.push(c); } else { st.stock = st.waste.reverse().map((c) => ({ ...c, up: false })); st.waste = []; } render(); return; }
        if (a === 'waste') { const c = st.waste[st.waste.length - 1]; if (!c) return; if (tryMove([c], -1)) { st.waste.pop(); render(); } else say('Lá này chưa đi đâu được.'); return; }
        if (b.dataset.c !== undefined) {
          const ci = +b.dataset.c, k = +b.dataset.k, t = st.tab[ci];
          if (!t[k].up) return;
          const cards = t.slice(k);
          if (tryMove(cards, ci)) { t.splice(k); flip(); const done = st.found.every((f) => f.length === 13); if (done) say(`Xếp xong cả bộ! Ván này được ${fmt(st.earned)}.`, true); render(); }
          else say('Lá này chưa đi đâu được.');
        }
      },
    };
  }

  // ================= POKER TEXAS HOLD'EM =================
  function poker() {
    const SB = 5, BB = 10;
    const BOTS = ['Lão Tư', 'Bà Sáu', 'Ông Kẹ'];
    let t = null, buyin = 500;
    const equity = (hole, board, opp) => {
      let win = 0; const N = 160;
      const used = new Set([...hole, ...board].map((c) => c.r * 4 + c.s));
      const rest = []; for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) if (!used.has(r * 4 + s)) rest.push({ r, s });
      for (let n = 0; n < N; n++) {
        for (let i = rest.length - 1; i > rest.length - 1 - (opp * 2 + 5 - board.length) && i > 0; i--) { const j = rnd(i + 1); [rest[i], rest[j]] = [rest[j], rest[i]]; }
        let p = rest.length - 1;
        const full = board.slice(); while (full.length < 5) full.push(rest[p--]);
        const me = best7([...hole, ...full]);
        let ok = true; for (let o = 0; o < opp; o++) { const v = best7([rest[p--], rest[p--], ...full]); if (v > me) { ok = false; break; } }
        if (ok) win++;
      }
      return win / N;
    };
    const newHand = () => {
      const d = deck(1);
      t.players.forEach((p) => { p.hole = [d.pop(), d.pop()]; p.bet = 0; p.folded = p.stack <= 0; p.allin = false; p.acted = false; });
      t.board = []; t.deckArr = d; t.pot = 0; t.stage = 0; t.dealer = (t.dealer + 1) % 4; t.show = false; t.result = '';
      const post = (i, v) => { const p = t.players[i]; const x = Math.min(v, p.stack); p.stack -= x; p.bet += x; t.pot += x; if (!p.stack) p.allin = true; };
      post((t.dealer + 1) % 4, SB); post((t.dealer + 2) % 4, BB);
      t.cur = BB; t.turn = (t.dealer + 3) % 4; t.minRaise = BB;
      advanceBots();
    };
    const live = () => t.players.filter((p) => !p.folded);
    const nextTurn = () => { for (let k = 1; k <= 4; k++) { const i = (t.turn + k) % 4; const p = t.players[i]; if (!p.folded && !p.allin) { t.turn = i; return true; } } return false; };
    const roundDone = () => live().filter((p) => !p.allin).every((p) => p.acted && p.bet === t.cur) || live().length <= 1;
    const act = (i, kind, amount = 0) => {
      const p = t.players[i];
      if (kind === 'fold') p.folded = true;
      else {
        const target = kind === 'raise' ? t.cur + amount : t.cur;
        const add = Math.min(target - p.bet, p.stack);
        p.stack -= add; p.bet += add; t.pot += add;
        if (!p.stack) p.allin = true;
        if (p.bet > t.cur) { t.minRaise = Math.max(t.minRaise, p.bet - t.cur); t.cur = p.bet; t.players.forEach((q) => { if (q !== p) q.acted = false; }); }
      }
      p.acted = true;
      p.last = kind === 'fold' ? 'Bỏ' : kind === 'raise' ? 'Tố' : p.bet === 0 ? 'Xem' : 'Theo';
    };
    const nextStreet = () => {
      t.players.forEach((p) => { p.bet = 0; p.acted = false; p.last = ''; }); t.cur = 0; t.minRaise = BB;
      t.stage++;
      if (t.stage === 1) t.board.push(t.deckArr.pop(), t.deckArr.pop(), t.deckArr.pop());
      else if (t.stage <= 3) t.board.push(t.deckArr.pop());
      t.turn = t.dealer; nextTurn();
    };
    const showdown = () => {
      const L = live();
      while (t.board.length < 5) t.board.push(t.deckArr.pop());
      let best = -1, winners = [];
      for (const p of L) { p.val = best7([...p.hole, ...t.board]); if (p.val > best) { best = p.val; winners = [p]; } else if (p.val === best) winners.push(p); }
      const share = Math.floor(t.pot / winners.length);
      winners.forEach((p) => { p.stack += share; });
      t.show = true;
      t.result = L.length === 1 ? `${winners[0].name} ăn ${fmt(t.pot)} (mọi người bỏ bài).` : `${winners.map((w) => w.name).join(', ')} thắng ${fmt(t.pot)} với ${handName(best)}.`;
      say(t.result, winners.includes(t.players[0]) ? true : false);
      t.pot = 0; t.stage = 4; round();
    };
    const progress = () => {
      if (live().length <= 1) { showdown(); return; }
      if (roundDone()) {
        if (t.stage >= 3 || live().filter((p) => !p.allin).length <= 1) { while (t.stage < 3) { t.stage++; nextStreet(); } showdown(); return; }
        nextStreet();
      } else nextTurn();
    };
    function advanceBots() {
      let guard = 0;
      while (t.stage < 4 && t.turn !== 0 && guard++ < 40) {
        const i = t.turn, p = t.players[i];
        const opp = live().length - 1;
        const eq = equity(p.hole, t.board, Math.max(1, opp));
        const toCall = t.cur - p.bet;
        const potOdds = toCall / Math.max(1, t.pot + toCall);
        const r = Math.random();
        if (eq > 0.62 + r * 0.15 && p.stack > toCall) act(i, 'raise', Math.max(t.minRaise, Math.round(t.pot * (0.5 + r * 0.5) / 5) * 5));
        else if (toCall === 0 || eq > potOdds + 0.05 || (r < 0.08 && toCall <= BB * 2)) act(i, 'call');
        else act(i, 'fold');
        progress();
      }
      let g2 = 0;
      if (t.stage < 4 && t.players[0].folded) { while (t.stage < 4 && g2++ < 80) { if (live().length <= 1) { showdown(); break; } if (t.turn === 0) nextTurn(); advanceBotsInner(); } }
      if (t.stage < 4 && g2 >= 80) showdown();
    }
    function advanceBotsInner() {
      const i = t.turn, p = t.players[i];
      if (i === 0) { progress(); return; }
      const eq = equity(p.hole, t.board, Math.max(1, live().length - 1));
      const toCall = t.cur - p.bet;
      if (toCall === 0 || eq > toCall / Math.max(1, t.pot + toCall)) act(i, 'call'); else act(i, 'fold');
      progress();
    }
    const render = () => {
      if (!t) {
        body.innerHTML = `<div class="felt pk"><p class="felt-note">TEXAS HOLD'EM · BÀN $5/$10 · 3 TAY CHƠI LÃO LUYỆN</p></div>
          <p class="cg-sub">Mang vào bàn</p>${chipsBar(buyin, [200, 500, 1000])}<div class="cg-acts"><button class="btn primary" data-a="sit">Ngồi vào bàn · ${fmt(buyin)}</button></div>`;
        return;
      }
      const P = t.players;
      const seat = (p, i) => `<div class="pk-seat s${i}${t.turn === i && t.stage < 4 ? ' turn' : ''}${p.folded ? ' out' : ''}">
        <b>${p.name}${i === t.dealer ? ' <i class="dl">D</i>' : ''}</b><small>${fmt(p.stack)}${p.bet ? ' · cược ' + fmt(p.bet) : ''}${p.last ? ' · ' + p.last : ''}</small>
        <div class="hand sm">${p.hole.map((c) => cardHTML(c, i !== 0 && !(t.show && !p.folded))).join('')}</div></div>`;
      const me = P[0], toCall = t.cur - me.bet;
      const myTurn = t.stage < 4 && t.turn === 0 && !me.folded;
      const raiseTo = Math.min(me.stack, toCall + Math.max(t.minRaise, BB));
      body.innerHTML = `<div class="felt pk"><div class="pk-top">${P.slice(1).map((p, i) => seat(p, i + 1)).join('')}</div>
        <div class="pk-board"><div class="hand">${[0, 1, 2, 3, 4].map((k) => t.board[k] ? cardHTML(t.board[k]) : '<span class="cd empty"></span>').join('')}</div><p class="pot">Pot ${fmt(t.pot)}</p></div>
        ${seat(me, 0)}</div>
        <div class="cg-acts">${t.stage >= 4
          ? `<button class="btn primary" data-a="next">Ván tiếp</button><button class="btn" data-a="leave">Đứng dậy · đổi ${fmt(me.stack)}</button>`
          : myTurn ? `<button class="btn" data-a="fold">Bỏ bài</button><button class="btn primary" data-a="call">${toCall ? 'Theo ' + fmt(Math.min(toCall, me.stack)) : 'Xem bài'}</button>${me.stack > toCall ? `<button class="btn" data-a="raise">Tố thêm ${fmt(raiseTo - toCall)}</button><button class="btn" data-a="allin">All-in</button>` : ''}`
          : '<button class="btn" disabled>Đang chờ…</button>'}</div>`;
    };
    const cashOut = () => { if (t) { pay(t.players[0].stack, 'Poker: đổi chip ra tiền'); t = null; } };
    return {
      title: 'Poker Texas Hold\'em',
      mount() { say(t ? '' : 'Chọn số tiền mang vào bàn. Bàn $5/$10, đấu 3 tay chơi lão luyện.'); render(); },
      unmount: cashOut,
      click(b) {
        if (b.dataset.chip && !t) { buyin = +b.dataset.chip; render(); return; }
        const a = b.dataset.a;
        if (a === 'sit') {
          if (!canBet(buyin)) return;
          pay(-buyin, 'Poker: mua chip');
          t = { players: [{ name: 'Bạn', stack: buyin }, ...BOTS.map((n) => ({ name: n, stack: 1000 }))], dealer: rnd(4) };
          newHand(); say('Đến lượt bạn khi ghế sáng viền vàng.'); render(); return;
        }
        if (!t) return;
        if (a === 'leave') { cashOut(); say('Đã đổi chip ra tiền mặt.'); render(); return; }
        if (a === 'next') {
          if (t.players[0].stack <= 0) { t = null; say('Bạn đã hết chip.', false); render(); return; }
          t.players.forEach((p, i) => { if (i && p.stack < BB) p.stack = 1000; });
          newHand(); say(''); render(); return;
        }
        if (t.turn !== 0) return;
        const me = t.players[0], toCall = t.cur - me.bet;
        if (a === 'fold') act(0, 'fold');
        else if (a === 'call') act(0, 'call');
        else if (a === 'raise') act(0, 'raise', Math.max(t.minRaise, BB));
        else if (a === 'allin') act(0, 'raise', me.stack - toCall);
        progress(); advanceBots(); render();
      },
    };
  }

  const GAMES = { bj: blackjack(), rl: roulette(), sl: slots(), hr: horses(), so: solitaire(), pk: poker() };
  function open(id) {
    current = GAMES[id]; if (!current) return;
    titleEl.textContent = current.title; ov.className = 'cg-ov g-' + id; ov.hidden = false;
    showCash(); current.mount(); ctx.onOpen();
  }
  function close() {
    if (ov.hidden) return;
    current?.unmount?.(); ov.hidden = true; current = null; ctx.onClose();
  }
  return { open, close, get isOpen() { return !ov.hidden; }, _rank5: rank5, _best7: best7 };
}
