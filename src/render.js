// 低分辨率渲染 + 像素后处理（量化调色 + 抖动 + 深度描边）
import * as THREE from 'three';

export const W = 480, H = 270;

const POST_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const POST_FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform vec2 texel; uniform float near; uniform float far; uniform float flash; uniform vec3 flashCol;
float lin(float d){ float z = d*2.0-1.0; return 2.0*near*far/(far+near - z*(far-near)); }
float inv(vec2 uv){ return 1.0/lin(texture2D(tDepth, uv).x); }
float bayer(vec2 p){
  vec2 q = mod(floor(p), 4.0);
  float a = mod(q.x + q.y*4.0, 16.0);
  // 4x4 bayer
  float m[16];
  m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
  m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
  float r = 0.0;
  for(int i=0;i<16;i++){ if(float(i)==a) r = m[i]; }
  return r/16.0 - 0.5;
}
void main(){
  vec3 col = texture2D(tColor, vUv).rgb;
  // 深度描边（用 1/z 的二阶差分，平面为 0）
  float c = inv(vUv);
  float l = inv(vUv - vec2(texel.x,0.)), r = inv(vUv + vec2(texel.x,0.));
  float u = inv(vUv - vec2(0.,texel.y)), d = inv(vUv + vec2(0.,texel.y));
  float e = max(abs(l + r - 2.0*c), abs(u + d - 2.0*c));
  float edge = step(0.085 * c + 0.002, e);
  col = pow(col, vec3(1.0/2.2));
  col = mix(col, vec3(dot(col, vec3(0.333))), -0.12);        // 稍提饱和
  col = mix(col, flashCol, flash);
  float lv = 7.0;
  vec2 fp = vUv / texel;
  col += bayer(fp) * (0.55 / lv);
  col = floor(col * lv + 0.5) / lv;
  col = mix(col, col * vec3(0.30, 0.32, 0.5), edge);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;

  const depthTexture = new THREE.DepthTexture(W, H);
  depthTexture.type = THREE.UnsignedIntType;
  const rt = new THREE.WebGLRenderTarget(W, H, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture, depthBuffer: true,
  });

  const camera = new THREE.PerspectiveCamera(48, W / H, 0.5, 220);
  const post = {
    mat: new THREE.ShaderMaterial({
      vertexShader: POST_VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false,
      uniforms: {
        tColor: { value: rt.texture }, tDepth: { value: depthTexture },
        texel: { value: new THREE.Vector2(1 / W, 1 / H) },
        near: { value: camera.near }, far: { value: camera.far },
        flash: { value: 0 }, flashCol: { value: new THREE.Vector3(1, 1, 1) },
      },
    }),
  };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post.mat);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene(); postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    renderer, camera,
    setFlash(v, col = [1, 1, 1]) { post.mat.uniforms.flash.value = v; post.mat.uniforms.flashCol.value.set(...col); },
    render(scene) {
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    },
  };
}

// ---------- 第三人称相机 ----------
export class CamCtrl {
  constructor(camera, world) {
    this.cam = camera; this.world = world;
    this.yaw = 0; this.pitch = 0.56; this.dist = 17; this.curDist = 17;
    this.lock = true; this.manualT = 0; this.shake = 0;
    this.focus = new THREE.Vector3();
  }
  /** 相机朝向的水平方向 */
  get fwd() { return [Math.sin(this.yaw), Math.cos(this.yaw)]; }
  get right() { return [-Math.cos(this.yaw), Math.sin(this.yaw)]; }

  update(dt, me, foe, rot) {
    if (rot) { this.yaw += rot * 2.4 * dt; this.manualT = 0.9; }
    this.manualT -= dt;
    if (this.lock && foe && this.manualT <= 0) {
      const dx = foe.x - me.x, dz = foe.z - me.z;
      if (dx * dx + dz * dz > 1) {
        const target = Math.atan2(dx, dz);
        let d = target - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * (1 - Math.exp(-3.2 * dt));
      }
    }
    // 焦点：玩家 + 稍微朝敌人偏移，保证双方都在画面
    const fx = me.x, fz = me.z;
    let ox = 0, oz = 0;
    if (foe) {
      const dx = foe.x - me.x, dz = foe.z - me.z, dl = Math.hypot(dx, dz) || 1;
      const k = Math.min(dl * 0.22, 4);
      ox = (dx / dl) * k; oz = (dz / dl) * k;
    }
    const tx = fx + ox, ty = me.y * 0.5 + 1.9, tz = fz + oz;
    this.focus.x += (tx - this.focus.x) * (1 - Math.exp(-9 * dt));
    this.focus.y += (ty - this.focus.y) * (1 - Math.exp(-6 * dt));
    this.focus.z += (tz - this.focus.z) * (1 - Math.exp(-9 * dt));

    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    // 遮挡：在水平面上对碰撞盒做射线裁剪
    let maxD = this.dist;
    const hx = -sy * cp, hz = -cy * cp;
    const t = this.world.rayClip(this.focus.x, this.focus.z, hx, hz, this.dist * cp, 0.8, false, { y0: this.focus.y, slope: sp / cp });
    maxD = Math.max(4.5, Math.min(this.dist, t / cp));
    const k = maxD < this.curDist ? 14 : 2.5;
    this.curDist += (maxD - this.curDist) * (1 - Math.exp(-k * dt));
    const D = this.curDist;
    this.shake = Math.max(0, this.shake - dt * 2.8);
    const s = this.shake * this.shake;
    this.cam.position.set(
      this.focus.x - sy * cp * D + (Math.random() - 0.5) * s * 1.4,
      this.focus.y + sp * D + (Math.random() - 0.5) * s * 1.4,
      this.focus.z - cy * cp * D + (Math.random() - 0.5) * s * 1.4);
    this.cam.lookAt(this.focus.x + sy * 2, this.focus.y + 0.3, this.focus.z + cy * 2);
  }
}
