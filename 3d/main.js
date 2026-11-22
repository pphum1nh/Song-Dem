import * as THREE from 'three';
import { RoomEnvironment } from './vendor/addons/RoomEnvironment.js';
import { GameClock } from './clock.js';
import { Input } from './input.js';
import { loadGLTF } from './gltf-load.js';
import { buildWorld, groundHeight, LIMIT, PITCH } from './world.js';
import { createSky } from './sky.js';
import { Player } from './player.js';
import { createLife } from './life.js';
import { CHARACTERS, preload } from './character.js';
import { createMenu } from './menu.js';
import { createPhone, fmt } from './phone.js';
import { buildInterior } from './interior.js';
import { BANK } from './world.js';

const SAVE_KEY = 'songdem3d.v2';
const $ = (id) => document.getElementById(id);

// ---------- Renderer / scene ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x2b1340, 55, 190);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 700);
// Môi trường phản chiếu để vàng và kính trông thật (tạo một lần lúc tải)
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 68 : 58; // dọc trên điện thoại thì mở rộng góc nhìn
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- Camera ----------
const cam = { yaw: 0, pitch: 0.42, dist: 8.5, curDist: 8.5 };
const ray = new THREE.Raycaster();
const camTarget = new THREE.Vector3();
const camWant = new THREE.Vector3();
const camDir = new THREE.Vector3();

function updateCamera(dt) {
  camTarget.set(player.position.x, player.position.y + 1.5, player.position.z);
  camDir.set(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
  ray.set(camTarget, camDir);
  ray.far = cam.dist;
  const hit = inside ? null : ray.intersectObjects(world.occluders, false)[0];
  const want = hit ? Math.max(1.6, hit.distance - 0.4) : cam.dist;
  cam.curDist = want < cam.curDist ? want : cam.curDist + (want - cam.curDist) * (1 - Math.exp(-4 * dt));
  camWant.copy(camTarget).addScaledVector(camDir, cam.curDist);
  camera.position.copy(camWant);
  camera.lookAt(camTarget);
}

// ---------- Input ----------
const input = new Input(canvas, $('joy'), $('joy-knob'));

// ---------- UI ----------
const ui = {
  time: $('clock-time'), day: $('clock-day'), icon: $('clock-icon'),
  action: $('action'), actionLabel: $('action-label'), cash: $('cash'), toast: $('toast'),
  modal: $('modal'), modalTitle: $('modal-title'), modalBody: $('modal-body'), modalActions: $('modal-actions'),
  fade: $('fade'), hint: $('hint'),
};
let modalOpen = false;
let nearby = null;

const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g></svg>';
const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>';
let iconIsMoon = null;

function setClockUI() {
  ui.time.textContent = clock.label;
  ui.day.textContent = 'Ngày ' + clock.day;
  const moon = sky.night > 0.5;
  if (moon !== iconIsMoon) { ui.icon.innerHTML = moon ? MOON : SUN; iconIsMoon = moon; }
}

// ---------- Tiền: ví (tiền mặt) và tài khoản BruhBank ----------
const money = { cash: 1000, bank: 0, log: [] };
function addLog(text, amt, bank = false) {
  money.log.unshift({ text, amt, bank, when: `Ngày ${clock.day} · ${clock.label}` });
  money.log.length = Math.min(money.log.length, 40);
}
let shownCash = null;
function setCashUI() { if (shownCash !== money.cash) { ui.cash.textContent = fmt(money.cash); shownCash = money.cash; } }
let toastTimer = 0;
function toast(t) { ui.toast.textContent = t; ui.toast.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => ui.toast.classList.remove('on'), 2600); }
const bankOpen = () => clock.minuteOfDay >= 8 * 60 && clock.minuteOfDay < 17 * 60;

