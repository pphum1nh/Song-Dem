// Thành phố dựng từ bộ KayKit City Builder Bits (CC0, Kay Lousberg) trên lưới ô 12 m.
// Sòng Đêm, nhà và đài phun nước vẫn là mô hình tự dựng.
import * as THREE from 'three';

export const S = 6;                       // 1 đơn vị KayKit = 6 m (một ô 2×2 = 12 m)
export const TILE = 12, BLOCK = 36, ROAD = 12, PITCH = BLOCK + ROAD, GRID = 2;
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

export function groundHeight(x, z) {
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

function labelSprite(text, color = '#ffffff', bg = 'rgba(20,10,24,.82)') {
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
  root.updateMatrixWorld(true);
  // Giữ nguyên xoay/co giãn của chính mô hình gốc, chỉ bỏ phần dịch chuyển
  const toOrigin = new THREE.Matrix4().makeTranslation(-root.position.x, -root.position.y, -root.position.z);
  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toOrigin, o.matrixWorld));
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
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ color: '#3b3a42', roughness: 0.95 }));
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
  const special = (i, j) => j === 0 && i >= -1 && i <= 1;

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
        const facesIn = (Math.abs(i) > GRID && Math.sign(tx) === -Math.sign(i) && tz === 0) || (Math.abs(j) > GRID && Math.sign(tz) === -Math.sign(j) && tx === 0);
        if (!facesIn) continue;
        const rot = Math.atan2(tx, tz);
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

  // ---------- SÒNG ĐÊM ----------
  {
    const W = 30, D = 20, H = 15, cx = 0, cz = -3;
    const g = new THREE.Group(); g.position.set(cx, SIDEWALK, cz); scene.add(g);
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#4a1d52', roughness: 0.55, metalness: 0.1 });
    const goldMat = new THREE.MeshStandardMaterial({ color: '#d6a743', roughness: 0.3, metalness: 0.85, emissive: '#6a4300', emissiveIntensity: 0.5 });
    const pink = new THREE.MeshBasicMaterial({ color: '#ff2d95', toneMapped: false });
    const gold = new THREE.MeshBasicMaterial({ color: '#ffcf5a', toneMapped: false });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };

    occluders.push(add(new THREE.BoxGeometry(W, H, D), bodyMat, 0, H / 2, 0));
    add(new THREE.BoxGeometry(W - 6, 4, D - 6), bodyMat, 0, H + 2, 0);
    add(new THREE.BoxGeometry(W - 12, 3, D - 10), goldMat, 0, H + 5.5, 0);
    add(new THREE.BoxGeometry(W + 0.6, 0.6, D + 0.6), goldMat, 0, H, 0);
    add(new THREE.BoxGeometry(W + 0.4, 0.4, D + 0.4), goldMat, 0, 6, 0);
    for (const sx of [-1, 1]) {
      add(new THREE.BoxGeometry(0.3, H, 0.3), pink, sx * (W / 2 + 0.15), H / 2, D / 2 + 0.15);
      add(new THREE.BoxGeometry(0.3, H, 0.3), pink, sx * (W / 2 + 0.15), H / 2, -D / 2 - 0.15);
    }
    add(new THREE.BoxGeometry(W, 0.3, 0.3), pink, 0, H - 0.6, D / 2 + 0.2);
    add(new THREE.BoxGeometry(W, 0.25, 0.25), gold, 0, 6.5, D / 2 + 0.2);
    add(new THREE.BoxGeometry(W - 6, 0.25, 0.25), pink, 0, H + 4, (D - 6) / 2 + 0.15);

    const glassMat = new THREE.MeshStandardMaterial({ color: '#2a1838', emissive: '#c25aa8', emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.4 });
    windowMats.push({ mat: glassMat, day: 0.25, night: 0.9 });
    add(new THREE.BoxGeometry(W - 3, 1.6, 0.1), glassMat, 0, 8.2, D / 2 + 0.06);

    const signTex = canvasTex(1024, 256, (c, w, h) => {
      c.font = '900 150px -apple-system, "Segoe UI", Roboto, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = '#ff2d95'; c.shadowBlur = 40;
      c.fillStyle = '#ffd1ec'; c.fillText('SÒNG ĐÊM', w / 2, h / 2 + 8);
      c.shadowBlur = 12; c.fillText('SÒNG ĐÊM', w / 2, h / 2 + 8);
    });
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false, depthWrite: false });
    add(new THREE.PlaneGeometry(18, 4.5), signMat, 0, 11.6, D / 2 + 0.08);

    add(new THREE.PlaneGeometry(8, 4.2), new THREE.MeshBasicMaterial({ color: '#ffb347', toneMapped: false }), 0, 2.1, D / 2 + 0.03);
    add(new THREE.BoxGeometry(14, 0.45, 5.4), goldMat, 0, 5.1, D / 2 + 2.7);
    add(new THREE.PlaneGeometry(13, 4.8), new THREE.MeshBasicMaterial({ color: '#ffe2a8', toneMapped: false, side: THREE.DoubleSide }), 0, 4.86, D / 2 + 2.7).rotation.x = Math.PI / 2;
    for (const sx of [-6.4, 6.4]) {
      add(new THREE.CylinderGeometry(0.28, 0.32, 4.9, 12), goldMat, sx, 2.45, D / 2 + 5);
      box(cx + sx - 0.4, cx + sx + 0.4, cz + D / 2 + 4.6, cz + D / 2 + 5.4);
    }
    add(new THREE.PlaneGeometry(4.2, 9), new THREE.MeshStandardMaterial({ color: '#8d0f2e', roughness: 0.9 }), 0, 0.02, D / 2 + 4.5).rotation.x = -Math.PI / 2;
    for (const sx of [-1, 1]) place('bush', cx + sx * 9, SIDEWALK, cz + D / 2 + 3, 0, S * 1.1);

    const faceTex = canvasTex(256, 256, (c, w) => {
      c.fillStyle = '#e2b24b'; c.beginPath(); c.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#a8761c'; c.lineWidth = 14; c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 22, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#7a4f0c'; c.font = '900 110px -apple-system, "Segoe UI", sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SĐ', w / 2, w / 2 + 6);
    });
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, metalness: 0.7, roughness: 0.35, emissive: '#ffcf5a', emissiveMap: faceTex, emissiveIntensity: 0.35 });
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.6, 40), [goldMat, faceMat, faceMat]);
    coin.rotation.x = Math.PI / 2;
    const coinPivot = new THREE.Group(); coinPivot.position.set(0, H + 11.2, 0); coinPivot.add(coin); g.add(coinPivot);

    box(cx - W / 2, cx + W / 2, cz - D / 2, cz + D / 2);
    interactables.push({ id: 'casino', x: cx, z: cz + D / 2 + 3, r: 3.4, label: 'Vào Sòng Đêm' });
    updaters.push((t, night) => {
      coinPivot.rotation.y = t * 0.9;
      const flick = 0.88 + 0.12 * Math.sin(t * 3.1) * Math.sin(t * 7.3);
      signMat.opacity = (0.55 + 0.45 * night) * flick;
      pink.color.setRGB(1, 0.18, 0.58).multiplyScalar(0.5 + 0.7 * night);
      gold.color.setRGB(1, 0.81, 0.35).multiplyScalar(0.6 + 0.5 * night);
    });
  }

  // ---------- NHÀ ----------
  const grassMat = new THREE.MeshStandardMaterial({ color: '#4d7a3f', roughness: 1 });
  {
    const cx = -PITCH, cz = 0;
    const grass = new THREE.Mesh(new THREE.BoxGeometry(BLOCK - 2, 0.06, BLOCK - 2), grassMat);
    grass.position.set(cx, SIDEWALK + 0.02, cz); scene.add(grass);

    const W = 11, D = 8, H = 5, hz = cz - 5;
    const g = new THREE.Group(); g.position.set(cx, SIDEWALK, hz); scene.add(g);
    const wallMat = new THREE.MeshStandardMaterial({ color: '#eadcc4', roughness: 0.9 });
    const trimMat = new THREE.MeshStandardMaterial({ color: '#f7f1e6', roughness: 0.8 });
    const roofM = new THREE.MeshStandardMaterial({ color: '#b04a35', roughness: 0.8, flatShading: true });
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wallMat); body.position.y = H / 2; g.add(body);
    occluders.push(body);
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2 - 0.7, 0); shape.lineTo(W / 2 + 0.7, 0); shape.lineTo(0, 3.4); shape.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: D + 1.2, bevelEnabled: false });
    roofGeo.translate(0, 0, -(D + 1.2) / 2);
    const roof = new THREE.Mesh(roofGeo, roofM); roof.position.y = H; g.add(roof);
    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), new THREE.MeshStandardMaterial({ color: '#6d4a3d' }));
    chim.position.set(3, H + 2.3, -1.5); g.add(chim);
    const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.5, D + 0.3), trimMat); base.position.y = 0.25; g.add(base);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.12), new THREE.MeshStandardMaterial({ color: '#5a3522', roughness: 0.6 }));
    door.position.set(0, 1.4, D / 2 + 0.04); g.add(door);
    const porch = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), new THREE.MeshBasicMaterial({ color: '#ffd98a', toneMapped: false }));
    porch.position.set(1.3, 2.9, D / 2 + 0.2); g.add(porch);
    const winMat = new THREE.MeshStandardMaterial({ color: '#2b3550', emissive: '#ffcf7a', emissiveIntensity: 1, roughness: 0.2 });
    windowMats.push({ mat: winMat, day: 0, night: 1.4 });
    for (const [x, y, z, ry] of [[-3.3, 2.7, D / 2 + 0.05, 0], [3.3, 2.7, D / 2 + 0.05, 0], [W / 2 + 0.05, 2.7, 0, Math.PI / 2], [-W / 2 - 0.05, 2.7, 0, -Math.PI / 2]]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.5), winMat); w.position.set(x, y, z); w.rotation.y = ry; g.add(w);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.8), trimMat); f.position.set(x, y, z); f.rotation.y = ry; f.translateZ(-0.01); g.add(f);
    }
    box(cx - W / 2, cx + W / 2, hz - D / 2, hz + D / 2);

    const stoneMat = new THREE.MeshStandardMaterial({ color: '#b7ab98', roughness: 0.95 });
    for (let z = hz + D / 2 + 1.2; z < cz + BLOCK / 2 - 0.5; z += 1.4) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1), stoneMat);
      s.position.set(cx + Math.sin(z) * 0.15, SIDEWALK + 0.06, z); scene.add(s);
    }
    const fenceMat = new THREE.MeshStandardMaterial({ color: '#f2ede4', roughness: 0.8 });
    const posts = [];
    const half = BLOCK / 2 - 1.2;
    for (let s = -half; s <= half + 0.01; s += 1.6) {
      posts.push([cx + s, cz - half], [cx - half, cz + s], [cx + half, cz + s]);
      if (Math.abs(s) > 2) posts.push([cx + s, cz + half]);
    }
    const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 1.1, 0.15), fenceMat, posts.length);
    posts.forEach(([x, z], i) => { m4.makeTranslation(x, SIDEWALK + 0.55, z); postMesh.setMatrixAt(i, m4); });
    scene.add(postMesh);
    const rail = (x, z, w, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), fenceMat); m.position.set(x, SIDEWALK + 0.85, z); scene.add(m); };
    rail(cx, cz - half, half * 2, 0.08); rail(cx - half, cz, 0.08, half * 2); rail(cx + half, cz, 0.08, half * 2);
    rail(cx - (half + 2) / 2, cz + half, half - 2, 0.08); rail(cx + (half + 2) / 2, cz + half, half - 2, 0.08);
    box(cx - half - 0.15, cx + half + 0.15, cz - half - 0.15, cz - half + 0.15);
    box(cx - half - 0.15, cx - half + 0.15, cz - half, cz + half);
    box(cx + half - 0.15, cx + half + 0.15, cz - half, cz + half);
    box(cx - half, cx - 2, cz + half - 0.15, cz + half + 0.15);
    box(cx + 2, cx + half, cz + half - 0.15, cz + half + 0.15);
    for (const [x, z, s] of [[-11, -11, 1.7], [11, -12, 1.5], [-12, 9, 1.6], [12, 10, 1.8], [7, 4, 1.2]]) {
      place('bush', cx + x, SIDEWALK, cz + z, rnd() * 6, S * s);
      box(cx + x - 0.6, cx + x + 0.6, cz + z - 0.6, cz + z + 0.6);
    }
    place('bench', cx - 5, SIDEWALK, cz + 6, Math.PI / 2);
    const label = labelSprite('NHÀ', '#ffe2a8');
    label.position.set(cx, SIDEWALK + H + 6, hz); scene.add(label);
    interactables.push({ id: 'house', x: cx, z: hz + D / 2 + 1.6, r: 2.6, label: 'Vào nhà' });
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
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const x = cx + Math.cos(a) * 12, z = cz + Math.sin(a) * 12;
      if (k % 3 === 0) { place('bench', x * 0.7 + cx * 0.3, SIDEWALK, z * 0.7 + cz * 0.3, -a + Math.PI / 2); continue; }
      place('bush', x, SIDEWALK, z, rnd() * 6, S * (1.4 + rnd() * 0.5));
      box(x - 0.6, x + 0.6, z - 0.6, z + 0.6);
    }
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
    colliders, occluders, interactables, lines, parked,
    update(t, night) {
      for (const w of windowMats) w.mat.emissiveIntensity = w.day + (w.night - w.day) * night;
      for (const u of updaters) u(t, night);
    },
  };
}
