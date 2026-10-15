# Kairos landing page: WebGL scene specification (the receipt)

Date: 2026-10-15. Status: build specification. Owner: WebGL. Scope: the single WebGL centerpiece of `web/app/(public)/page.tsx`, its fallbacks, and the tests that keep it honest.

Inputs: `01-creative-direction.md` (read in full; sections 3.5, 3.6, 4, 9.2 to 9.5 and 10 are binding), `_research/stack-feasibility.md`, `_research/awwwards-references.md` (tier and reduced-motion playbook), `_concepts/concept-the-ledger.md` (original receipt notes), `docs/04-ui-ux-brief.md` (colour tokens), `web/package.json` (no motion, 3D or test dependencies installed today).

Skills applied as guidance (all four loaded): `anthropic-skills:3d-scroll-website` (sticky stage with a tall wrapper, requestAnimationFrame discipline, refs instead of React state for hot values, DPR-aware sizing, passive listeners; its frame-sequence and Framer Motion advice is not used because the locked decision is one real-time WebGL object driven by GSAP), `threejs-shaders` (ShaderMaterial uniforms, varyings, `step`/`mix` instead of branches, precomputing in JavaScript), `threejs-postprocessing` (used to decide against any EffectComposer pass: every pass is a full-screen render), `shader-programming-glsl` (`smoothstep` for soft edges, constants on the CPU, no heavy branching).

Names used from the creative direction, exactly: section ids `entry-00-hero` to `entry-10-start`; scene state ids `slip-open`, `slip-recede`, `slip-feed`, `slip-cite`, `slip-hold`, `slip-tear`, `ghost-path`, `slip-reply`, `slip-fresh`; components `StageLoader` and `Stage`; store `ledgerStore`; slots `[data-lane]` and `[data-slot="receipt"]`; tokens `--receipt-paper`, `--ease-post`, `--ease-feed`, `--ease-travel`, `--ease-tear`, `--ease-retract`, `--dur-print`, `--dur-tear`, `--dur-handoff`.

## 0. Verification notes and deltas from the creative direction

### 0.1 Facts checked on 2026-10-15

