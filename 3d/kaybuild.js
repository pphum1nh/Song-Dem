// Dựng Nhà và Sòng Đêm theo phong cách KayKit: khối vát cạnh, tô bằng bảng màu chuyển sắc của KayKit,
// cửa sổ khung trắng có bậu và rèm, mái hiên sọc. Mỗi công trình gộp thành một lưới dùng vật liệu của kit.
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';

// Ô màu trong texture KayKit: [cột 0..7, hàng 0..3]; mỗi ô chuyển sắc từ trên xuống dưới.
export const C = {
  white: [1, 0], lgrey: [2, 0], dgrey: [3, 0], black: [4, 0], terra: [5, 0], brick: [6, 0], orange: [7, 0],
  sky: [0, 1], blue: [1, 1], slate: [2, 1], gold: [3, 1], red: [4, 1], peach: [5, 1], wgrey: [6, 1], taupe: [7, 1],
  olive: [0, 2], teal: [1, 2], green: [2, 2], dgreen: [3, 2], cream: [5, 2], magenta: [6, 2], salmon: [7, 2],
  yellow: [2, 3],
};

export class Builder {
  constructor() { this.parts = []; this.stack = [new THREE.Matrix4()]; }
  get m() { return this.stack[this.stack.length - 1]; }
  push(x = 0, y = 0, z = 0, ry = 0) {
    const local = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
    this.stack.push(this.m.clone().multiply(local));
  }
  pop() { this.stack.pop(); }

  // Tô màu: u ở giữa ô, v theo chiều cao khối để có dải chuyển sắc như KayKit
  paint(g, cell, a = 0.15, b = 0.85) {
    g.computeBoundingBox();
    const bb = g.boundingBox, pos = g.attributes.position, uv = g.attributes.uv;
    const span = Math.max(1e-4, bb.max.y - bb.min.y);
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) - bb.min.y) / span;
      uv.setXY(i, (cell[0] + 0.5) / 8, (cell[1] + a + (1 - t) * (b - a)) / 4);
    }
  }
  paintGlass(g) {
    g.computeBoundingBox();
    const bb = g.boundingBox, pos = g.attributes.position, uv = g.attributes.uv;
    const sx = Math.max(1e-4, bb.max.x - bb.min.x + bb.max.z - bb.min.z), sy = Math.max(1e-4, bb.max.y - bb.min.y);
    for (let i = 0; i < pos.count; i++) {
      const s = (pos.getX(i) - bb.min.x + pos.getZ(i) - bb.min.z) / sx, t = (pos.getY(i) - bb.min.y) / sy;
      uv.setXY(i, 0.02 + 0.2 * s, 0.77 + 0.2 * (1 - t));
    }
  }
  addGeo(g, cell, opts = {}) {
    if (opts.glass) this.paintGlass(g); else this.paint(g, cell, opts.a, opts.b);
    if (opts.ry) g.rotateY(opts.ry);
    if (opts.rx) g.rotateX(opts.rx);
    if (opts.rz) g.rotateZ(opts.rz);
    g.translate(opts.x || 0, opts.y || 0, opts.z || 0);
    g.applyMatrix4(this.m);
    this.parts.push(g.index ? g.toNonIndexed() : g);
    return g;
  }
  // Khối vát cạnh đặt theo đáy (y là cao độ đáy)
  box(w, h, d, x, y, z, cell, opts = {}) {
    const r = opts.r ?? 0.12;
    const rr = Math.min(r, w / 2 - 0.005, h / 2 - 0.005, d / 2 - 0.005);
    const g = rr > 0.01 ? new RoundedBoxGeometry(w, h, d, 1, rr) : new THREE.BoxGeometry(w, h, d);
    return this.addGeo(g, cell, { ...opts, x, y: y + h / 2, z });
  }
  cyl(rt, rb, h, x, y, z, cell, opts = {}) {
    return this.addGeo(new THREE.CylinderGeometry(rt, rb, h, opts.seg || 10), cell, { ...opts, x, y: y + h / 2, z });
  }
  build(material) {
    const geo = mergeGeometries(this.parts.map((g) => { const c = g.clone(); c.deleteAttribute('uv1'); return c; }), false);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
}

