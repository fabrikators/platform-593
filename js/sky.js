// The sky stays paper until the camera is out on the open terrace; then the
// late-afternoon sky (the CC0 HDRI) dissolves in. The dome follows the camera.
import * as THREE from 'three';
import { PAPER } from './reveal.js';

export class Sky {
  constructor() {
    const paper = {};
    PAPER.getRGB(paper, THREE.SRGBColorSpace);
    this.uniforms = {
      tSky: { value: null },
      uRot: { value: 0 },
      uK: { value: 0 },
      uGain: { value: 1 },
      uPaper: { value: new THREE.Vector3(paper.r, paper.g, paper.b) },
    };
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main(){
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tSky; uniform float uRot; uniform float uK; uniform float uGain; uniform vec3 uPaper;
        varying vec3 vDir;
        #include <common>
        void main(){
          vec3 d = normalize(vDir);
          float u = (atan(d.z, d.x) + uRot) * RECIPROCAL_PI2 + 0.5;
          float v = asin(clamp(d.y, -1.0, 1.0)) * RECIPROCAL_PI + 0.5;
          vec3 c = texture2D(tSky, vec2(fract(u), v)).rgb * uGain;
          // late-day grade: the haze near the horizon warms, strongest toward the sun's bearing
          float az = cos(atan(d.z, d.x) + uRot - 0.701);
          float low = smoothstep(0.45, -0.02, d.y);
          c *= mix(vec3(1.0), vec3(1.32, 0.98, 0.76), low * (0.45 + 0.55 * max(az, 0.0)));
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          gl_FragColor.rgb = mix(uPaper, gl_FragColor.rgb, uK);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(150, 64, 32), m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    this.mesh.visible = false;
  }
  setTexture(t) { this.uniforms.tSky.value = t; }
  update(camera, k) {
    this.uniforms.uK.value = k;
    this.mesh.visible = k > 0.001 && !!this.uniforms.tSky.value;
    this.mesh.position.copy(camera.position);
  }
}
