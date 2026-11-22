// Menu chính và màn hình tải ("rèm" kéo lên), theo đúng phong cách của bản Sòng Đêm 2D.
const TIPS = [
  'Kéo nửa trái màn hình để đi, đẩy hết cỡ để chạy.',
  'Kéo nửa phải màn hình để xoay camera quanh nhân vật.',
  '20 giây ngoài đời là 1 phút trong game. Về nhà ngủ để tua tới sáng.',
  'Đồng xu vàng xoay trên nóc là Sòng Đêm. Đi theo nó nếu bị lạc.',
  'Xe sẽ dừng lại khi bạn đứng chắn đường, nhưng đừng thử quá nhiều.',
  'Bấm nút hình người ở góc trái trên để đổi nhân vật.',
];
const SUITS = '♠&#xFE0E;♥&#xFE0E;♦&#xFE0E;♣&#xFE0E;';

export function createMenu({ summary, has2D }) {
  const root = document.documentElement;
  const el = document.createElement('div');
  el.id = 'sdm'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Menu chính');
  document.body.appendChild(el);
  const ld = document.createElement('div');
  ld.id = 'sdl'; ld.hidden = true; ld.setAttribute('role', 'status'); ld.setAttribute('aria-live', 'polite');
  ld.innerHTML = `<div class="sdl-col"><h1 class="sdl-title">SÒNG ĐÊM</h1><div class="sdl-suits" aria-hidden="true">${SUITS}</div>
    <p class="sdl-step"></p><div class="sdl-bar" aria-hidden="true"><i></i></div><p class="sdl-tip"></p></div><div class="sdl-edge" aria-hidden="true"></div>`;
  document.body.appendChild(ld);

  let resolver = null;
  let inGame = false;

  function render() {
    const s = summary();
    const cont = s ? `<button class="sdm-btn gold" data-m="cont"><b>Tiếp tục</b><small>${s}</small></button>` : '';
    el.innerHTML = `<div class="sdm-col">
      <header class="sdm-sign"><span class="sdm-kick">Sòng bài · Khu phố · Đêm</span><h1 class="sdm-title">SÒNG ĐÊM</h1><div class="sdm-suits" aria-hidden="true">${SUITS}</div></header>
      <nav class="sdm-list" aria-label="Menu chính">${cont}
        <button class="sdm-btn${s ? '' : ' gold'}" data-m="new"><b>Chơi mới</b><small>Bắt đầu lúc 21:00 trước cửa nhà</small></button>
        ${inGame ? '<button class="sdm-btn" data-m="who"><b>Đổi nhân vật</b><small>12 nhân vật, đổi ngay tại chỗ</small></button>' : ''}
        ${has2D ? '<button class="sdm-btn dim" data-m="2d"><b>Mở bản 2D</b><small>Về Sòng Đêm bản đầy đủ</small></button>' : ''}
      </nav>
      <p class="sdm-foot">Bản thử 3D · tự lưu trên máy này</p></div>`;
    el.querySelector('.sdm-btn')?.focus();
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    const m = b.dataset.m;
    if (m === '2d') { location.href = '../'; return; }
    if (resolver) { const r = resolver; resolver = null; r(m); }
  });
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && !el.hidden && inGame && resolver) { const r = resolver; resolver = null; r('cont'); }
  });

  return {
    // Hiện menu và chờ người chơi chọn: 'cont' | 'new'
    choose(fromGame = false) {
      inGame = fromGame;
      render();
      el.hidden = false;
      root.classList.add('sdm-on');
      return new Promise((r) => { resolver = r; });
    },
    hide() { el.hidden = true; root.classList.remove('sdm-on'); },
    get open() { return !el.hidden; },

    // Rèm tải: chạy `task(step)` phía sau, tối thiểu `minMs`, rồi kéo rèm lên.
    async curtain(kind, task, minMs = 1400) {
      const steps = kind === 'new'
        ? ['Đang chuẩn bị ván mới…', 'Đang dựng khu phố…', 'Đang gọi người qua đường…', 'Đang bật đèn đường…', 'Sòng Đêm đã mở cửa']
        : ['Đang tải tiến trình…', 'Đang dựng khu phố…', 'Đang gọi người qua đường…', 'Đang bật đèn đường…', 'Sòng Đêm đã mở cửa'];
      const stepEl = ld.querySelector('.sdl-step'), bar = ld.querySelector('.sdl-bar i');
      ld.querySelector('.sdl-tip').textContent = 'Mẹo: ' + TIPS[Math.floor(Math.random() * TIPS.length)];
      stepEl.textContent = steps[0];
      ld.classList.remove('up');
      bar.style.transition = 'none'; bar.style.width = '0%';
      ld.hidden = false; el.hidden = true; root.classList.add('sdm-on');
      void bar.offsetWidth;
      bar.style.transition = 'width .35s ease';
      const t0 = performance.now();
      const step = (i, frac) => { stepEl.textContent = steps[Math.min(i, steps.length - 2)]; bar.style.width = Math.round(frac * 92) + '%'; };
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
      try { await task(step); } catch (e) { stepEl.textContent = 'Không tải được: ' + (e.message || e); throw e; }
      const left = minMs - (performance.now() - t0);
      if (left > 0) await new Promise((r) => setTimeout(r, left));
      stepEl.textContent = steps[steps.length - 1]; bar.style.width = '100%';
      await new Promise((r) => setTimeout(r, 250));
      ld.classList.add('up');
      await new Promise((r) => {
        let done = false;
        const fin = () => { if (done) return; done = true; ld.hidden = true; ld.classList.remove('up'); root.classList.remove('sdm-on'); r(); };
        ld.addEventListener('transitionend', function h(e) { if (e.target !== ld) return; ld.removeEventListener('transitionend', h); fin(); });
        setTimeout(fin, 1400);
      });
    },
  };
}