// Cửa sổ kiểu KayKit, mặt quay về +Z tại vị trí hiện tại của builder
export function kWindow(k, x, y, w = 1.5, h = 1.9, frame = C.white, curtain = C.salmon) {
  k.box(w + 0.4, h + 0.4, 0.24, x, y - 0.2, 0.04, frame, { r: 0.08 });
  k.box(w, h, 0.12, x, y, 0.14, null, { glass: true, r: 0 });
  k.box(0.12, h, 0.12, x, y, 0.2, frame, { r: 0.03 });
  k.box(w, 0.12, 0.12, x, y + h * 0.62, 0.2, frame, { r: 0.03 });
  if (curtain) k.box(w * 0.92, h * 0.2, 0.06, x, y + h * 0.78, 0.17, curtain, { r: 0.02 });
  k.box(w + 0.7, 0.2, 0.5, x, y - 0.38, 0.22, frame, { r: 0.06 });
}

export function kDoor(k, x, y, w, h, panel, frame = C.white) {
  k.box(w + 0.5, h + 0.3, 0.26, x, y, 0.04, frame, { r: 0.08 });
  k.box(w, h, 0.14, x, y, 0.12, panel, { r: 0.05 });
  k.box(w * 0.7, h * 0.3, 0.06, x, y + h * 0.58, 0.2, null, { glass: true, r: 0 });
  k.cyl(0.08, 0.08, 0.1, x + w * 0.35, y + h * 0.45, 0.24, C.gold, { rx: Math.PI / 2 });
}

// Mái hiên sọc nghiêng ra trước
function kAwning(k, x, y, w, depth, colA, colB, n = 6) {
  const sw = w / n, a = 0.38;
  for (let i = 0; i < n; i++) {
    k.box(sw, 0.14, depth, x - w / 2 + sw * (i + 0.5), y, depth / 2 * Math.cos(a) + 0.1, i % 2 ? colB : colA, { r: 0.03, rx: a });
    k.box(sw, 0.45, 0.12, x - w / 2 + sw * (i + 0.5), y - depth * Math.sin(a) - 0.4, depth * Math.cos(a) + 0.12, i % 2 ? colB : colA, { r: 0.03 });
  }
}

