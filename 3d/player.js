// Người chơi: vật lý đơn giản (hình tròn với hộp va chạm) + nhân vật có xương.
import * as THREE from 'three';
import { radialTex } from './world.js';
import { createCharacter } from './character.js';

const WALK = 3.4, RUN = 7.2, RADIUS = 0.4;

export function makeBlob(scene) {
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: radialTex('rgba(0,0,0,.5)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.renderOrder = 2;
  scene.add(blob);
  return blob;
}

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.blob = makeBlob(scene);
    this.position = this.group.position;
    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.run = 0;
    this.character = null;
    this.charName = null;
  }

  async setCharacter(name) {
    const c = await createCharacter(name);
    if (this.character) this.group.remove(this.character.object);
    this.character = c; this.charName = name;
    this.group.add(c.object);
  }

  update(dt, t, mx, mz, run, colliders, groundHeight, limit) {
    const mag = Math.min(1, Math.hypot(mx, mz));
    const target = run ? RUN : WALK * (mag > 0.05 ? Math.max(mag, 0.4) : 0);
    const tx = mag > 0.01 ? (mx / mag) * target : 0;
    const tz = mag > 0.01 ? (mz / mag) * target : 0;
    const k = 1 - Math.exp(-(mag > 0.01 ? 10 : 14) * dt);
    this.velocity.x += (tx - this.velocity.x) * k;
    this.velocity.z += (tz - this.velocity.z) * k;

    const p = this.position;
    p.x += this.velocity.x * dt;
    p.z += this.velocity.z * dt;
    resolve(p, RADIUS, colliders);
    p.x = Math.max(-limit, Math.min(limit, p.x));
    p.z = Math.max(-limit, Math.min(limit, p.z));
    p.y += (groundHeight(p.x, p.z) - p.y) * (1 - Math.exp(-18 * dt));

    this.speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.speed > 0.3) {
      let d = Math.atan2(this.velocity.x, this.velocity.z) - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * (1 - Math.exp(-12 * dt));
    }
    this.group.rotation.y = this.heading;
    this.run += ((this.speed > WALK + 0.5 ? 1 : 0) - this.run) * (1 - Math.exp(-6 * dt));
    if (this.character) this.character.animate(dt, this.speed, this.run, t);
    this.blob.position.set(p.x, p.y + 0.03, p.z);
  }
}

export function resolve(p, r, boxes) {
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
