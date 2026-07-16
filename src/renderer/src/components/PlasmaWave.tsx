import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import './PlasmaWave.css'

const vertexShader = `
void main() {
  gl_Position = vec4(position, 1.0);
}
`

const fragmentShader = `
precision highp float;

uniform vec2 vScreenSize;
uniform float vTime;
uniform float vScale;

uniform vec3 vColorBackground;

uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform vec3 uColor5;

uniform vec3 uRotation0;
uniform vec3 uRotation1;
uniform vec3 uRotation2;

uniform float uAudio0;
uniform float uAudio1;
uniform float uAudio2;

uniform float uReact0;
uniform float uReact1;
uniform float uReact2;

#define CIRCLE_WIDTH_BASE 0.8
#define CIRCLE_WIDTH_STEP 0.2
#define SPARK_STRENGTH_BASE 1.0
#define SPARK_STRENGTH_STEP 0.3
#define CIRCLE_RADIUS_BASE 0.95
#define CIRCLE_RADIUS_STEP 0.15
#define CIRCLE_OFFSET_BASE 0.0
#define CIRCLE_OFFSET_STEP 1.57

vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise3(vec3 v) {
  const vec2 C = vec2(0.1666667, 0.3333333);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1. + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float tri(in float x){return abs(fract(x)-.5);}
vec3 tri3(in vec3 p){return vec3( tri(p.z+tri(p.y*20.)), tri(p.z+tri(p.x*1.)), tri(p.y+tri(p.x*1.)));}

float triNoise3D(in vec3 p, in float spd) {
  float z=0.4;
  float rz = 0.1;
  vec3 bp = p;
  for (float i=0.; i<=4.; i++ ) {
    vec3 dg = tri3(bp*0.01);
    p += (dg+vTime*.1*spd);
    bp *= 4.;
    z *= 0.9;
    p *= 1.6;
    rz+= (tri(p.z+tri(0.6*p.x+0.1*tri(p.y))))/z;
  }
  return smoothstep(0.0, 8., rz + sin(rz + sin(z) * 2.8) * 2.2);
}

vec2 rotate(vec2 p, float a) {
  float s = sin(a);
  float c = cos(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

float light(float intensity, float attenuation, float dist) {
  return intensity / (1.0 + dist + dist * attenuation);
}

vec4 makeNoiseBlob2(vec2 uv, vec3 color1, vec3 color2, float strength, float offset) {
  float len = length(uv);
  float v0, v1, cl;
  float r0, d0, n0;
  float r, d;

  n0 = snoise3( vec3(uv * 1.2 + offset, vTime * 0.5 + offset) ) * 0.5 + 0.5;
  r0 = mix(0.0, 1.0, n0);
  d0 = distance(uv, r0 / len * uv);
  v0 = smoothstep(r0 + 0.1 + (sin(vTime + offset) + 1.0), r0, len);

  v1 = light(0.15 * (1.0 + 1.5 * (-sin(vTime * 2. + offset * 0.5) * 0.5)) + 0.3 * strength, 10.0 , d0);

  vec3 col = mix(color1, color2, uv.y * 2.);
  col = col + v1;
  col.rgb = clamp(col.rgb, 0.0, 1.0);
  return vec4(col, v0);
}

vec4 makeBlob(vec2 uv, float blob, vec3 color1, vec3 color2, float width, float baseReaction, float likeReaction, float audioStrength, float offset, vec2 noiseOffset) {
  float len = length(uv);
  float outerRadius = blob + width * 0.5 + baseReaction * (1.0 + max(likeReaction, audioStrength * 0.6) * 50. * baseReaction);
  float strength = max(likeReaction, audioStrength);
  vec4 noise = makeNoiseBlob2(uv * (1.0 - likeReaction * 0.5) + noiseOffset, color1, color2, strength, offset);
  noise.a = mix(0.0, noise.a, smoothstep(outerRadius, 0.5, len));
  noise.rgb += 0.6 * likeReaction * (1.0 - smoothstep(0.2, outerRadius * 0.8, len));
  return noise;
}

void main() {
  vec2 uv = gl_FragCoord.xy / vScreenSize.xy;
  uv = uv * 2.0 - 1.0;
  uv.y *= vScreenSize.y / min(vScreenSize.x, vScreenSize.y) / vScale;
  uv.x *= vScreenSize.x / min(vScreenSize.x, vScreenSize.y) / vScale;

  vec2 ruv = uv * 2.0;
  float pr = length(ruv);
  float pa = atan(ruv.y, ruv.x);
  float idx = (pa/3.1415) / 2.0;

  vec2 ruv1 = rotate(uv * 2.0, 3.1415);
  float pa1 = atan(ruv1.y, ruv1.x);
  float idx1 = (pa1/3.1415) / 2.0;
  float idx21 = (pa1/3.1415 + 1.0) / 2.0 * 3.1415;

  float spark = triNoise3D(vec3(idx, 0.0, 0.0), 0.1);
  spark = mix(spark, triNoise3D(vec3(idx1, 0.0, idx1), 0.1), smoothstep(0.9, 1.0, sin(idx21)));
  spark = spark * 0.2 + pow(spark, 10.);
  spark = smoothstep(0.0, spark, 0.3) * spark;

  vec3 color = vColorBackground;
  vec4 blobColor;
  float radius;
  float n0 = snoise3(vec3(uv * 1.2, vTime * 0.5));

  radius = CIRCLE_RADIUS_BASE - CIRCLE_RADIUS_STEP * 0.0;
  blobColor = makeBlob(uv, mix(radius, radius + 0.3, n0), uColor0, uColor3, CIRCLE_WIDTH_BASE - CIRCLE_WIDTH_STEP * 0.0, (SPARK_STRENGTH_BASE - SPARK_STRENGTH_STEP * 0.0) * spark, uReact0, uAudio0, CIRCLE_OFFSET_BASE + CIRCLE_OFFSET_STEP * 0.0, rotate(uRotation0.xy, vTime * uRotation0.z));
  color = mix(color, blobColor.rgb, blobColor.a);

  radius = CIRCLE_RADIUS_BASE - CIRCLE_RADIUS_STEP * 1.0;
  blobColor = makeBlob(uv, mix(radius, radius + 0.3, n0), uColor1, uColor4, CIRCLE_WIDTH_BASE - CIRCLE_WIDTH_STEP * 1.0, (SPARK_STRENGTH_BASE - SPARK_STRENGTH_STEP * 1.0) * spark, uReact1, uAudio1, CIRCLE_OFFSET_BASE + CIRCLE_OFFSET_STEP * 1.0, rotate(uRotation1.xy, vTime * uRotation1.z));
  color = mix(color, blobColor.rgb, blobColor.a);

  radius = CIRCLE_RADIUS_BASE - CIRCLE_RADIUS_STEP * 2.0;
  blobColor = makeBlob(uv, mix(radius, radius + 0.3, n0), uColor2, uColor5, CIRCLE_WIDTH_BASE - CIRCLE_WIDTH_STEP * 2.0, (SPARK_STRENGTH_BASE - SPARK_STRENGTH_STEP * 2.0) * spark, uReact2, uAudio2, CIRCLE_OFFSET_BASE + CIRCLE_OFFSET_STEP * 2.0, rotate(uRotation2.xy, vTime * uRotation2.z));
  color = mix(color, blobColor.rgb, blobColor.a);

  gl_FragColor = vec4(color, 1.0);
}
`