// ---------------- NHÀ NGƯỜI CHƠI ----------------
export function buildHouseKay(kitMaterial) {
  const k = new Builder();
  const W = 11, D = 8, F1 = 3.3, F2 = 3.0, P = 0.5;
  k.box(W + 0.6, P, D + 0.6, 0, 0, 0, C.lgrey, { r: 0.15 });
  k.box(W, F1, D, 0, P, 0, C.cream, { r: 0.18 });
  k.box(W + 0.35, 0.35, D + 0.35, 0, P + F1, 0, C.white, { r: 0.1 });
  k.box(W, F2, D, 0, P + F1 + 0.35, 0, C.peach, { r: 0.18 });
  const top = P + F1 + 0.35 + F2;
  k.box(W + 0.35, 0.3, D + 0.35, 0, top - 0.05, 0, C.white, { r: 0.1 });

  // Mái dốc hai phía, sống mái chạy theo trục X
  const rh = 3.0, a = Math.atan2(rh, D / 2 + 0.2);
  const shape = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, rh)]);
  const attic = new THREE.ExtrudeGeometry(shape, { depth: W - 0.2, bevelEnabled: false });
  attic.translate(0, 0, -(W - 0.2) / 2); attic.rotateY(Math.PI / 2);
  k.addGeo(attic, C.cream, { y: top + 0.25 });
  const slabL = (D / 2 + 1.0) / Math.cos(a);
  for (const s of [-1, 1]) {
    k.addGeo(new RoundedBoxGeometry(W + 1.4, 0.5, slabL, 1, 0.14), C.brick,
      { rx: s * a, x: 0, y: top + 0.25 + rh - (slabL / 2) * Math.sin(a) + 0.3, z: s * (slabL / 2) * Math.cos(a) });
  }
  k.box(W + 1.5, 0.35, 0.6, 0, top + 0.25 + rh - 0.05, 0, C.terra, { r: 0.12 });
  // Ống khói
  k.box(1.1, 3.2, 1.1, 3.4, top + 0.6, -1.6, C.brick, { r: 0.1 });
  k.box(1.4, 0.35, 1.4, 3.4, top + 3.8, -1.6, C.dgrey, { r: 0.08 });

  // Mặt tiền (+Z)
  k.push(0, 0, D / 2);
  kDoor(k, 0, P + 0.05, 1.5, 2.5, C.teal);
  kWindow(k, -3.4, P + 1.2, 1.7, 1.6);
  kWindow(k, 3.4, P + 1.2, 1.7, 1.6);
  for (const x of [-3.4, 0, 3.4]) kWindow(k, x, P + F1 + 0.95, 1.4, 1.5, C.white, C.yellow);
  // Hiên trước: sàn, bậc, cột, mái nhỏ
  k.box(4.2, P, 2.4, 0, 0, 1.2, C.lgrey, { r: 0.1 });
  k.box(2.4, 0.25, 0.7, 0, 0, 2.7, C.wgrey, { r: 0.06 });
  for (const x of [-1.8, 1.8]) k.box(0.32, 2.9, 0.32, x, P, 2.2, C.white, { r: 0.08 });
  k.box(4.8, 0.3, 2.9, 0, P + 2.9, 1.25, C.white, { r: 0.1 });
  k.box(4.6, 0.25, 2.7, 0, P + 3.2, 1.2, C.brick, { r: 0.08, rx: -0.12 });
  k.box(4.0, 0.45, 0.6, -3.4, P + 0.05, 0.4, C.brick, { r: 0.08 });
  k.box(4.0, 0.45, 0.6, 3.4, P + 0.05, 0.4, C.brick, { r: 0.08 });
  for (const x of [-4.8, -3.4, -2.0, 2.0, 3.4, 4.8]) k.box(0.45, 0.45, 0.45, x, P + 0.5, 0.4, C.green, { r: 0.2 });
  k.pop();
  // Hai bên hông và mặt sau
  for (const [ry, half] of [[Math.PI / 2, W / 2], [-Math.PI / 2, W / 2], [Math.PI, D / 2]]) {
    k.push(Math.sin(ry) * half, 0, Math.cos(ry) * half, ry);
    if (ry === Math.PI) { for (const x of [-3, 3]) { kWindow(k, x, P + 1.2, 1.6, 1.6); kWindow(k, x, P + F1 + 0.95, 1.4, 1.5, C.white, C.yellow); } }
    else { kWindow(k, 0, P + 1.2, 1.6, 1.6); kWindow(k, 0, P + F1 + 0.95, 1.4, 1.5, C.white, C.yellow); }
    k.pop();
  }

  // Sân: lối đi lát đá, hàng rào trắng, hộp thư
  for (let z = D / 2 + 3.2, i = 0; z < 16.5; z += 1.5, i++) k.box(1.8, 0.12, 1.0, Math.sin(i) * 0.15, 0, z, C.lgrey, { r: 0.08 });
  const fz = 16.6;
  for (let x = -16.5; x <= 16.51; x += 1.65) {
    if (Math.abs(x) < 1.8) continue;
    k.box(0.28, 1.1, 0.28, x, 0, fz, C.white, { r: 0.07 });
  }
  for (const s of [-1, 1]) {
    k.box(14.5, 0.16, 0.14, s * 9.25, 0.75, fz, C.white, { r: 0.04 });
    k.box(14.5, 0.16, 0.14, s * 9.25, 0.35, fz, C.white, { r: 0.04 });
  }
  k.box(0.2, 1.1, 0.2, 2.6, 0, fz - 0.6, C.dgrey, { r: 0.05 });
  k.box(0.55, 0.45, 0.8, 2.6, 1.1, fz - 0.6, C.red, { r: 0.12 });

  const mesh = k.build(kitMaterial);
  const lights = [new THREE.Vector3(1.4, P + 2.6, D / 2 + 0.45)];
  return { mesh, lights, door: new THREE.Vector3(0, 0, D / 2 + 2.6) };
}

