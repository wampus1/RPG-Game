// CRT post-process: the low-res frame is uploaded as a texture and drawn
// through a shader with barrel curvature, scanlines, an aperture-grille mask,
// chromatic fringing, vignette, flicker and a soft bloom "glow".
// (Round 80) With the effect off, none of that: the frame's canvas (and the
// drawn-back world's, under it) are on the page themselves, scaled up by
// the browser, pixel-sharp; WebGL isn't touched. With it on, the blurred
// levels the glow is drawn from are made only when there's a glow, and the
// drawn-back world's picture is sent only when it's been drawn again.
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
uniform sampler2D uWSharp;
uniform sampler2D uWSoft;
uniform float uLayered;
uniform float uWLod;
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

// The frame: one picture, or (the camera drawn back) the world, drawn
// finer than the view, under the view's own layer (the UI, premultiplied).
vec3 at(vec2 uv) {
  vec4 t = texture(uSharp, uv);
  if (uLayered < 0.5) return t.rgb;
  return texture(uWSharp, uv).rgb * (1.0 - t.a) + t.rgb;
}
vec3 soft(vec2 uv, float lod) {
  vec4 t = textureLod(uSoft, uv, lod);
  if (uLayered < 0.5) return t.rgb;
  return textureLod(uWSoft, uv, lod + uWLod).rgb * (1.0 - t.a) + t.rgb;
}

void main() {
  vec2 uv = curve(vUv);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { outColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  // Slight horizontal beam blur + chromatic fringing.
  float px = 1.0 / uSrc.x;
  vec3 col;
  col.r = at(uv + vec2(px * 0.35, 0.0)).r;
  col.g = at(uv).g;
  col.b = at(uv - vec2(px * 0.35, 0.0)).b;
  col = mix(col, at(uv + vec2(px * 0.5, 0.0)), 0.18);
  // Bloom from blurred mip levels: bright pixels glow.
  vec3 b1 = soft(uv, 1.5);
  vec3 b2 = soft(uv, 3.0);
  vec3 b3 = soft(uv, 4.5);
  vec3 bloom = max(b1 - 0.62, 0.0) * 0.55 + max(b2 - 0.52, 0.0) * 0.5 + max(b3 - 0.45, 0.0) * 0.4;
  col += bloom * uGlow;
  col += b3 * 0.035 * uGlow;
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
    // (Round 80) The frame on the page itself, the effect off (see direct).
    this.directOn = false;
    this.shownWorld = null;
    // What of the drawn-back world was last sent (its picture, and which
    // drawing of it: `worldV`, set with `world`).
    this.sentWorld = null;
    this.sentV = -1;
    this.worldV = 0;
    this.curve = 0.8;
    this.glow = 1;
    this.gl = null;
    try {
      this.gl = outCanvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true });
    } catch {
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
    // The world's own picture, when it's drawn apart from the view (see
    // Renderer.render): a pixel to start with.
    this.wtex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.wtex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.generateMipmap(gl.TEXTURE_2D);
    this.u = {};
    for (const n of ['uSharp', 'uSoft', 'uWSharp', 'uWSoft', 'uLayered', 'uWLod', 'uSrc', 'uOut', 'uTime', 'uCurve', 'uGlow']) this.u[n] = gl.getUniformLocation(prog, n);
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

  // (Round 80) The frame on the page itself (the effect off, or no WebGL):
  // its canvas (and the drawn-back world's, under it) put on the page in
  // the screen's place, scaled up by the browser, pixel-sharp (see
  // style.css). The screen's own canvas stays on top, unseen, for the
  // pointer.
  direct(on, world = null) {
    if (on !== this.directOn) {
      this.directOn = on;
      const stage = this.stage();
      if (on) stage.appendChild(this.src);
      else this.src.remove();
      this.src.classList.toggle('direct', on);
      this.out.classList.toggle('unseen', on);
      if (!on && this.shownWorld) {
        this.shownWorld.remove();
        this.shownWorld = null;
      }
    }
    if (!on || world === this.shownWorld) return;
    if (this.shownWorld) this.shownWorld.remove();
    this.shownWorld = world;
    if (world) {
      world.classList.add('direct', 'under');
      this.stage().insertBefore(world, this.src);
    }
  }

  // What the screen's canvas sits in on the page (made the first time).
  stage() {
    let st = this.out.parentElement;
    if (st && st.id === 'stage') return st;
    st = document.createElement('div');
    st.id = 'stage';
    this.out.replaceWith(st);
    st.appendChild(this.out);
    return st;
  }

  // `this.world`, when set: the world drawn apart from the view, finer than
  // it (the camera drawn back); the view is then only what's over it.
  // (`this.worldV`: which drawing of it this is.)
  present(time) {
    const world = this.world || null;
    if (!this.gl || !this.enabled) {
      this.direct(true, world);
      return;
    }
    this.direct(false);
    const gl = this.gl;
    // (The glow is drawn from the frame's blurred levels: made only when
    // there's a glow to draw. Without, the sharp look's all there is.)
    const glow = this.glow > 0;
    gl.viewport(0, 0, this.out.width, this.out.height);
    gl.useProgram(this.prog);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.src);
    if (glow) gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindSampler(0, this.sharp);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.bindSampler(1, glow ? this.soft : this.sharp);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.wtex);
    // (The drawn-back world: sent again only once it's been drawn again,
    // its blurred levels only for a glow, and once a drawing.)
    if (world && (world !== this.sentWorld || this.worldV !== this.sentV || (glow && !this.sentMips))) {
      if (world !== this.sentWorld || this.worldV !== this.sentV) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, world);
      if (glow) gl.generateMipmap(gl.TEXTURE_2D);
      this.sentWorld = world;
      this.sentV = this.worldV;
      this.sentMips = glow;
    } else if (!world) this.sentWorld = null;
    gl.bindSampler(2, this.sharp);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.wtex);
    gl.bindSampler(3, glow && this.sentMips ? this.soft : this.sharp);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.uniform1i(this.u.uSharp, 0);
    gl.uniform1i(this.u.uSoft, 1);
    gl.uniform1i(this.u.uWSharp, 2);
    gl.uniform1i(this.u.uWSoft, 3);
    gl.uniform1f(this.u.uLayered, world ? 1 : 0);
    gl.uniform1f(this.u.uWLod, world ? Math.log2(world.width / VIEW_W) : 0);
    gl.uniform2f(this.u.uSrc, VIEW_W, VIEW_H);
    gl.uniform2f(this.u.uOut, this.out.width, this.out.height);
    gl.uniform1f(this.u.uTime, time);
    gl.uniform1f(this.u.uCurve, this.enabled ? this.curve : 0);
    gl.uniform1f(this.u.uGlow, this.enabled ? this.glow : 0);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