const BAND_COUNT = 8

const lt = (h: number, s: number, l: number): [number, number, number] => {
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const a = s * Math.min(l, 1 - l)
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0), f(8), f(4)]
}

const ot = (h: number) => ((h % 360) + 360) % 360
const Ot = (h: number) => ((h % 360) + 360) % 360
const ht = (t: number, e: number) => {
  const eN = ((e % 360) + 360) % 360
  return eN >= 280 && eN < 360 ? ((t % 360) + 360) % 360 : t
}
const tt = (min: number, max: number) => Math.floor(Math.random() * (Math.floor(max) - min + 1)) + min

const buildDefaultColors = () => {
  const b = ot(10)
  const be = ht(Ot(b + tt(30, 40)), b)
  return [
    lt(b, 1, 0.5),
    lt(300, 1, 0.5),
    lt(50, 1, 0.5),
    lt(be, 1, 0.5),
    lt(320, 1, 0.5),
    lt(50, 1, 0.5),
  ] as [number, number, number][]
}

// Named hue anchors the track color snaps to — guarantees the full spread
// (red/orange/yellow/green/cyan/blue/purple/pink) actually shows up across
// different covers, instead of leaving it to however the cover's raw
// dominant hue happens to fall (which in practice clustered away from some
// of these, cyan included).
const HUE_ANCHORS = [0, 30, 55, 120, 190, 220, 270, 320]