// ---------------- SÒNG ĐÊM ----------------
export function buildCasinoKay(kitMaterial) {
  const k = new Builder();
  const W = 30, D = 20, P = 0.5, G = 6.2, U = 8.4;
  const top = P + G + 0.7 + U;
  k.box(W + 0.8, P, D + 0.8, 0, 0, 0, C.lgrey, { r: 0.2 });
  k.box(W, G, D, 0, P, 0, C.red, { r: 0.2, a: 0.1, b: 0.7 });
  k.box(W + 0.7, 0.7, D + 0.7, 0, P + G, 0, C.gold, { r: 0.18 });
  k.box(W - 0.6, U, D - 0.6, 0, P + G + 0.7, 0, C.blue, { r: 0.2, a: 0.45, b: 0.95 });
  k.box(W + 0.5, 0.6, D + 0.5, 0, top, 0, C.white, { r: 0.15 });
  k.box(W + 0.2, 0.9, D + 0.2, 0, top + 0.6, 0, C.gold, { r: 0.15 });
  k.box(W - 1, 0.2, D - 1, 0, top + 1.3, 0, C.dgrey, { r: 0.05 });
  // Vương miện bậc thang + bệ đồng xu
  k.box(16, 2.6, 10, 0, top + 1.4, -1, C.red, { r: 0.25 });
  k.box(16.6, 0.5, 10.6, 0, top + 4.0, -1, C.gold, { r: 0.15 });
  k.box(9, 1.8, 6, 0, top + 4.5, -1, C.blue, { r: 0.25, a: 0.5, b: 0.95 });
  k.box(9.6, 0.45, 6.6, 0, top + 6.3, -1, C.gold, { r: 0.15 });
  k.cyl(0.35, 0.5, 1.6, 0, top + 6.75, -1, C.gold);

  // Mặt tiền tầng trệt: cột vàng, kính lớn, lối vào giữa lõm vào
  k.push(0, 0, D / 2);
  for (const x of [-13.5, -8.5, -4.6, 4.6, 8.5, 13.5]) {
    k.box(1.1, G - 0.2, 0.6, x, P + 0.1, 0.05, C.gold, { r: 0.18 });
    k.box(1.5, 0.5, 0.8, x, P, 0.05, C.gold, { r: 0.12 });
  }
  for (const x of [-11, 11, -6.55, 6.55]) {
    const w = Math.abs(x) > 9 ? 3.8 : 2.8;
    k.box(w + 0.3, 3.7, 0.2, x, P + 0.9, 0.0, C.white, { r: 0.06 });
    k.box(w, 3.4, 0.12, x, P + 1.05, 0.1, null, { glass: true, r: 0 });
    k.box(w, 0.6, 0.06, x, P + 3.7, 0.18, C.magenta, { r: 0.02 });
    k.box(w + 0.5, 0.25, 0.5, x, P + 0.75, 0.2, C.gold, { r: 0.06 });
    kAwning(k, x, P + 5.1, w + 0.6, 1.6, C.red, C.white, Math.abs(x) > 9 ? 6 : 4);
  }
  // Cửa chính: khung vàng, 3 cánh kính
  k.box(8.4, 0.4, 1.0, 0, P, -0.2, C.gold, { r: 0.1 });
  k.box(8.2, 4.6, 0.3, 0, P + 0.3, -0.05, C.gold, { r: 0.12 });
  for (const x of [-2.6, 0, 2.6]) k.box(2.3, 4.0, 0.12, x, P + 0.4, 0.1, null, { glass: true, r: 0 });
  for (const x of [-1.3, 1.3]) k.box(0.2, 4.0, 0.2, x, P + 0.4, 0.15, C.gold, { r: 0.05 });

  // Mái che lối vào (marquee) có cột vàng
  k.box(13, 1.3, 6, 0, P + 5.2, 3.0, C.gold, { r: 0.3 });
  k.box(13.4, 0.5, 6.4, 0, P + 6.45, 3.0, C.red, { r: 0.2 });
  k.box(12.2, 0.12, 5.2, 0, P + 5.12, 3.0, C.yellow, { r: 0.02 });
  for (const x of [-6, 6]) {
    k.cyl(0.38, 0.42, 5.1, x, P, 5.4, C.gold, { seg: 12 });
    k.box(1.2, 0.4, 1.2, x, P, 5.4, C.gold, { r: 0.1 });
  }
  // Bậc + thảm đỏ + cột chắn dây đỏ
  k.box(10, 0.25, 2.0, 0, 0, 1.4, C.lgrey, { r: 0.06 });
  k.box(4.2, 0.06, 10, 0, P - 0.22, 5.4, C.red, { r: 0 });
  for (const s of [-1, 1]) {
    for (const z of [3, 5.5, 8, 10.5]) {
      k.cyl(0.09, 0.09, 1.1, s * 2.7, P - 0.2, z, C.gold, { seg: 8 });
      k.cyl(0.18, 0.18, 0.18, s * 2.7, P + 0.9, z, C.gold, { seg: 8 });
    }
    k.box(0.12, 0.12, 7.5, s * 2.7, P + 0.62, 6.75, C.red, { r: 0.04 });
    // Chậu cây
    k.box(1.8, 1.0, 1.8, s * 8.5, P - 0.2, 7.5, C.gold, { r: 0.2 });
    k.box(1.4, 1.2, 1.4, s * 8.5, P + 0.8, 7.5, C.dgreen, { r: 0.6 });
  }
  // Tầng trên: 2 hàng cửa sổ khung vàng, rèm hồng
  for (const yy of [P + G + 1.9, P + G + 5.6]) {
    for (let i = 0; i < 7; i++) kWindow(k, -12 + i * 4, yy, 2.0, 2.2, C.gold, C.magenta);
  }
  // Bảng hiệu lớn nền xanh đậm viền vàng (chữ neon gắn riêng)
  k.box(20, 4.6, 0.6, 0, top - 1.6, 0.6, C.gold, { r: 0.25 });
  k.box(19, 3.8, 0.3, 0, top - 1.2, 0.9, C.black, { r: 0.12 });
  // Biển dọc ở góc trái
  k.box(2.2, 13, 1.0, -W / 2 - 1.2, P + 3, 0.4, C.red, { r: 0.3 });
  k.box(2.6, 0.5, 1.3, -W / 2 - 1.2, P + 16, 0.4, C.gold, { r: 0.15 });
  k.box(2.6, 0.5, 1.3, -W / 2 - 1.2, P + 2.6, 0.4, C.gold, { r: 0.15 });
  k.pop();

  // Hông và mặt sau: cửa sổ và mái hiên
  for (const [ry, half, n] of [[Math.PI / 2, W / 2, 4], [-Math.PI / 2, W / 2, 4], [Math.PI, D / 2, 7]]) {
    k.push(Math.sin(ry) * half, 0, Math.cos(ry) * half, ry);
    const span = (n - 1) * 4;
    for (let i = 0; i < n; i++) {
      const x = -span / 2 + i * 4;
      kWindow(k, x, P + G + 1.9, 2.0, 2.2, C.gold, C.magenta);
      kWindow(k, x, P + G + 5.6, 2.0, 2.2, C.gold, C.magenta);
      if (ry !== Math.PI) { kWindow(k, x, P + 1.6, 2.4, 2.6, C.gold, C.magenta); kAwning(k, x, P + 5.0, 3.0, 1.3, C.red, C.white, 4); }
    }
    k.pop();
  }
  const mesh = k.build(kitMaterial);
  return { mesh, W, D, P, G, top, door: new THREE.Vector3(0, 0, D / 2 + 9) };
}