function moveMoney(dir, amt, limit) {
  const from = dir === 'in' ? money.cash : money.bank;
  const v = Math.min(amt === 'all' ? from : amt, from, limit ?? Infinity);
  if (v <= 0) { toast(dir === 'in' ? 'Ví không còn tiền để gửi.' : 'Tài khoản không còn tiền để rút.'); return; }
  if (dir === 'in') { money.cash -= v; money.bank += v; addLog('Gửi tiền vào BruhBank', -v, true); toast(`Đã gửi ${fmt(v)} vào tài khoản.`); }
  else { money.cash += v; money.bank -= v; addLog('Rút tiền từ BruhBank', v, true); toast(`Đã rút ${fmt(v)} về ví.`); }
  save();
}
function bankDialog(atm) {
  const limit = atm ? 2000 : Infinity;
  const body = `Ví: ${fmt(money.cash)} · Tài khoản: ${fmt(money.bank)}.` + (atm ? ` Rút tối đa ${fmt(2000)} mỗi lần.` : ' Quầy giao dịch không giới hạn số tiền.');
  openModal(atm ? 'ATM BruhBank' : 'Quầy BruhBank', body, [
    { label: 'Gửi $100', run: () => { moveMoney('in', 100); bankDialog(atm); } },
    { label: 'Rút $100', run: () => { moveMoney('out', 100, limit); bankDialog(atm); } },
    { label: 'Gửi $500', run: () => { moveMoney('in', 500); bankDialog(atm); } },
    { label: 'Rút $500', run: () => { moveMoney('out', 500, limit); bankDialog(atm); } },
    { label: 'Gửi tất cả', run: () => { moveMoney('in', 'all'); bankDialog(atm); } },
    { label: atm ? 'Rút $2.000' : 'Rút tất cả', run: () => { moveMoney('out', 'all', limit); bankDialog(atm); } },
    { label: 'Xong', run: closeModal },
  ]);
  ui.modalActions.classList.add('grid2');
}

function openModal(title, body, actions) {
  modalOpen = true;
  input.setEnabled(false);
  ui.modalTitle.textContent = title;
  ui.modalBody.textContent = body;
  ui.modalActions.innerHTML = '';
  actions.forEach((a, i) => {
    const b = document.createElement('button');
    b.className = i === 0 ? 'btn primary' : 'btn';
    b.textContent = a.label;
    b.addEventListener('click', a.run);
    ui.modalActions.appendChild(b);
  });
  ui.modalActions.classList.remove('grid2');
  ui.modal.hidden = false;
  ui.modalActions.firstChild?.focus();
}
function closeModal() {
  modalOpen = false;
  ui.modal.hidden = true;
  input.setEnabled(true);
}
function fadeThen(fn) {
  ui.fade.classList.add('on');
  setTimeout(() => { fn(); save(); setTimeout(() => ui.fade.classList.remove('on'), 120); }, 420);
}

function enter(target) {
  if (!target) return;
  if (target.id === 'house') {
    fadeThen(() => setInside(true));
  } else if (target.id === 'exit') {
    fadeThen(() => setInside(false));
  } else if (target.id === 'bed') {
    openModal('Giường ngủ', `Bây giờ là ${clock.label}, ngày ${clock.day}.`, [
      { label: 'Ngủ đến 7:00 sáng', run: () => { closeModal(); fadeThen(() => clock.advanceTo(7 * 60)); } },
      { label: 'Nghỉ 1 tiếng', run: () => { closeModal(); fadeThen(() => clock.advanceBy(60)); } },
      { label: 'Để sau', run: closeModal },
    ]);
  } else if (target.id === 'atm') {
    bankDialog(true);
  } else if (target.id === 'bank') {
    if (bankOpen()) bankDialog(false);
    else openModal('BruhBank đã đóng cửa', `Quầy giao dịch mở từ 8:00 đến 17:00. Bây giờ là ${clock.label}. ATM bên cạnh vẫn hoạt động 24/7.`, [
      { label: 'Dùng ATM', run: () => bankDialog(true) }, { label: 'Đóng', run: closeModal },
    ]);
  } else if (target.id === 'casino') {
    openModal('Sòng Đêm', `Bản thử 3D: bên trong sòng bạc sẽ được dựng ở bước tiếp theo. Bây giờ là ${clock.label}.`, [
      { label: 'Ra ngoài', run: closeModal },
    ]);
  }
}
ui.action.addEventListener('click', () => enter(nearby));
// ---------- Trong nhà / ngoài phố ----------
let inside = false;
let interior = null;
function setInside(on) {
  inside = on;
  interior.setActive(on);
  const home = world.interactables.find((i) => i.id === 'house');
  if (on) { player.position.copy(interior.spawn); player.heading = Math.PI; cam.yaw = 0; cam.pitch = 0.62; cam.dist = 7; }
  else { player.position.set(home.x, groundHeight(home.x, home.z + 0.5), home.z + 0.5); player.heading = 0; cam.yaw = 0; cam.pitch = 0.42; cam.dist = 8.5; }
  player.velocity.set(0, 0, 0); cam.curDist = cam.dist;
}