function snapHue(h: number): number {
  let closest = HUE_ANCHORS[0]
  let bestDist = 360
  for (const anchor of HUE_ANCHORS) {
    const d = Math.min(Math.abs(h - anchor), 360 - Math.abs(h - anchor))
    if (d < bestDist) {
      bestDist = d
      closest = anchor
    }
  }
  return closest
}

// All 3 blobs ([0,3], [1,4], [2,5]) stay on the same hue as the track now —
// only lightness varies between them — so the shader reads as one coherent
// color rather than several distinct ones layered together.
const buildTrackColors = (trackHue: number) => {
  const h = snapHue(((trackHue % 360) + 360) % 360)
  return [
    lt(h, 1, 0.5),
    lt(h, 1, 0.5),
    lt(h, 1, 0.5),
    lt(h, 1, 0.55),
    lt(h, 1, 0.45),
    lt(h, 1, 0.4),
  ] as [number, number, number][]
}

interface PlasmaWaveProps {
  playing?: boolean
  getFrequencyBands?: (bandCount: number) => Float32Array
  energy?: number
  trackHue?: number
  collectionHue?: number
  coverColor?: string
  className?: string
}

function PlasmaWave({ playing = false, getFrequencyBands, energy = 0.6, trackHue, collectionHue, coverColor, className = '' }: PlasmaWaveProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const playingRef = useRef(playing)
  const getFrequencyBandsRef = useRef(getFrequencyBands)
  const energyRef = useRef(energy)
  const trackHueRef = useRef(trackHue)
  const collectionHueRef = useRef(collectionHue)
  const coverColorRef = useRef(coverColor)
  const [visible, setVisible] = useState(false)

  useEffect(() => { playingRef.current = playing }, [playing])
  useEffect(() => { getFrequencyBandsRef.current = getFrequencyBands }, [getFrequencyBands])
  useEffect(() => { energyRef.current = energy }, [energy])
  useEffect(() => { trackHueRef.current = trackHue }, [trackHue])
  useEffect(() => { collectionHueRef.current = collectionHue }, [collectionHue])
  useEffect(() => { coverColorRef.current = coverColor }, [coverColor])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light'
    const bgHex = isDark ? '#000000' : '#f0f0f2'
    container.style.setProperty('--plasmawave-bg', bgHex)

    setVisible(true)

    const observer = new MutationObserver(() => {
      const dark = document.documentElement.getAttribute('data-theme') !== 'light'
      container.style.setProperty('--plasmawave-bg', dark ? '#000000' : '#f0f0f2')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
      renderer.setClearColor(0x000000, 0)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      container.appendChild(renderer.domElement)
    } catch {
      return
    }

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const cvec = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
    const c0 = () => new THREE.Vector3()

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light'
    const bgVal = isDark ? 0.0 : 0.9607

    const uniforms = {
      vTime: { value: Math.floor(3600 * Math.random()) },
      vScreenSize: { value: new THREE.Vector2() },
      vScale: { value: 0.35 },
      vColorBackground: { value: new THREE.Vector3(bgVal, bgVal, bgVal) },
      uColor0: { value: c0() },
      uColor1: { value: c0() },
      uColor2: { value: c0() },
      uColor3: { value: c0() },
      uColor4: { value: c0() },
      uColor5: { value: c0() },
      uRotation0: { value: cvec(-0.3, 0.3, 0.2) },
      uRotation1: { value: cvec(-0.3, -0.3, -0.2) },
      uRotation2: { value: cvec(-0.3, -0.3, 0.2) },
      uAudio0: { value: 0 },
      uAudio1: { value: 0 },
      uAudio2: { value: 0 },
      uReact0: { value: 0 },
      uReact1: { value: 0 },
      uReact2: { value: 0 }
    }

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms
    })

    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const currentColors: [number, number, number][] = Array.from({ length: 6 }, () => [0, 0, 0])
    const ucv = [
      uniforms.uColor0, uniforms.uColor1, uniforms.uColor2,
      uniforms.uColor3, uniforms.uColor4, uniforms.uColor5
    ]
    function applyColors(c: [number, number, number][]): void {
      for (let i = 0; i < 6; i++) ucv[i].value.set(c[i][0], c[i][1], c[i][2])
    }

    const defaultColors = buildDefaultColors()
    for (let i = 0; i < 6; i++) {
      currentColors[i][0] = defaultColors[i][0]
      currentColors[i][1] = defaultColors[i][1]
      currentColors[i][2] = defaultColors[i][2]
    }
    applyColors(currentColors)

    let prevPlaying = false
    let lastHue: number | null | undefined = undefined
    let targetColors: [number, number, number][] = defaultColors

    const toHex = ([r, g, b]: [number, number, number]): string =>
      '#' + [r, g, b].map(c => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, '0')).join('')

    function setGlowColor(playing: boolean, colors: [number, number, number][]): void {
      const el = containerRef.current
      if (!el) return
      if (playing) {
        el.style.setProperty('--plasmawave-glow-color', toHex(colors[0]))
        el.style.setProperty('--plasmawave-glow-color-2', toHex(colors[2]))
        el.style.setProperty('--plasmawave-glow-color-3', toHex(colors[4]))
      } else {
        // Keep the last colors set — the fade-out is driven by the
        // container's opacity transition (CSS), so removing the custom
        // properties here would make the glow vanish instantly instead
        // of fading out with it.
      }
    }
    setGlowColor(playingRef.current, targetColors)

    const onResize = (): void => {
      const el = containerRef.current
      if (!el) return
      const w = el.clientWidth
      const h = el.clientHeight
      renderer.setSize(w, h)
      uniforms.vScreenSize.value.set(w, h)
    }
    window.addEventListener('resize', onResize)
    onResize()

    let lastTime = performance.now()
    let animationFrameId: number
    let audioLow = 0, audioMid = 0, audioHigh = 0
    let reactLow = 0, reactMid = 0, reactHigh = 0

    function update() {
      animationFrameId = requestAnimationFrame(update)
      const now = performance.now()
      const dt = Math.min(0.05, (now - lastTime) * 0.001)
      lastTime = now

      const isPlaying = playingRef.current

      if (isPlaying) {
        const hue = trackHueRef.current
        if (hue != null && hue >= 0 && hue !== lastHue) {
          lastHue = hue
          targetColors = buildTrackColors(hue)
        }
      } else if (!isPlaying && prevPlaying) {
        targetColors = defaultColors
        lastHue = undefined
        setGlowColor(false, targetColors)
      }
      prevPlaying = isPlaying

      const speed = isPlaying ? energyRef.current : 0.2
      uniforms.vTime.value += dt * speed * 0.5

      const bands = isPlaying ? getFrequencyBandsRef.current?.(BAND_COUNT) : null
      if (bands) {
        const low = bands[0] + bands[1] + bands[2]
        const mid = bands[3] + bands[4] + bands[5]
        const high = bands[6] + bands[7]
        const attack = 0.15
        const decay = 0.06
        audioLow += (low - audioLow) * (low > audioLow ? attack : decay)
        audioMid += (mid - audioMid) * (mid > audioMid ? attack : decay)
        audioHigh += (high - audioHigh) * (high > audioHigh ? attack : decay)
      } else {
        audioLow = 0; audioMid = 0; audioHigh = 0
      }
      uniforms.uAudio0.value = audioLow
      uniforms.uAudio1.value = audioMid
      uniforms.uAudio2.value = audioHigh

      const reactDecay = dt * 1000 / 600
      reactLow = Math.max(0, reactLow - reactDecay)
      reactMid = Math.max(0, reactMid - reactDecay)
      reactHigh = Math.max(0, reactHigh - reactDecay)
      uniforms.uReact0.value = reactLow
      uniforms.uReact1.value = reactMid
      uniforms.uReact2.value = reactHigh

      for (let i = 0; i < 6; i++) {
        currentColors[i][0] += (targetColors[i][0] - currentColors[i][0]) * Math.min(1, dt * 4)
        currentColors[i][1] += (targetColors[i][1] - currentColors[i][1]) * Math.min(1, dt * 4)
        currentColors[i][2] += (targetColors[i][2] - currentColors[i][2]) * Math.min(1, dt * 4)
      }
      applyColors(currentColors)
      if (isPlaying) setGlowColor(true, currentColors)

      renderer.render(scene, camera)
    }
    animationFrameId = requestAnimationFrame(update)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', onResize)
      const canvas = renderer.domElement
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas)
      material.dispose()
      geometry.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`plasmawave-container${visible ? ' plasmawave-container--visible' : ''}${playing ? ' plasmawave-container--playing' : ''} ${className}`}
      aria-hidden="true"
    >
      <div className="plasmawave-container--shadow" />
    </div>
  )
}

export default PlasmaWave