// Phần phát sáng (neon, bóng đèn, biển chữ) dựng riêng bằng vật liệu không chịu ánh sáng
export function casinoLights(c, signTexture, bladeTexture) {
  const g = new THREE.Group();
  const { W, D, P, G, top } = c;
  const bulbGeo = new THREE.SphereGeometry(0.14, 8, 6);
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffe6a6', toneMapped: false });
  const bulbs = [];
  // Viền bóng đèn quanh mái che và bảng hiệu
  for (let x = -6.3; x <= 6.31; x += 0.7) bulbs.push([x, P + 5.85, D / 2 + 6.08], [x, P + 5.05, D / 2 + 5.4]);
  for (let x = -9.4; x <= 9.41; x += 0.7) bulbs.push([x, top + 2.85, D / 2 + 1.05], [x, top - 1.45, D / 2 + 1.05]);
  for (let y = top - 1.45; y <= top + 2.86; y += 0.7) bulbs.push([-9.75, y, D / 2 + 1.05], [9.75, y, D / 2 + 1.05]);
  for (let y = P + 3.6; y <= P + 15.6; y += 0.7) bulbs.push([-W / 2 - 2.4, y, D / 2 + 0.95], [-W / 2, y, D / 2 + 0.95]);
  const im = new THREE.InstancedMesh(bulbGeo, bulbMat, bulbs.length);
  const m = new THREE.Matrix4();
  bulbs.forEach((p, i) => im.setMatrixAt(i, m.makeTranslation(p[0], p[1], p[2])));
  g.add(im);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(18.4, 3.6), new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, toneMapped: false }));
  sign.position.set(0, top + 0.7, D / 2 + 1.07); g.add(sign);
  const marquee = new THREE.Mesh(new THREE.PlaneGeometry(12.2, 1.1), new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, toneMapped: false }));
  marquee.position.set(0, P + 5.85, D / 2 + 6.02); g.add(marquee);
  const blade = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 11.6), new THREE.MeshBasicMaterial({ map: bladeTexture, transparent: true, toneMapped: false }));
  blade.position.set(-W / 2 - 1.2, P + 9.6, D / 2 + 0.92); g.add(blade);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), new THREE.MeshBasicMaterial({ color: '#fff1c4', toneMapped: false, side: THREE.DoubleSide }));
  under.rotation.x = Math.PI / 2; under.position.set(0, P + 5.1, D / 2 + 3.0); g.add(under);
  return { group: g, bulbMat, signs: [sign.material, marquee.material, blade.material] };
}

