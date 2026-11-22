// Thành phố dựng từ bộ KayKit City Builder Bits (CC0, Kay Lousberg) trên lưới ô 12 m.
// Sòng Đêm, nhà và đài phun nước vẫn là mô hình tự dựng.
import * as THREE from 'three';
import { buildCasinoKay, casinoLights, buildBankKay, buildTownhouse, HOUSE_STYLES, buildMarket, treeGeometry } from './kaybuild.js';

export const S = 6;                       // 1 đơn vị KayKit = 6 m (một ô 2×2 = 12 m)
export const TILE = 12, BLOCK = 36, ROAD = 12, PITCH = BLOCK + ROAD, GRID = 1; // 3×3 khối đi lại được
export const SIDEWALK = 0.6, ROADY = 0.44;
export const LIMIT = (GRID + 0.5) * PITCH + ROAD / 2 - 1;
const RING = GRID + 1;                    // vòng khối nhà phía ngoài, chỉ để nhìn

export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bậc thềm/hiên đứng lên được: {minX,maxX,minZ,maxZ,y}
export const platforms = [];
export const BANK = { x: 0, z: PITCH - TILE, i: 0, j: 1, tx: 0, tz: -1 };

export function groundHeight(x, z) {
  for (const p of platforms) if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) return p.y;
  const i = Math.round(x / PITCH), j = Math.round(z / PITCH);
  if (Math.abs(i) > GRID || Math.abs(j) > GRID) return ROADY;
  const e = BLOCK / 2 + 0.6;
  return Math.abs(x - i * PITCH) <= e && Math.abs(z - j * PITCH) <= e ? SIDEWALK : ROADY;
}

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function radialTex(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return canvasTex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}

