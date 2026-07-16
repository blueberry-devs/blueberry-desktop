import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import './PlasmaWave.css'

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

const fragmentShader = `
precision highp float;
varying vec2 vUv;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_audioLow;
uniform float u_audioMid;
uniform float u_audioHigh;
uniform float u_playing;
uniform vec3 u_coverColor;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise2d(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise2d(p);
    p = p * 2.03 + vec2(17.0, 9.2);
    a *= 0.5;
  }
  return v;
}

vec3 hueRotate(vec3 col, float a) {
  const mat3 toYIQ = mat3(0.299, 0.596, 0.211,
                          0.587, -0.274, -0.523,
                          0.114, -0.322, 0.312);
  const mat3 toRGB = mat3(1.0, 1.0, 1.0,
                          0.956, -0.272, -1.106,
                          0.621, -0.647, 1.703);
  vec3 yiq = toYIQ * col;
  float ca = cos(a), sa = sin(a);
  yiq = vec3(yiq.x, yiq.y * ca - yiq.z * sa, yiq.y * sa + yiq.z * ca);
  return toRGB * yiq;
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  float aspect = u_resolution.x / u_resolution.y;
  uv.x *= aspect;
  float t = u_time * 0.1;

  // --- Singularity pattern (radial waves) ---
  float d = length(uv) * 0.8;
  float sn = snoise(vec3(uv * 1.5, t));
  float waves = sin(d * 10.0 - t * 5.0 + sn * 2.0) * 0.5 + 0.5;
  float singularity = 1.0 / (d + 0.1);
  float singularityPattern = pow(waves * singularity, 2.0);

  // --- Domain warp ---
  vec2 warpedUv = uv * 1.2;
  float warpAmount = 0.3 + u_audioLow * 1.5;
  warpedUv += warpAmount * (vec2(
    fbm(warpedUv + t * 0.3),
    fbm(warpedUv + vec2(5.2, 1.3) + t * 0.2)
  ) - 0.5);

  float noiseDistort = snoise(vec3(warpedUv * 2.0, t * 0.5));
  warpedUv += noiseDistort * 0.15 * (1.0 + u_audioMid * 4.0);

  // --- Pulse scale on bass ---
  float pulse = 1.0 + u_audioLow * 0.25;
  uv *= pulse;

  // ===================== PLAYING STATE =====================
  float audioEnergy = u_audioLow + u_audioMid + u_audioHigh;

  // Same structure as idle — outline separates fill from border; slightly bigger shape
  float pOutline = smoothstep(0.08, 0.82, singularityPattern);
  pOutline = pOutline * pOutline;

  // 3 cycling color pairs: blue+coral → green+pink → purple+gold
  float schemeT = u_time * 0.1;
  float sp = fract(schemeT);

  vec3 pFill;
  vec3 pOutlineCol;

  if (sp < 0.33) {
    float t = sp / 0.33;
    pFill = mix(vec3(0.35, 0.65, 1.00), vec3(0.35, 0.95, 0.55), smoothstep(0.0, 1.0, t));
    pOutlineCol = mix(vec3(1.00, 0.55, 0.45), vec3(1.00, 0.50, 0.70), smoothstep(0.0, 1.0, t));
  } else if (sp < 0.67) {
    float t = (sp - 0.33) / 0.34;
    pFill = mix(vec3(0.35, 0.95, 0.55), vec3(0.55, 0.45, 1.00), smoothstep(0.0, 1.0, t));
    pOutlineCol = mix(vec3(1.00, 0.50, 0.70), vec3(1.00, 0.85, 0.40), smoothstep(0.0, 1.0, t));
  } else {
    float t = (sp - 0.67) / 0.33;
    pFill = mix(vec3(0.55, 0.45, 1.00), vec3(0.35, 0.65, 1.00), smoothstep(0.0, 1.0, t));
    pOutlineCol = mix(vec3(1.00, 0.85, 0.40), vec3(1.00, 0.55, 0.45), smoothstep(0.0, 1.0, t));
  }

  float pCycle = noise2d(warpedUv * 0.8 + t * 0.15);
  pFill = mix(pFill, pFill * 1.15, pCycle * 0.25);
  pOutlineCol = mix(pOutlineCol, pOutlineCol * 1.3, pCycle * 0.2);

  vec3 playCol = mix(pOutlineCol, pFill, pOutline);
  playCol *= 1.0 + audioEnergy * 1.2;

  // --- Mix in cover color based on audio energy ---
  float coverMix = smoothstep(0.1, 0.8, audioEnergy) * 0.55;
  playCol = mix(playCol, u_coverColor, coverMix);

  // --- Bass flash: white burst on strong bass hits ---
  float bassFlash = smoothstep(0.6, 1.5, u_audioLow) * 0.35;
  playCol += bassFlash;

  // ===================== IDLE STATE =====================
  float edgeMask = 1.0 - smoothstep(0.0, 0.6, singularityPattern);
  float outline = smoothstep(0.15, 0.85, singularityPattern);
  outline = outline * outline;

  vec3 idleYellow = vec3(1.0, 0.86, 0.30);
  vec3 idlePurple = vec3(0.55, 0.27, 0.90);
  float idleCycle = noise2d(warpedUv * 0.8 + t * 0.15);
  vec3 idleFill = mix(idleYellow, vec3(1.0, 0.78, 0.20), idleCycle * 0.3);
  vec3 idleCol = mix(idlePurple, idleFill, outline);

  // ===================== BLEND =====================
  vec3 col = mix(idleCol, playCol, u_playing);

  float brightness = mix(0.55, 1.0, u_playing);
  col *= brightness;

  // --- Vignette ---
  float vd = length(vUv - 0.5) * 1.41421356;
  col *= 1.0 - 0.2 * smoothstep(0.35, 1.0, vd);

  // --- Grain ---
  float grain = (hash21(gl_FragCoord.xy + vec2(t * 17.0, t * 31.0)) - 0.5) * 0.02;
  col += grain;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

const BAND_COUNT = 8

interface PlasmaWaveProps {
  playing?: boolean
  getFrequencyBands?: (bandCount: number) => Float32Array
  coverColor?: [number, number, number]
  className?: string
}

function PlasmaWave({ playing = false, getFrequencyBands, coverColor = [0.35, 0.65, 1.0], className = '' }: PlasmaWaveProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const playingRef = useRef(playing)
  const getFrequencyBandsRef = useRef(getFrequencyBands)

  useEffect(() => {
    playingRef.current = playing
  }, [playing])

  const coverColorRef = useRef(coverColor)
  useEffect(() => {
    coverColorRef.current = coverColor
  }, [coverColor])

  useEffect(() => {
    getFrequencyBandsRef.current = getFrequencyBands
  }, [getFrequencyBands])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      container.appendChild(renderer.domElement)
    } catch (err) {
      console.error('WebGL not supported', err)
      return
    }

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const uniforms = {
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2() },
      u_audioLow: { value: 0 },
      u_audioMid: { value: 0 },
      u_audioHigh: { value: 0 },
      u_playing: { value: 0 },
      u_coverColor: { value: new THREE.Vector3(0.35, 0.65, 1.0) }
    }

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms
    })

    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    // Smooth audio blend values
    let audioLow = 0
    let audioMid = 0
    let audioHigh = 0
    let playBlend = 0

    const onResize = () => {
      const w = container!.clientWidth
      const h = container!.clientHeight
      renderer.setSize(w, h)
      uniforms.u_resolution.value.set(w, h)
    }

    window.addEventListener('resize', onResize)
    onResize()

    let lastTime = performance.now()
    let animationFrameId: number

    function update() {
      animationFrameId = requestAnimationFrame(update)
      const now = performance.now()
      const dt = Math.min(0.05, (now - lastTime) * 0.001)
      lastTime = now

      uniforms.u_time.value += dt

      // Smooth playing blend
      const targetPlay = playingRef.current ? 1 : 0
      playBlend += (targetPlay - playBlend) * dt * 2
      uniforms.u_playing.value = playBlend

      // Audio frequency analysis
      const bands = playingRef.current ? getFrequencyBandsRef.current?.(BAND_COUNT) : null
      if (bands) {
        // Split 8 bands into low (0-2), mid (3-5), high (6-7)
        const low = (bands[0] + bands[1] + bands[2]) / 3
        const mid = (bands[3] + bands[4] + bands[5]) / 3
        const high = (bands[6] + bands[7]) / 2

        // Smooth with exponential moving average — aggressive attack, gentle decay
        const attack = 0.6
        const decay = 0.12
        audioLow += ((low * 12) - audioLow) * (low > audioLow ? attack : decay)
        audioMid += ((mid * 10) - audioMid) * (mid > audioMid ? attack : decay)
        audioHigh += ((high * 10) - audioHigh) * (high > audioHigh ? attack : decay)
      } else {
        // Idle: gentle ambient pulse
        const pulse = Math.sin(uniforms.u_time.value * 0.8) * 0.5 + 0.5
        audioLow = pulse * 0.3
        audioMid = Math.sin(uniforms.u_time.value * 1.1 + 1.0) * 0.5 * 0.2
        audioHigh = Math.sin(uniforms.u_time.value * 1.5 + 2.0) * 0.5 * 0.1
      }

      uniforms.u_audioLow.value = audioLow
      uniforms.u_audioMid.value = audioMid
      uniforms.u_audioHigh.value = audioHigh

      // Smooth cover color transition
      const cc = coverColorRef.current
      uniforms.u_coverColor.value.lerp({ x: cc[0], y: cc[1], z: cc[2] } as THREE.Vector3, dt * 2)

      renderer.render(scene, camera)
    }

    animationFrameId = requestAnimationFrame(update)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', onResize)
      const canvas = renderer.domElement
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas)
      }
      material.dispose()
      geometry.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`plasmawave-container ${className}`}
      aria-hidden="true"
    />
  )
}

export default PlasmaWave