// ---------------- NGÂN HÀNG BRUHBANK ----------------
export function buildBankKay(kitMaterial, signTexture) {
  const k = new Builder();
  const W = 11, D = 8.5, P = 0.45, H = 6.4;
  k.box(W + 0.4, P, D + 0.4, 0, 0, 0, C.lgrey, { r: 0.12 });
  k.box(W, H, D, 0, P, 0, C.white, { r: 0.18, a: 0.3, b: 0.9 });
  k.box(W + 0.3, 0.5, D + 0.3, 0, P + H, 0, C.slate, { r: 0.12 });
  k.box(W - 2, 1.4, D - 2, 0, P + H + 0.5, -0.4, C.slate, { r: 0.2, a: 0.3, b: 0.8 });
  k.cyl(1.6, 2.0, 1.2, 0, P + H + 1.9, -0.4, C.sky, { seg: 16 });
  // Bậc thềm 3 nấc phía trước
  for (let i = 0; i < 3; i++) k.box(W - 0.6 - i * 0.6, 0.15 * (i + 1), 2.6 - i * 0.7, 0, 0, D / 2 + 1.3 - i * 0.35, C.lgrey, { r: 0.05 });
  // Hiên cột
  for (const x of [-3.6, -1.2, 1.2, 3.6]) {
    k.box(0.9, 0.3, 0.9, x, P, D / 2 + 1.6, C.white, { r: 0.08 });
    k.cyl(0.32, 0.36, 5.4, x, P + 0.3, D / 2 + 1.6, C.white, { seg: 12 });
    k.box(0.9, 0.3, 0.9, x, P + 5.7, D / 2 + 1.6, C.white, { r: 0.08 });
  }
  k.box(9.2, 1.0, 2.6, 0, P + 6.0, D / 2 + 1.1, C.white, { r: 0.12 });
  const shape = new THREE.Shape([new THREE.Vector2(-4.8, 0), new THREE.Vector2(4.8, 0), new THREE.Vector2(0, 1.6)]);
  const ped = new THREE.ExtrudeGeometry(shape, { depth: 2.4, bevelEnabled: false });
  k.addGeo(ped, C.white, { y: P + 7.0, z: D / 2 - 0.1 });
  k.box(9.8, 0.25, 0.4, 0, P + 6.95, D / 2 + 2.35, C.slate, { r: 0.06 });
  // Mặt tiền: cửa kính khung vàng, cửa sổ
  k.push(0, 0, D / 2);
  k.box(2.8, 3.6, 0.25, 0, P, 0.02, C.gold, { r: 0.08 });
  k.box(2.3, 3.2, 0.12, 0, P + 0.1, 0.12, null, { glass: true, r: 0 });
  k.box(0.12, 3.2, 0.12, 0, P + 0.1, 0.18, C.gold, { r: 0.03 });
  for (const x of [-2.4, 2.4]) kWindow(k, x, P + 2.0, 1.2, 2.2, C.white, C.sky);
  // ATM bên trái mặt tiền
  k.box(1.3, 2.3, 0.7, -4.4, P, 0.3, C.dgrey, { r: 0.12 });
  k.box(1.32, 0.35, 0.72, -4.4, P + 2.3, 0.3, C.blue, { r: 0.1 });
  k.box(0.9, 0.6, 0.08, -4.4, P + 1.35, 0.66, null, { glass: true, r: 0 });
  k.box(0.9, 0.25, 0.2, -4.4, P + 0.95, 0.7, C.lgrey, { r: 0.04 });
  k.pop();
  for (const [ry, half] of [[Math.PI / 2, W / 2], [-Math.PI / 2, W / 2]]) {
    k.push(Math.sin(ry) * half, 0, Math.cos(ry) * half, ry);
    for (const x of [-2.2, 2.2]) kWindow(k, x, P + 2.0, 1.3, 2.2, C.white, C.sky);
    k.pop();
  }
  const mesh = k.build(kitMaterial);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 1.2), new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, toneMapped: false }));
  return { mesh, sign, signY: P + 6.5, signZ: D / 2 + 2.45, W, D };
}

