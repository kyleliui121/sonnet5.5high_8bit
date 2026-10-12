// 方块网格辅助：材质缓存 + 带UV平铺的盒子
import * as THREE from 'three';

const colMats = {}, texMats = {};
export function colMat(hex, opts = {}) {
  const k = hex + JSON.stringify(opts);
  return (colMats[k] ||= new THREE.MeshLambertMaterial({ color: hex, ...opts }));
}
export function glowMat(hex) {
  const k = 'g' + hex;
  return (colMats[k] ||= new THREE.MeshBasicMaterial({ color: hex }));
}
export function texMat(tex) {
  return (texMats[tex.id] ||= new THREE.MeshLambertMaterial({ map: tex }));
}

const TILE = 2; // 一张 16px 纹理覆盖 2 个世界单位 => 8px/unit

/** 以底面中心为基点放置盒子。mat 为材质；若材质带 map 则按尺寸平铺 UV。 */
export function box(parent, mat, cx, y0, cz, w, h, d, o = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (mat.map) {
    const uv = geo.attributes.uv;
    const sc = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) {
      for (let i = 0; i < 4; i++) {
        const idx = f * 4 + i;
        uv.setXY(idx, (uv.getX(idx) * sc[f][0]) / TILE, (uv.getY(idx) * sc[f][1]) / TILE);
      }
    }
  }
  const m = new THREE.Mesh(geo, mat);
  m.position.set(cx, y0 + h / 2, cz);
  m.castShadow = o.cast !== false;
  m.receiveShadow = o.receive !== false;
  if (o.rot) m.rotation.y = o.rot;
  parent.add(m);
  return m;
}
