// Bên trong nhà: phòng kiểu "nhà búp bê" (tường chỉ thấy từ phía trong) với nội thất KayKit Furniture Bits (CC0).
import * as THREE from 'three';
import { Builder, C } from './kaybuild.js';

export const ROOM = { x: 0, z: -400, y: 0.44, W: 10, D: 7.5 };
const F = 0.8; // 1 đơn vị nội thất KayKit ≈ 0,72 m

export function buildInterior(scene, furnGltf, kitMaterial, colliders, interactables) {
  const group = new THREE.Group();
  group.position.set(ROOM.x, ROOM.y, ROOM.z);
  scene.add(group);
  const { W, D } = ROOM, H = 3.4;

  // Sàn gỗ, tường, chân tường, cửa sổ, cửa ra vào
  const k = new Builder();
  for (let i = 0; i < 10; i++) {
    const x = -W / 2 + (i + 0.5) * (W / 10);
    k.box(W / 10 - 0.03, 0.1, D, x, -0.1, 0, i % 2 ? C.brick : C.terra, { r: 0.02, a: 0.7, b: 0.75 });
  }
  const wall = (w, x, z, ry, cell) => {
    const g = new THREE.PlaneGeometry(w, H);
    k.addGeo(g, cell, { ry, x, y: H / 2, z, a: 0.1, b: 0.6 });
  };
  wall(W, 0, -D / 2, 0, C.cream); wall(D, -W / 2, 0, Math.PI / 2, C.peach); wall(D, W / 2, 0, -Math.PI / 2, C.peach);
  wall(W / 2 - 0.9, -(W / 4 + 0.45), D / 2, Math.PI, C.cream); wall(W / 2 - 0.9, W / 4 + 0.45, D / 2, Math.PI, C.cream);
  wall(1.8, 0, D / 2, Math.PI, C.cream);
  const pane = (w, h, x, y, z, ry) => {
    k.addGeo(new THREE.PlaneGeometry(w + 0.3, h + 0.3), C.white, { ry, x, y, z });
    const g = new THREE.PlaneGeometry(w, h); k.addGeo(g, null, { glass: true, ry, x: x + Math.sin(ry) * 0.01, y, z: z + Math.cos(ry) * 0.01 });
  };
  pane(1.4, 1.3, -1.6, 2.0, -D / 2 + 0.02, 0); pane(1.4, 1.3, 4.0, 2.0, -D / 2 + 0.02, 0);
  pane(1.4, 1.3, -W / 2 + 0.02, 2.0, 2.0, Math.PI / 2); pane(1.4, 1.3, W / 2 - 0.02, 2.0, 1.2, -Math.PI / 2);
  // Cửa ra vào ở tường trước (nhìn từ trong)
  k.addGeo(new THREE.PlaneGeometry(1.6, 2.5), C.teal, { ry: Math.PI, x: 0, y: 1.25, z: D / 2 - 0.02 });
  k.addGeo(new THREE.PlaneGeometry(2.0, 2.8), C.white, { ry: Math.PI, x: 0, y: 1.4, z: D / 2 - 0.01 });
  // Chân tường
  k.box(W, 0.14, 0.08, 0, 0, -D / 2 + 0.04, C.white, { r: 0 });
  k.box(0.08, 0.14, D, -W / 2 + 0.04, 0, 0, C.white, { r: 0 });
  k.box(0.08, 0.14, D, W / 2 - 0.04, 0, 0, C.white, { r: 0 });
  const roomMat = kitMaterial.clone(); roomMat.side = THREE.FrontSide;
  const shell = k.build(roomMat); shell.castShadow = false; group.add(shell);

  // Nội thất
  const kitScene = furnGltf.scene;
  const place = (name, x, z, ry = 0, y = 0, collide = true) => {
    const src = kitScene.getObjectByName(name);
    if (!src) return null;
    // Bọc trong nhóm: node gốc của mô hình nén giữ phần bù vị trí/tỉ lệ, không được ghi đè
    const o = new THREE.Group();
    o.add(src.clone(true));
    o.scale.setScalar(F); o.position.set(x, y, z); o.rotation.y = ry;
    group.add(o);
    if (collide) {
      group.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(o);
      colliders.push({ minX: b.min.x + 0.05, maxX: b.max.x - 0.05, minZ: b.min.z + 0.05, maxZ: b.max.z - 0.05 });
    }
    return o;
  };
  place('rug_rectangle_stripes_A', 2.3, -0.9, 0, 0.001, false);
  place('rug_oval_A', -2.6, 2.0, 0, 0.001, false);
  place('bed_double_A', -3.1, -2.45, 0);
  place('lamp_table', -1.25, -3.25, 0);
  place('shelf_B_large_decorated', -4.6, 0.6, Math.PI / 2);
  place('couch_pillows', 2.3, -2.95, 0);
  place('table_low', 2.3, -1.0, 0);
  place('armchair_pillows', 4.2, -0.9, -Math.PI / 2);
  place('lamp_standing', 4.4, -3.2, 0);
  place('cabinet_medium_decorated', 0.3, -3.35, 0);
  place('table_medium', -2.6, 2.0, 0);
  place('chair_A_wood', -3.8, 2.0, Math.PI / 2);
  place('chair_A_wood', -1.4, 2.0, -Math.PI / 2);
  place('cactus_medium_A', 4.4, 3.0, 0);
  place('pictureframe_large_A', 2.3, -3.72, 0, 1.55, false);
  place('pictureframe_medium', -3.1, -3.72, 0, 1.55, false);
  // Tường làm vật cản
  colliders.push(
    { minX: ROOM.x - W / 2 - 1, maxX: ROOM.x + W / 2 + 1, minZ: ROOM.z - D / 2 - 1, maxZ: ROOM.z - D / 2 + 0.1 },
    { minX: ROOM.x - W / 2 - 1, maxX: ROOM.x - W / 2 + 0.1, minZ: ROOM.z - D / 2, maxZ: ROOM.z + D / 2 },
    { minX: ROOM.x + W / 2 - 0.1, maxX: ROOM.x + W / 2 + 1, minZ: ROOM.z - D / 2, maxZ: ROOM.z + D / 2 },
    { minX: ROOM.x - W / 2 - 1, maxX: ROOM.x - 0.8, minZ: ROOM.z + D / 2 - 0.1, maxZ: ROOM.z + D / 2 + 1 },
    { minX: ROOM.x + 0.8, maxX: ROOM.x + W / 2 + 1, minZ: ROOM.z + D / 2 - 0.1, maxZ: ROOM.z + D / 2 + 1 },
    { minX: ROOM.x - 0.8, maxX: ROOM.x + 0.8, minZ: ROOM.z + D / 2 + 0.3, maxZ: ROOM.z + D / 2 + 1 },
  );
  interactables.push(
    { id: 'bed', x: ROOM.x - 3.1, z: ROOM.z - 0.9, r: 1.5, label: 'Đi ngủ', indoor: true },
    { id: 'exit', x: ROOM.x, z: ROOM.z + D / 2 - 0.6, r: 1.3, label: 'Ra ngoài', indoor: true },
  );

  const light = new THREE.PointLight('#ffe0b0', 0, 16, 1.4); light.position.set(0, 3.0, -0.3); group.add(light);
  const lamp2 = new THREE.PointLight('#ffc98a', 0, 6, 1.6); lamp2.position.set(4.4, 1.9, -3.1); group.add(lamp2);
  group.visible = false;
  return {
    group,
    spawn: new THREE.Vector3(ROOM.x, ROOM.y, ROOM.z + D / 2 - 1.4),
    setActive(on) { group.visible = on; light.intensity = on ? 28 : 0; lamp2.intensity = on ? 6 : 0; },
  };
}
