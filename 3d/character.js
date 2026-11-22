// Nhân vật từ bộ "Vocations and Uniforms" (CC BY-SA). Mô hình gốc ở tư thế chữ T, không có
// animation, nên dáng đi được tạo bằng cách xoay xương theo trục của nhân vật.
import * as THREE from 'three';
import { loadGLTF } from './gltf-load.js';
import { clone as cloneSkinned } from './vendor/addons/utils/SkeletonUtils.js';

export const CHARACTERS = {
  Businessman: 'Doanh nhân', Businesswoman: 'Nữ doanh nhân', BaseMale: 'Thanh niên', BaseFemale: 'Cô gái',
  Police: 'Cảnh sát', Nurse: 'Y tá', Doctor: 'Bác sĩ', Engineer: 'Kỹ sư', Mechanic: 'Thợ máy',
  Teacher: 'Cô giáo', StudentM: 'Nam sinh', StudentF: 'Nữ sinh',
};
const SCALE = 1.88; // mô hình gốc cao ~0,95 → ~1,78 m

const cache = new Map();
export function preload(name) {
  if (!cache.has(name)) cache.set(name, loadGLTF(`assets/chars/${name}.json`));
  return cache.get(name);
}

const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
const tq = new THREE.Quaternion(), tq2 = new THREE.Quaternion(), wq = new THREE.Quaternion();

// Trục của mô hình biểu diễn trong hệ toạ độ cục bộ của xương (mô hình đang ở gốc, không xoay).
function localAxis(bone, axis) {
  bone.getWorldQuaternion(wq);
  return axis.clone().applyQuaternion(wq.invert());
}
function bake(bone, axis, angle) {
  bone.quaternion.multiply(tq.setFromAxisAngle(localAxis(bone, axis), angle));
  bone.updateMatrixWorld(true);
}

export async function createCharacter(name) {
  const gltf = await preload(name);
  const root = cloneSkinned(gltf.scene);
  root.traverse((o) => {
    if (o.isMesh) {
      o.frustumCulled = false;
      o.material = o.material.clone();
      o.material.metalness = 0; o.material.roughness = 0.75; o.material.side = THREE.FrontSide;
    }
  });
  root.updateMatrixWorld(true);
  const bone = (n) => root.getObjectByName(n);
  const B = {
    pelvis: bone('pelvis'), spine1: bone('spine1'), spine2: bone('spine2'), spine3: bone('spine3'), head: bone('head'),
    uaL: bone('upper_armL'), uaR: bone('upper_armR'), faL: bone('forearmL'), faR: bone('forearmR'),
    thL: bone('thighL'), thR: bone('thighR'), shL: bone('shinL'), shR: bone('shinR'), ftL: bone('footL'), ftR: bone('footR'),
  };

  // Hạ tay xuống từ tư thế chữ T (mô hình nhìn về −Z, tay trái ở phía −X)
  bake(B.uaL, AZ, 1.22); bake(B.uaR, AZ, -1.22);
  bake(B.faL, AX, 0.18); bake(B.faR, AX, 0.18);

  const rig = {};
  for (const [k, b] of Object.entries(B)) {
    if (!b) continue;
    rig[k] = { b, rest: b.quaternion.clone(), x: localAxis(b, AX), y: localAxis(b, AY) };
  }
  const set = (k, ax, ay = 0) => {
    const r = rig[k]; if (!r) return;
    r.b.quaternion.copy(r.rest).multiply(tq.setFromAxisAngle(r.x, ax));
    if (ay) r.b.quaternion.multiply(tq2.setFromAxisAngle(r.y, ay));
  };

  const object = new THREE.Group();
  root.rotation.y = Math.PI;        // để mặt nhân vật quay về +Z như phần còn lại của game
  root.scale.setScalar(SCALE);
  object.add(root);

  let phase = Math.random() * 6;
  return {
    object,
    // speed: m/s thực tế; run: 0..1; t: thời gian để thở khi đứng yên
    animate(dt, speed, run, t) {
      const amt = Math.min(1, speed / 1.2);
      const stride = 1.5 + 1.1 * run;
      phase += dt * (speed / stride) * Math.PI * 2;
      const sL = Math.sin(phase), cL = Math.cos(phase);
      const A = (0.42 + 0.3 * run) * amt;
      // Mô hình nhìn về −Z: xoay dương quanh +X đưa chân/tay ra trước
      set('thL', sL * A);
      set('thR', -sL * A);
      const knee = 0.75 + 0.7 * run;
      set('shL', -(0.06 + knee * Math.max(0, cL)) * amt);
      set('shR', -(0.06 + knee * Math.max(0, -cL)) * amt);
      set('ftL', 0.15 * Math.max(0, -sL) * amt);
      set('ftR', 0.15 * Math.max(0, sL) * amt);
      const arm = (0.38 + 0.4 * run) * amt;
      const breathe = Math.sin(t * 1.7) * 0.03 * (1 - amt);
      set('uaL', -sL * arm + breathe);
      set('uaR', sL * arm + breathe);
      set('faL', (0.15 + 0.9 * run) * amt);
      set('faR', (0.15 + 0.9 * run) * amt);
      set('spine1', -0.16 * run * amt);
      set('spine2', 0, sL * 0.09 * amt);
      set('spine3', breathe * 0.6);
      set('head', 0.05 * run * amt);
      root.position.y = Math.abs(cL) * 0.05 * amt;
    },
  };
}
