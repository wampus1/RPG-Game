// CRT post-process: the low-res frame is uploaded as a texture and drawn
// through a shader with barrel curvature, scanlines, an aperture-grille mask,
// chromatic fringing, vignette, flicker and a soft bloom "glow".
import { VIEW_W, VIEW_H } from '../config.js';

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uSharp;
uniform sampler2D uSoft;
uniform vec2 uSrc;
uniform vec2 uOut;
uniform float uTime;
uniform float uCurve;
uniform float uGlow;
in vec2 vUv;
out vec4 outColor;

vec2 curve(vec2 uv) {
  uv = uv * 2.0 - 1.0;
  vec2 off = abs(uv.yx) / vec2(6.2, 4.6);
  uv = uv + uv * off * off * uCurve;
  return uv * 0.5 + 0.5;
}

void main() {
  vec2 uv = curve(vUv);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { outColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  // Slight horizontal beam blur + chromatic fringing.
  float px = 1.0 / uSrc.x;
  vec3 col;
  col.r = texture(uSharp, uv + vec2(px * 0.35, 0.0)).r;
  col.g = texture(uSharp, uv).g;
  col.b = texture(uSharp, uv - vec2(px * 0.35, 0.0)).b;
  col = mix(col, texture(uSharp, uv + vec2(px * 0.5, 0.0)).rgb, 0.18);
  // Bloom from blurred mip levels: bright pixels glow.
  vec3 b1 = textureLod(uSoft, uv, 1.5).rgb;
  vec3 b2 = textureLod(uSoft, uv, 3.0).rgb;
  vec3 b3 = textureLod(uSoft, uv, 4.5).rgb;
  vec3 bloom = max(b1 - 0.45, 0.0) * 0.6 + max(b2 - 0.35, 0.0) * 0.5 + max(b3 - 0.3, 0.0) * 0.45;
  col += bloom * uGlow;
  col += b3 * 0.05 * uGlow;
  // Scanlines keyed to source rows.
  float row = uv.y * uSrc.y;
  float scan = 0.5 + 0.5 * cos(6.2831853 * row);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col *= mix(0.72 + lum * 0.2, 1.06, scan);
  // Aperture grille.
  float m = mod(gl_FragCoord.x, 3.0);
  vec3 mask = m < 1.0 ? vec3(1.06, 0.94, 0.94) : m < 2.0 ? vec3(0.94, 1.06, 0.94) : vec3(0.94, 0.94, 1.06);
  col *= mix(vec3(1.0), mask, 0.55);
  // Vignette + flicker + faint rolling band.
  vec2 d = uv - 0.5;
  col *= 1.0 - dot(d, d) * 0.9;
  col *= 0.985 + 0.015 * sin(uTime * 60.0);
  col *= 1.0 + 0.025 * smoothstep(0.0, 0.05, fract(uv.y * 0.5 - uTime * 0.07)) * (1.0 - smoothstep(0.05, 0.1, fract(uv.y * 0.5 - uTime * 0.07)));
  // Soft rounded-corner falloff.
  vec2 e = smoothstep(vec2(0.0), vec2(0.008), uv) * smoothstep(vec2(0.0), vec2(0.008), 1.0 - uv);
  col *= e.x * e.y;
  outColor = vec4(pow(col, vec3(0.95)), 1.0);
}`;

export class CRT {
  constructor(outCanvas, srcCanvas) {
    this.out = outCanvas;
    this.src = srcCanvas;
    this.enabled = true;
    this.curve = 1;
    this.glow = 1;
    this.gl = null;
    try {
      this.gl = outCanvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true });
    } catch (e) {
      this.gl = null;
    }
    if (this.gl) {
      try {
        this.init();
      } catch (e) {
        console.warn('CRT shader failed, falling back to 2D', e);
        this.gl = null;
      }
    }
    if (!this.gl) {
      this.ctx2d = outCanvas.getContext('2d');
      document.body.classList.add('no-webgl');
    }
  }

  init() {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    this.prog = prog;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.sharp = gl.createSampler();
    gl.samplerParameteri(this.sharp, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.samplerParameteri(this.sharp, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.samplerParameteri(this.sharp, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.samplerParameteri(this.sharp, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.soft = gl.createSampler();
    gl.samplerParameteri(this.soft, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.samplerParameteri(this.soft, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.samplerParameteri(this.soft, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.samplerParameteri(this.soft, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.u = {};
    for (const n of ['uSharp', 'uSoft', 'uSrc', 'uOut', 'uTime', 'uCurve', 'uGlow']) this.u[n] = gl.getUniformLocation(prog, n);
  }

  // Map a point on the output canvas (CSS px) to source pixel coordinates,
  // applying the same curvature as the shader.
  mapPointer(cx, cy) {
    const r = this.out.getBoundingClientRect();
    let u = (cx - r.left) / r.width;
    let v = (cy - r.top) / r.height;
    if (this.enabled && this.gl) {
      let x = u * 2 - 1;
      let y = v * 2 - 1;
      const ox = Math.abs(y) / 6.2;
      const oy = Math.abs(x) / 4.6;
      x = x + x * ox * ox * this.curve;
      y = y + y * oy * oy * this.curve;
      u = x * 0.5 + 0.5;
      v = y * 0.5 + 0.5;
    }
    return { x: u * VIEW_W, y: v * VIEW_H };
  }

  present(time) {
    if (!this.gl) {
      const ctx = this.ctx2d;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.src, 0, 0, this.out.width, this.out.height);
      return;
    }
    const gl = this.gl;
    gl.viewport(0, 0, this.out.width, this.out.height);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindSampler(0, this.sharp);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.bindSampler(1, this.soft);
    gl.uniform1i(this.u.uSharp, 0);
    gl.uniform1i(this.u.uSoft, 1);
    gl.uniform2f(this.u.uSrc, VIEW_W, VIEW_H);
    gl.uniform2f(this.u.uOut, this.out.width, this.out.height);
    gl.uniform1f(this.u.uTime, time);
    gl.uniform1f(this.u.uCurve, this.enabled ? this.curve : 0);
    gl.uniform1f(this.u.uGlow, this.enabled ? this.glow : 0);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