// ---------------- NHÀ PHỐ (khu dân cư) ----------------
// Mặt tiền quay về +Z; gốc toạ độ ở giữa đáy nhà.
export const HOUSE_STYLES = [
  { wall: C.cream, wall2: C.peach, roof: C.brick, door: C.teal },     // nhà người chơi
  { wall: C.sky, wall2: C.sky, roof: C.slate, door: C.white },
  { wall: C.yellow, wall2: C.yellow, roof: C.terra, door: C.red },
  { wall: C.salmon, wall2: C.salmon, roof: C.dgrey, door: C.white },
  { wall: C.green, wall2: C.green, roof: C.brick, door: C.cream },
  { wall: C.wgrey, wall2: C.white, roof: C.blue, door: C.gold },
  { wall: C.teal, wall2: C.teal, roof: C.dgrey, door: C.yellow },
];
export function buildTownhouse(kitMaterial, style = HOUSE_STYLES[0], seed = 0) {
  const k = new Builder();
  const W = 8.6, D = 7, F1 = 3.1, F2 = 2.8, P = 0.4;
  k.box(W + 0.4, P, D + 0.4, 0, 0, 0, C.lgrey, { r: 0.12 });
  k.box(W, F1, D, 0, P, 0, style.wall, { r: 0.16 });
  k.box(W + 0.3, 0.3, D + 0.3, 0, P + F1, 0, C.white, { r: 0.08 });
  k.box(W, F2, D, 0, P + F1 + 0.3, 0, style.wall2, { r: 0.16 });
  const top = P + F1 + 0.3 + F2;
  k.box(W + 0.3, 0.25, D + 0.3, 0, top - 0.05, 0, C.white, { r: 0.08 });
  const rh = 2.6, a = Math.atan2(rh, D / 2 + 0.2);
  const shape = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, rh)]);
  const attic = new THREE.ExtrudeGeometry(shape, { depth: W - 0.2, bevelEnabled: false });
  attic.translate(0, 0, -(W - 0.2) / 2); attic.rotateY(Math.PI / 2);
  k.addGeo(attic, style.wall2, { y: top + 0.2 });
  const slabL = (D / 2 + 0.9) / Math.cos(a);
  for (const s of [-1, 1]) {
    k.addGeo(new RoundedBoxGeometry(W + 1.0, 0.42, slabL, 1, 0.12), style.roof,
      { rx: s * a, y: top + 0.2 + rh - (slabL / 2) * Math.sin(a) + 0.26, z: s * (slabL / 2) * Math.cos(a) });
  }
  k.box(W + 1.1, 0.3, 0.5, 0, top + 0.2 + rh - 0.05, 0, style.roof, { r: 0.1 });
  if (seed % 2 === 0) { k.box(0.9, 2.4, 0.9, W / 2 - 1.6, top + 0.6, -1.4, C.brick, { r: 0.08 }); k.box(1.2, 0.3, 1.2, W / 2 - 1.6, top + 3.0, -1.4, C.dgrey, { r: 0.06 }); }
  k.push(0, 0, D / 2);
  const doorX = seed % 3 === 0 ? -2.2 : seed % 3 === 1 ? 2.2 : 0;
  kDoor(k, doorX, P + 0.05, 1.3, 2.4, style.door);
  for (const x of [-2.6, 0, 2.6]) if (Math.abs(x - doorX) > 1.5) kWindow(k, x, P + 1.15, 1.4, 1.5, C.white, seed % 2 ? C.salmon : C.yellow);
  for (const x of [-2.6, 0, 2.6]) kWindow(k, x, P + F1 + 0.85, 1.2, 1.4, C.white, seed % 2 ? C.yellow : C.salmon);
  k.box(2.4, 0.22, 1.2, doorX, 0, 0.6, C.lgrey, { r: 0.05 });
  k.box(2.6, 0.22, 1.3, doorX, P + 2.75, 0.55, C.white, { r: 0.06, rx: -0.15 });
  k.pop();
  for (const [ry, half] of [[Math.PI / 2, W / 2], [-Math.PI / 2, W / 2], [Math.PI, D / 2]]) {
    k.push(Math.sin(ry) * half, 0, Math.cos(ry) * half, ry);
    for (const x of ry === Math.PI ? [-2.2, 2.2] : [0]) { kWindow(k, x, P + 1.15, 1.3, 1.4, C.white, null); kWindow(k, x, P + F1 + 0.85, 1.2, 1.3, C.white, null); }
    k.pop();
  }
  return { mesh: k.build(kitMaterial), W, D, doorX, P };
}

