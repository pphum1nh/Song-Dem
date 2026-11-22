// Nhân vật dựng bằng khối, có dáng đi vung tay chân và bóng tròn dưới chân.
import * as THREE from 'three';
import { radialTex } from './world.js';

const WALK = 4.2, RUN = 7.8, RADIUS = 0.45;

export class Player {
  constructor(scene) {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: '#e8b98f', roughness: 0.7 });
    const shirt = new THREE.MeshStandardMaterial({ color: '#b3193f', roughness: 0.7 });
    const jacket = new THREE.MeshStandardMaterial({ color: '#1f1b2e', roughness: 0.6 });
    const pants = new THREE.MeshStandardMaterial({ color: '#2a2a3c', roughness: 0.8 });
    const shoe = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.5 });
    const hair = new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.9 });

    const body = new THREE.Group(); g.add(body);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.66, 0.34), jacket); torso.position.y = 1.2; body.add(torso);
    const tee = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.6, 0.02), shirt); tee.position.set(0, 1.21, 0.175); body.add(tee);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), skin); head.position.y = 1.72; body.add(head);
    const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.225, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    hairM.position.y = 1.74; hairM.rotation.x = -0.25; body.add(hairM);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.12, 8), skin); neck.position.y = 1.56; body.add(neck);

    const limb = (w, h, mat, x, y) => {
      const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat); m.position.y = -h / 2; pivot.add(m);
      body.add(pivot); return { pivot, mesh: m };
    };
    this.armL = limb(0.16, 0.62, jacket, -0.4, 1.5);
    this.armR = limb(0.16, 0.62, jacket, 0.4, 1.5);
    for (const a of [this.armL, this.armR]) {
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), skin); hand.position.y = -0.66; a.pivot.add(hand);
    }
    this.legL = limb(0.2, 0.82, pants, -0.15, 0.87);
    this.legR = limb(0.2, 0.82, pants, 0.15, 0.87);
    for (const l of [this.legL, this.legR]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.32), shoe); s.position.set(0, -0.84, 0.05); l.pivot.add(s);
    }

    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: radialTex('rgba(0,0,0,.55)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.renderOrder = 2;
    scene.add(blob);

    scene.add(g);
    this.group = g; this.body = body; this.blob = blob;
    this.position = g.position;
    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.phase = 0;
    this.speed = 0;
  }

  update(dt, mx, mz, run, colliders, groundHeight, limit) {
    const mag = Math.min(1, Math.hypot(mx, mz));
    const target = run ? RUN : WALK * Math.max(mag, mag > 0.05 ? 0.45 : 0);
    const tx = mag > 0.01 ? (mx / mag) * target : 0;
    const tz = mag > 0.01 ? (mz / mag) * target : 0;
    const k = 1 - Math.exp(-(mag > 0.01 ? 12 : 16) * dt);
    this.velocity.x += (tx - this.velocity.x) * k;
    this.velocity.z += (tz - this.velocity.z) * k;

    const p = this.position;
    p.x += this.velocity.x * dt;
    p.z += this.velocity.z * dt;
    resolve(p, RADIUS, colliders);
    p.x = Math.max(-limit, Math.min(limit, p.x));
    p.z = Math.max(-limit, Math.min(limit, p.z));
    const gy = groundHeight(p.x, p.z);
    p.y += (gy - p.y) * (1 - Math.exp(-20 * dt));

    this.speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.speed > 0.3) {
      const want = Math.atan2(this.velocity.x, this.velocity.z);
      let d = want - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * (1 - Math.exp(-14 * dt));
    }
    this.group.rotation.y = this.heading;

    const s = Math.min(1, this.speed / RUN);
    this.phase += dt * (3 + this.speed * 1.5);
    const swing = Math.sin(this.phase) * (0.25 + 0.65 * s) * Math.min(1, this.speed / 1.2);
    this.legL.pivot.rotation.x = swing;
    this.legR.pivot.rotation.x = -swing;
    this.armL.pivot.rotation.x = -swing * 0.85;
    this.armR.pivot.rotation.x = swing * 0.85;
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.06 * Math.min(1, this.speed / 2);
    this.body.rotation.x = s * 0.12;
    this.armL.pivot.rotation.z = -0.06; this.armR.pivot.rotation.z = 0.06;

    this.blob.position.set(p.x, p.y + 0.03, p.z);
  }
}

function resolve(p, r, boxes) {
  for (const b of boxes) {
    if (p.x < b.minX - r || p.x > b.maxX + r || p.z < b.minZ - r || p.z > b.maxZ + r) continue;
    const cx = Math.min(Math.max(p.x, b.minX), b.maxX);
    const cz = Math.min(Math.max(p.z, b.minZ), b.maxZ);
    const dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      p.x += (dx / d) * (r - d); p.z += (dz / d) * (r - d);
    } else {
      const l = p.x - b.minX, rr = b.maxX - p.x, t = p.z - b.minZ, bb = b.maxZ - p.z;
      const m = Math.min(l, rr, t, bb);
      if (m === l) p.x = b.minX - r; else if (m === rr) p.x = b.maxX + r; else if (m === t) p.z = b.minZ - r; else p.z = b.maxZ + r;
    }
  }
}
