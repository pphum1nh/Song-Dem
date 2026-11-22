// Người đi bộ đi quanh vỉa hè và xe chạy vòng trên đường (lái bên phải như ở Việt Nam).
import * as THREE from 'three';
import { BLOCK, PITCH, SIDEWALK, ROADY, radialTex, seeded } from './world.js';
import { createCharacter, CHARACTERS } from './character.js';
import { makeBlob } from './player.js';

// Hình chữ nhật bo góc, lấy mẫu mỗi ~0,5 m. dir = 1 ngược chiều kim đồng hồ khi nhìn từ trên xuống.
function roundedRect(cx, cz, hx, hz, r, dir = 1) {
  const pts = [];
  const corners = [[hx - r, hz - r, 0], [-(hx - r), hz - r, Math.PI / 2], [-(hx - r), -(hz - r), Math.PI], [hx - r, -(hz - r), -Math.PI / 2]];
  for (const [ox, oz, a0] of corners) {
    for (let k = 0; k <= 8; k++) {
      const a = a0 + (k / 8) * (Math.PI / 2);
      pts.push(new THREE.Vector3(cx + ox + Math.cos(a) * r, 0, cz + oz + Math.sin(a) * r));
    }
  }
  if (dir < 0) pts.reverse();
  return makePath(pts);
}

function makePath(pts) {
  const seg = [0];
  for (let i = 1; i <= pts.length; i++) seg.push(seg[i - 1] + pts[i - 1].distanceTo(pts[i % pts.length]));
  const total = seg[seg.length - 1];
  return {
    total,
    at(s, out, dirOut) {
      s = ((s % total) + total) % total;
      let i = 1; while (seg[i] < s) i++;
      const a = pts[i - 1], b = pts[i % pts.length];
      const t = (s - seg[i - 1]) / (seg[i] - seg[i - 1] || 1);
      out.lerpVectors(a, b, t);
      if (dirOut) dirOut.subVectors(b, a).normalize();
      return out;
    },
  };
}

// Lệch sang phải theo hướng đi
function offsetPath(path, offset) {
  const P = new THREE.Vector3(), D = new THREE.Vector3();
  const pts = [];
  for (let s = 0; s < path.total; s += 1) {
    path.at(s, P, D);
    pts.push(new THREE.Vector3(P.x - D.z * offset, 0, P.z + D.x * offset));
  }
  return makePath(pts);
}

export async function createLife(scene, kitGltf, playerName) {
  const rnd = seeded(7);
  const npcs = [];
  const cars = [];
  const kit = kitGltf.scene;

  // ---------- Xe chạy ----------
  const loops = [
    offsetPath(roundedRect(0, 0, PITCH / 2, PITCH / 2, 8, 1), 1.9),
    offsetPath(roundedRect(0, 0, PITCH / 2, PITCH / 2, 8, -1), 1.9),
    offsetPath(roundedRect(0, 0, PITCH * 1.5, PITCH * 1.5, 8, 1), 1.9),
    offsetPath(roundedRect(0, 0, PITCH * 1.5, PITCH * 1.5, 8, -1), 1.9),
  ];
  const carKinds = ['car_sedan', 'car_taxi', 'car_hatchback', 'car_stationwagon', 'car_police', 'car_taxi'];
  const lightTex = radialTex('rgba(255,236,190,0.85)', 'rgba(255,236,190,0)');
  const beamMat = new THREE.MeshBasicMaterial({ map: lightTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const headMat = new THREE.MeshBasicMaterial({ color: '#fff4d6', toneMapped: false });
  const tailMat = new THREE.MeshBasicMaterial({ color: '#ff2a2a', toneMapped: false });
  const lampGeo = new THREE.SphereGeometry(0.13, 8, 6);
  loops.forEach((path, li) => {
    const n = li < 2 ? 2 : 3;
    for (let k = 0; k < n; k++) {
      const kind = carKinds[(li * 3 + k) % carKinds.length];
      const g = new THREE.Group();
      const model = kit.getObjectByName(kind).clone(true);
      model.scale.setScalar(6);
      g.add(model);
      for (const sx of [-0.75, 0.75]) {
        const h = new THREE.Mesh(lampGeo, headMat); h.position.set(sx, 1.1, 2.75); g.add(h);
        const t = new THREE.Mesh(lampGeo, tailMat); t.position.set(sx, 1.2, -2.8); g.add(t);
      }
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 8), beamMat);
      beam.rotation.x = -Math.PI / 2; beam.position.set(0, 0.06, 6.5); beam.renderOrder = 1;
      g.add(beam);
      scene.add(g);
      cars.push({ g, path, s: (k / n) * path.total + li * 13, v: 7, beam });
    }
  });

  // ---------- Người đi bộ ----------
  const names = Object.keys(CHARACTERS).filter((n) => n !== playerName);
  const blocks = [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1], [0, 0], [-2, 0], [2, 0], [1, 0]];
  const h = BLOCK / 2 - 0.85;
  const jobs = blocks.map(async ([i, j], k) => {
    const c = await createCharacter(names[k % names.length]);
    const g = new THREE.Group(); g.add(c.object); scene.add(g);
    const path = roundedRect(i * PITCH, j * PITCH, h, h, 1.5, rnd() < 0.5 ? 1 : -1);
    npcs.push({ c, g, blob: makeBlob(scene), path, s: rnd() * path.total, base: 1.15 + rnd() * 0.4, v: 0 });
  });
  // Không chờ tất cả: người đi bộ xuất hiện dần khi tải xong
  Promise.allSettled(jobs);

  const P = new THREE.Vector3(), D = new THREE.Vector3(), T = new THREE.Vector3();
  return {
    cars, npcs,
    update(dt, t, player, night) {
      for (const car of cars) {
        car.path.at(car.s, P, D);
        // Dừng khi người chơi hoặc xe khác ở ngay phía trước
        let want = 8;
        T.set(player.x - P.x, 0, player.z - P.z);
        const ahead = T.dot(D), side = Math.abs(T.x * D.z - T.z * D.x);
        if (ahead > 0 && ahead < 9 && side < 2.2) want = 0;
        for (const o of cars) {
          if (o === car || o.path !== car.path) continue;
          const gap = ((o.s - car.s) % car.path.total + car.path.total) % car.path.total;
          if (gap < 10) want = Math.min(want, Math.max(0, (gap - 6.5) * 2));
        }
        car.v += (want - car.v) * (1 - Math.exp(-(want < car.v ? 6 : 1.5) * dt));
        car.s += car.v * dt;
        car.path.at(car.s, P, D);
        car.path.at(car.s + 3, T);
        car.g.position.set(P.x, ROADY + 0.42, P.z);
        car.g.rotation.y = Math.atan2(T.x - P.x, T.z - P.z);
        car.beam.visible = night > 0.15;
      }
      for (const n of npcs) {
        n.path.at(n.s, P, D);
        T.set(player.x - P.x, 0, player.z - P.z);
        const blocked = T.lengthSq() < 4 && T.dot(D) > 0;
        n.v += ((blocked ? 0 : n.base) - n.v) * (1 - Math.exp(-6 * dt));
        n.s += n.v * dt;
        n.path.at(n.s, P, D);
        n.g.position.set(P.x, SIDEWALK, P.z);
        n.g.rotation.y = Math.atan2(D.x, D.z);
        n.c.animate(dt, n.v, 0, t);
        n.blob.position.set(P.x, SIDEWALK + 0.03, P.z);
      }
    },
  };
}