| Fact | Status | Source |
| --- | --- | --- |
| three's `WebGLRenderer` is WebGL 2 only since r163, so "no WebGL2" means tier 0 | Verified | [threejs.org WebGLRenderer docs](https://threejs.org/docs/pages/WebGLRenderer.html) |
| `WebGLRenderer` options and defaults: `alpha false`, `premultipliedAlpha true`, `antialias false`, `stencil false`, `depth true`, `powerPreference 'default'`, `failIfMajorPerformanceCaveat false`, `precision 'highp'` | Verified | same page |
| `renderer.compileAsync(scene, camera)` exists, returns a Promise and uses `KHR_parallel_shader_compile` | Verified | same page |
| `renderer.initTexture(texture)` uploads a texture before first render | Verified | same page |
| `renderer.forceContextLoss()` and `dispose()` exist; `renderer.info.memory.geometries` and `.textures`, `info.render.calls` and `.triangles` exist | Verified | same page |
| `copyTextureToTexture(src, dst, srcRegion: Box2, dstPosition: Vector2, srcLevel, dstLevel)` exists; whether it regenerates mipmaps is not documented | Verified signature, mipmap behaviour unverified | same page |
| `EXT_disjoint_timer_query_webgl2` (GPU timing) is reported by about 72% of Chromium sessions and almost no Firefox or Safari sessions | Reported | [web3dsurvey](https://web3dsurvey.com/webgl2/extensions/EXT_disjoint_timer_query_webgl2), [Khronos registry](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/) |
| Canvas 2D exposes `font`, `fontVariantCaps`, `letterSpacing` and `textRendering`, but no equivalent of `font-feature-settings` or `font-variant-numeric` | Verified for what exists ([MDN font](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/font), [MDN textRendering](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textRendering)); absence is from knowledge, treat as unverified | MDN |
| Versions: `three@0.186.1`, `@types/three@0.186.0`, `gsap@3.15.0`, `@gsap/react@2.1.2`, `lenis@1.3.26` | Verified by the stack research on 2026-10-15 | `_research/stack-feasibility.md` section 2 |

Items marked unverified are resolved in the first implementation spike (section 13.3).

### 0.2 Deltas from `01-creative-direction.md`

Each delta is an engineering correction that keeps the direction's intent. The creative direction's owner should accept or reject them at design lock.

| # | Direction says | This spec says | Why |
| --- | --- | --- | --- |
| D1 | Print texture 1024 by 2304 (T2), 512 by 1152 (T1), mapped 1:1 to the plane | Visible paper stays 1024 by 2304 texels (T2) and 512 by 1152 (T1), mapped 1:1. The allocated texture is 1024 by 2560 (T2) and 512 by 1280 (T1): a 256-row (T2) or 128-row (T1) hidden write-ahead band | With a ring buffer exactly as tall as the visible paper, the row being written below the print head is the same texture row still visible at the slip's top edge, so new ink would flash at the top. The hidden band removes that. Both sizes stay under the 4096 `MAX_TEXTURE_SIZE` gate |
| D2 | T1 geometry 2 by 48 segments | T1 uses two quads (stub and body, 1 by 1 segment each) | Nothing bends at T1 (no curl, straight split), so 48 rows add vertices and no shape |
| D3 | Perforation drawn in the texture, one line above the head, 1 texel wide at a 4px period | Perforation is procedural in the fragment shader at a fixed slip position `PERF_Y`, 0.05 units (32 texels, about 9 CSS px) above the head, acting as the printer's tear bar: 1 CSS px holes at a 4 CSS px period. Printed lines always stop 24 texels above it (print gap 56 texels, 3.5) | The texture scrolls (ring buffer) but the tear line belongs to the printer. A perforation a full line above the head would cut through the newest printed line. A 1-texel hole at T2 would be 0.3 CSS px and alias |
| D4 | The curl "darkens toward Circuit Border" under a light from the upper left | The curl bends forward, toward the camera | A backward bend turns the normal toward an upper-left light and would brighten, not darken, the curl |
| D5 | Print uses `tnum` and `zero` | Canvas 2D cannot enable OpenType features; digits are placed on fixed cells and the zero's slash is drawn as a stroke (3.6) | No canvas API for feature settings |
| D6 | Palette check: canvas pixels Void or hue 95 to 135 degrees | Pixels must be achromatic, or have hue 95 to 135 degrees AND HSV saturation 0.20 or less | Lime Pulse `#7fee64` has hue 108 degrees, inside the band; its saturation is 0.58, every allowed mix is 0.16 or less |
| D7 | `slip-reply` shows the fresh paper (header, `05 · Receipt filed`) | Fresh paper only when the slip was torn. A visitor who never approved sees the original paper continue, with `05 · Not sent · waiting for your approval` as its newest line | "Receipt filed" would be untrue for a visitor who sent nothing |
| D8 | `slip-tear` scale "1.00 to slot fit" | Slot fit matches width and trims the paper's visible length from the top to the slot's aspect ("length fit", 5.6) | A 2.25:1 slip cannot cover a roughly square DOM receipt; the hand-off must align exactly |
| D9 | Feed rows at 34px | Feed rows shrink to fit, from 34px down to a 26px floor, and are never truncated. The P1 generator caps excluded keywords at 16 characters | The longest reason row is about 65 characters |
| D10 | Full-size lines on a 108px rhythm | Full-size lines wrap at word boundaries to a 896px measure; each wrapped row prints as its own step | Line 02 is 58 characters; about 36 fit at 48px |
| D11 | Blue-noise dither | Interleaved gradient noise computed in the shader | Same visual job, no texture asset |
| D12 | `ledgerStore`: `posted`, `feedDone`, `approvedAt`, `torn` | Adds `printed: ReceiptLineId[]` (append-only) and `print(id)` | Lines such as `04 · Awaiting your approval` and `RULES CHANGED` are not derivable from the four fields, and replay after an Activity recreate must be exact |
| D13 | Not specified | Renderer `depth: false`; materials `depthTest: false`, `depthWrite: false` | The scene is painter-ordered and never self-overlaps; dropping the depth buffer saves about 8MB at T2 |
| D14 | T2 DPR "up to 2 within a 2.1MP drawing buffer"; T1 "DPR 1 within a 1.0MP drawing buffer"; rounded to 0.25 steps | Same budgets, rounded to the nearest 0.25 step, with floors: T2 never renders below DPR 1, T1 never below 0.75 (8.3) | Fill cost here is the slip's area, not the viewport's. A strict 2.1MP cap would render a 2560 by 1440 monitor at DPR 0.75 and blur the printed lines for exactly the desktop jurors who look closest |
| D15 | Poster `fetchpriority="low"`; "the H1 is the LCP element" | Poster `fetchpriority="auto"`; LCP is budgeted whichever element wins (9.2) | At 1024px and wider the poster is larger in area than the H1, so it can be the LCP element; a low-priority fetch would then delay LCP |

## 1. What the centerpiece is

One thermal-paper receipt slip emerging from a printer mouth in the receipt lane (grid columns 9 to 12 at 1024px and wider). The paper is unlit, palette-locked and matte. The slip prints one line for most entries, feeds a 48-row sample run once, waits without moving at the approval beat, is signed with the visitor's local time, tears along its perforation, travels to a centred slot and hands off to the DOM receipt. At the end of the page a fresh slip prints the sign-up row. Nothing else exists in the scene: no particles, floor, environment map, lights or second object.

### 1.1 Scene graph

```
scene (THREE.Scene, background null, no fog)
├── printer (Group)                    lane fit × state pose × pointer tilt × flatten
│   ├── head      (Mesh, quadGeometry, headMaterial)      print head hairline, renderOrder 3
│   ├── paperA    (Group)                                 local y offset for the lift-out in slip-fresh
│   │   └── stubA (Mesh, stubGeometry, paperMaterialA)    paper between the head and the perforation, renderOrder 1
│   └── paperB    (Mesh, paperBGeometry, paperMaterialB)  fresh sign-up slip, visible only in slip-fresh, renderOrder 2
├── bodyA         (Mesh, bodyGeometry, paperMaterialA)    paper above the perforation, renderOrder 1
│                                                         matrixAutoUpdate false; world matrix set each frame (5.5)
└── ghost         (Mesh, quadGeometry, ghostMaterial)     dashed outline, visible only in ghost-path, renderOrder 4

camera (PerspectiveCamera, fov 35, near 0.1, far 20, position (0, 0, 6), lookAt (0, 0, 0)); never moves
```

`bodyA` is a sibling of `printer`, not a child, because after the tear it travels on its own while the stub and head stay in the lane. Before the tear its world matrix equals `printer.matrixWorld × paperA.matrix`, so it reads as one object.

### 1.2 Slip space

All geometry is authored in slip space: x from -0.8 to +0.8, y from -1.8 (the print head, `HEAD_Y`) to +1.8 (the top), z = 0 for flat paper. One texel of visible paper is 1/640 of a unit in both axes (1.6 units = 1024 texels, 3.6 units = 2304 texels at T2).

| Constant (shader `#define` and `scene.ts` export) | Value | Meaning |
| --- | --- | --- |
| `SLIP_W` | 1.6 | Slip width, units |
| `SLIP_H` | 3.6 | Slip height, units (2.25:1, 80mm paper) |
| `HEAD_Y` | -1.8 | Print head line |
| `PERF_Y` | -1.75 | Perforation (tear bar) line, 0.05 units (32 texels at T2) above the head |
| `PRINT_GAP` | 56 texels (T2), 28 (T1) | Distance from the head to the bottom of the newest printed row; 24 texels (T2) clear of the perforation |
| `CURL_START` | 1.008 | Curl begins (top 22% of the slip, 0.792 units) |
| `CURL_R` | 0.6 | Curl radius, units |
| `CURL_MAX` | 0.66323 | 38 degrees in radians |
| `HEAT_H` | 0.03 | Heat-mark band above the head, units |

## 2. Geometry and counts

### 2.1 Meshes

| Mesh | Geometry | T2 segments | T2 vertices | T2 triangles | T1 segments | T1 vertices | T1 triangles |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `bodyA` | `PlaneGeometry(1.6, 3.55, segX, segY)` translated so y spans -1.75 to +1.8 | 32 by 95 (row height 0.0374; 21 rows inside the curl) | 3,168 | 6,080 | 1 by 1 | 4 | 2 |
| `stubA` | `PlaneGeometry(1.6, 0.05, 1, 1)` translated so y spans -1.8 to -1.75 | 1 by 1 | 4 | 2 | 1 by 1 | 4 | 2 |
| `paperB` | `paperBGeometry` = `PlaneGeometry(1.6, 3.6, 1, 1)` (flat; its paper never reaches the curl) | 1 by 1 | 4 | 2 | 1 by 1 | 4 | 2 |
| `head` | `quadGeometry` = `PlaneGeometry(1, 1)`, scaled to 1.76 by 1 CSS px, at `HEAD_Y` | 1 by 1 | shared | 2 | same | shared | 2 |
| `ghost` | `quadGeometry`, scaled per frame to the outline rectangle | 1 by 1 | shared | 2 | same | shared | 2 |
| **Total resident** | 4 geometries (body, stub, paperB, quad) | | **3,180** | **6,086** | | **16** | **8** |

Largest frame: `bodyA` + `stubA` + `head` + one of `ghost` or `paperB` = 6,086 triangles at T2 and 8 at T1.

Instances: none (no `InstancedMesh`). Particles: none (no `Points`). The 48-row sample feed is text in the print texture, not geometry.

The stub and body are separate geometries so the tear is a clean split along `PERF_Y` with no stretched triangles between the pieces. The perforation holes are drawn half on each side of the seam (3.3), so after the split each edge keeps a notched half-row.

### 2.2 Draw calls

| Moment | Visible meshes | Draw calls |
| --- | --- | --- |
| Most states | `head`, `stubA`, `bodyA` | 3 |
| `ghost-path`, p 0.18 to 0.50 | `head`, `stubA`, `bodyA`, `ghost` | 4 |
| `slip-fresh`, during the lift-out | `head`, `stubA`, `bodyA`, `paperB` | 4 |
| Canvas hidden | none (no render) | 0 |

Maximum 4. A Playwright check asserts `renderer.info.render.calls <= 5` (section 12).

### 2.3 Why vanilla three

The stack research measured vanilla three at about 133KB gzip against about 250KB for R3F 9.8.2, and the scene's inputs are a handful of numbers written from one GSAP ticker. Vanilla three, behind the thin `Stage` component, is the build. R3F stays the pre-approved fallback with the settings in `stack-feasibility.md` section 7.3; nothing in this spec needs it.

## 3. Materials and shaders

### 3.1 Colour pipeline

| Setting | Value | Reason |
| --- | --- | --- |
| Palette storage | Plain `THREE.Vector3` values of the sRGB hex divided by 255, never `THREE.Color` | `THREE.Color.setHex` converts to linear under colour management; the shader must mix in sRGB so flat paper outputs exactly `#def0dd`, the DOM `--receipt-paper`, and the canvas-to-DOM hand-off matches |
| Mixing space | sRGB, in the fragment shader | CSS blends in sRGB; the cross-fade and the paper band then agree |
| Output | The shader writes sRGB directly; it does not include `<colorspace_fragment>` or `<tonemapping_fragment>` | `ShaderMaterial` only applies those chunks when the shader includes them (P: confirmed by end-to-end check 9 in 12.3 and spike item S1) |
| Renderer | `outputColorSpace = SRGBColorSpace`, `toneMapping = NoToneMapping` | No built-in material is used, so these only document intent |
| Print texture | `colorSpace = NoColorSpace` | The texture is data (ink coverage in alpha), not colour |
| Alpha | Renderer `alpha: true`, `premultipliedAlpha: true`; materials output premultiplied colour, `transparent: true`, `blending: NormalBlending`, `premultipliedAlpha: true` | The canvas composites over the Void page; outside the slip every pixel is (0, 0, 0, 0) |
| Depth | Renderer `depth: false`; all materials `depthTest: false`, `depthWrite: false`; order by `renderOrder` | D13 |

### 3.2 Palette (the only colours the scene can produce)

`web/components/landing/stage/palette.ts` exports `STAGE_PALETTE` in this exact order. The paper shader receives it as `uniform vec3 uPalette[6]`.

| Index | Token | Hex | Vector3 (sRGB, 4 decimals) | Used for |
| --- | --- | --- | --- | --- |
| 0 | `--background` Void | `#000000` | (0.0000, 0.0000, 0.0000) | Ink, heat mark |
| 1 | `--surface` Ground Iron | `#181818` | (0.0941, 0.0941, 0.0941) | Back face, paper level (recede) |
| 2 | `--border` Circuit Border | `#485346` | (0.2824, 0.3255, 0.2745) | Shaded side of the curl |
| 3 | `--link` Fern Link | `#859984` | (0.5216, 0.6000, 0.5176) | Print head hairline, ghost outline (equals `mix(Void, Phosphor White, 0.6)` from the direction, to the nearest unit) |
| 4 | `--foreground` Phosphor White | `#ddffdc` | (0.8667, 1.0000, 0.8627) | Reserved; in the array because the direction lists it; no shader reads it today |
| 5 | `--mint` Mint Frost, `--receipt-paper` | `#def0dd` | (0.8706, 0.9412, 0.8667) | Lit paper |

Lime Pulse `#7fee64` is not in the array. Every output colour is a convex combination of these entries, plus a dither of at most 0.5/255 on curl pixels. There is no emissive term, no light object, no additive blending, no bloom and no halo.

### 3.3 Paper material (`paperMaterialA`, `paperMaterialB`)

Two `ShaderMaterial` instances built from the same vertex and fragment source and the same `defines`, so three compiles one program. `side: DoubleSide`, `toneMapped: false`; WebGL 2 provides `fwidth` without extensions. Shaders are written in three's default `ShaderMaterial` dialect (three prefixes `#version 300 es` and maps `attribute`, `varying`, `texture2D` and `gl_FragColor`); fragment precision `highp`.

#### Uniforms and what drives them

| Uniform | Type | Range or value | Driven by | Updated |
| --- | --- | --- | --- | --- |
| `uPalette` | `vec3[6]` | 3.2 | Constant | Once |
| `uPrint` | `sampler2D` | Texture A (ring buffer) or texture B (fresh slip) | State: a print uploads it | Per print or feed batch, never per frame |
| `uTexH` | `float` | A: 2560 (T2), 1280 (T1). B: 512 (T2), 256 (T1) | Tier | Once |
| `uVisH` | `float` | 2304 (T2), 1152 (T1) | Tier | Once |
| `uFeed` | `float` | Paper coordinate at the head, texels; only grows | Time: print and feed tweens started by state; replay sets it at once | Per frame while a tween runs |
| `uPrintY` | `float` | Ink edge, texels; never more than `uFeed - PRINT_GAP` | Time: print tween; follows `uFeed` during the feed | Per frame while a tween runs |
| `uPaperLen` | `float` | Visible paper length from the head, texels. A: `uVisH` except during length fit. B: grows from 0 | Scroll (length fit, 5.6); time (fresh slip feed) | Per frame while changing |
| `uCurl` | `float` | 0 to 1 (forced 0 at T1) | Scroll (pose blend); time (the tear relaxes it to 0) | Per frame while changing |
| `uLevel` | `float` | 0.65 to 1.00 (paper level toward Ground Iron) | Scroll (pose blend) | Per frame while changing |
| `uAlpha` | `float` | 0 to 1 | Time (paper A lift-out in `slip-fresh`) | Per frame while changing |
| `uPxToLocal` | `float` | Slip units per CSS px at the mesh's current fit, for example 0.00532 at the 1440 by 900 lane fit | Resize; scroll (travel scale) | On resize and per travel frame |

Pointer input never reaches a shader: it rotates the `printer` group in JavaScript (5.4). Time never reaches a shader as `uTime`: every timed move is a GSAP tween on a uniform or a transform, and every one ends.

`uPxToLocal = k / fitScale`, where `k` is world units per CSS px at z = 0 (5.1) and `fitScale` is the mesh's current uniform scale.

#### Vertex shader

```glsl
// paper.vert  (defines: SLIP_W 1.6, SLIP_H 3.6, HEAD_Y -1.8, PERF_Y -1.75,
//               CURL_START 1.008, CURL_R 0.6, CURL_MAX 0.66323, HEAT_H 0.03)
uniform float uCurl;            // 0..1, scales the curl angle

varying vec2 vLocal;            // slip-space x, y before bending (drives texture, holes, heat)
varying vec3 vNormalV;          // view-space normal for the fixed-light shade

void main() {
  float inCurl = step(CURL_START, position.y);
  float d      = max(position.y - CURL_START, 0.0);   // distance along the paper into the curl
  float tMax   = CURL_MAX * uCurl;                     // current maximum bend, radians
  float arc    = min(d, CURL_R * tMax);                // part of d that lies on the arc
  float theta  = arc / CURL_R;                         // bend angle at this vertex
  float tail   = d - arc;                              // straight run past the arc

  // Forward curl: the top bends toward the camera (+z) around an axis at z = +CURL_R.
  float yc = CURL_START + CURL_R * sin(theta) + tail * cos(tMax);
  float zc = CURL_R * (1.0 - cos(theta)) + tail * sin(tMax);

  vec3 p = vec3(position.x, mix(position.y, yc, inCurl), zc * inCurl);
  vec3 n = vec3(0.0, -sin(theta) * inCurl, mix(1.0, cos(theta), inCurl));

  vLocal   = position.xy;
  vNormalV = normalize(normalMatrix * n);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
```

With `uCurl = 0`, `tMax = 0`, so `arc = 0`, `tail = d`, `yc = position.y` and `zc = 0`: the plane is exactly flat. The bend is continuous at `CURL_START` and at the end of the arc (0.398 units of arc at 38 degrees, then 0.394 units of straight tangent). At T1 the define `NO_CURL` compiles the bend out and `uCurl` stays 0.

#### Fragment shader

```glsl
// paper.frag
uniform vec3  uPalette[6];      // 0 Void, 1 Ground Iron, 2 Circuit Border, 3 Fern Link, 4 Phosphor White, 5 Mint Frost
uniform sampler2D uPrint;       // ink coverage in .a; flipY false; RepeatWrapping on v (A), ClampToEdge (B)
uniform float uTexH, uVisH, uFeed, uPrintY, uPaperLen, uLevel, uAlpha, uPxToLocal;

varying vec2 vLocal;
varying vec3 vNormalV;

const vec3 LIGHT_V = vec3(-0.2506, 0.3509, 0.9023);   // fixed, from the upper left, view space

// 1 below edge, 0 above, with a one-pixel anti-aliased transition
float below(float edge, float x) {
  float w = max(fwidth(x), 1e-5);
  return 1.0 - smoothstep(edge - 0.5 * w, edge + 0.5 * w, x);
}

void main() {
  float h = (vLocal.y - HEAD_Y) * (uVisH / SLIP_H);    // texels above the head
  float s = uFeed - h;                                  // paper coordinate of this fragment

  // Paper presence: only the newest uPaperLen texels of paper exist.
  float paper = below(uPaperLen, h);

  // Perforation (tear bar): 1 CSS px holes at a 4 CSS px period, centred on PERF_Y.
  float px   = uPxToLocal;
  float row  = below(0.5 * px, abs(vLocal.y - PERF_Y));
  float t    = (vLocal.x + 0.5 * SLIP_W) / (4.0 * px);
  float tri  = abs(fract(t) - 0.5);                     // triangle wave, continuous across periods
  float wT   = fwidth(t);
  float hole = 1.0 - smoothstep(0.125 - 0.5 * wT, 0.125 + 0.5 * wT, tri);  // a quarter of the period
  paper *= 1.0 - row * hole;

  // Shade: Lambert against the fixed light, normalised so flat paper is exactly 1.
  vec3  n       = normalize(vNormalV) * (gl_FrontFacing ? 1.0 : -1.0);
  float lambert = clamp(dot(n, LIGHT_V) / LIGHT_V.z, 0.0, 1.0);
  float shade   = 0.62 + 0.38 * lambert;
  vec3  colour  = gl_FrontFacing ? mix(uPalette[2], uPalette[5], shade)
                                 : mix(uPalette[1], uPalette[2], shade);

  // Interleaved gradient noise dither, +/-0.5/255, only on the curl gradient (flat paper stays exact).
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  colour += (ign - 0.5) * (1.0 / 255.0) * step(shade, 0.999);

  // Heat mark: the HEAT_H band directly above the head is 18% toward Void.
  colour = mix(colour, uPalette[0], 0.18 * below(HEAD_Y + HEAT_H, vLocal.y));

  // Ink: sampled from the ring buffer; only paper already printed (s < uPrintY) carries ink.
  float ink = texture2D(uPrint, vec2(vLocal.x / SLIP_W + 0.5, s / uTexH)).a;
  ink *= below(uPrintY, s) * (gl_FrontFacing ? 1.0 : 0.0);
  colour = mix(colour, uPalette[0], ink);

  // Paper level: recede toward Ground Iron.
  colour = mix(uPalette[1], colour, uLevel);

  float a = paper * uAlpha;
  gl_FragColor = vec4(colour * a, a);                  // premultiplied
}
```

Notes on the fragment shader:

- Texture v is `s / uTexH` without `fract()`. `RepeatWrapping` wraps it, so screen-space derivatives stay continuous and mip selection has no seam at the wrap.
- The light direction is constant in view space; the camera never moves, so view space equals world space. With the forward curl the shaded side tilts away from the light: at the full 38 degrees `lambert` is 0.55 and `shade` 0.83, toward Circuit Border.
- Brightness discipline: `lambert` is clamped to 1 after normalisation, so no pose, tilt or curl can make the paper brighter than Mint Frost.
- The back face is visible only at grazing angles; it never carries ink.
- Cost per fragment: one texture fetch, five `fwidth`, about 60 ALU operations. At 1440 by 900 the slip covers about 0.20 megapixels CSS, 0.32 megapixels at DPR 1.25.

### 3.4 Head and ghost materials

`headMaterial` is a `ShaderMaterial` with one uniform, `uColor` = `STAGE_PALETTE[3]` (Fern Link), opaque, `depthTest: false`:

```glsl
// head.frag
uniform vec3 uColor;
void main() { gl_FragColor = vec4(uColor, 1.0); }
```

The head mesh is scaled to x = 1.76 (1.1 times the slip width) and y = `uPxToLocal` (1 CSS px), placed at y = `HEAD_Y`, as a child of `printer`, so it rotates with the printer and stays 1 CSS px tall at every fit.

`ghostMaterial` draws a 1 CSS px dashed rectangle (6px on, 4px off) inside a quad whose world size is set per frame from a rectangle in CSS px:

| Uniform | Type | Value | Driven by |
| --- | --- | --- | --- |
| `uColor` | `vec3` | `STAGE_PALETTE[3]` Fern Link | Constant |
| `uRectPx` | `vec2` | Outline width and height in CSS px | Scroll (travel interpolates the lane rectangle to the slot rectangle) |
| `uDash` | `vec2` | (6.0, 4.0) CSS px | Constant |
| `uAlpha` | `float` | 0 to 1 | Time (separation, 300ms) |

```glsl
// ghost.frag   (vUv from the quad's uv)
uniform vec3 uColor; uniform vec2 uRectPx; uniform vec2 uDash; uniform float uAlpha;
varying vec2 vUv;
void main() {
  vec2  p = vUv * uRectPx;                                     // CSS px inside the rectangle
  vec4  e = vec4(p.y, uRectPx.x - p.x, uRectPx.y - p.y, p.x);  // bottom, right, top, left
  float d = min(min(e.x, e.y), min(e.z, e.w));
  float line = 1.0 - smoothstep(0.5, 1.5, d);                  // 1 CSS px stroke on the inside edge
  float w = uRectPx.x, h = uRectPx.y, per;                     // perimeter: bottom, right, top, left
  if (d == e.x)      per = p.x;
  else if (d == e.y) per = w + p.y;
  else if (d == e.z) per = w + h + (w - p.x);
  else               per = 2.0 * w + h + (h - p.y);
  float m    = mod(per, uDash.x + uDash.y);
  float dash = 1.0 - smoothstep(uDash.x - 0.5, uDash.x + 0.5, m);
  float a = line * dash * uAlpha;
  gl_FragColor = vec4(uColor * a, a);
}
```

The branch picks one edge per fragment, is coherent across large areas and runs only during `ghost-path`.

### 3.5 Print texture: a ring buffer of paper

#### Allocation

| Texture | T2 size | T1 size | Format | Filtering | Wrap | Other |
| --- | --- | --- | --- | --- | --- | --- |
| A (sample paper) | 1024 by 2560 (2304 visible + 256 hidden write-ahead) | 512 by 1280 (1152 + 128) | `CanvasTexture`, RGBA8 | `LinearMipmapLinearFilter` min, `LinearFilter` mag, mipmaps on; anisotropy `min(4, capabilities.getMaxAnisotropy())` at T2, 1 at T1 | `ClampToEdgeWrapping` on u, `RepeatWrapping` on v | `flipY = false`, `premultiplyAlpha = false`, `colorSpace = NoColorSpace` |
| B (fresh sign-up slip) | 1024 by 512 | 512 by 256 | same | same | `ClampToEdgeWrapping` on both | same |

Both 2D source canvases use `getContext('2d', { alpha: true })`. Ink is drawn in opaque `#000000` on a cleared, transparent canvas, so alpha is ink coverage.

Uploads use `texture.needsUpdate = true` (full upload, mipmaps regenerated by three). `copyTextureToTexture` is not used: its mipmap behaviour after a region copy is undocumented (0.1).

#### Paper coordinates

`s` is a position along the paper in texels, increasing toward newer paper. `uFeed` is the paper coordinate at the head; the visible paper is `[uFeed - uVisH, uFeed]`. Paper position `s` is stored at canvas row `s mod uTexH`. Rows for `s` in `(uFeed, uFeed + 256]` (T2) map to texture rows that are not visible, so writing there never shows on screen (delta D1).

#### Row types (T2 values; T1 halves every number)

| Row type | Height | Face | Size | Tracking | Baseline from row top | Left margin | Measure |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Header | 120 | Inter 500, uppercase | 40px | 0.08em (3.2px) | 78 | 64 | 896 |
| Full line | 108 | Inter 400 | 48px | 0 | 72 | 64 | 896 |
| Feed row | 60 | Inter 400 | 34px, shrinking to fit down to 26px | 0 | 42 | 64 | 896 |
| Stamp row (signature box) | 108 | Inter 400 | 48px | 0 | 72 | 64 + 24 inset | Box: 4-texel stroke, from row top + 12 to row top + 96, x from 64 to 64 + text width + 48 |

On screen at the 1440 by 900 lane fit (slip 301 CSS px wide, 3.40 texels per CSS px), a full line is about 14px type on a 32px rhythm, a feed row about 10px on 18px, and the header about 12px.

#### One print step

A full-size entry line is word-wrapped (3.6) into one to three rows. Each row is one print step:

1. The row is drawn into the canvas at paper position `top = max(uPrintY, uFeed - PRINT_GAP)` (clear the rows first, then draw; split the draw in two if it crosses the canvas end) and uploaded. The row lies in the hidden band, so the upload is invisible.
2. `uFeed` tweens by the row height over 520ms with `--ease-post` (`cubic-bezier(0.22, 1, 0.36, 1)`), and `uPrintY` tweens to `top + rowHeight` over 420ms with the same curve. Both start together. Because the ink edge leads the paper, it stays between 43 and 56 texels above the head (never below the perforation at 32), so the ink appears to come out of the printer.
3. The next row of the same entry starts when the previous step's 520ms ends.

The slip is held flat for every full-size entry (5.4): it flattens 120ms before the first step, holds during all steps and for 200ms after, then returns over 600ms.

#### The feed (entry 02, `slip-feed`)

- 48 feed rows (60 texels each, 2,880 texels in all) start at `uFeed - PRINT_GAP`.
- `uFeed` tweens by 2,880 over 2,400ms with `--ease-feed` (`cubic-bezier(0.45, 0, 0.55, 1)`). During the feed, `uPrintY` is set every frame to `uFeed - PRINT_GAP`.
- Rows are written in batches of two (120 texels at T2, 60 at T1). A batch covering `[b0, b1]` is written as soon as `b1 <= uFeed + 256` (T2) and must be written before `uFeed - PRINT_GAP` passes `b0`. That window is 192 texels, at least 100ms at the feed's peak speed, so the write never races the paper. That is 24 uploads in 2.4s, at most one per frame.
- 200ms after the feed stops, the full-size 02 line prints (two rows, about 1,040ms).
- Total autonomous motion for the beat: 120 + 2,400 + 200 + 1,040 + 200 + 600 = 4,560ms. That is under the 5s threshold of WCAG 2.2.2, and the visitor's scroll started it.

#### Replay without a sweep

On reload mid-page, on Activity recreate, or when more than two prints are queued, the stage computes the final `uFeed` and `uPrintY` for every line in `ledgerStore.printed`, draws only the rows that land in the visible window plus the hidden band, uploads once and sets the uniforms directly. Nothing animates.

#### Initial layouts

| Paper | Layout |
| --- | --- |
| A, hero (`slip-open`) | `uFeed = 1613`; header at `s` 0 to 120; line 00 at 120 to 228; `uPrintY = 228`. The header's top sits 30% down from the slip's top edge, line 00 under it, and blank fed paper below down to the head. The poster (8.5) is rendered from exactly this state |
| A, fresh after the tear (`torn = true`) | Same layout with the header and `05 · Receipt filed` |
| B, sign-up slip (`slip-fresh`) | Header `KAIROS · AT SIGN-UP` at `s` 40 to 160; the `+25 credits · free grant · never expires` line (two rows) at 160 to 376; final `uFeed = 432`. `uPaperLen` always equals `uFeed`, so the slip is exactly as long as the paper that has come out |

### 3.6 Drawing text into the canvas

| Topic | Rule |
| --- | --- |
| Font family | Read the `next/font` family string with `getComputedStyle(document.body).getPropertyValue('--font-inter').trim()`; fall back to `Inter, system-ui, sans-serif`. The family that `next/font` generates is not the literal name "Inter" |
| Font readiness | `await Promise.all([document.fonts.load('400 48px ' + family), document.fonts.load('500 40px ' + family)])` before the first draw (T1 sizes at T1) |
| Tabular numerals (delta D5) | Every digit is drawn alone, centred in a cell whose width is `measureText('0').width` at the current font. Runs of non-digits are drawn with one `fillText` and advanced by their measured width |
| Slashed zero (delta D5) | After drawing `0` in its cell at `(x, baseline)`, with `cell` the cell width and `asc` the `actualBoundingBoxAscent` of `0`: stroke a line from `(x + 0.30 cell, baseline - 0.14 asc)` to `(x + 0.70 cell, baseline - 0.86 asc)` with `lineWidth = round(0.085 × fontSize)`, `lineCap = 'butt'` and `strokeStyle = '#000000'`. A visual sign-off compares it with the DOM `zero` glyph at the same size |
| Header tracking | `ctx.letterSpacing = '3.2px'` when the property exists; otherwise characters are placed one by one with 3.2px added to each advance |
| Text rendering | `ctx.textRendering = 'optimizeLegibility'` when available; `textBaseline = 'alphabetic'`; `fillStyle = '#000000'` |
| Wrapping (delta D10) | Greedy at spaces within the 896-texel measure. A ` · ` separator stays at the end of the row before the break. At most three rows per entry; every string in 3.7 fits in two |
| Feed rows (delta D9) | Never wrapped and never truncated. Start at 34px; if the row is wider than 896, step down 2px at a time to the 26px floor. The P1 generator keeps excluded keywords to 16 characters or fewer, so the floor always suffices |
| Signature box | The stamp row draws a 4-texel ink rectangle around the time. The direction's Phosphor White box would be invisible on paper, so on paper the box is ink |

### 3.7 Receipt lines (one data source for the texture and the DOM)

`web/components/landing/stage/receipt-lines.ts` exports `ReceiptLineId`, `RECEIPT_LINES` and `getReceiptLines(printed, snapshot)`. The `Stage` draws from it and the lane's `<ol id="receipt-lines">` renders from it, so the canvas and the accessible list never differ.

| `ReceiptLineId` | Row type | Exact text | Printed when |
| --- | --- | --- | --- |
| `header` | Header | `KAIROS · RECEIPT · SAMPLE` | Pre-printed |
| `l00` | Full | `00 · Ledger opened` | Pre-printed |
| `feed` | 48 feed rows | `SKIP · {id} · {first reason}` or `PASS · {id} · goes to scoring`; four-digit ids and reasons from the default combination in `web/content/fit-sample.json` | `entry-02-fit-gate` local u crosses 0.20 forward, once |
| `l02` | Full | `02 · Fit gate · hard rules first · every skip has a reason` | 200ms after the feed stops |
| `rules-changed` | Feed row | `RULES CHANGED · SAMPLE RE-CHECKED` | 800ms after the last sample-run control change; at most 8 per session (later changes still update the DOM and its live region) |
| `l03` | Full | `03 · Resume v3 · every line cites a confirmed fact` | `entry-03-truth-lock` u crosses 0.20 |
| `l04-approved` | Full + stamp row | `04 · Approved by you`, then the stamp `{local date and time}` in the signature box | The approve click. The time is read in the handler, stored as ISO in `approvedAt` and formatted with `Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" })` |
| `l04-awaiting` | Full | `04 · Awaiting your approval` | `entry-04-approve` u crosses 0.85 with `approvedAt` null, once |
| `l05-submitted` | Full | `05 · Submitted · employer form · fields saved` | Stage p crosses 0.05 with `approvedAt` set |
| `l05-not-sent` | Full | `05 · Not sent · waiting for your approval` | Stage p crosses 0.05 with `approvedAt` null |
| `fresh-header`, `l05-filed` | Header, full | `KAIROS · RECEIPT · SAMPLE`, `05 · Receipt filed` | Drawn on the fresh paper when the tear completes; seen when the canvas next shows |
| `l06` | Full | `06 · Reply tagged to its application` | `entry-06-replies` u crosses 0.20 |
| `signup-header`, `l10` | Header, full (texture B) | `KAIROS · AT SIGN-UP`, `+25 credits · free grant · never expires` | `entry-10-start` u crosses 0.20 |

Every print calls `ledgerStore.print(id)` (delta D12), which appends to `printed` and persists it to `sessionStorage` in try/catch. A print requested while the canvas is hidden is queued and plays when the canvas next becomes visible, after its fade-in, under the queue rule (more than two queued: all but the last print at once).

In the DOM list the 48 feed rows are one item (copy key `receipt.feedSummary`, owned by `06-copy-deck.md`), with the rows in a nested `<ol>` inside a native `<details>`. Every other id is one `<li>` with the exact text above.

## 4. Lighting and post-processing

| Item | Decision | Cost |
| --- | --- | --- |
| Lights | None. The paper shader computes a fixed-direction Lambert term itself (3.3); no `Light` objects, no shadow maps, no environment map | 0 lights, 0 shadow passes |
| Emissive | None. The paper is never brighter than Mint Frost | 0 |
| Post-processing | None. No `EffectComposer`, no `RenderPass`, no bloom, FXAA, SMAA, vignette, grain or colour pass. Edge smoothing comes from `fwidth` in the paper and ghost shaders, and banding from the in-shader dither | 0 passes, 0 render targets, 0 extra full-screen fills, 0ms |
| Anti-aliasing | `antialias: false`; analytic edges in the shaders; DPR rounded down to 0.25 steps (8.3) to avoid moiré on 1px features | No MSAA buffer |
| Why | Every post pass is a full-screen render, the mobile bottleneck is fill rate, and a bloom pass would spread light onto nearby text, which the brand rules forbid | |

## 5. Camera, fit and scene states

### 5.1 Camera and lane fit

The camera is identical in every state: `PerspectiveCamera(35, aspect, 0.1, 20)`, position (0, 0, 6), target (0, 0, 0), `aspect = innerWidth / Hc` where `Hc` is the canvas CSS height (`100lvh`). All movement is the object's, so screen-to-world mapping stays one formula.

| Quantity | Formula |
| --- | --- |
| World units per CSS px at z = 0 | `k = 2 × 6 × tan(17.5°) / Hc = 3.78359 / Hc` |
| Slip CSS width | `W = min(0.85 × laneWidth, 0.36 × (Hc - 64))`; slip CSS height `2.25 × W` |
| Lane-fit scale | `laneScale = W × k / 1.6` |
| Slip centre, CSS px | `cx` = centre of the `[data-lane]` rectangle (any lane element; all share columns 9 to 12); `cy = 64 + (Hc - 64) / 2` (centred below the navbar) |
| Slip centre, world | `X = (cx - innerWidth / 2) × k`, `Y = (Hc / 2 - cy) × k`, `Z = 0` |
| `uPxToLocal` at lane fit | `1.6 / W` |

The lane rectangle is measured on `ScrollTrigger.refresh`, on resize (8.3 resize rule) and after `document.fonts.ready`.

Worked values (12-column grid in the 1280px container, 32px gutters and gaps; lane = columns 9 to 12):

| Viewport | Lane width | Slip W by H (CSS px) | `k` | `laneScale` | X | Y | `uPxToLocal` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1024 by 768 | 298.7 | 253.4 by 570.2 | 0.0049266 | 0.7803 | 1.6292 | -0.1576 | 0.00631 |
| 1280 by 800 | 384.0 | 265.0 by 596.2 | 0.0047295 | 0.7833 | 1.9675 | -0.1513 | 0.00604 |
| 1440 by 900 | 384.0 | 301.0 by 677.2 | 0.0042040 | 0.7908 | 1.7489 | -0.1345 | 0.00532 |
| 1920 by 1080 | 384.0 | 326.4 by 734.4 | 0.0035033 | 0.7147 | 1.4574 | -0.1121 | 0.00490 |
| 2560 by 1440 | 384.0 | 326.4 by 734.4 | 0.0026275 | 0.5360 | 1.0930 | -0.0841 | 0.00490 |

### 5.2 Progress inputs

The `Stage` creates its own ScrollTriggers inside its effect (no prop plumbing from the entries) and writes plain numbers into a module-level `stageInput` object, never React state:

| Input | Source | Definition |
| --- | --- | --- |
| `u[i]` per entry | One ScrollTrigger per `[data-scene]` element, `start: "top 85%"`, `end: "bottom 15%"`, `refreshPriority` = entry index | Local progress 0 to 1, as in the direction (4.5) |
| `p` | One ScrollTrigger on `[data-stage="entry-05"]`, `start: "top top"`, `end: "bottom bottom"` | Pinned stage progress 0 to 1. The pin itself is CSS `position: sticky`; ScrollTrigger only measures |
| Pointer | `pointermove` on `window` (passive), registered only while tilt is eligible (5.4) | Normalised position against the slip centre |
| Store | `ledgerStore.subscribe` | `approvedAt`, `torn`, `printed`, `feedDone` |

Each entry element carries `data-scene` with its state id: `entry-00-hero` `slip-open`, `entry-01-reported` `slip-recede`, `entry-02-fit-gate` `slip-feed`, `entry-03-truth-lock` `slip-cite`, `entry-04-approve` `slip-hold`, `entry-05-send-receipt` `slip-tear` (the stage substitutes `ghost-path` when `approvedAt` is null at p 0.18), `entry-06-replies` `slip-reply`, `entry-07-billing`, `entry-08-compare` and `entry-09-questions` `none`, `entry-10-start` `slip-fresh`.

### 5.3 State table

Offsets are relative to the lane-fit pose: x as a fraction of the lane width (positive right), y as a fraction of `Hc` (positive up), z in world units. Rotations are degrees (x, y, z), Euler order XYZ, applied to `printer`. Scale multiplies `laneScale`. Uniform values are the state's rest values; T1 forces `uCurl = 0`.

| State id | Section | Camera position | Target | fov | Offset (x, y, z) | Rotation | Scale | `uCurl` | `uLevel` | `uAlpha` A | `uPaperLen` A | Pointer tilt | Canvas | Prints |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `slip-open` | `entry-00-hero` | (0, 0, 6) | (0, 0, 0) | 35 | (0, 0, 0) | (6, -14, 2) | 1.00 | 1 | 1.00 | 1 | 2304 | On (T2, fine pointer): up to 6 on y, 3 on x | Visible | `header`, `l00` pre-printed |
| `slip-recede` | `entry-01-reported` | (0, 0, 6) | (0, 0, 0) | 35 | (+0.15, -0.06, -0.8) | (4, -24, 0) | 0.82 | 1 | 0.65 | 1 | 2304 | Off | Visible | None |
| `slip-feed` | `entry-02-fit-gate` | (0, 0, 6) | (0, 0, 0) | 35 | (0, 0, 0) | (0, -6, 0) | 0.96 | 1 | 1.00 | 1 | 2304 | Off | Visible | `feed` at u 0.20, `l02` 200ms after; `rules-changed` on control changes |
| `slip-cite` | `entry-03-truth-lock` | (0, 0, 6) | (0, 0, 0) | 35 | (0, 0, 0) | (2, -10, 0) | 0.96 | 1 | 1.00 | 1 | 2304 | Off | Visible | `l03` at u 0.20 |
| `slip-hold` | `entry-04-approve` | (0, 0, 6) | (0, 0, 0) | 35 | (-0.04, 0, 0.2) | (0, -4, 0) | 1.00 | 1 | 1.00 | 1 | 2304 | Off; nothing prints on scroll before u 0.85 | Visible | `l04-approved` on click; `l04-awaiting` at u 0.85 if not approved |
| `slip-tear` | `entry-05-send-receipt`, approved | (0, 0, 6) | (0, 0, 0) | 35 | Lane (0, 0, 0); body then travels to the slot (5.6) | (0, -6, 0); body to (0, 0, 0) | 1.00; body to slot fit | 1, then 0 at the tear | 1.00 | 1 | 2304, then length fit | Off | Visible until p 0.50, then hidden | `l05-submitted` at p 0.05 |
| `ghost-path` | `entry-05-send-receipt`, not approved | (0, 0, 6) | (0, 0, 0) | 35 | Lane (0, 0, 0); the ghost outline travels | (0, 0, 0) | 1.00 | 1 | 1.00 | 1 | 2304 | Off | Visible until p 0.50, then hidden | `l05-not-sent` at p 0.05 |
| `slip-reply` | `entry-06-replies` | (0, 0, 6) | (0, 0, 0) | 35 | (0, 0, 0) | (4, -12, 1) | 0.92 | 1 | 1.00 | 1 | 2304 | Off | Fades in when the entry top reaches 70% | Queued prints, then `l06` at u 0.20. Fresh paper only if `torn` (delta D7) |
| `none` | `entry-07-billing`, `entry-08-compare`, `entry-09-questions` | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | Hidden (`visibility: hidden`, no renders) | None (requests queue) |
| `slip-fresh` | `entry-10-start` | (0, 0, 6) | (0, 0, 0) | 35 | (0, 0, 0) | (6, -14, 2) | 1.00 | 1 | 1.00 | 1, then 0 during the lift-out | 2304; B grows 0 to 432 | On (T2, fine pointer) after the print | Fades in when the entry top reaches 85% | `signup-header`, `l10` at u 0.20 |

Ghost uniform values in `ghost-path`: `uAlpha` 0 before p 0.18 and 1 after the 300ms separation; `uRectPx` equals the slip's lane rectangle (W by 2.25W, 301 by 677 at 1440 by 900) offset by (-12, -12) CSS px after separation, interpolating to the slot rectangle during travel.

### 5.4 Pose composition (every rendered frame)

1. **Target pose.** Let `i` be the highest entry index whose `u[i] > 0`, and `j` the nearest earlier entry with a different state. Target = `mix(pose(j), pose(i), smoothstep(0, 0.25, u[i]))` for offset, scale, `uCurl` and `uLevel`; rotations are mixed per Euler component (all angles are under 25 degrees, so component mixing is visually exact).
2. **Approach.** The applied pose moves toward the target with a frame-rate-independent lerp equal to 0.12 per frame at 60fps: `a = 1 - 0.88^(dt × 60)` (0.12 at 60fps, 0.2256 at 30fps), `pose += (target - pose) × a`. When every component is within 1e-4 of its target, it snaps and stops requesting renders. There is no overshoot.
3. **Pointer tilt** (`slip-open` and `slip-fresh` only; T2; `(hover: hover) and (pointer: fine)`): `nx = clamp((clientX - slipCentreX) / (innerWidth / 2), -1, 1)`, `ny = clamp((clientY - slipCentreY) / (Hc / 2), -1, 1)`; target tilt `y = 6 × nx` degrees and `x = 3 × ny` degrees (the face turns toward the pointer). Smoothing is critically damped: `tilt += (target - tilt) × (1 - exp(-6 × dt))`. When the pointer leaves the window, or in any other state, the target is 0. It settles within 0.01 degrees in about 1.1s and then stops rendering.
4. **Flatten** for full-size prints: a factor `f` multiplies both the pose rotation and the tilt. `f` goes 1 to 0 over 120ms (`--ease-post`) before the first print step, stays 0 during every step and for 200ms after, then returns to 1 over 600ms (`--ease-post`). Lines the visitor might read are never printed on a rotated surface.
5. **Compose.** `printer.position = laneCentre + offset`, `printer.rotation = f × (poseRotation + tilt)`, `printer.scale = laneScale × poseScale`. Before the tear `bodyA.matrix = printer.matrixWorld × translate(0, liftY, 0)` with `liftY = 0`.

### 5.5 Transitions between consecutive states

Scroll distances are for 1440 by 900, where an entry's u range spans its height plus 0.70 `Hc` (630px).

| From | To | Trigger and range | Scroll distance | Easing | What changes | On reverse scroll |
| --- | --- | --- | --- | --- | --- | --- |
| Poster | `slip-open` | Stage ready (9.1) | n/a | Linear opacity, 600ms: the poster fades out over the canvas, which already shows the identical frame | The canvas takes over | n/a |
| `slip-open` | `slip-recede` | `entry-01-reported` u 0 to 0.25 | 360px | `smoothstep`, then the 0.12 lerp | Offset, rotation, scale 1.00 to 0.82, `uLevel` 1.00 to 0.65 | Scrubs back |
| `slip-recede` | `slip-feed` | `entry-02-fit-gate` u 0 to 0.25 | 495px | Same | Back to the lane, scale 0.96, `uLevel` 1.00; the feed starts at u 0.20 (time, 2,400ms, `--ease-feed`) | Pose scrubs back; the feed never reverses |
| `slip-feed` | `slip-cite` | `entry-03-truth-lock` u 0 to 0.25 | 428px | Same | Rotation (0, -6, 0) to (2, -10, 0); `l03` at u 0.20 | Pose scrubs back |
| `slip-cite` | `slip-hold` | `entry-04-approve` u 0 to 0.25 | 383px | Same | Offset (-0.04, 0, 0.2), rotation (0, -4, 0), scale 1.00 | Pose scrubs back |
| `slip-hold` | `slip-tear` or `ghost-path` | Stage p 0 to 0.10 | 90px | Same | Lane pose (0, -6, 0) for `slip-tear`, (0, 0, 0) for `ghost-path`; the 05 line at p 0.05 | Pose scrubs back |
| Inside `slip-tear` | | Tear at p 0.18; travel p 0.25 to 0.50; hand-off at p 0.50 | 162px, 225px, at 450px | Tear 700ms `--ease-tear` (time); travel scrubbed through `--ease-travel`; hand-off 400ms linear opacity | 5.6 | Travel scrubs back until the hand-off; the tear never reverses |
| Inside `ghost-path` | | Separation at p 0.18; travel p 0.25 to 0.50; hand-off at p 0.50 | same | Separation 300ms `--ease-post`; travel scrubbed `--ease-travel`; hand-off 400ms linear | 5.6 | Travel scrubs back |
| `slip-tear` or `ghost-path` | `slip-reply` | `entry-06-replies` top reaches 70% of `Hc` | n/a | 400ms linear opacity fade-in; the pose is set directly while hidden | Fresh paper (if torn) or paper A continuing | Fades out when the entry top goes back below 70%; the stage area is DOM again |
| `slip-reply` | `none` | `entry-07-billing` top reaches 85% | n/a | 400ms linear fade-out, then `visibility: hidden` | Rendering stops | Fades back in |
| `none` | `slip-fresh` | `entry-10-start` top reaches 85% | n/a | 400ms linear fade-in; pose set while hidden | Paper A in the lane; at u 0.20 the lift-out and paper B (below) | Fades out; the lift-out never reverses |
| Inside `slip-fresh` | | u crosses 0.20 | n/a | Time-based | t 0 to 600ms: paper A lifts by 1.15 slip heights (`--ease-travel`) and `uAlpha` A goes 1 to 0, linear, from 240ms to 600ms. t 300 to 1,200ms: paper B feeds 0 to 216 texels (`--ease-feed`), bringing its header out past the print gap. From 1,200ms: flatten, print the two `l10` rows (1,040ms), hold 200ms, unflatten 600ms. Total 3,160ms | Never reverses |

All scroll-linked moves are reversible poses. Every time-based move runs once, to its end, and is recorded in `ledgerStore`.

### 5.6 The pinned stage (entry 05, 1024px and wider)

**Slot measurement.** `[data-slot="receipt"]` sits inside the 100vh sticky stage, so its viewport rectangle while pinned equals its offset inside the stage. The stage measures `slotRect = slot.getBoundingClientRect()` minus the stage's own top-left, on refresh and resize, and treats it as viewport coordinates for any p in [0, 1].

**Slot fit (delta D8).** `slotScale = slotRect.width × k / 1.6`. Length fit: the body's visible length in texels is `uPaperLen - 32` (the perforation is at 32), and must match the slot's aspect: `uPaperLenTarget = clamp(32 + 1024 × slotRect.height / slotRect.width, 288, 2304)` at T2 (`16 + 512 × ratio`, clamped to 144 to 1152, at T1). The visible body's centre in slip space is `yc = PERF_Y + (uPaperLenTarget - 32) / 1280` (T2; `/ 640` at T1), so the body's slot position is `slotCentreWorld - slotScale × (0, yc, 0)` with rotation (0, 0, 0). If the slot's aspect (height over width) is 2.22 or more, the body (2,272 visible texels over 1,024) already fits and no length fit happens. The paper above the cut is the oldest paper (the feed rows and line 02); the newest lines, 03 to 05, stay.

**Sequence (approved visitor, `slip-tear`).**

| p | Event | Values |
| --- | --- | --- |
| 0.00 to 0.10 | Pose blend into the lane pose | As 5.5 |
| 0.05 | Print `l05-submitted` (flatten applies) | 1,440ms for one row; the line is two rows, 1,960ms |
| 0.18 forward, once | Tear: `liftY` 0 to `0.04 × Hc × k / printerScale` local units and `uCurl` 1 to 0, both over 700ms with `--ease-tear`. `ledgerStore.torn = true` at the end. T1: same lift, no curl (a straight split) | At 1440 by 900 the lift is 36 CSS px |
| 0.25 to 0.50 | Travel, `kt = easeTravel((p - 0.25) / 0.25)`: body position `mix(liftedLanePosition, slotPosition, kt)`, rotation `(0, -6, 0) × (1 - kt)`, scale `mix(laneScale, slotScale, kt)`, `uPaperLen = mix(2304, uPaperLenTarget, kt)`, `uPxToLocal = k / scale`. Stub and head stay in the lane | Scrubbed |
| 0.50 forward | Hand-off: the canvas CSS opacity goes 1 to 0 over 400ms, linear (T1: 240ms). The DOM receipt's fade-in is keyed to the same p threshold by its own code, so both start on the same frame | Opacity only |
| After the fade | `visibility: hidden`; rendering stops. Texture A is redrawn as fresh paper (`fresh-header`, `l05-filed`, 3.5); the body reattaches (`liftY = 0`, `uPaperLen = 2304`, `uCurl` back to the pose value) | Invisible |

**Fast scroll.** The 05 line takes about 2s to print, and a visitor can reach p 0.18 sooner. When the tear starts, any running print step completes at once (`progress(1)`), and a tear still running when p reaches 0.25 completes at once, so the travel always moves a torn, flat body.

**Sequence (not approved, `ghost-path`).** At p 0.05 the slip prints `l05-not-sent`. At p 0.18 the ghost separates: `uAlpha` 0 to 1 and an offset of (-12, -12) CSS px over 300ms (`--ease-post`). From 0.25 to 0.50 the ghost's centre and `uRectPx` interpolate from the lane rectangle to `slotRect` with `kt`, and the offset decays to 0 with `kt`; the slip stays in the lane. At 0.50 the canvas fades out as above. Pressing the in-place "Approve sample draft" sets `approvedAt`; the stage queues `l04-approved` for the next time the canvas is visible.

**Re-entering the stage.** Scrolling back above p 0.50 while `torn` fades the canvas back in (400ms) with the fresh paper in the lane pose; there is no second tear and no travel. Scrolling forward past 0.50 again fades it out. If the visitor approved at the ghost and scrolls back above p 0.18, the next forward crossing of 0.18 runs the approved sequence, tear included.

### 5.7 Append-only rules

- Printed lines never un-print, the feed and the tear never reverse, and paper A never returns to the hero layout once torn.
- On mount (first load, reload mid-page, Activity recreate), every event whose trigger point is already behind the current scroll position applies at once with no animation: prints replay (3.5), a due tear applies instantly, and the travel takes its scrubbed value from p.
- The only state written by the stage is `ledgerStore.print(id)` and `ledgerStore.torn`. Every other value is recomputed from the store, the scroll position and the tier.

## 6. DOM and canvas layering

### 6.1 Structure

| Layer | Element | CSS | z-index |
| --- | --- | --- | --- |
| Page background | `body` | `background: var(--background)` (Void) | n/a |
| Stage | `<div class="stage-root" aria-hidden="true">` holding the one `<canvas>`, rendered by `Stage` (client only) | `position: fixed; inset: 0 0 auto 0; height: 100lvh; pointer-events: none; contain: strict; view-transition-name: kairos-stage`; canvas `width: 100%; height: 100%; display: block; opacity: 1`. Fades (hand-off, entries 06, 07 and 10) are set by the stage as inline `transition: opacity 400ms linear` (240ms at T1) and `opacity`, then `visibility: hidden` on `transitionend` when fading out | 0 |
| Content | Every entry, `position: relative`, transparent background over the lane | Text in columns 1 to 8 only (column 8 is the buffer) | 1 |
| Mint band | Entry 05's mint layer and band (DOM) | Covers the canvas after the hand-off | 1 |
| Rail | Ledger rail | Fixed | 40 |
| Navbar | Navbar | Fixed, Carbon Veil at 85% with 10px blur | 50 |
| Dialogs | Native `<dialog>` | Top layer | Top layer |

Global CSS: `::view-transition-group(kairos-stage) { animation: none; }` so route changes do not cross-fade the stage. One `StageLoader` is rendered by `web/app/(public)/page.tsx` before the first entry; it renders nothing at T0.

The hero poster `<img>` and the lane receipt `<aside aria-label="Sample receipt" data-lane-receipt>` with `<ol id="receipt-lines">` are server HTML in the lane. When the canvas has faded in, the stage sets `data-stage-ready="true"` on `<html>`; CSS then hides the lane receipt visually (the standard visually-hidden pattern, still read by assistive technology). Without that attribute the lane receipt is visible, which is the T0 presentation and the pre-load state.

### 6.2 Pointer events

- The canvas has `pointer-events: none`. Nothing in the scene is interactive and there is no raycasting; every control is a DOM element.
- The pointer for tilt is read from `window` `pointermove` (passive), registered only while tilt is eligible (5.4) and removed otherwise. `pointerleave` on `document.documentElement` sets the tilt target to 0.
- Wheel, touch and keyboard scrolling are never intercepted by the stage; Lenis (01, 10.1) and native scroll own them.

### 6.3 Readability guarantees

| Guarantee | Mechanism | Check |
| --- | --- | --- |
| Text never sits on the slip | Text stays in columns 1 to 8; the slip stays inside `[data-lane]` (columns 9 to 12) except during the entry 05 travel | Playwright lane separation at 1024, 1280 and 1440 (12.3) |
| Text never sits on the travel path | Entry 05's H2 block stays at least 24px clear of the union of the body's rectangles for p 0.25 to 0.50 (it fades out from 0.50) | The same check at p 0.25, 0.375 and 0.50 |
| Everything outside the slip is pure Void | The canvas clears to (0, 0, 0, 0) and paper alpha is 0 outside the slip, so body text over Void keeps its brief contrast: Phosphor White 19.4:1, Moss 80 12.6:1, Sage 60 8.3:1 | Palette histogram (12.3) |
| No glow or halo onto text | No bloom, no additive blending, no emissive; paper never exceeds Mint Frost | Shader review; histogram |
| Ink on paper is legible, although the canvas is `aria-hidden` and the DOM list is authoritative | Void ink on flat Mint Frost 17.6:1; on the curl's darkest paper (shade 0.62) 9.7:1; on receded paper (`uLevel` 0.65) 7.7:1 | Contrast unit test on the palette mixes (12.2) |
| The slip is a visible object | Darkest paper (curl at recede) against Void about 4.6:1; print head (Fern Link) 6.9:1 | Same unit test |
| Forced colours | `@media (forced-colors: active)` hides `.stage-root` and shows the lane receipt; the probe returns T0 | Playwright `forcedColors: "active"` |

## 7. Idle behaviour and the pause control

### 7.1 At rest the GPU does nothing

There is no ambient motion: no sway, breathing, loop or shimmer. The stage renders a frame only when at least one of these is true, and otherwise skips `renderer.render`:

1. An entry's u or the stage p changed by more than 0.0005 since the last render.
2. The pose lerp has not settled (any component 1e-4 or more from target).
3. The pointer tilt has not settled (0.01 degrees or more from target).
4. A tween is running (print step, feed, tear, ghost separation, canvas fade bookkeeping, lift-out, paper B feed).
5. A resize happened, or a texture was uploaded this frame.

Frame cap: a dirty frame renders only if `now - lastRender >= interval - 1ms`, with `interval` 16.7ms at T2 and 33.3ms at T1; otherwise it stays dirty for the next tick. Rendering also stops when `document.hidden` is true, when the canvas is hidden (`none`, after the hand-off) and while the route is hidden by Activity (the effect has been cleaned up).

### 7.2 Every autonomous move ends quickly

| Sequence | Started by | Duration |
| --- | --- | --- |
| One-row full-size print | Scroll past u 0.20 | 1,440ms (120 flatten + 520 + 200 hold + 600 return) |
| Two-row full-size print | Same | 1,960ms |
| Feed beat (feed, pause, `l02`) | Scroll | 4,560ms |
| Tear | Scroll past p 0.18 | 700ms |
| Ghost separation | Scroll | 300ms |
| Sign-up slip (`slip-fresh`) | Scroll | 3,160ms |
| Approve stamp (two rows plus flatten) | Click | 1,960ms |

Nothing moves on its own for 5 seconds or more, and every sequence is started by the visitor, so WCAG 2.2.2 does not require a pause control for the scene. One is provided anyway.

### 7.3 Pause and stop

The "Motion: Full / Reduced" control (01, 9.2) is the pause and stop for the scene, wherever it is rendered. The stage watches both `prefers-reduced-motion` (a `change` listener) and the `data-motion` attribute on `<html>` (a `MutationObserver` on that one attribute).

| Change | Stage behaviour |
| --- | --- |
| To Reduced (or the OS preference turns on) | Every running tween jumps to its end (`progress(1)`), so the store records the same lines; the stage unmounts (dispose, 10.1); `data-stage-ready` is removed, so the lane receipt becomes visible. No WebGL code runs again in this state |
| Back to Full | Re-probe (8.2), capped by the session tier; if T1 or T2, remount and replay without a sweep (3.5); the canvas fades in over 600ms |
| Tab hidden | Rendering stops; tweens complete on GSAP's clock and, with `lagSmoothing(0)`, land on their end values when the tab returns |

## 8. Quality tiers

### 8.1 Names

The direction's three runtime tiers (01, 9.5) map onto the four quality names as follows. `data-stage-tier` on `<html>` carries `2`, `1` or `0`; `data-motion="reduced"` (01, 9.2) separates low from static.

| Quality name | Tier | WebGL | DOM motion (rules, titles, odometers, DOM print and tear) |
| --- | --- | --- | --- |
| High | T2 (`data-stage-tier="2"`) | Full scene | Runs |
| Medium | T1 (`data-stage-tier="1"`) | Lite scene | Runs |
| Low | T0 (`data-stage-tier="0"`), motion allowed | None; the WebGL chunk is never requested | Runs. At 1024px and wider, entry 05 uses the same DOM print-and-tear as phones (01, 9.1) in normal flow, with no pin |
| Static | T0 with `data-motion="reduced"` or `prefers-reduced-motion: reduce` | None | None; every element is in its final state (01, 9.2) |

### 8.2 Detection

`probeTier(env)` in `tier.ts` is a pure function over an environment object, so it is unit-tested row by row. It runs once inside the idle callback after `load` (9.1), never during render. The first matching row wins.

| Order | Condition | Tier |
| --- | --- | --- |
| 1 | `innerWidth < 1024` | 0 (no stage on phones and tablets in portrait, by decision) |
| 2 | `matchMedia('(prefers-reduced-motion: reduce)').matches` or `<html data-motion="reduced">` | 0 (static) |
| 3 | `matchMedia('(forced-colors: active)').matches` | 0 |
| 4 | `navigator.connection?.saveData === true` | 0 |
| 5 | `sessionStorage['kairos-stage-tier']` holds 0, 1 or 2 (try/catch) | That value; the probe below still runs and the lower of the two wins |
| 6 | `document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true, powerPreference: 'low-power' })` returns null | 0 (no WebGL 2, or a software renderer) |
| 7 | `navigator.deviceMemory <= 2` (Chromium only; absent means unknown, never low) | 1 |
| 8 | `navigator.hardwareConcurrency <= 4` and `matchMedia('(pointer: coarse)').matches` | 1 |
| 9 | `gl.getParameter(gl.MAX_TEXTURE_SIZE) < 4096` | 1 |
| 10 | Otherwise | 2 |

After row 6 the probe context is released at once with `gl.getExtension('WEBGL_lose_context')?.loseContext()`. `WEBGL_debug_renderer_info` is not read. `detect-gpu` is not used (it fetches benchmark data from unpkg at runtime).

Live changes: narrowing the window below 1024px unmounts the stage (the page switches to the phone composition); widening to 1024px or more re-runs the probe, capped by the session tier. A change to reduced motion follows 7.3.

### 8.3 Settings per tier

| Setting | T2 (high) | T1 (medium) | T0 (low and static) |
| --- | --- | --- | --- |
| Device pixel ratio (delta D14) | `min(devicePixelRatio, 2, max(1, round4(sqrt(2.1e6 / (cssW × cssH)))))` | `min(devicePixelRatio, 1, max(0.75, round4(sqrt(1.0e6 / (cssW × cssH)))))` | n/a |
| Drawing buffer target | 2.1MP, never below DPR 1 (1440 by 900 at DPR 2 gives 1.25 and 2.03MP; 1920 by 1080 at DPR 1 gives 1.0 and 2.07MP; 2560 by 1440 gives 1.0 and 3.69MP) | 1.0MP, never below DPR 0.75 (1440 by 900 gives 1.0 and 1.30MP; 1920 by 1080 gives 0.75 and 1.17MP) | n/a |
| Frame cap | 60fps (16.7ms) | 30fps (33.3ms) | n/a |
| Body geometry | 32 by 95 segments | 1 by 1 | n/a |
| Curl | On (`uCurl` per state, 38 degrees maximum) | Off (`NO_CURL`) | n/a |
| Print texture A | 1024 by 2560 | 512 by 1280 | n/a |
| Print texture B | 1024 by 512 | 512 by 256 | n/a |
| Glyph sizes (full, feed, header) | 48, 34 (floor 26), 40px | 24, 17 (floor 13), 20px | n/a |
| Anisotropy | `min(4, getMaxAnisotropy())` | 1 | n/a |
| Pointer tilt | On in `slip-open` and `slip-fresh` with a fine pointer | Off | n/a |
| Tear | Lift 4% of `Hc` and curl relaxes to 0 (700ms) | Straight lift, same curve and duration | DOM print and tear (low) or none (static) |
| Hand-off fade | 400ms | 240ms | n/a |
| Feed | 48 rows, batches of 2 | 48 rows, batches of 2 | DOM list summary item |
| Lane presentation | Canvas; lane receipt visually hidden | Same | Visible lane receipt (mint paper, perforated top, 14px lines on a 32px rhythm) |
| Entry 05 | Pinned stage (5.6) | Pinned stage | Normal flow |

`round4(x) = Math.round(x × 4) / 4` keeps DPR on 0.25 steps (MDN warns that fractional ratios on fine lines cause moiré). The renderer is resized only when the CSS width changes, or the height changes by more than 25%, and always with `renderer.setSize(cssW, cssH, false)` after `setPixelRatio(dpr)`; CSS sizes the canvas.

### 8.4 Runtime sampler

`createFrameSampler()` records the interval between two consecutive rendered ticks (only when the previous tick also rendered, so idle gaps never count).

| Rule | Value |
| --- | --- |
| Window | First 45 qualifying intervals after the canvas is ready, then the next 45 after any step-down |
| Step down T2 to T1 | Median above 24ms: dispose the scene, rebuild at T1 and replay with no sweep (the poster or lane receipt covers the rebuild, 9.1) |
| Step down T1 to T0 | Median above 34ms at T1, or a third step-down in one session: unmount the stage; the lane receipt shows |
| Persistence | Final tier in `sessionStorage['kairos-stage-tier']` (try/catch). No step-up within a session |

### 8.5 Static fallback per state

The pre-load state of every tier and the whole T0 experience use the same fallbacks. Only `slip-open` needs an image; every later state is the DOM lane receipt, which costs no download and is always exact because it renders from `receipt-lines.ts`.

| State | Fallback shown | Asset | Format | Intrinsic size | Weight budget |
| --- | --- | --- | --- | --- | --- |
| `slip-open` | Poster of the exact hero state (header, line 00, curl, print head) on Void | `web/public/landing/receipt-slip-open.avif`, `web/public/landing/receipt-slip-open.webp` | AVIF (opaque, on Void), WebP fallback through `<picture>` | 816 by 1648 px: 2x the largest slip (326.4 CSS px wide) with a box 1.25 slip widths wide and 2.52 slip widths tall | AVIF 40KB or less, WebP 64KB or less |
| `slip-recede` | Lane receipt: header, `00 · Ledger opened` | none | DOM | n/a | 0KB |
| `slip-feed` | Lane receipt plus the feed summary item and `l02` | none | DOM | n/a | 0KB |
| `slip-cite` | Lane receipt plus `l03` | none | DOM | n/a | 0KB |
| `slip-hold` | Lane receipt; `l04-approved` with the time after the click, or `l04-awaiting` | none | DOM | n/a | 0KB |
| `slip-tear`, `ghost-path` | Entry 05 in normal flow: the DOM receipt (or the ghost receipt) on the mint band | none | DOM | n/a | 0KB |
| `slip-reply` | Lane receipt plus `l06` | none | DOM | n/a | 0KB |
| `slip-fresh` | Lane receipt plus a new group headed `KAIROS · AT SIGN-UP` with `l10` | none | DOM | n/a | 0KB |

Poster display: an `<img>` inside the hero lane, `width: calc(var(--slip-w) * 1.25)`, `aspect-ratio: 816 / 1648`, centred on the slip centre (5.1), explicit `width="816" height="1648"` attributes, `decoding="async"`, `fetchpriority="auto"` (delta D15), `alt=""` (the lane receipt carries the text). `--slip-w` is a CSS custom property on the lane: `min(85cqw, calc(0.36 * (100lvh - 64px)))` with `container-type: inline-size` on `[data-lane]`, the CSS form of the 5.1 formula.

Poster production: `web/scripts/render-stage-posters.ts` opens `/?stage-tier=2&stage-poster=slip-open` in Playwright Chromium at 1920 by 1080, DPR 2 (slip 326.4 CSS px), with the renderer created with `preserveDrawingBuffer: true` in poster mode only, captures the 816 by 1648 box, and encodes AVIF (quality 55, effort 9) and WebP (quality 80) with `sharp`. It fails if a file exceeds its budget. The poster must stay identical to the live scene: an end-to-end check (12.3, check 17) compares it with the canvas at the reference viewport and fails above a 1% pixel difference, which is the signal to re-run the script.

## 9. Loading strategy

### 9.1 Sequence

| Step | When | What | Visible result |
| --- | --- | --- | --- |
| 0 | Server HTML | H1, subhead, CTAs (the hero text is complete at first paint), the poster `<picture>` in the hero lane, the lane receipt `<aside>` with every pre-printed line. No JavaScript is needed | The T0 presentation |
| 1 | `load` event, then `requestIdleCallback(start, { timeout: 2000 })`; where `requestIdleCallback` is missing (Safari), `setTimeout(start, 200)` | `probeTier` (8.2), typically under 5ms; writes `data-stage-tier` | None |
| 2 | Tier 1 or 2 | `StageLoader` renders `Stage` through `next/dynamic(() => import('./stage'), { ssr: false, loading: () => null })` from a Client Component; the chunk (three plus the scene, 140KB gzip or less) is requested now and never before `load` | None |
| 3 | Chunk evaluated | `Stage` effect: create the renderer on a new canvas inside `.stage-root` (opacity 1, beneath the content layer), the scene, materials and geometries; resolve the font family and await the two `document.fonts.load` calls (3.6); draw texture A from `ledgerStore.printed` (replay, 3.5) and texture B's header; `renderer.initTexture(texA)` and `initTexture(texB)` | None (the poster and lane receipt sit above the canvas in z-order) |
| 4 | Warm-up | Make every mesh visible, `await renderer.compileAsync(scene, camera)` (three programs: paper, head, ghost; uses `KHR_parallel_shader_compile` where present), restore visibility, render one frame and wait one more tick | None |
| 5 | Ready | Fade the covering DOM out instead of fading the canvas in: in the hero the poster goes opacity 1 to 0 over 600ms, linear; mid-page the lane receipt does the same. On `transitionend`, set `data-stage-ready="true"` (poster `visibility: hidden`, lane receipt visually hidden) | The canvas, identical to the poster |
| 6 | Failure | Any step 2 to 5 throws (chunk error, null context, compile error) or takes more than 8,000ms from step 2 | Dispose, set the session tier to 0, keep the T0 presentation |

The poster lives in the content layer (z-index 1) above the canvas (z-index 0), so the cross-fade fades the poster out over a canvas already showing the same image. That is equivalent to fading the canvas in, and it never shows an empty frame.

### 9.2 What protects LCP

- No WebGL code, three or shader source is in the initial landing chunk; step 2 starts after `load` and idle.
- No preloader; the hero text is server HTML at its final readable colour from frame 0 (Ink starts from Sage 60, 01, 8.2).
- The poster is the only image above the fold at 1024px and wider. It is larger in area than the H1 (about 376 by 759 CSS px against about 800 by 192 at 1440 by 900), so it can become the LCP element (delta D15). It is therefore 40KB of AVIF at `fetchpriority="auto"` rather than `low`, and Lighthouse desktop must report LCP of 1.5s or less whichever element wins (12.5).
- Fonts used by the canvas are the page's own `next/font` files, already loaded for the DOM; the stage adds no font request.

## 10. Memory, disposal and context loss

### 10.1 Memory budget

| Item | T2 at 1440 by 900, DPR 1.25 | T1 at 1440 by 900, DPR 1.0 |
| --- | --- | --- |
| Drawing buffer, RGBA8, no depth, no stencil, no MSAA | 2.03MP × 4B = 8.1MB | 1.30MP × 4B = 5.2MB |
| Compositor front buffer (browser-managed, estimate) | about 8.1MB | about 5.2MB |
| Texture A with mipmaps | 1024 × 2560 × 4B × 4/3 = 14.0MB | 512 × 1280 × 4B × 4/3 = 3.5MB |
| Texture B with mipmaps | 2.8MB | 0.7MB |
| 2D source canvases (A and B) | 12.6MB | 3.1MB |
| Geometry buffers | About 0.14MB (3,168 vertices × 32B plus 6,080 × 3 × 2B of index) | under 0.01MB |
| Programs | 3 | 3 |
| **Total** | **about 46MB; budget 64MB** | **about 18MB; budget 24MB** |
| JavaScript heap added by the stage (three plus scene) | Budget 12MB | Budget 12MB |

The unused `normal` attribute is deleted from every `PlaneGeometry` (the vertex shader builds its own normal). GPU memory is read from the Chrome Task Manager "GPU memory" column during the manual pass; the JavaScript heap from a heap snapshot.

### 10.2 Disposal (effect cleanup, in this order)

1. Revert the stage's GSAP context: its ScrollTriggers and tweens (`useGSAP` with a `scope`, or `gsap.context().revert()`).
2. Remove the stage's ticker callback. Lenis's callback, owned by `SmoothScroll`, is registered first with `prioritize`, so the order Lenis, ScrollTrigger, stage holds (01, 10.1).
3. Remove listeners and observers: `pointermove`, `pointerleave`, resize (`ResizeObserver` on `.stage-root`), `visibilitychange`, the two media queries, the `data-motion` `MutationObserver`, `webglcontextlost` and `webglcontextrestored`, the `ledgerStore` subscription.
4. Dispose GPU objects: the four geometries, the four materials, textures A and B; assert `renderer.info.memory.geometries === 0` and `renderer.info.memory.textures === 0` in test builds; then `renderer.dispose()`, `renderer.forceContextLoss()`, and remove the canvas element.
5. Release the 2D source canvases by setting their `width` and `height` to 0, and reset `stageInput`.

With `cacheComponents`, Next keeps the hidden landing route mounted under `<Activity mode="hidden">` and cleans up its effects; the stage therefore disposes fully on hide and rebuilds on show from `ledgerStore`, the scroll position and the session tier, with no sweep. After five hide and show cycles there is exactly one canvas and the heap has grown by less than 1MB (12.3).

### 10.3 Context loss

| Event | Behaviour |
| --- | --- |
| `webglcontextlost` | `event.preventDefault()` (three's own handler also does this), stop rendering, remove `data-stage-ready` (the poster or lane receipt shows again), increment `sessionStorage['kairos-stage-losses']` (try/catch) |
| Second loss in the session | Dispose immediately and pin the session to tier 0 (`kairos-stage-tier = 0`); never wait for a restore |
| `webglcontextrestored` within 5,000ms | three re-initialises its GL state; set `needsUpdate = true` on textures A and B (the 2D canvases still hold the paper), `await renderer.compileAsync`, render, then run the 9.1 step 5 fade |
| No restore within 5,000ms | Dispose and stay at tier 0 for the session |
| Never | Reload the page, or show an error to the visitor |

Test builds expose `window.__kairosStage.loseContext()` and `.restoreContext()`, which call `renderer.forceContextLoss()` and `renderer.forceContextRestore()`.

## 11. Frame budget and measurement

### 11.1 Budgets

| Tier | Reference hardware | Frame cap | GPU time per rendered frame (p95) | Stage CPU per frame (p95, excluding upload frames) | CPU on an upload frame | Draw calls | Triangles | Frames rendered at rest |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T2 | MacBook Air M1 (Chrome and Safari); Windows laptop with Intel Iris Xe (Chrome), 1440 by 900 | 60fps | 2.0ms or less | 1.0ms or less | 4.0ms or less, at most one upload per frame | 4 (fail above 5) | 6,086 or fewer | 0 |
| T1 | Intel UHD 620 class, 4 cores (Chrome on Windows or ChromeOS), 1440 by 900 | 30fps | 4.0ms or less | 2.0ms or less | 6.0ms or less | 4 (fail above 5) | 8 | 0 |
| T0 | Any | n/a | 0 | 0 | n/a | 0 | 0 | 0 |

Whole-page rule at T2: the stage's CPU and GPU time together leave at least 10ms of each 16.7ms frame for Lenis, ScrollTrigger, React and the DOM demos.

Where the GPU time goes, estimated for T2 at 1440 by 900: a clear of 2.03MP, about 0.32 million paper fragments (one fetch and about 60 ALU operations each), and three tiny quads. There are no passes, no depth buffer, no shadows and no MSAA resolve.

### 11.2 How to measure

| Method | Where | What it gives | Limits |
| --- | --- | --- | --- |
| Debug overlay, `?stage-debug=1` | Builds with `NEXT_PUBLIC_STAGE_DEBUG=1` only; the code sits behind `process.env.NEXT_PUBLIC_STAGE_DEBUG === '1'` so production builds drop it | GPU ms per render through `EXT_disjoint_timer_query_webgl2` (`beginQuery(TIME_ELAPSED_EXT)` around `renderer.render`, results polled with `QUERY_RESULT_AVAILABLE` on later frames, discarded when `GPU_DISJOINT_EXT` is set); CPU ms per tick with `performance.now()`; p50 and p95 over the last 120 renders; renders per second, `info.render.calls` and `.triangles`, uploads, tier, DPR, buffer MP | GPU timing is Chromium only (about 72% of Chromium sessions report the extension; Firefox and Safari almost none). Elsewhere the column reads "n/a" and the frame interval is used |
| Chrome DevTools Performance panel | Manual | A scripted scroll from the top to entry 06: the GPU track, frame lanes, long tasks, texture uploads | CPU throttling does not throttle the GPU; use the T1 reference machine for GPU numbers |
| `window.__kairosStage.stats()` | Test builds, read by Playwright | `{ renders, uploads, resizes, calls, triangles, tier, dpr, bufferMP, state }` | Counts, not GPU time |
| Runtime sampler | Production | The median of rendered frame intervals, which drives the tier step-down (8.4) | Measures the whole frame, which is what the visitor feels |

## 12. Test plan

### 12.1 Tooling

- Unit: `vitest` at the major version the server already uses (`^5.0.4`), with `"test": "vitest run"` added to `web/package.json`, so the root `npm test` (workspaces) runs it. One file: `web/components/landing/stage/stage.test.ts`.
- End to end: `@playwright/test` at the version matching the server's `playwright-core` (`^1.64.0`), config `web/playwright.config.ts`, spec `web/e2e/landing-stage.spec.ts`, against `next build && next start` with `NEXT_PUBLIC_STAGE_DEBUG=1`.
- CI WebGL: headless Chromium with `--use-angle=swiftshader`. Because SwiftShader fails `failIfMajorPerformanceCaveat`, the probe returns T0 there; tests that need the scene pass `?stage-tier=2` or `?stage-tier=1`, which only test builds honour.

### 12.2 Unit tests (pure functions, no WebGL)

| # | Subject | Assertion |
| --- | --- | --- |
| U1 | `STAGE_PALETTE` | Exactly the six hexes of 3.2 in order; no entry within 0.1 (Euclidean, sRGB 0 to 1) of Lime Pulse (0.498, 0.933, 0.392) |
| U2 | Palette contrast | Void ink on Mint Frost 17 or more; on the curl's darkest paper (shade 0.62) 9 or more; on receded paper (level 0.65) 7 or more; darkest paper against Void 3 or more |
| U3 | `laneFit` | The five rows of 5.1 within 0.001 |
| U4 | `dprFor(tier, cssW, cssH, devicePixelRatio)` | The examples in 8.3, plus `devicePixelRatio` below the floor (for example 0.9 on a zoomed-out page) returns the device value |
| U5 | `probeTier(env)` | One case per row of 8.2, including "deviceMemory absent is not low" and "the session tier caps the result" |
| U6 | `planFeedBatches` | Every batch is written while `b1 <= uFeed + hiddenBand` and before `uFeed - PRINT_GAP` passes `b0`, for the `--ease-feed` curve sampled at 60fps and 30fps; writes that cross the canvas end are split in two |
| U7 | Print step | The ink edge stays between 43 and 56 texels above the head through a full step, sampled every 1ms |
| U8 | `getReceiptLines` | Exact strings of 3.7; feed rows built from a fixture of `fit-sample.json`; one-shot ids never repeat; `rules-changed` stops at 8; `l04-approved` formats an ISO time with `Intl.DateTimeFormat` |
| U9 | Text layout with a fake `measureText` (fixed advances) | Digits sit on equal cells; a zero gets a slash stroke; wrapping keeps ` · ` at the end of a row; a feed row shrinks no further than 26px and the function throws if it still does not fit |
| U10 | Easing functions | `easePost`, `easeFeed`, `easeTravel`, `easeTear`, `easeRetract` return 0 at 0 and 1 at 1, are monotonic, and match CSS `cubic-bezier` at t = 0.25, 0.5 and 0.75 within 0.001 |
| U11 | Smoothing | The tilt and pose filters never overshoot: 600 steps with random `dt` between 4ms and 50ms approach the target monotonically |
| U12 | Sampler | 45 intervals of 30ms step T2 down to T1; then 45 of 40ms step to T0; idle gaps are ignored; no step-up |

### 12.3 End-to-end checks (Playwright, Chromium)

| # | Check | Pass criterion |
| --- | --- | --- |
| 1 | Reduced motion (`reducedMotion: "reduce"`) | No `.stage-root canvas`; `window.__kairosStage` undefined after 5s; no script larger than 100KB requested after `load`; every lane line present in the DOM |
| 2 | WebGL disabled (launch with `--disable-webgl`) | Tier 0; the poster and the lane receipt are visible; all landing text present |
| 3 | Forced colours (`forcedColors: "active"`) | No canvas; the lane receipt is visible |
| 4 | Palette histogram at 12 scroll positions and at p 0.25, 0.375 and 0.50 | Every pixel of the lane rectangle (and the stage centre during travel) is achromatic (max minus min channel 6 or less) or has hue 95 to 135 degrees with HSV saturation 0.20 or less (delta D6) |
| 5 | Lime count (01, 3.3) with the canvas present | Never more than one visible element whose background is `rgb(127, 238, 100)` |
| 6 | Lane separation at 1024, 1280 and 1440 | No text box intersects the lane rectangle; at p 0.25, 0.375 and 0.50 the entry 05 H2 box is at least 24px from `__kairosStage.bodyRect()` |
| 7 | Idle | `renders` does not change over 2s of rest at five positions (hero, entries 02, 04, 06 and 10) |
| 8 | Draw cost | `calls` 5 or fewer and `triangles` 6,086 or fewer on every rendered frame of a full scroll |
| 9 | Colour exactness | In `slip-hold` (rotation (0, -4, 0), lambert clamps to 1), a blank paper pixel equals `#def0dd` within 1 per channel |
| 10 | Append-only | After scrolling to entry 06 and back to the top, `__kairosStage.printed()` is unchanged and `torn` stays true; after a reload at entry 06 the printed list and the lane receipt list match, and no tween ran during replay |
| 11 | Approval paths | Approve in entry 04: the lane list contains `04 · Approved by you` and the same time as the inline confirmation; the stage reports `slip-tear` in entry 05. Without approval: it reports `ghost-path`, and after the hand-off the DOM slot shows "No receipt yet. Nothing was sent." |
| 12 | Context loss | `loseContext()`: the lane receipt or poster is visible within 100ms; `restoreContext()`: the canvas returns; a second loss: no canvas and `sessionStorage['kairos-stage-tier']` is `"0"` |
| 13 | Activity | Client navigation `/` to `/pricing` and back, five times: exactly one canvas, `info.memory` reports 4 geometries and 2 textures after each return, and the heap (after a forced GC through CDP) grows by less than 1MB |
| 14 | Motion control | Choosing Reduced removes the canvas within 500ms and shows the lane receipt; choosing Full brings it back with an identical printed list |
| 15 | Resize | A width change from 1440 to 1280 re-fits the slip inside the lane; a 20% height change does not resize the renderer (`resizes` unchanged); narrowing below 1024 unmounts the stage |
| 16 | Sampler | `?stage-tier=2&stage-slow=40` (test-only busy wait per render) ends at tier 0 with `kairos-stage-tier` stored |
| 17 | Visual baselines and poster | `toHaveScreenshot` of the lane in every state at 1440 by 900 for T2 and T1, `maxDiffPixelRatio: 0.01`, SwiftShader; and the poster image compared with the live `slip-open` canvas at 1920 by 1080, DPR 2, within 1% |

### 12.4 Manual checks (design lock and each release)

- Legibility sign-off (01, 10.5): on a 1080p display at DPR 1 and on a DPR 2 display, full-size lines read cleanly when flat, the slashed zero matches the DOM `zero` glyph, and feed rows read as fast texture.
- Devices: iPad in landscape (1024 or wider) in Safari, including backgrounding the tab (context loss) and Low Power Mode (Safari caps at 30fps; the sampler may demote); Windows Chrome on an Intel iGPU; macOS Safari.
- Screen readers: NVDA with Firefox and VoiceOver with Safari. The canvas is silent, the lane receipt is read as a list, and prints are never announced.
- Keyboard: Page Down and Space through the pinned stage with no trap; skip links land below the navbar.
- A Performance-panel trace against 11.1 on both reference machines.

### 12.5 Budgets in CI

- Turbopack Bundle Analyzer: the stage chunk is 140KB gzip or less; the initial landing chunk contains no `three` module.
- Playwright: the stage chunk's request starts after `loadEventEnd`.
- Lighthouse desktop: LCP 1.5s or less and CLS 0.05 or less with the poster present (delta D15).

## 13. Interfaces and open items

### 13.1 Files

| Path | Exports | Notes |
| --- | --- | --- |
| `web/components/landing/stage/stage-loader.tsx` | `StageLoader` | `'use client'`. Waits for `load` plus idle, runs `probeTier`, writes `data-stage-tier`, then renders `Stage` through `next/dynamic(..., { ssr: false })` for tiers 1 and 2. Rendered once by `web/app/(public)/page.tsx` |
| `web/components/landing/stage/stage.tsx` | `Stage` (default export for `next/dynamic`) | `'use client'`. About 60 lines: one effect creates the scene, registers the ticker callback and ScrollTriggers, and cleans up (10.2) |
| `web/components/landing/stage/scene.ts` | `createReceiptScene`, `STAGE_PALETTE`, `STAGE_DEFINES`, the GLSL strings, `laneFit`, `slotFit`, the five easing functions | Imports `three`; only reachable from the lazy chunk |
| `web/components/landing/stage/print.ts` | `createPrintTexture`, `layoutRows`, `planFeedBatches` | 2D canvas drawing and the ring buffer |
| `web/components/landing/stage/receipt-lines.ts` | `ReceiptLineId`, `RECEIPT_LINES`, `getReceiptLines` | No `three` import; also used by the DOM lane receipt and the phone tape |
| `web/components/landing/stage/tier.ts` | `probeTier`, `dprFor`, `createFrameSampler` | No `three` import; used by `StageLoader` |
| `web/components/landing/stage/stage.test.ts` | | Unit tests U1 to U12 |
| `web/e2e/landing-stage.spec.ts`, `web/playwright.config.ts` | | End-to-end checks 1 to 17 |
| `web/scripts/render-stage-posters.ts` | | Poster production (8.5) |
| `web/public/landing/receipt-slip-open.avif`, `.webp` | | 816 by 1648 |

If `03-motion-system.md` defines a shared module for the JavaScript easing functions, `scene.ts` imports it instead of defining its own.

### 13.2 Names other documents must use

| Kind | Name | Owner of the other side |
| --- | --- | --- |
| Scene state ids | `slip-open`, `slip-recede`, `slip-feed`, `slip-cite`, `slip-hold`, `slip-tear`, `ghost-path`, `slip-reply`, `slip-fresh`, plus `none` for entries 07 to 09 | All |
| Entry attribute | `data-scene="<state id>"` on each entry section (`entry-05-send-receipt` carries `slip-tear`) | 05 architecture |
| Lane | `[data-lane]` on the lane column (any entry), with `container-type: inline-size`; CSS property `--slip-w: min(85cqw, calc(0.36 * (100lvh - 64px)))` | 02 design system, 05 architecture |
| Pinned stage | `[data-stage="entry-05"]` on the 200vh wrapper; `[data-slot="receipt"]` on the receipt slot inside the 100vh sticky stage; the DOM receipt fades in on its own when p crosses 0.50 | 03 motion, 05 architecture |
| Lane receipt | `<aside aria-label="Sample receipt" data-lane-receipt>` containing `<ol id="receipt-lines">`, rendered from `getReceiptLines` | 02, 05 |
| Poster | `.receipt-poster` `<picture>` in the hero lane | 02, 05 |
| Root attributes | `data-stage-tier="0|1|2"`, `data-stage-ready="true"` (set by the stage), `data-motion="reduced"` (set by the inline script and `MotionToggle`) | 03, 05 |
| Stage root | `.stage-root` with `view-transition-name: kairos-stage` and `::view-transition-group(kairos-stage) { animation: none; }` | 05 |
| Store | `ledgerStore` fields `posted`, `feedDone`, `approvedAt` (ISO string), `torn`, plus `printed: ReceiptLineId[]` and `print(id)` (delta D12) | 05 architecture |
| Receipt line ids | `header`, `l00`, `feed`, `l02`, `rules-changed`, `l03`, `l04-approved`, `l04-awaiting`, `l05-submitted`, `l05-not-sent`, `fresh-header`, `l05-filed`, `l06`, `signup-header`, `l10` | 05, 06 |
| Copy key | `receipt.feedSummary` (the DOM summary of the 48 feed rows) | 06 copy deck |
| Tokens read | `--receipt-paper`, `--ease-post`, `--ease-feed`, `--ease-travel`, `--ease-tear`, `--ease-retract`, `--dur-print`, `--dur-tear`, `--dur-handoff`, `--font-inter` | 02 design system |
| Session keys | `kairos-stage-tier`, `kairos-stage-losses` (sessionStorage, try/catch) | 05 |
| Test-only switches | `NEXT_PUBLIC_STAGE_DEBUG=1` enables `?stage-tier=0|1|2`, `?stage-poster=slip-open`, `?stage-debug=1`, `?stage-slow=<ms>` and `window.__kairosStage` (`stats`, `printed`, `state`, `bodyRect`, `loseContext`, `restoreContext`) | 05, QA |
| Data | `web/content/fit-sample.json` (P1), default combination, posting ids as four digits, excluded keywords of 16 characters or fewer | Owner of `server/src/services/fit.ts` |

### 13.3 Open items for the first implementation spike

| # | Item | How to resolve | Fallback |
| --- | --- | --- | --- |
| S1 | `ShaderMaterial` outputs sRGB without colour space conversion when the shader omits `<colorspace_fragment>` | E2E check 9 | Include the chunk and store the palette as linear values |
| S2 | three's prefix maps `texture2D`, `gl_FragColor` and `varying` for a non-raw `ShaderMaterial` in r186 | Compile the three programs in a 20-line page | Set `glslVersion: THREE.GLSL3` and write `texture`, `out vec4`, `in` and `out` |
| S3 | `compileAsync` compiles invisible meshes | Log `renderer.info.programs.length` after the call with `paperB` and `ghost` hidden | Keep the "make every mesh visible during warm-up" step (already in 9.1) |
| S4 | Full-texture upload cost at 1024 by 2560 | Debug overlay on both reference machines during the feed | Above 4ms: batches of one row at T2 and a `copyTextureToTexture` region copy, after confirming it regenerates mipmaps |
| S5 | Canvas 2D has no OpenType feature control | Confirm in Chrome, Safari and Firefox that `tnum` and `zero` do not apply through `ctx.font` | Already handled by manual digit cells and the drawn slash (3.6) |
| S6 | `ctx.letterSpacing` support in Safari | Feature test | Per-character placement (3.6) |
| S7 | Context loss and restore on current iPadOS Safari | Background and foreground on a device | Second loss pins tier 0 (10.3) |
| S8 | Poster as the LCP element | Lighthouse desktop and the Chrome LCP entry | Keep `fetchpriority="auto"`; if LCP exceeds 1.5s, reduce the poster to the slip's own rectangle (1.0 by 2.25 slip widths) |