// ---------------- SIÊU THỊ ----------------
export function buildMarket(kitMaterial) {
  const k = new Builder();
  const W = 30, D = 13, H = 6.5, P = 0.3;
  k.box(W + 0.4, P, D + 0.4, 0, 0, 0, C.lgrey, { r: 0.1 });
  k.box(W, H, D, 0, P, 0, C.brick, { r: 0.2, a: 0.3, b: 0.8 });
  k.box(W + 0.5, 0.6, D + 0.5, 0, P + H, 0, C.yellow, { r: 0.15 });
  for (const [x, z] of [[-9, -2], [-4, 2], [6, -1], [10, 3]]) k.box(2.2, 1.2, 1.6, x, P + H + 0.6, z, C.wgrey, { r: 0.12 });
  k.push(0, 0, D / 2);
  k.box(10, 4.4, 0.6, 0, P, 0.05, C.yellow, { r: 0.15 });
  k.box(8.6, 3.8, 0.12, 0, P + 0.1, 0.4, null, { glass: true, r: 0 });
  for (const x of [-2.9, 0, 2.9]) k.box(0.15, 3.8, 0.15, x, P + 0.1, 0.45, C.white, { r: 0.04 });
  for (const x of [-11, 11]) { k.box(7, 3.0, 0.12, x, P + 0.9, 0.06, null, { glass: true, r: 0 }); k.box(7.4, 0.25, 0.5, x, P + 0.7, 0.2, C.white, { r: 0.06 }); }
  k.box(12, 0.3, 3.0, 0, P + 4.6, 1.5, C.green, { r: 0.1 });
  for (const x of [-5.6, 5.6]) k.cyl(0.18, 0.18, 4.6, x, 0, 2.8, C.white);
  k.box(13, 2.0, 0.5, 0, P + H - 1.4, 0.3, C.green, { r: 0.2 });
  k.pop();
  return { mesh: k.build(kitMaterial), W, D, P, H };
}

// Cây thông thấp kiểu low-poly (trả về hình học đã tô màu để dùng InstancedMesh)
export function treeGeometry(kind = 0) {
  const k = new Builder();
  k.cyl(0.18, 0.26, 1.4, 0, 0, 0, C.brick, { seg: 6 });
  if (kind === 0) { k.cyl(0, 1.5, 2.6, 0, 1.0, 0, C.green, { seg: 7 }); k.cyl(0, 1.1, 2.0, 0, 2.6, 0, C.green, { seg: 7 }); }
  else k.addGeo(new THREE.IcosahedronGeometry(1.5, 0), C.green, { y: 2.6 });
  const mesh = k.build(null);
  return mesh.geometry;
}
