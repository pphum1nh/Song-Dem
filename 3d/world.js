// Thành phố: lưới khối nhà, Sòng Đêm ở giữa, Nhà phía tây, công viên phía đông.
import * as THREE from 'three';

export const BLOCK = 40, ROAD = 12, PITCH = BLOCK + ROAD, GRID = 2, CURB = 0.25;
export const LIMIT = (GRID + 0.5) * PITCH + ROAD / 2 - 2; // mép đường ngoài cùng

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
  if (Math.abs(i) > GRID || Math.abs(j) > GRID) return 0;
  return Math.abs(x - i * PITCH) <= BLOCK / 2 && Math.abs(z - j * PITCH) <= BLOCK / 2 ? CURB : 0;
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

// Một ô mặt tiền = 4 cửa sổ × 4 tầng = 8 m × 12 m.
function facadeMaterial(wall, glass, seed, windowMats) {
  const r = seeded(seed);
  const lit = [];
  for (let i = 0; i < 16; i++) lit.push(r() < 0.42 ? ['#ffd58a', '#ffe9b8', '#ffb46b', '#bfe1ff', '#ff9ad5'][Math.floor(r() * 5)] : null);
  const map = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 4; row++) {
      g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, row * 32, w, 2);
      for (let col = 0; col < 4; col++) {
        g.fillStyle = glass; g.fillRect(col * 32 + 7, row * 32 + 9, 18, 18);
        g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(col * 32 + 7, row * 32 + 9, 18, 3);
      }
    }
  });
  const emissiveMap = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) if (lit[i]) {
      g.fillStyle = lit[i]; g.fillRect((i % 4) * 32 + 7, Math.floor(i / 4) * 32 + 9, 18, 18);
    }
  });
  for (const t of [map, emissiveMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  const m = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.85, metalness: 0.05 });
  windowMats.push({ mat: m, day: 0, night: 1.15 });
  return m;
}

function facadeBox(w, h, d, facade, roof) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  // Thứ tự mặt: +x, -x, +y, -y, +z, -z. Mặt bên lặp texture theo kích thước thật.
  for (let f = 0; f < 6; f++) {
    if (f === 2 || f === 3) continue;
    const fw = f < 2 ? d : w;
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * (fw / 8), uv.getY(i) * (h / 12));
    }
  }
  return new THREE.Mesh(geo, [facade, facade, roof, roof, facade, facade]);
}

