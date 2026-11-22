import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { GameClock } from './clock.js';
import { Input } from './input.js';
import { buildWorld, groundHeight, LIMIT, PITCH } from './world.js';
import { createSky } from './sky.js';
import { Player } from './player.js';

const SAVE_KEY = 'songdem3d.v1';
const $ = (id) => document.getElementById(id);

// ---------- Renderer / scene ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x2b1340, 60, 250);
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

const world = buildWorld(scene);
const sky = createSky(scene);
const player = new Player(scene);
const clock = new GameClock(21 * 60);

// ---------- Lưu / tải ----------
const home = world.interactables.find((i) => i.id === 'house');
player.position.set(home.x, 0.25, home.z + 2.5);
player.heading = 0;
try {
  const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  if (s && Number.isFinite(s.t)) {
    clock.totalMinutes = s.t;
    if (Number.isFinite(s.x) && Number.isFinite(s.z)) player.position.set(s.x, groundHeight(s.x, s.z), s.z);
    if (Number.isFinite(s.h)) player.heading = s.h;
  }
} catch (_) {}
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ t: clock.totalMinutes, x: player.position.x, z: player.position.z, h: player.heading }));
  } catch (_) {}
}
setInterval(save, 3000);
addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

// ---------- Camera ----------
const cam = { yaw: 0, pitch: 0.5, dist: 12, curDist: 12 };
const ray = new THREE.Raycaster();
const camTarget = new THREE.Vector3();
const camWant = new THREE.Vector3();
const camDir = new THREE.Vector3();

function updateCamera(dt) {
  camTarget.set(player.position.x, player.position.y + 1.5, player.position.z);
  camDir.set(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
  ray.set(camTarget, camDir);
  ray.far = cam.dist;
  const hit = ray.intersectObjects(world.occluders, false)[0];
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
  speed: $('speed'), action: $('action'), actionLabel: $('action-label'),
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

ui.speed.addEventListener('click', () => {
  clock.speed = clock.speed === 1 ? 30 : 1;
  ui.speed.textContent = '×' + clock.speed;
  ui.speed.setAttribute('aria-pressed', String(clock.speed !== 1));
});

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
    openModal('Nhà của bạn', `Bây giờ là ${clock.label}, ngày ${clock.day}.`, [
      { label: 'Ngủ đến 7:00 sáng', run: () => { closeModal(); fadeThen(() => clock.advanceTo(7 * 60)); } },
      { label: 'Nghỉ 1 tiếng', run: () => { closeModal(); fadeThen(() => clock.advanceBy(60)); } },
      { label: 'Ra ngoài', run: closeModal },
    ]);
  } else if (target.id === 'casino') {
    openModal('Sòng Đêm', `Bản thử 3D: bên trong sòng bạc sẽ được dựng ở bước tiếp theo. Bây giờ là ${clock.label}.`, [
      { label: 'Ra ngoài', run: closeModal },
    ]);
  }
}
ui.action.addEventListener('click', () => enter(nearby));
input.onAction = () => { if (modalOpen) return; enter(nearby); };
addEventListener('keydown', (e) => { if (e.code === 'Escape' && modalOpen) closeModal(); });

setTimeout(() => ui.hint.classList.add('gone'), 7000);

// ---------- Vòng lặp ----------
let last = performance.now();
let elapsed = 0;
const fwd = new THREE.Vector3(), right = new THREE.Vector3();

function frame(now) {
  const realDt = Math.min((now - last) / 1000, 1);
  last = now;
  const dt = Math.min(realDt, 1 / 20);
  elapsed += dt;

  clock.update(realDt);

  const look = input.consumeLook();
  cam.yaw -= look.dx * 0.0065;
  cam.pitch = Math.min(1.2, Math.max(0.12, cam.pitch + look.dy * 0.004));

  const mv = input.getMove();
  fwd.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
  right.set(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
  const mx = right.x * mv.x + fwd.x * mv.y;
  const mz = right.z * mv.x + fwd.z * mv.y;
  player.update(dt, mx, mz, mv.run, world.colliders, groundHeight, LIMIT);

  sky.update(clock.minuteOfDay, player.position);
  scene.environmentIntensity = 0.18 + 0.5 * (1 - sky.night);
  world.update(elapsed, sky.night);
  updateCamera(dt);

  // Điểm tương tác gần nhất
  let best = null, bestD = Infinity;
  for (const it of world.interactables) {
    const d = Math.hypot(player.position.x - it.x, player.position.z - it.z);
    if (d < it.r && d < bestD) { best = it; bestD = d; }
  }
  if (best !== nearby) {
    nearby = best;
    ui.action.hidden = !best;
    if (best) ui.actionLabel.textContent = best.label;
  }

  setClockUI();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

document.body.classList.add('ready');
requestAnimationFrame((t) => { last = t; frame(t); });

// Móc kiểm thử (dùng cho chụp màn hình tự động)
window.__songdem = { renderer, clock, player, cam, setMinute: (m) => { clock.totalMinutes = Math.floor(clock.totalMinutes / 1440) * 1440 + m; }, PITCH };