// ---------- Chỉ đường: cột sáng ở điểm đến ----------
const PLACES = [
  { id: 'house', name: 'Nhà', x: -48, z: 2.6, color: '#ffb46b' },
  { id: 'casino', name: 'Sòng Đêm', x: 0, z: 7.2, color: '#ff4fa3' },
  { id: 'bank', name: 'BruhBank', x: BANK.x, z: BANK.z - 6.5, color: '#4aa3ff' },
  { id: 'park', name: 'Công viên', x: 48, z: 0, color: '#6fdc9c' },
];
let waypoint = null;
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 60, 20, 1, true),
  new THREE.MeshBasicMaterial({ color: '#ffd36b', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
beacon.visible = false; scene.add(beacon);
function setWaypoint(id) {
  waypoint = PLACES.find((p) => p.id === id) || null;
  beacon.visible = !!waypoint;
  if (waypoint) { beacon.position.set(waypoint.x, 30, waypoint.z); beacon.material.color.set(waypoint.color); toast('Đã bật chỉ đường tới ' + waypoint.name + '.'); }
}

const phone = createPhone({
  time: () => clock.label, day: () => clock.day, money: () => money, bankOpen,
  player: () => ({ x: inside ? -48 : player.position.x, z: inside ? -4 : player.position.z, heading: player.heading }),
  places: () => PLACES, waypoint: () => waypoint?.id, setWaypoint,
  speed: () => clock.speed, toggleSpeed: () => { clock.speed = clock.speed === 1 ? 30 : 1; },
  openMenu: () => openMenu(),
  onOpen: () => { input.setEnabled(false); }, onClose: () => { if (!modalOpen) input.setEnabled(true); },
});
$('phone').addEventListener('click', () => { if (!modalOpen && !menu.open) phone.open(); });
$('jump').addEventListener('pointerdown', (e) => { e.preventDefault(); input.queueJump(); });

function pickCharacter() {
  openModal('Chọn nhân vật', 'Nhân vật: bộ "Vocations and Uniforms" (CC BY-SA). Thành phố và nội thất: KayKit City Builder Bits, Furniture Bits của Kay Lousberg (CC0).', [
    ...Object.entries(CHARACTERS).map(([key, label]) => ({
      label: (key === player.charName ? '✓ ' : '') + label,
      run: async () => { closeModal(); await player.setCharacter(key); save(); },
    })),
    { label: 'Đóng', run: closeModal },
  ]);
  ui.modalActions.classList.add('grid2');
}
$('menu').addEventListener('click', openMenu);
async function openMenu() {
  if (menu.open || modalOpen) return;
  phone.close();
  paused = true; input.setEnabled(false); save();
  const m = await menu.choose(true);
  if (m === 'new') {
    await menu.curtain('new', async (step) => { step(1, 0.6); if (inside) setInside(false); clock.totalMinutes = 21 * 60; money.cash = 1000; money.bank = 0; money.log.length = 0; setWaypoint(null); goHome(); save(); });
  } else menu.hide();
  paused = false; input.setEnabled(true);
  if (m === 'who') pickCharacter();
}
input.onAction = () => { if (modalOpen || phone.isOpen) return; enter(nearby); };
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') return;
  if (modalOpen) closeModal(); else if (!menu.open && !phone.isOpen && player) openMenu();
});

// ---------- Vòng lặp ----------
let last = performance.now();
let elapsed = 0;
const fwd = new THREE.Vector3(), right = new THREE.Vector3();

