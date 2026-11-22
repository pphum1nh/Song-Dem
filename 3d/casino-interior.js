// Bên trong Sòng Đêm: sảnh kiểu "nhà búp bê" với 6 khu chơi, dựng bằng khối KayKit + nhân vật.
import * as THREE from 'three';
import { Builder, C } from './kaybuild.js';
import { createCharacter } from './character.js';

export const HALL = { x: 400, z: 0, y: 0.44, W: 28, D: 20 };

export function buildCasinoInterior(scene, kitMaterial, colliders, interactables, labelSprite) {
  const g = new THREE.Group();
  g.position.set(HALL.x, HALL.y, HALL.z);
  scene.add(g);
  const { W, D } = HALL, H = 5;
  const k = new Builder();
  // Sàn thảm caro đỏ
  for (let ix = 0; ix < 14; ix++) for (let iz = 0; iz < 10; iz++) {
    k.box(2, 0.1, 2, -W / 2 + 1 + ix * 2, -0.1, -D / 2 + 1 + iz * 2, (ix + iz) % 2 ? C.red : C.brick, { r: 0, a: 0.5, b: 0.55 });
  }
  const wall = (w, x, z, ry, cell) => k.addGeo(new THREE.PlaneGeometry(w, H), cell, { ry, x, y: H / 2, z, a: 0.45, b: 0.95 });
  wall(W, 0, -D / 2, 0, C.blue); wall(D, -W / 2, 0, Math.PI / 2, C.blue); wall(D, W / 2, 0, -Math.PI / 2, C.blue);
  wall(W / 2 - 1.5, -(W / 4 + 0.75), D / 2, Math.PI, C.blue); wall(W / 2 - 1.5, W / 4 + 0.75, D / 2, Math.PI, C.blue);
  wall(3, 0, D / 2, Math.PI, C.blue);
  // Viền vàng chân tường và đỉnh tường
  for (const y of [0, H - 0.4]) {
    k.box(W, 0.4, 0.12, 0, y, -D / 2 + 0.06, C.gold, { r: 0 });
    k.box(0.12, 0.4, D, -W / 2 + 0.06, y, 0, C.gold, { r: 0 });
    k.box(0.12, 0.4, D, W / 2 - 0.06, y, 0, C.gold, { r: 0 });
  }
  // Cột vàng trang trí
  for (const x of [-7, 7]) for (const z of [-D / 2 + 0.5]) k.box(0.8, H, 0.8, x, 0, z, C.gold, { r: 0.2 });
  // Cửa ra (nhìn từ trong)
  k.addGeo(new THREE.PlaneGeometry(2.6, 3.2), C.gold, { ry: Math.PI, x: 0, y: 1.6, z: D / 2 - 0.02 });
  k.addGeo(new THREE.PlaneGeometry(2.2, 2.9), null, { glass: true, ry: Math.PI, x: 0, y: 1.5, z: D / 2 - 0.03 });

  // ----- Bàn Blackjack (trái sau) -----
  const table = (x, z, w, d, felt = C.dgreen) => {
    k.box(w, 0.9, d, x, 0, z, C.brick, { r: 0.4 });
    k.box(w - 0.5, 0.08, d - 0.5, x, 0.9, z, felt, { r: 0.2 });
    k.box(w + 0.2, 0.14, d + 0.2, x, 0.86, z, C.brick, { r: 0.07 });
  };
  table(-8.5, -5.5, 5, 2.6);
  for (const [x, z] of [[-10.2, -5.1], [-9.1, -5.0], [-7.9, -5.0], [-6.8, -5.1]]) k.box(0.55, 0.04, 0.8, x, 1.0, z, C.white, { r: 0.02 });
  // ----- Bàn Poker (giữa) -----
  k.addGeo(new THREE.CylinderGeometry(2.9, 2.9, 0.9, 24), C.brick, { y: 0.45, z: -5.5 });
  k.addGeo(new THREE.CylinderGeometry(2.55, 2.55, 0.1, 24), C.dgreen, { y: 0.95, z: -5.5 });
  for (let i = 0; i < 5; i++) k.box(0.5, 0.04, 0.7, -1.2 + i * 0.6, 1.0, -5.5, C.white, { r: 0.02 });
  // ----- Bàn Roulette (phải sau) -----
  table(8.5, -5.5, 6, 2.6);
  k.addGeo(new THREE.CylinderGeometry(1.05, 1.2, 0.35, 24), C.gold, { x: 6.4, y: 1.0, z: -5.5 });
  // ----- Dãy máy slot (tường trái) -----
  for (let i = 0; i < 4; i++) {
    const z = -1 + i * 2.4;
    k.box(1.3, 2.3, 1.1, -W / 2 + 0.9, 0, z, C.red, { r: 0.2 });
    k.box(1.4, 0.4, 1.2, -W / 2 + 0.9, 2.3, z, C.gold, { r: 0.15 });
    k.box(0.08, 0.7, 0.85, -W / 2 + 1.56, 1.35, z, null, { glass: true, r: 0 });
    k.box(0.4, 0.15, 0.9, -W / 2 + 1.55, 0.95, z, C.gold, { r: 0.05 });
    k.box(0.7, 1.0, 0.8, -W / 2 + 2.6, 0, z, C.dgrey, { r: 0.2 });
  }
  // ----- Đua ngựa: quầy cược trước màn hình lớn (tường phải) -----
  k.box(1.2, 1.1, 5, W / 2 - 3.2, 0, 3, C.gold, { r: 0.3 });
  k.box(1.4, 0.15, 5.2, W / 2 - 3.2, 1.1, 3, C.brick, { r: 0.06 });
  // ----- Bàn xếp bài (giữa trước) -----
  k.addGeo(new THREE.CylinderGeometry(1.3, 1.3, 0.85, 18), C.brick, { x: -4, y: 0.425, z: 3.5 });
  k.addGeo(new THREE.CylinderGeometry(1.15, 1.15, 0.08, 18), C.dgreen, { x: -4, y: 0.88, z: 3.5 });
  for (let i = 0; i < 5; i++) k.box(0.35, 0.03, 0.5, -4.9 + i * 0.45, 0.93, 3.3, i % 2 ? C.white : C.blue, { r: 0.02 });
  // ----- Quầy bar (phải trước) -----
  k.box(5, 1.15, 1.2, 6, 0, 6.5, C.brick, { r: 0.25 });
  k.box(5.3, 0.15, 1.4, 6, 1.15, 6.5, C.gold, { r: 0.06 });
  for (const x of [4.2, 5.6, 7, 8.4]) { k.cyl(0.32, 0.32, 0.1, x, 0.8, 5.5, C.red); k.cyl(0.06, 0.06, 0.8, x, 0, 5.5, C.gold); }

  const mat = kitMaterial.clone(); mat.side = THREE.FrontSide;
  const shell = k.build(mat); shell.castShadow = false; g.add(shell);

  // Bánh xe roulette quay + màn hình đua ngựa + đèn chùm
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.06, 37), new THREE.MeshStandardMaterial({ color: '#6b1520', metalness: 0.3, roughness: 0.4 }));
  wheel.position.set(6.4, 1.38, -5.5); g.add(wheel);
  const spokes = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.12), new THREE.MeshStandardMaterial({ color: '#d6a743', metalness: 0.8, roughness: 0.3 }));
  spokes.position.set(6.4, 1.43, -5.5); g.add(spokes);
  const screenTex = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 288; const x = c.getContext('2d');
    x.fillStyle = '#1e5a2c'; x.fillRect(0, 0, 512, 288);
    for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#2a6e38' : '#246332'; x.fillRect(0, 30 + i * 40, 512, 40); }
    x.fillStyle = '#fff'; x.fillRect(440, 30, 6, 240);
    const cols = ['#e2b24b', '#3a3f4c', '#4aa3ff', '#ff9a3c', '#a04ad8', '#e8e8e8'];
    cols.forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.ellipse(120 + i * 45, 50 + i * 40, 22, 11, 0, 0, Math.PI * 2); x.fill(); });
    x.fillStyle = '#ffe3a1'; x.font = 'bold 26px Bungee, sans-serif'; x.fillText('ĐUA NGỰA · CHẶNG MỚI', 16, 24);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.9), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.set(W / 2 - 0.05, 2.6, 3); screen.rotation.y = -Math.PI / 2; g.add(screen);
  const bulb = new THREE.MeshBasicMaterial({ color: '#fff1c4', toneMapped: false });
  for (const [x, z] of [[-7, -2], [0, -2], [7, -2], [0, 4]]) {
    const ch = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), bulb); ch.position.set(x, H - 0.8, z); g.add(ch);
  }
  for (const [x, z, i] of [[-7, -3, 40], [0, -3, 40], [7, -3, 40], [0, 4, 30], [-10, 3, 18], [10, 3, 18]]) {
    const l = new THREE.PointLight('#ffd9a0', i, 14, 1.4); l.position.set(x, H - 1.2, z); g.add(l);
  }

  // Nhãn trên mỗi khu
  const labels = [['BLACKJACK', -8.5, -5.5], ['POKER', 0, -5.5], ['ROULETTE', 8.5, -5.5], ['SLOT', -W / 2 + 1.6, 2.6], ['ĐUA NGỰA', W / 2 - 3.2, 3], ['XẾP BÀI', -4, 3.5]];
  for (const [t, x, z] of labels) { const s = labelSprite(t, '#ffe3a1'); s.scale.set(5, 1.25, 1); s.position.set(x, 3.4, z); g.add(s); }

  // Va chạm (toạ độ thế giới)
  const bx = (x0, x1, z0, z1) => colliders.push({ minX: HALL.x + x0, maxX: HALL.x + x1, minZ: HALL.z + z0, maxZ: HALL.z + z1 });
  bx(-W / 2 - 1, W / 2 + 1, -D / 2 - 1, -D / 2 + 0.2); bx(-W / 2 - 1, -W / 2 + 0.2, -D / 2, D / 2); bx(W / 2 - 0.2, W / 2 + 1, -D / 2, D / 2);
  bx(-W / 2 - 1, -1.3, D / 2 - 0.2, D / 2 + 1); bx(1.3, W / 2 + 1, D / 2 - 0.2, D / 2 + 1); bx(-1.3, 1.3, D / 2 + 0.4, D / 2 + 1);
  bx(-11.1, -5.9, -6.9, -4.1); bx(-2.9, 2.9, -8.4, -2.6); bx(5.4, 11.6, -6.9, -4.1);
  bx(-W / 2, -W / 2 + 3.1, -1.6, 7.5); bx(W / 2 - 3.9, W / 2, 0.4, 5.6); bx(-5.3, -2.7, 2.2, 4.8); bx(3.4, 8.6, 5.8, 7.2);
  const I = (id, x, z, label, r = 1.8) => interactables.push({ id, x: HALL.x + x, z: HALL.z + z, r, label, room: 'casino' });
  I('g-bj', -8.5, -3.4, 'Chơi Blackjack'); I('g-pk', 0, -2.0, 'Chơi Poker'); I('g-rl', 8.5, -3.4, 'Chơi Roulette');
  I('g-sl', -W / 2 + 3.8, 2.6, 'Chơi máy slot', 2.2); I('g-hr', W / 2 - 4.6, 3, 'Cược đua ngựa', 2.2); I('g-so', -4, 5.6, 'Xếp bài Vegas');
  I('exit-casino', 0, D / 2 - 0.9, 'Ra phố', 1.5);

  // Nhân viên và khách (tải sau, không chặn)
  const people = [['Businesswoman', -8.5, -7.3, 0], ['StudentF', 0, -8.9, 0], ['Police', 2.9, -5.5, -Math.PI / 2], ['BaseMale', -2.9, -5.5, Math.PI / 2], ['Police', 0, 8.2, Math.PI], ['Nurse', 8.5, -7.3, 0]];
  for (const [n, x, z, ry] of people) createCharacter(n).then((c) => { c.animate(0, 0, 0, 0); c.object.position.set(x, 0, z); c.object.rotation.y = ry; g.add(c.object); }).catch(() => {});

  g.visible = false;
  let lightsOn = false;
  return {
    group: g,
    spawn: new THREE.Vector3(HALL.x, HALL.y, HALL.z + D / 2 - 2),
    setActive(on) { g.visible = on; lightsOn = on; },
    update(t) { if (lightsOn) { wheel.rotation.y = t * 1.5; spokes.rotation.y = t * 1.5; } },
  };
}