export function labelSprite(text, color = '#ffffff', bg = 'rgba(20,10,24,.82)') {
  const tex = canvasTex(512, 128, (g, w) => {
    g.font = '800 64px -apple-system, "Segoe UI", Roboto, sans-serif';
    const tw = g.measureText(text).width + 64;
    g.fillStyle = bg;
    g.beginPath(); g.roundRect((w - tw) / 2, 20, tw, 88, 44); g.fill();
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, 66);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(8, 2, 1);
  return s;
}

// Biển chữ neon dùng font Bungee của bản 2D
function signTexture(text, w, h, size, fill = '#ffe3a1', glow = '#ff3d9a') {
  return canvasTex(w, h, (g) => {
    g.font = `${size}px Bungee, "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = glow; g.shadowBlur = 34; g.fillStyle = fill; g.fillText(text, w / 2, h / 2 + 6);
    g.shadowBlur = 10; g.fillText(text, w / 2, h / 2 + 6);
  });
}
function bladeTexture(text) {
  return canvasTex(160, 1100, (g) => {
    g.font = '96px Bungee, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ffcf5a'; g.shadowBlur = 20; g.fillStyle = '#fff3c9';
    text.split('').forEach((ch, i) => g.fillText(ch, 80, 120 + i * 170));
  });
}

// Mặt nạ phát sáng: chỉ vùng kính cửa sổ của bảng màu KayKit (góc dưới trái, ô 48/49/56/57).
function windowMask(color) {
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, h * 0.75, 0, h);
    gr.addColorStop(0, color); gr.addColorStop(1, '#6b4a2a');
    g.fillStyle = gr; g.fillRect(0, h * 0.75, w * 0.25, h * 0.25);
  });
  t.flipY = false;
  return t;
}

// Gom một mô hình trong bộ kit thành danh sách {geometry, material} đã nướng sẵn biến đổi cục bộ.
function partsOf(kit, name) {
  const root = kit.getObjectByName(name);
  if (!root) throw new Error('Thiếu mô hình ' + name);
  // Mô hình đã nén (KHR_mesh_quantization): toạ độ là số nguyên chuẩn hoá, còn tỉ lệ và độ lệch
  // nằm trong biến đổi của node. Phải giữ nguyên biến đổi đó và đổi dữ liệu sang số thực trước khi nướng,
  // nếu không toà nhà sẽ bị lún nửa xuống đất và bị cắt giá trị.
  kit.updateMatrixWorld(true);
  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    for (const key of ['position', 'normal', 'uv']) {
      const a = g.getAttribute(key);
      if (!a || a.array instanceof Float32Array) continue;
      const f = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
      g.setAttribute(key, new THREE.BufferAttribute(f, a.itemSize));
    }
    g.applyMatrix4(o.matrixWorld);
    parts.push({ geometry: g, material: o.material });
  });
  return parts;
}

export function buildWorld(scene, kitGltf) {
  const kit = kitGltf.scene;
  const colliders = [];
  const occluders = [];
  const interactables = [];
  const windowMats = [];
  const updaters = [];
  const rnd = seeded(20251122);
  platforms.length = 0;
  const box = (minX, maxX, minZ, maxZ) => colliders.push({ minX, maxX, minZ, maxZ });

  // Vật liệu gốc của KayKit: một texture bảng màu dùng chung
  let kitMat = null;
  kit.traverse((o) => { if (o.isMesh && !kitMat) kitMat = o.material; });
  kitMat.metalness = 0; kitMat.roughness = 0.85;
  const litWarm = kitMat.clone(); litWarm.emissive = new THREE.Color('#ffffff'); litWarm.emissiveMap = windowMask('#ffcf86');
  const litCool = kitMat.clone(); litCool.emissive = new THREE.Color('#ffffff'); litCool.emissiveMap = windowMask('#cfe4ff');
  windowMats.push({ mat: litWarm, day: 0, night: 1.6 }, { mat: litCool, day: 0, night: 1.3 });

  // Bộ đệm instancing: name -> [matrix]
  const batches = new Map();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  function place(name, x, y, z, rotY = 0, scale = S, variant = '') {
    const key = name + '|' + variant;
    if (!batches.has(key)) batches.set(key, { name, variant, list: [] });
    q.setFromAxisAngle(yAxis, rotY);
    batches.get(key).list.push(new THREE.Matrix4().compose(p.set(x, y, z), q, new THREE.Vector3(scale, scale, scale)));
  }
  const kitBox = (name) => new THREE.Box3().setFromObject(kit.getObjectByName(name));

  // Va chạm cho một mô hình đặt xoay bội số 90°
  function footprint(name, x, z, rotY, shrink = 0) {
    const b = kitBox(name);
    const pts = [[b.min.x, b.min.z], [b.max.x, b.min.z], [b.min.x, b.max.z], [b.max.x, b.max.z]].map(([lx, lz]) => {
      const c = Math.cos(rotY), s = Math.sin(rotY);
      return [x + (lx * c + lz * s) * S, z + (-lx * s + lz * c) * S];
    });
    const xs = pts.map((v) => v[0]), zs = pts.map((v) => v[1]);
    box(Math.min(...xs) + shrink, Math.max(...xs) - shrink, Math.min(...zs) + shrink, Math.max(...zs) - shrink);
    return b;
  }

  // Mặt đất bên ngoài
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ color: '#5f9a4c', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0.05;
  scene.add(ground);

  // ---------- Đường ----------
  const lines = [];
  for (let k = -GRID - 1; k <= GRID; k++) lines.push((k + 0.5) * PITCH);
  const edge = lines[lines.length - 1];
  const isLine = (v) => lines.some((l) => Math.abs(l - v) < 0.01);
  const nearCasinoCross = (x, z) => [[-24, -24], [24, -24], [-24, 24], [24, 24]].some(([a, b]) => Math.hypot(x - a, z - b) < 13);
  for (let gx = -edge; gx <= edge + 0.01; gx += TILE) {
    for (let gz = -edge; gz <= edge + 0.01; gz += TILE) {
      const onX = isLine(gx), onZ = isLine(gz); // onX: đường dọc trục Z tại x = gx
      if (!onX && !onZ) continue;
      if (onX && onZ) {
        const ex = Math.abs(Math.abs(gx) - edge) < 0.01, ez = Math.abs(Math.abs(gz) - edge) < 0.01;
        if (ex && ez) {
          const rot = gx < 0 ? (gz < 0 ? 0 : Math.PI / 2) : (gz < 0 ? -Math.PI / 2 : Math.PI);
          place('road_corner', gx, 0, gz, rot);
        } else if (ex) place('road_tsplit', gx, 0, gz, gx < 0 ? 0 : Math.PI);
        else if (ez) place('road_tsplit', gx, 0, gz, gz < 0 ? -Math.PI / 2 : Math.PI / 2);
        else place('road_junction', gx, 0, gz, 0);
      } else {
        const kind = nearCasinoCross(gx, gz) ? 'road_straight_crossing' : 'road_straight';
        place(kind, gx, 0, gz, onX ? 0 : Math.PI / 2);
      }
    }
  }

  // ---------- Khối nhà ----------
  const narrow = ['building_A_withoutBase', 'building_B_withoutBase', 'building_C_withoutBase', 'building_D_withoutBase'];
  const all = [...narrow, 'building_E_withoutBase', 'building_F_withoutBase', 'building_G_withoutBase', 'building_H_withoutBase'];
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const lampSpots = [];
  // Loại khu của từng khối 3×3 ô
  const BLOCK_TYPE = { '0,0': 'casino', '-1,0': 'res', '-1,-1': 'res', '1,0': 'park', '1,1': 'market' };
  const typeOf = (i, j) => BLOCK_TYPE[`${i},${j}`] || 'city';
  const special = (i, j) => typeOf(i, j) !== 'city';
  const trees = []; // [x, z, scale, kind]

  function addBuilding(name, x, z, rot, collide) {
    const variant = rnd() < 0.62 ? 'warm' : rnd() < 0.5 ? 'cool' : 'off';
    place(name, x, 0, z, rot, S, variant);
    const b = collide ? footprint(name, x, z, rot, 0.05) : kitBox(name);
    if (rnd() < 0.18) {
      const c = Math.cos(rot), s = Math.sin(rot);
      const ox = (rnd() - 0.5) * 0.4, oz = -0.2;
      place('watertower', x + (ox * c + oz * s) * S, b.max.y * S, z + (-ox * s + oz * c) * S, rnd() * 6, S * 0.9);
    }
  }

  for (let i = -RING; i <= RING; i++) for (let j = -RING; j <= RING; j++) {
    const cx = i * PITCH, cz = j * PITCH;
    const ring = Math.abs(i) > GRID || Math.abs(j) > GRID;
    for (let tx = -1; tx <= 1; tx++) for (let tz = -1; tz <= 1; tz++) {
      const x = cx + tx * TILE, z = cz + tz * TILE;
      if (!ring) place('base', x, 0, z);
      if (special(i, j)) continue;
      if (i === BANK.i && j === BANK.j && tx === BANK.tx && tz === BANK.tz) continue;
      if (tx === 0 && tz === 0) {
        if (ring) continue;
        // Sân trong: thùng rác, hộp, bụi cây
        place('dumpster', x - 2, SIDEWALK, z + 1, rnd() * 0.4);
        box(x - 3.8, x - 0.2, z - 0.1, z + 2.1);
        place('box_A', x + 2, SIDEWALK, z - 1.5, rnd()); place('box_B', x + 2.9, SIDEWALK, z - 0.8, rnd());
        place('bush', x + 3, SIDEWALK, z + 3, 0, S * 1.1);
        continue;
      }
      const corner = tx !== 0 && tz !== 0;
      const nx = corner ? 0 : tx, nz = corner ? tz : tz;
      // Khối ngoài cùng chỉ dựng các ô nhìn vào thành phố
      if (ring) {
        // Chỉ dựng dãy nhà nhìn vào thành phố (bỏ các khối ở góc chéo)
        if (Math.abs(i) > GRID && Math.abs(j) > GRID) continue;
        const inX = Math.abs(i) > GRID, sx = -Math.sign(i), sz = -Math.sign(j);
        if (inX ? tx !== sx : tz !== sz) continue;
        const rot = inX ? Math.atan2(sx, 0) : Math.atan2(0, sz);
        place('base', x, 0, z);
        addBuilding(pick(all), x, z, rot, false);
        continue;
      }
      const rot = Math.atan2(nx, nz);
      addBuilding(corner ? pick(narrow) : pick(all), x, z, rot, true);
    }
    if (ring) continue;
    // Đèn đường: 2 cột mỗi cạnh khối, cần đèn vươn ra đường
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (const off of [-TILE / 2, TILE / 2]) {
        const lx = cx + nx * (BLOCK / 2 - 0.2) + (nz !== 0 ? off : 0);
        const lz = cz + nz * (BLOCK / 2 - 0.2) + (nx !== 0 ? off : 0);
        lampSpots.push([lx, lz, Math.atan2(nz, -nx), nx, nz]);
      }
    }
    // Trụ cứu hỏa và ghế dài trước nhà
    if (!special(i, j)) {
      place('firehydrant', cx + BLOCK / 2 - 0.35, SIDEWALK, cz + BLOCK / 2 - 3.5, 0);
      if (rnd() < 0.6) place('trash_A', cx + 4, SIDEWALK, cz - BLOCK / 2 + 0.35, 0);
    }
  }

  // Đèn giao thông ở hai góc mỗi ngã tư trong thành phố
  for (const x of lines) for (const z of lines) {
    if (Math.abs(x) >= edge - 0.01 || Math.abs(z) >= edge - 0.01) continue;
    place('trafficlight_B', x + ROAD / 2 + 0.4, SIDEWALK, z + ROAD / 2 + 0.4, Math.PI / 2);
    place('trafficlight_B', x - ROAD / 2 - 0.4, SIDEWALK, z - ROAD / 2 - 0.4, -Math.PI / 2);
  }

  for (const [lx, lz, rot] of lampSpots) place('streetlight', lx, SIDEWALK, lz, rot);

  // Xe đỗ ven đường
  const parked = [];
  const carNames = ['car_sedan', 'car_hatchback', 'car_stationwagon', 'car_taxi'];
  for (const x of lines) {
    if (Math.abs(x) >= edge - 0.01) continue;
    for (let z = -edge + TILE; z < edge; z += TILE) {
      if (isLine(z) || rnd() > 0.22 || nearCasinoCross(x, z)) continue;
      const side = rnd() < 0.5 ? -1 : 1;
      const px = x + side * 4.4, pz = z + (rnd() - 0.5) * 3;
      place(pick(carNames), px, ROADY + 0.42, pz, side > 0 ? 0 : Math.PI);
      box(px - 1.4, px + 1.4, pz - 2.9, pz + 2.9);
      parked.push([px, pz]);
    }
  }

  // ---------- SÒNG ĐÊM (kiểu KayKit) ----------
  {
    const cx = 0, cz = -5;
    const c = buildCasinoKay(litWarm);
    c.mesh.position.set(cx, SIDEWALK, cz); scene.add(c.mesh); occluders.push(c.mesh);
    const lights = casinoLights(c, signTexture('SÒNG ĐÊM', 1024, 200, 150), bladeTexture('CASINO'));
    lights.group.position.copy(c.mesh.position); scene.add(lights.group);
    const { W, D, top } = c, fz = cz + D / 2;
    box(cx - W / 2, cx + W / 2, cz - D / 2, cz + D / 2);
    box(cx - W / 2 - 2.4, cx - W / 2, fz + 0.2, fz + 0.9);                // biển dọc CASINO
    for (const x of [-6, 6]) box(cx + x - 0.5, cx + x + 0.5, fz + 4.9, fz + 5.9); // cột mái che
    for (const x of [-8.5, 8.5]) box(cx + x - 0.95, cx + x + 0.95, fz + 6.6, fz + 8.4); // chậu cây
    for (const x of [-2.7, 2.7]) box(cx + x - 0.15, cx + x + 0.15, fz + 2.9, fz + 10.6); // dây chắn
    platforms.push({ minX: cx - 5, maxX: cx + 5, minZ: fz + 0.4, maxZ: fz + 2.4, y: SIDEWALK + 0.25 });
    interactables.push({ id: 'casino', x: cx, z: fz + 2.2, r: 3.2, label: 'Vào Sòng Đêm' });
    const coinMat = new THREE.MeshStandardMaterial({ color: '#e2b24b', metalness: 0.6, roughness: 0.35, emissive: '#ffcf5a', emissiveIntensity: 0.3 });
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.55, 36), coinMat);
    coin.rotation.x = Math.PI / 2;
    const pivot = new THREE.Group(); pivot.position.set(cx, SIDEWALK + top + 10.8, cz - 1); pivot.add(coin); scene.add(pivot);
    const lamp = new THREE.PointLight('#ffd28a', 0, 26, 1.6); lamp.position.set(cx, SIDEWALK + 4.2, fz + 4); scene.add(lamp);
    updaters.push((t, night) => {
      pivot.rotation.y = t * 0.9;
      const flick = 0.9 + 0.1 * Math.sin(t * 3.1) * Math.sin(t * 7.3);
      lights.bulbMat.color.setRGB(1, 0.9, 0.65).multiplyScalar(0.55 + 0.75 * night * (0.85 + 0.15 * Math.sin(t * 9)));
      for (const m of lights.signs) m.opacity = (0.75 + 0.25 * night) * flick;
      lamp.intensity = 90 * night;
    });
  }

  // ---------- KHU DÂN CƯ (nhà người chơi là một căn trong đó) ----------
  const grassMat = new THREE.MeshStandardMaterial({ color: '#5a8f45', roughness: 1 });
  for (const [i, j] of [[-1, 0], [-1, -1]]) {
    const cx = i * PITCH, cz = j * PITCH;
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(BLOCK - 3.4, 0.05, BLOCK - 3.4), grassMat);
    lawn.position.set(cx, SIDEWALK + 0.02, cz); scene.add(lawn);
    let n = 0;
    for (let tx = -1; tx <= 1; tx++) for (let tz = -1; tz <= 1; tz++) {
      const x = cx + tx * TILE, z = cz + tz * TILE;
      if (tx === 0 && tz === 0) {
        for (const [ox, oz] of [[-3, -3], [3, -2.5], [-2.5, 3], [3.2, 3.4]]) trees.push([x + ox, z + oz, 0.9 + rnd() * 0.4, rnd() < 0.6 ? 0 : 1]);
        place('bench', x, SIDEWALK, z, Math.PI / 2);
        continue;
      }
      const corner = tx !== 0 && tz !== 0;
      const nx = corner ? 0 : tx, nz = tz;
      const rot = Math.atan2(nx, nz);
      const isPlayer = i === -1 && j === 0 && tx === 1 && tz === 0;
      const style = isPlayer ? HOUSE_STYLES[0] : HOUSE_STYLES[1 + ((n + (j + 2) * 3) % (HOUSE_STYLES.length - 1))];
      const hx = x - nx * 1.4, hz = z - nz * 1.4;
      const h = buildTownhouse(litWarm, style, n + (isPlayer ? 1 : 0));
      h.mesh.position.set(hx, SIDEWALK, hz); h.mesh.rotation.y = rot;
      scene.add(h.mesh); occluders.push(h.mesh);
      const along = nx !== 0;
      const hw = (along ? h.D : h.W) / 2, hd = (along ? h.W : h.D) / 2;
      box(hx - hw, hx + hw, hz - hd, hz + hd);
      // Cây ở góc sân trước
      const tX = nz, tZ = -nx; // hướng dọc theo mặt phố
      if (!corner) trees.push([x + nx * 3.6 + tX * 4.6, z + nz * 3.6 + tZ * 4.6, 0.8 + rnd() * 0.3, 0]);
      if (isPlayer) {
        const c = Math.cos(rot), sn = Math.sin(rot);
        const lx = h.doorX, lz = h.D / 2 + 1.5;
        const dx = hx + lx * c + lz * sn, dz = hz - lx * sn + lz * c;
        interactables.push({ id: 'house', x: dx, z: dz, r: 2.2, label: 'Vào nhà', spawnX: dx + nx * 1.2, spawnZ: dz + nz * 1.2, heading: rot });
        const label = labelSprite('NHÀ', '#ffe2a8');
        label.position.set(hx, SIDEWALK + 11.5, hz); scene.add(label);
      }
      n++;
    }
  }

  // ---------- SIÊU THỊ + BÃI ĐỖ XE ----------
  {
    const cx = PITCH, cz = PITCH;
    const m = buildMarket(litWarm);
    const sz = cz + BLOCK / 2 - m.D / 2 - 1.6;
    m.mesh.position.set(cx, SIDEWALK, sz); m.mesh.rotation.y = Math.PI; scene.add(m.mesh); occluders.push(m.mesh);
    box(cx - m.W / 2, cx + m.W / 2, sz - m.D / 2, sz + m.D / 2);
    const lot = new THREE.Mesh(new THREE.BoxGeometry(BLOCK - 3, 0.04, 18), new THREE.MeshStandardMaterial({ color: '#4a4a52', roughness: 0.95 }));
    lot.position.set(cx, SIDEWALK + 0.02, cz - 6.5); scene.add(lot);
    const lineMat = new THREE.MeshBasicMaterial({ color: '#e8e8e8' });
    const lines = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.02, 4.8), lineMat, 40);
    let li = 0;
    const carNames2 = ['car_sedan', 'car_hatchback', 'car_stationwagon', 'car_taxi'];
    for (const row of [-12.5, -3.5]) for (let k2 = 0; k2 < 11; k2++) {
      const x = cx - 15 + k2 * 3;
      if (li < 40) { m4.makeTranslation(x, SIDEWALK + 0.05, cz + row); lines.setMatrixAt(li++, m4); }
      if (k2 < 10 && rnd() < 0.55) {
        const px = x + 1.5, pz = cz + row;
        place(carNames2[Math.floor(rnd() * 4)], px, SIDEWALK + 0.42, pz, rnd() < 0.5 ? 0 : Math.PI);
        box(px - 1.2, px + 1.2, pz - 2.6, pz + 2.6);
      }
    }
    lines.count = li; scene.add(lines);
    interactables.push({ id: 'market', x: cx, z: sz - m.D / 2 - 1.8, r: 2.6, label: 'Vào siêu thị' });
    for (const x of [-16, 16]) trees.push([cx + x, cz + 15, 1, 0]);
  }

  // ---------- NGÂN HÀNG BRUHBANK ----------
  {
    const bx = BANK.x, bz = BANK.z;
    const bk = buildBankKay(litWarm, signTexture('BRUHBANK', 1024, 160, 120, '#ffffff', '#4aa3ff'));
    bk.mesh.position.set(bx, SIDEWALK, bz); bk.mesh.rotation.y = Math.PI; scene.add(bk.mesh); occluders.push(bk.mesh);
    scene.add(bk.sign); bk.sign.position.set(bx, SIDEWALK + bk.signY, bz - bk.signZ); bk.sign.rotation.y = Math.PI;
    box(bx - bk.W / 2, bx + bk.W / 2, bz - bk.D / 2, bz + bk.D / 2);
    for (const x of [-3.6, -1.2, 1.2, 3.6]) box(bx + x - 0.35, bx + x + 0.35, bz - bk.D / 2 - 1.9, bz - bk.D / 2 - 1.3);
    platforms.push({ minX: bx - 5.2, maxX: bx + 5.2, minZ: bz - bk.D / 2 - 2.6, maxZ: bz - bk.D / 2, y: SIDEWALK + 0.45 });
    box(bx + 3.75, bx + 5.05, bz - bk.D / 2 - 0.7, bz - bk.D / 2); // cây ATM
    interactables.push({ id: 'atm', x: bx + 4.4, z: bz - bk.D / 2 - 1.4, r: 1.6, label: 'Dùng ATM' });
    interactables.push({ id: 'bank', x: bx, z: bz - bk.D / 2 - 1.0, r: 1.6, label: 'Vào BruhBank' });
    updaters.push((t, night) => { bk.sign.material.opacity = 0.8 + 0.2 * night; });
  }

  // ---------- CÔNG VIÊN ----------
  {
    const cx = PITCH, cz = 0;
    const grass = new THREE.Mesh(new THREE.BoxGeometry(BLOCK - 4, 0.06, BLOCK - 4), grassMat);
    grass.position.set(cx, SIDEWALK + 0.02, cz); scene.add(grass);
    const stone = new THREE.MeshStandardMaterial({ color: '#a59d92', roughness: 0.9 });
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.3, 0.8, 32), stone);
    basin.position.set(cx, SIDEWALK + 0.4, cz); scene.add(basin);
    const waterMat = new THREE.MeshStandardMaterial({ color: '#2d6f9a', emissive: '#3aa0d8', emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.2 });
    windowMats.push({ mat: waterMat, day: 0.05, night: 0.45 });
    const water = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.1, 32), waterMat);
    water.position.set(cx, SIDEWALK + 0.72, cz); scene.add(water);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 12), stone);
    spout.position.set(cx, SIDEWALK + 1.5, cz); scene.add(spout);
    box(cx - 4.2, cx + 4.2, cz - 4.2, cz + 4.2);
    for (const [ox, oz] of [[-14, -14], [14, -14], [-14, 14], [14, 14], [0, -15], [0, 15], [-15, 0], [15, 0]]) { trees.push([cx + ox, cz + oz, 1.1 + rnd() * 0.4, rnd() < 0.5 ? 0 : 1]); box(cx + ox - 0.4, cx + ox + 0.4, cz + oz - 0.4, cz + oz + 0.4); }
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const x = cx + Math.cos(a) * 12, z = cz + Math.sin(a) * 12;
      if (k % 3 === 0) { place('bench', x * 0.7 + cx * 0.3, SIDEWALK, z * 0.7 + cz * 0.3, -a + Math.PI / 2); continue; }
      place('bush', x, SIDEWALK, z, rnd() * 6, S * (1.4 + rnd() * 0.5));
      box(x - 0.6, x + 0.6, z - 0.6, z + 0.6);
    }
  }

  // Cây ngoài rìa thành phố (trên nền cỏ) và dựng tất cả cây bằng instancing
  for (let k2 = 0; k2 < 90; k2++) {
    const a = rnd() * Math.PI * 2, rad = 150 + rnd() * 70;
    trees.push([Math.cos(a) * rad, Math.sin(a) * rad, 1.4 + rnd() * 1.2, rnd() < 0.7 ? 0 : 1]);
  }
  for (const kind of [0, 1]) {
    const list = trees.filter((t) => t[3] === kind);
    const im = new THREE.InstancedMesh(treeGeometry(kind), kitMat, list.length);
    list.forEach(([x, z, sc], k2) => {
      const y = Math.hypot(x, z) > 130 ? 0.05 : SIDEWALK;
      m4.compose(p.set(x, y, z), q.setFromAxisAngle(yAxis, k2), new THREE.Vector3(sc, sc, sc)); im.setMatrixAt(k2, m4);
    });
    scene.add(im);
  }

  // ---------- Dựng InstancedMesh cho mọi thứ đã đặt ----------
  const partCache = new Map();
  for (const { name, variant, list } of batches.values()) {
    if (!partCache.has(name)) partCache.set(name, partsOf(kit, name));
    for (const part of partCache.get(name)) {
      const mat = variant === 'warm' ? litWarm : variant === 'cool' ? litCool : part.material;
      const im = new THREE.InstancedMesh(part.geometry, mat, list.length);
      list.forEach((mm, k) => im.setMatrixAt(k, mm));
      im.computeBoundingSphere();
      scene.add(im);
      if (name.startsWith('building')) occluders.push(im);
    }
  }

  // Bóng đèn và vũng sáng dưới đèn đường
  {
    const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false });
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 10, 8), bulbMat, lampSpots.length);
    const poolMat = new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,200,130,0.9)', 'rgba(255,200,130,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(10, 10), poolMat, lampSpots.length);
    const e = new THREE.Euler(-Math.PI / 2, 0, 0), one = new THREE.Vector3(1, 1, 1);
    lampSpots.forEach(([x, z, , nx, nz], k) => {
      const tipX = x + nx * 1.3, tipZ = z + nz * 1.3;
      m4.makeTranslation(tipX, SIDEWALK + 5.45, tipZ); bulbs.setMatrixAt(k, m4);
      m4.compose(p.set(tipX + nx * 0.6, ROADY + 0.05, tipZ + nz * 0.6), q.setFromEuler(e), one); pools.setMatrixAt(k, m4);
    });
    pools.renderOrder = 1;
    scene.add(bulbs, pools);
    updaters.push((t, night) => {
      bulbMat.color.setRGB(1, 0.85, 0.63).multiplyScalar(0.3 + 1.0 * night);
      poolMat.opacity = 0.55 * night;
      pools.visible = night > 0.02;
    });
  }

  return {
    colliders, occluders, interactables, lines, parked, ground,
    update(t, night) {
      for (const w of windowMats) w.mat.emissiveIntensity = w.day + (w.night - w.day) * night;
      for (const u of updaters) u(t, night);
    },
  };
}