function frame(now) {
  const realDt = Math.min((now - last) / 1000, 1);
  last = now;
  const dt = Math.min(realDt, 1 / 20);
  elapsed += dt;

  if (!paused) clock.update(realDt);

  const look = input.consumeLook();
  cam.yaw -= look.dx * 0.0065;
  cam.pitch = Math.min(1.2, Math.max(0.12, cam.pitch + look.dy * 0.004));

  const mv = input.getMove();
  fwd.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
  right.set(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
  const mx = right.x * mv.x + fwd.x * mv.y;
  const mz = right.z * mv.x + fwd.z * mv.y;
  player.update(dt, elapsed, mx, mz, mv.run, world.colliders, groundHeight, inside ? Infinity : LIMIT, input.consumeJump());
  life.update(dt, elapsed, player.position, sky.night);

  sky.update(clock.minuteOfDay, player.position, inside);
  if (waypoint) {
    const d = Math.hypot(player.position.x - waypoint.x, player.position.z - waypoint.z);
    beacon.visible = !inside && d > 5;
    if (d < 5 && !inside) { toast('Đã tới ' + waypoint.name + '.'); setWaypoint(null); }
  }
  scene.environmentIntensity = 0.18 + 0.5 * (1 - sky.night);
  world.update(elapsed, sky.night);
  updateCamera(dt);

  // Điểm tương tác gần nhất
  let best = null, bestD = Infinity;
  for (const it of world.interactables) {
    if (!!it.indoor !== inside) continue;
    const d = Math.hypot(player.position.x - it.x, player.position.z - it.z);
    if (d < it.r && d < bestD) { best = it; bestD = d; }
  }
  if (best !== nearby) {
    nearby = best;
    ui.action.hidden = !best;
    if (best) ui.actionLabel.textContent = best.label;
  }

  setClockUI();
  setCashUI();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

let paused = false;
function startLoop() {
  document.body.classList.add('ready');
  requestAnimationFrame((t) => { last = t; frame(t); });
}

// Móc kiểm thử (dùng cho chụp màn hình tự động)
window.__songdem = { get inside() { return inside; }, setInside: (v) => setInside(v), money, phone: () => phone, setWaypoint: (v) => setWaypoint(v), renderer, scene, get life() { return life; }, get clock() { return clock; }, get player() { return player; }, cam, setMinute: (m) => { clock.totalMinutes = Math.floor(clock.totalMinutes / 1440) * 1440 + m; }, PITCH };

// ---------- Menu chính → rèm tải → vào game ----------
const has2D = /\/3d\/(index\.html)?$/.test(location.pathname);
let saved = null;
try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (_) {}
const charName = saved && CHARACTERS[saved.c] ? saved.c : 'Businessman';
// Bắt đầu tải ngay khi mở trang, trong lúc người chơi còn ở menu
const kitPromise = loadGLTF('assets/citykit.json');
const furnPromise = loadGLTF('assets/furniture.json');
furnPromise.catch(() => {});
const fontReady = document.fonts ? document.fonts.load('80px Bungee', 'SÒNG ĐÊM').catch(() => {}) : Promise.resolve();
preload(charName).catch(() => {});
kitPromise.catch(() => {});

let world, sky, player, clock, life;
const two = (n) => String(n).padStart(2, '0');
const summaryOf = (t) => `Ngày ${Math.floor(t / 1440) + 1} · ${two(Math.floor((t % 1440) / 60))}:${two(Math.floor(t % 60))}`;
const menu = createMenu({
  has2D,
  summary: () => (clock ? summaryOf(clock.totalMinutes) : saved && Number.isFinite(saved.t) ? summaryOf(saved.t) : ''),
});
$('loading').remove();

const first = await menu.choose();
if (first === 'new') { saved = null; try { localStorage.removeItem(SAVE_KEY); } catch (_) {} }

function goHome() {
  const home = world.interactables.find((i) => i.id === 'house');
  player.position.set(home.x, groundHeight(home.x, home.z + 2.5), home.z + 2.5);
  player.heading = 0;
  cam.yaw = 0;
}
function save() {
  if (!clock) return;
  try {
    const home = world.interactables.find((i) => i.id === 'house');
    const px = inside ? home.x : player.position.x, pz = inside ? home.z + 0.5 : player.position.z;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ t: clock.totalMinutes, x: px, z: pz, h: player.heading, c: player.charName, m: money }));
  } catch (_) {}
}

await menu.curtain(first, async (step) => {
  step(0, 0.15);
  const kit = await kitPromise;
  await fontReady;
  step(1, 0.45);
  world = buildWorld(scene, kit);
  const furn = await furnPromise;
  let kitMat; kit.scene.traverse((o) => { if (o.isMesh && !kitMat) kitMat = o.material; });
  interior = buildInterior(scene, furn, kitMat, world.colliders, world.interactables);
  sky = createSky(scene);
  clock = new GameClock(21 * 60);
  player = new Player(scene);
  await player.setCharacter(charName);
  step(2, 0.7);
  life = await createLife(scene, kit, charName);
  goHome();
  if (saved && Number.isFinite(saved.t)) {
    clock.totalMinutes = saved.t;
    if (Number.isFinite(saved.x) && Number.isFinite(saved.z)) player.position.set(saved.x, groundHeight(saved.x, saved.z), saved.z);
    if (Number.isFinite(saved.h)) player.heading = saved.h;
    if (saved.m && Number.isFinite(saved.m.cash)) { money.cash = saved.m.cash; money.bank = saved.m.bank || 0; money.log = Array.isArray(saved.m.log) ? saved.m.log : []; }
  }
  step(3, 0.9);
  startLoop();
  await new Promise((r) => setTimeout(r, 120)); // vẽ vài khung để shader biên dịch sau rèm
});
setTimeout(() => ui.hint.classList.add('gone'), 7000);
setInterval(save, 3000);
addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