function labelSprite(text, color = '#ffffff', bg = 'rgba(20,10,24,.82)') {
  const tex = canvasTex(512, 128, (g, w, h) => {
    g.font = '800 64px -apple-system, "Segoe UI", Roboto, sans-serif';
    const tw = g.measureText(text).width + 64;
    const x = (w - tw) / 2;
    g.fillStyle = bg;
    g.beginPath(); g.roundRect(x, 20, tw, 88, 44); g.fill();
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, 66);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(8, 2, 1);
  return s;
}

export function buildWorld(scene) {
  const colliders = [];
  const occluders = [];
  const interactables = [];
  const windowMats = [];
  const updaters = [];
  const r = seeded(20251122);
  const box = (minX, maxX, minZ, maxZ) => colliders.push({ minX, maxX, minZ, maxZ });

  // Mặt đất và vỉa hè
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: '#2b2a33', roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const curbMat = new THREE.MeshStandardMaterial({ color: '#77727f', roughness: 0.9 });
  const grassMat = new THREE.MeshStandardMaterial({ color: '#3f6b3a', roughness: 1 });
  const slabGeo = new THREE.BoxGeometry(BLOCK, CURB, BLOCK);
  const slabs = new THREE.InstancedMesh(slabGeo, curbMat, (2 * GRID + 1) ** 2);
  const m4 = new THREE.Matrix4();
  let si = 0;
  for (let i = -GRID; i <= GRID; i++) for (let j = -GRID; j <= GRID; j++) {
    m4.makeTranslation(i * PITCH, CURB / 2, j * PITCH);
    slabs.setMatrixAt(si++, m4);
  }
  scene.add(slabs);

  // Vạch kẻ đường
  const dashes = [];
  const roadLines = [];
  for (let k = -GRID - 1; k <= GRID; k++) roadLines.push((k + 0.5) * PITCH);
  const ext = LIMIT + 2;
  for (const c of roadLines) {
    for (let s = -ext; s <= ext; s += 6) {
      const nearCross = roadLines.some((q) => Math.abs(s - q) < ROAD / 2 + 1.5);
      if (nearCross) continue;
      dashes.push([c, s, 0], [s, c, Math.PI / 2]);
    }
  }
  const dashMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 2.6), new THREE.MeshStandardMaterial({ color: '#d9cf9c', roughness: 0.8 }), dashes.length);
  const q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  dashes.forEach(([x, z, rot], i) => {
    e.set(-Math.PI / 2, 0, rot); q.setFromEuler(e); p.set(x, 0.02, z);
    m4.compose(p, q, one); dashMesh.setMatrixAt(i, m4);
  });
  scene.add(dashMesh);

  // Vật liệu mặt tiền
  const roofMat = new THREE.MeshStandardMaterial({ color: '#3a3742', roughness: 0.9 });
  const facades = [
    facadeMaterial('#4a4458', '#1c2030', 11, windowMats),
    facadeMaterial('#6b5a4c', '#1e1c22', 22, windowMats),
    facadeMaterial('#3d4a57', '#151b26', 33, windowMats),
    facadeMaterial('#5c3f52', '#1d1420', 44, windowMats),
  ];
  const ventMat = new THREE.MeshStandardMaterial({ color: '#55525c', roughness: 0.7 });

  function addBuilding(x, z, w, d, h, collide = true, group = scene) {
    const b = facadeBox(w, h, d, facades[Math.floor(r() * facades.length)], roofMat);
    b.position.set(x, h / 2 + CURB, z);
    group.add(b);
    if (collide) { box(x - w / 2, x + w / 2, z - d / 2, z + d / 2); occluders.push(b); }
    const n = Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const vw = 1.5 + r() * 2.5;
      const v = new THREE.Mesh(new THREE.BoxGeometry(vw, 1 + r() * 1.5, vw), ventMat);
      v.position.set(x + (r() - 0.5) * (w - vw - 1), h + CURB + 0.6, z + (r() - 0.5) * (d - vw - 1));
      group.add(v);
    }
  }

  // Cây (instanced)
  const trees = [];
  function addTree(x, z, s = 1) { trees.push([x, z, s]); box(x - 0.4, x + 0.4, z - 0.4, z + 0.4); }

  // Các khối thường
  for (let i = -GRID; i <= GRID; i++) for (let j = -GRID; j <= GRID; j++) {
    if (j === 0 && (i === 0 || i === -1 || i === 1)) continue; // casino, nhà, công viên
    const cx = i * PITCH, cz = j * PITCH;
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (r() < 0.12) { addTree(cx + ox * 9, cz + oz * 9, 1.1); continue; }
      const w = 11 + r() * 6, d = 11 + r() * 6;
      const h = 3 * Math.round(3 + r() * (Math.abs(i) + Math.abs(j) >= 3 ? 11 : 7));
      addBuilding(cx + ox * 9.5, cz + oz * 9.5, w, d, h);
    }
  }

  // Đường chân trời xa (không va chạm)
  for (let k = 0; k < 44; k++) {
    const a = (k / 44) * Math.PI * 2 + r() * 0.1;
    const rad = 175 + r() * 60;
    addBuilding(Math.cos(a) * rad, Math.sin(a) * rad, 16 + r() * 18, 16 + r() * 18, 24 + r() * 60, false);
  }

  // ---------- SÒNG ĐÊM ----------
  {
    const W = 30, D = 20, H = 15, cx = 0, cz = -3;
    const g = new THREE.Group(); g.position.set(cx, CURB, cz); scene.add(g);
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#4a1d52', roughness: 0.55, metalness: 0.1 });
    const goldMat = new THREE.MeshStandardMaterial({ color: '#d6a743', roughness: 0.3, metalness: 0.85, emissive: '#6a4300', emissiveIntensity: 0.5 });
    const pink = new THREE.MeshBasicMaterial({ color: '#ff2d95', toneMapped: false });
    const gold = new THREE.MeshBasicMaterial({ color: '#ffcf5a', toneMapped: false });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };

    const body = add(new THREE.BoxGeometry(W, H, D), bodyMat, 0, H / 2, 0);
    occluders.push(body);
    add(new THREE.BoxGeometry(W - 6, 4, D - 6), bodyMat, 0, H + 2, 0);
    add(new THREE.BoxGeometry(W - 12, 3, D - 10), goldMat, 0, H + 5.5, 0);
    add(new THREE.BoxGeometry(W + 0.6, 0.6, D + 0.6), goldMat, 0, H, 0);
    add(new THREE.BoxGeometry(W + 0.4, 0.4, D + 0.4), goldMat, 0, 6, 0);

    // Dải neon
    for (const sx of [-1, 1]) {
      add(new THREE.BoxGeometry(0.3, H, 0.3), pink, sx * (W / 2 + 0.15), H / 2, D / 2 + 0.15);
      add(new THREE.BoxGeometry(0.3, H, 0.3), pink, sx * (W / 2 + 0.15), H / 2, -D / 2 - 0.15);
    }
    add(new THREE.BoxGeometry(W, 0.3, 0.3), pink, 0, H - 0.6, D / 2 + 0.2);
    add(new THREE.BoxGeometry(W, 0.25, 0.25), gold, 0, 6.5, D / 2 + 0.2);
    add(new THREE.BoxGeometry(W - 6, 0.25, 0.25), pink, 0, H + 4, (D - 6) / 2 + 0.15);

    // Dải kính tầng trên
    const glassMat = new THREE.MeshStandardMaterial({ color: '#2a1838', emissive: '#c25aa8', emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.4 });
    windowMats.push({ mat: glassMat, day: 0.25, night: 0.9 });
    add(new THREE.BoxGeometry(W - 3, 1.6, 0.1), glassMat, 0, 8.2, D / 2 + 0.06);

    // Biển SÒNG ĐÊM
    const signTex = canvasTex(1024, 256, (c, w, h) => {
      c.font = '900 150px -apple-system, "Segoe UI", Roboto, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = '#ff2d95'; c.shadowBlur = 40;
      c.fillStyle = '#ffd1ec'; c.fillText('SÒNG ĐÊM', w / 2, h / 2 + 8);
      c.shadowBlur = 12; c.fillText('SÒNG ĐÊM', w / 2, h / 2 + 8);
    });
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false, depthWrite: false });
    add(new THREE.PlaneGeometry(18, 4.5), signMat, 0, 11.6, D / 2 + 0.08);

    // Lối vào: cửa sáng, mái che, cột, thảm đỏ
    const doorMat = new THREE.MeshBasicMaterial({ color: '#ffb347', toneMapped: false });
    add(new THREE.PlaneGeometry(8, 4.2), doorMat, 0, 2.1, D / 2 + 0.03);
    add(new THREE.BoxGeometry(14, 0.45, 5.4), goldMat, 0, 5.1, D / 2 + 2.7);
    add(new THREE.PlaneGeometry(13, 4.8), new THREE.MeshBasicMaterial({ color: '#ffe2a8', toneMapped: false, side: THREE.DoubleSide }), 0, 4.86, D / 2 + 2.7).rotation.x = Math.PI / 2;
    for (const sx of [-6.4, 6.4]) {
      add(new THREE.CylinderGeometry(0.28, 0.32, 4.9, 12), goldMat, sx, 2.45, D / 2 + 5);
      box(cx + sx - 0.4, cx + sx + 0.4, cz + D / 2 + 4.6, cz + D / 2 + 5.4);
    }
    add(new THREE.PlaneGeometry(4.2, 9), new THREE.MeshStandardMaterial({ color: '#8d0f2e', roughness: 0.9 }), 0, 0.02, D / 2 + 4.5).rotation.x = -Math.PI / 2;

    // Đồng xu vàng xoay trên mái (mốc nhìn từ xa)
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
  {
    const cx = -PITCH, cz = 0;
    const grass = new THREE.Mesh(new THREE.BoxGeometry(BLOCK - 1, 0.04, BLOCK - 1), grassMat);
    grass.position.set(cx, CURB + 0.02, cz); scene.add(grass);

    const W = 11, D = 8, H = 5, hz = cz - 6;
    const g = new THREE.Group(); g.position.set(cx, CURB, hz); scene.add(g);
    const wallMat = new THREE.MeshStandardMaterial({ color: '#eadcc4', roughness: 0.9 });
    const trimMat = new THREE.MeshStandardMaterial({ color: '#f7f1e6', roughness: 0.8 });
    const roofM = new THREE.MeshStandardMaterial({ color: '#8a3b2c', roughness: 0.8, flatShading: true });
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
    door.position.set(0, 1.3 + 0.1, D / 2 + 0.04); g.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshStandardMaterial({ color: '#d6a743', metalness: 1, roughness: 0.3 }));
    knob.position.set(0.55, 1.35, D / 2 + 0.13); g.add(knob);
    const porchLight = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), new THREE.MeshBasicMaterial({ color: '#ffd98a', toneMapped: false }));
    porchLight.position.set(1.3, 2.9, D / 2 + 0.2); g.add(porchLight);

    const winMat = new THREE.MeshStandardMaterial({ color: '#2b3550', emissive: '#ffcf7a', emissiveIntensity: 1, roughness: 0.2 });
    windowMats.push({ mat: winMat, day: 0, night: 1.4 });
    for (const [x, y, z, ry] of [[-3.3, 2.7, D / 2 + 0.05, 0], [3.3, 2.7, D / 2 + 0.05, 0], [W / 2 + 0.05, 2.7, 0, Math.PI / 2], [-W / 2 - 0.05, 2.7, 0, -Math.PI / 2]]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.5), winMat);
      w.position.set(x, y, z); w.rotation.y = ry; g.add(w);
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.8), trimMat);
      frame.position.set(x, y, z); frame.rotation.y = ry; frame.translateZ(-0.01); g.add(frame);
    }
    box(cx - W / 2, cx + W / 2, hz - D / 2, hz + D / 2);

    // Lối đi lát đá
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#b7ab98', roughness: 0.95 });
    for (let z = hz + D / 2 + 1.2; z < cz + BLOCK / 2 - 0.5; z += 1.4) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1), stoneMat);
      s.position.set(cx + (Math.sin(z) * 0.15), CURB + 0.05, z); scene.add(s);
    }

    // Hàng rào (chừa cổng ở giữa phía trước)
    const fenceMat = new THREE.MeshStandardMaterial({ color: '#f2ede4', roughness: 0.8 });
    const posts = [];
    const half = BLOCK / 2 - 0.6;
    for (let s = -half; s <= half + 0.01; s += 1.6) {
      posts.push([cx + s, cz - half], [cx - half, cz + s], [cx + half, cz + s]);
      if (Math.abs(s) > 2) posts.push([cx + s, cz + half]);
    }
    const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 1.1, 0.15), fenceMat, posts.length);
    posts.forEach(([x, z], i) => { m4.makeTranslation(x, CURB + 0.55, z); postMesh.setMatrixAt(i, m4); });
    scene.add(postMesh);
    const rail = (x, z, w, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), fenceMat); m.position.set(x, CURB + 0.85, z); scene.add(m); };
    rail(cx, cz - half, half * 2, 0.08); rail(cx - half, cz, 0.08, half * 2); rail(cx + half, cz, 0.08, half * 2);
    rail(cx - (half + 2) / 2, cz + half, half - 2, 0.08); rail(cx + (half + 2) / 2, cz + half, half - 2, 0.08);
    box(cx - half - 0.15, cx + half + 0.15, cz - half - 0.15, cz - half + 0.15);
    box(cx - half - 0.15, cx - half + 0.15, cz - half, cz + half);
    box(cx + half - 0.15, cx + half + 0.15, cz - half, cz + half);
    box(cx - half, cx - 2, cz + half - 0.15, cz + half + 0.15);
    box(cx + 2, cx + half, cz + half - 0.15, cz + half + 0.15);

    for (const [x, z, s] of [[-12, -12, 1.3], [12, -13, 1.1], [-13, 10, 1.2], [13, 11, 1.4], [8, 4, 0.9]]) addTree(cx + x, cz + z, s);

    const label = labelSprite('NHÀ', '#ffe2a8');
    label.position.set(cx, CURB + H + 6, hz); scene.add(label);
    interactables.push({ id: 'house', x: cx, z: hz + D / 2 + 1.6, r: 2.6, label: 'Vào nhà' });
  }

  // ---------- CÔNG VIÊN ----------
  {
    const cx = PITCH, cz = 0;
    const grass = new THREE.Mesh(new THREE.BoxGeometry(BLOCK - 1, 0.04, BLOCK - 1), grassMat);
    grass.position.set(cx, CURB + 0.02, cz); scene.add(grass);
    const stone = new THREE.MeshStandardMaterial({ color: '#a59d92', roughness: 0.9 });
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.3, 0.8, 32), stone);
    basin.position.set(cx, CURB + 0.4, cz); scene.add(basin);
    const waterMat = new THREE.MeshStandardMaterial({ color: '#2d6f9a', emissive: '#3aa0d8', emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.2 });
    windowMats.push({ mat: waterMat, day: 0.05, night: 0.45 });
    const water = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.1, 32), waterMat);
    water.position.set(cx, CURB + 0.72, cz); scene.add(water);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 12), stone);
    spout.position.set(cx, CURB + 1.5, cz); scene.add(spout);
    box(cx - 4.2, cx + 4.2, cz - 4.2, cz + 4.2);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      addTree(cx + Math.cos(a) * 13, cz + Math.sin(a) * 13, 0.9 + r() * 0.5);
    }
  }

  // Cây trồng instanced
  {
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.26, 2.2, 6), new THREE.MeshStandardMaterial({ color: '#5a3d2b' }), trees.length);
    const leafGeo = new THREE.IcosahedronGeometry(1.6, 0);
    const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.9 }), trees.length);
    const col = new THREE.Color();
    trees.forEach(([x, z, s], i) => {
      m4.compose(p.set(x, CURB + 1.1 * s, z), q.identity(), new THREE.Vector3(s, s, s)); trunk.setMatrixAt(i, m4);
      m4.compose(p.set(x, CURB + 3 * s, z), q.setFromEuler(e.set(0, i, 0)), new THREE.Vector3(s, s * 1.25, s)); leaves.setMatrixAt(i, m4);
      leaves.setColorAt(i, col.setHSL(0.27 + (i % 5) * 0.015, 0.45, 0.28 + (i % 3) * 0.04));
    });
    scene.add(trunk, leaves);
  }

  // Đèn đường ở các góc khối + vũng sáng giả trên mặt đất
  {
    const spots = [];
    for (let i = -GRID; i <= GRID; i++) for (let j = -GRID; j <= GRID; j++)
      for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) spots.push([i * PITCH + ox * (BLOCK / 2 - 0.8), j * PITCH + oz * (BLOCK / 2 - 0.8)]);
    const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 5, 6); poleGeo.translate(0, 2.5, 0);
    const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: '#2a2830', metalness: 0.6, roughness: 0.5 }), spots.length);
    const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false });
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 10, 8), bulbMat, spots.length);
    const poolMat = new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,200,130,0.9)', 'rgba(255,200,130,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(11, 11), poolMat, spots.length);
    spots.forEach(([x, z], i) => {
      m4.makeTranslation(x, CURB, z); poles.setMatrixAt(i, m4);
      m4.makeTranslation(x, CURB + 5.05, z); bulbs.setMatrixAt(i, m4);
      m4.compose(p.set(x, CURB + 0.03, z), q.setFromEuler(e.set(-Math.PI / 2, 0, 0)), one); pools.setMatrixAt(i, m4);
    });
    pools.renderOrder = 1;
    scene.add(poles, bulbs, pools);
    updaters.push((t, night) => {
      bulbMat.color.setRGB(1, 0.85, 0.63).multiplyScalar(0.25 + 1.0 * night);
      poolMat.opacity = 0.6 * night;
      pools.visible = night > 0.02;
    });
  }

  return {
    colliders, occluders, interactables,
    update(t, night) {
      for (const w of windowMats) w.mat.emissiveIntensity = w.day + (w.night - w.day) * night;
      for (const u of updaters) u(t, night);
    },
  };
}
