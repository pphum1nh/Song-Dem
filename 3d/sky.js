// Bầu trời, mặt trời/mặt trăng, sao, sương mù: tất cả chạy theo giờ trong game.
import * as THREE from 'three';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const C = (h) => new THREE.Color(h);
const PAL = {
  topNight: C('#0a0620'), topDay: C('#3f82d4'),
  horNight: C('#2b1340'), horDay: C('#bfe0f5'), horDusk: C('#ef8a52'),
  hemiNight: C('#8a7ad6'), hemiDay: C('#cfe3ff'),
  gndNight: C('#3a2a46'), gndDay: C('#5f5444'),
  moon: C('#8ea4ff'), sun: C('#fff4e0'), sunLow: C('#ffab66'),
};

export function createSky(scene) {
  const uniforms = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 16),
    new THREE.ShaderMaterial({
      uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vDir;
        void main(){ float h = clamp(vDir.y * 1.4, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.6)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
    }),
  );
  dome.renderOrder = -10;
  scene.add(dome);

  const starGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 900; i++) {
    const u = Math.random() * Math.PI * 2, v = Math.random() * 0.95 + 0.05;
    const r = 520;
    pts.push(Math.cos(u) * Math.sqrt(1 - v * v) * r, v * r, Math.sin(u) * Math.sqrt(1 - v * v) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({ color: '#f6f0dc', fog: false, transparent: true }));
  scene.add(moon);

  const hemi = new THREE.HemisphereLight();
  // Đèn phụ ấm đi theo nhân vật, chỉ bật về đêm để nhân vật không thành bóng đen
  const fill = new THREE.PointLight('#ffd6a8', 0, 16, 1.6);
  scene.add(fill);
  const sun = new THREE.DirectionalLight();
  scene.add(hemi, sun, sun.target);

  const dir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();
  const tmp = new THREE.Color();
  const state = { night: 1 };

  state.update = (minuteOfDay, center) => {
    const a = ((minuteOfDay - 360) / 720) * Math.PI; // 0 lúc 6:00, π lúc 18:00
    const elev = Math.sin(a);
    const day = smooth(-0.1, 0.3, elev);
    const dusk = Math.exp(-Math.pow(elev / 0.2, 2));
    const night = 1 - day;
    state.night = night;

    uniforms.top.value.copy(PAL.topNight).lerp(PAL.topDay, day);
    uniforms.horizon.value.copy(PAL.horNight).lerp(PAL.horDay, day).lerp(PAL.horDusk, dusk * 0.7);
    scene.fog.color.copy(uniforms.horizon.value);

    dir.set(Math.cos(a), elev, -0.35).normalize();
    const lightDir = day > 0.15 ? dir : moonDir.set(-dir.x, Math.max(0.35, -dir.y), -dir.z).normalize();
    sun.position.copy(center).addScaledVector(lightDir, 100);
    sun.target.position.copy(center);
    sun.intensity = day * 2.3 + night * 0.9;
    sun.color.copy(PAL.moon).lerp(tmp.copy(PAL.sun).lerp(PAL.sunLow, dusk), day);

    hemi.intensity = 1.0 + day * 0.5 + night * 0.6;
    hemi.color.copy(PAL.hemiNight).lerp(PAL.hemiDay, day);
    hemi.groundColor.copy(PAL.gndNight).lerp(PAL.gndDay, day);

    fill.position.set(center.x, center.y + 3.2, center.z);
    fill.intensity = 22 * night;
    dome.position.copy(center);
    stars.position.copy(center);
    starMat.opacity = night * night;
    stars.visible = night > 0.02;
    moon.position.copy(center).addScaledVector(dir, -480);
    moon.position.y = Math.max(moon.position.y, center.y + 90);
    moon.material.opacity = night;
    moon.visible = night > 0.02;
  };
  return state;
}
