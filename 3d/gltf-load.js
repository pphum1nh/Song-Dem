// Nạp glTF mà không bắt trình duyệt tải URL "data:" hay "blob:".
// Một số nơi lưu trang (như trang chia sẻ của Claude) chặn các URL đó, làm GLTFLoader báo
// "Failed to load buffer". Ở đây dữ liệu base64 được tự giải mã, ghép thành GLB trong bộ nhớ,
// còn texture được giải mã bằng createImageBitmap rồi gắn vào vật liệu sau.
import * as THREE from 'three';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

function decodeDataUri(uri) {
  const comma = uri.indexOf(',');
  const bin = atob(uri.slice(comma + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return { bytes: out, mime: uri.slice(5, uri.indexOf(';')) };
}

const TEXTURE_SLOTS = [
  ['baseColorTexture', 'map', true], ['emissiveTexture', 'emissiveMap', true],
  ['normalTexture', 'normalMap', false], ['occlusionTexture', 'aoMap', false],
];

export async function loadGLTF(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được ${url} (${res.status})`);
  const json = await res.json();

  // 1) Gộp mọi buffer vào một khối nhị phân duy nhất
  const chunks = [];
  const bufferOffset = [];
  let size = 0;
  for (const b of json.buffers || []) {
    const { bytes } = decodeDataUri(b.uri);
    bufferOffset.push(size);
    chunks.push(bytes); size += bytes.length;
    const pad = (4 - (size % 4)) % 4;
    if (pad) { chunks.push(new Uint8Array(pad)); size += pad; }
  }
  for (const v of json.bufferViews || []) {
    v.byteOffset = (v.byteOffset || 0) + bufferOffset[v.buffer];
    v.buffer = 0;
  }
  json.buffers = [{ byteLength: size }];

  // 2) Tách ảnh ra, ghi nhớ vật liệu nào dùng ảnh nào
  const images = (json.images || []).map((im) => (im.uri ? decodeDataUri(im.uri) : null));
  const texImage = (json.textures || []).map((t) => t.source ?? t.extensions?.EXT_texture_webp?.source);
  const wanted = []; // [materialIndex, threeSlot, imageIndex, srgb]
  (json.materials || []).forEach((m, mi) => {
    const pbr = m.pbrMetallicRoughness || {};
    for (const [key, slot, srgb] of TEXTURE_SLOTS) {
      const ref = key === 'baseColorTexture' ? pbr[key] : m[key];
      if (!ref) continue;
      wanted.push([mi, slot, texImage[ref.index], srgb]);
      if (key === 'baseColorTexture') delete pbr[key]; else delete m[key];
    }
  });
  delete json.images; delete json.textures; delete json.samplers;
  const strip = (arr) => arr && arr.filter((e) => e !== 'EXT_texture_webp');
  if (json.extensionsUsed) json.extensionsUsed = strip(json.extensionsUsed);
  if (json.extensionsRequired) json.extensionsRequired = strip(json.extensionsRequired);

  // 3) Đóng gói GLB trong bộ nhớ và cho GLTFLoader phân tích
  const enc = new TextEncoder();
  let jsonBytes = enc.encode(JSON.stringify(json));
  const jpad = (4 - (jsonBytes.length % 4)) % 4;
  if (jpad) { const t = new Uint8Array(jsonBytes.length + jpad); t.set(jsonBytes); t.fill(0x20, jsonBytes.length); jsonBytes = t; }
  const total = 12 + 8 + jsonBytes.length + 8 + size;
  const glb = new ArrayBuffer(total);
  const dv = new DataView(glb);
  const u8 = new Uint8Array(glb);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length, true); dv.setUint32(16, 0x4e4f534a, true); u8.set(jsonBytes, 20);
  let o = 20 + jsonBytes.length;
  dv.setUint32(o, size, true); dv.setUint32(o + 4, 0x004e4942, true); o += 8;
  for (const c of chunks) { u8.set(c, o); o += c.length; }
  const gltf = await loader.parseAsync(glb, '');

  // 4) Giải mã ảnh và gắn texture (mỗi ảnh chỉ giải mã một lần)
  const texCache = new Map();
  const getTex = async (imgIndex, srgb) => {
    const key = imgIndex + (srgb ? 's' : 'l');
    if (!texCache.has(key)) {
      texCache.set(key, (async () => {
        const im = images[imgIndex];
        const bmp = await createImageBitmap(new Blob([im.bytes], { type: im.mime }));
        const tex = new THREE.Texture(bmp);
        tex.flipY = false;
        if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        return tex;
      })());
    }
    return texCache.get(key);
  };
  const byIndex = new Map();
  gltf.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) {
      const a = gltf.parser.associations.get(mat);
      if (a && a.materials !== undefined) {
        if (!byIndex.has(a.materials)) byIndex.set(a.materials, []);
        byIndex.get(a.materials).push(mat);
      }
    }
  });
  await Promise.all(wanted.map(async ([mi, slot, imgIndex, srgb]) => {
    if (imgIndex === undefined || !images[imgIndex]) return;
    const tex = await getTex(imgIndex, srgb);
    for (const mat of byIndex.get(mi) || []) { mat[slot] = tex; mat.needsUpdate = true; }
  }));
  return gltf;
}
