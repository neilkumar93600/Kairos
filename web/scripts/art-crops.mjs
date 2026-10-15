// Landing art: soft placeholders for the paintings in prompt.md, and crops derived from the real ones.
// Run from web/: node scripts/art-crops.mjs [--placeholders]
// Derived files are rebuilt when their source is newer. Placeholders are only ever written when the file is missing,
// so the owner's real art is never overwritten; delete a placeholder to regenerate it.
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const LANDING = fileURLToPath(new URL('../public/landing/', import.meta.url));
const ART = `${LANDING}art/`;
const args = new Set(process.argv.slice(2));
const placeholders = args.has('--placeholders');

// Palettes from prompt.md: dawn valley, footbridge, noon meadow, dusk hills, off-white OG fade.
const dawn = {
  stops: [[0, '#DCE7F2'], [0.45, '#F6DCC8'], [0.7, '#C9CFA6'], [1, '#A9B48C']],
  glows: [{ x: 0.5, y: 0.6, r: 0.22, color: '#F0BF9A', opacity: 0.6 }],
};

const PLACEHOLDERS = [
  { file: 'art/scene-a-dawn-valley.png', width: 3200, height: 1600, ...dawn },
  { file: 'art/scene-a-dawn-valley-portrait.png', width: 1088, height: 1360, ...dawn },
  { file: 'art/step-1-fit-gate.png', width: 1536, height: 1152, ...dawn },
  { file: 'art/step-2-truth-lock.png', width: 1536, height: 1152, ...dawn },
  {
    file: 'art/scene-b-footbridge.png', width: 2048, height: 2048,
    stops: [[0, '#CFE0F0'], [0.33, '#CFE0F0'], [0.5, '#E6D0C4'], [0.62, '#D7B9A6'], [1, '#8FA07A']],
    glows: [{ x: 0.6, y: 0.55, r: 0.3, color: '#F2D9C4', opacity: 0.7 }],
  },
  {
    file: 'art/scene-c-noon-meadow.png', width: 1600, height: 1200,
    stops: [[0, '#C9CFA6'], [0.5, '#E4D9A6'], [1, '#A9B48C']],
    glows: [{ x: 0.7, y: 0.3, r: 0.4, color: '#F5EBC4', opacity: 0.8 }],
  },
  {
    // Late afternoon (#8): soft colour under the inbox card on the left, warm gold toward the post box on the right.
    file: 'art/step-4-replies.png', width: 1536, height: 1152,
    stops: [[0, '#F3DCC6'], [0.45, '#F6DCC8'], [0.7, '#D9CFA0'], [1, '#A9A46A']],
    glows: [{ x: 0.2, y: 0.3, r: 0.4, color: '#DCE7F2', opacity: 0.6 }, { x: 0.82, y: 0.6, r: 0.3, color: '#F2B866', opacity: 0.5 }],
  },
  {
    // Optional (#9): transparent, so the code mesh under it stays the dark card's art until a painting exists.
    file: 'art/dark-card-night.png', width: 2048, height: 1152, transparent: true,
  },
  {
    // Dusk (#10): the upper 55 percent is plain sky for the closing line and button; warm light low in the centre.
    file: 'art/closing-dusk-door.png', width: 3072, height: 1024,
    stops: [[0, '#AAB6F2'], [0.4, '#D8C8E8'], [0.55, '#F4C4A8'], [0.64, '#F2B866'], [0.78, '#B89DA2'], [1, '#A9A46A']],
    glows: [{ x: 0.5, y: 0.82, r: 0.14, color: '#F5D9A0', opacity: 0.8 }],
  },
  {
    file: 'art/footer-dusk-hills.png', width: 3072, height: 1024,
    stops: [[0, '#F7E6E4'], [0.2, '#F7E6E4'], [0.45, '#9AA3E6'], [0.6, '#E9A0A8'], [0.8, '#A9A46A'], [1, '#8E9358']],
    glows: [{ x: 0, y: 1, r: 0.35, color: '#E07F5E', opacity: 0.8 }, { x: 1, y: 1, r: 0.35, color: '#E07F5E', opacity: 0.8 }],
  },
  {
    file: 'og-kairos.png', width: 1200, height: 630, limit: 120 * 1024,
    ...dawn,
    glows: [...dawn.glows, { x: 0, y: 0, r: 0.7, color: '#F7F7F5', opacity: 0.95 }],
  },
];

// Smooth gradients only: a vertical base and soft radial glows. No shapes, text or detail.
function artSvg({ width, height, stops, glows = [] }) {
  const bg = stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
  const defs = glows
    .map((g, i) => `<radialGradient id="g${i}" cx="${g.x}" cy="${g.y}" r="${g.r}"><stop offset="0" stop-color="${g.color}" stop-opacity="${g.opacity ?? 0.8}"/><stop offset="1" stop-color="${g.color}" stop-opacity="0"/></radialGradient>`)
    .join('');
  const layers = glows.map((_, i) => `<rect width="${width}" height="${height}" fill="url(#g${i})"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">${bg}</linearGradient>${defs}</defs><rect width="${width}" height="${height}" fill="url(#bg)"/>${layers}</svg>`;
}

// Keeps the OG image under 120 KB by reducing the palette step by step.
async function pngUnder(buffer, limit) {
  let out;
  for (const colours of [undefined, 256, 128, 64]) {
    out = await sharp(buffer).png(colours ? { palette: true, colours, compressionLevel: 9, effort: 10 } : { compressionLevel: 9, effort: 10 }).toBuffer();
    if (out.length <= limit) return out;
  }
  console.warn(`og-kairos.png is ${(out.length / 1024).toFixed(0)} KB, above 120 KB even at 64 colours`);
  return out;
}

const isNewer = (target, source) => statSync(source).mtimeMs > statSync(target).mtimeMs;
const needsBuild = (target, ...sources) => !existsSync(target) || sources.some((s) => existsSync(s) && isNewer(target, s));

async function makePlaceholders() {
  for (const p of PLACEHOLDERS) {
    const out = LANDING + p.file;
    if (existsSync(out)) {
      console.log(`keep   ${p.file}`);
      continue;
    }
    const png = p.transparent
      ? await sharp({ create: { width: p.width, height: p.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()
      : await sharp(Buffer.from(artSvg(p)), { density: 72 }).png({ compressionLevel: 9 }).toBuffer();
    writeFileSync(out, p.limit ? await pngUnder(png, p.limit) : png);
    console.log(`made   ${p.file} ${p.width}x${p.height}`);
  }
}

async function deriveCrops() {
  const sceneA = `${ART}scene-a-dawn-valley.png`;
  const portrait = `${ART}scene-a-dawn-valley-portrait.png`;
  if (existsSync(sceneA) && needsBuild(portrait, sceneA)) {
    // 4:5 portrait: full height, centred, resized to 1088 x 1360.
    const { width, height } = await sharp(sceneA).metadata();
    const cropW = Math.round(height * 0.8);
    await sharp(sceneA)
      .extract({ left: Math.round((width - cropW) / 2), top: 0, width: cropW, height })
      .resize(1088, 1360)
      .png({ compressionLevel: 9 })
      .toFile(portrait);
    console.log('built  scene-a-dawn-valley-portrait.png (4:5 crop of Scene A)');
  }

  const footer = `${ART}footer-dusk-hills.png`;
  const footerCrop = `${ART}footer-dusk-hills-2880x840.png`;
  if (existsSync(footer) && needsBuild(footerCrop, footer)) {
    // Keeps the bottom of the hills; the pale top band is what gets cut.
    await sharp(footer)
      .resize(2880, 840, { fit: 'cover', position: 'bottom' })
      .png({ compressionLevel: 9 })
      .toFile(footerCrop);
    console.log('built  footer-dusk-hills-2880x840.png');
  }

  const og = `${LANDING}og-kairos.png`;
  if (existsSync(og)) {
    const { width, height } = await sharp(og).metadata();
    if (width === 1200 && height === 630) {
      console.log('keep   og-kairos.png already 1200 x 630');
    } else {
      // Keep the full-size original next to the output, then resize it in place.
      copyFileSync(og, `${ART}og-kairos-source.png`);
      const resized = await sharp(og).resize(1200, 630, { fit: 'cover' }).png().toBuffer();
      writeFileSync(og, await pngUnder(resized, 120 * 1024));
      console.log(`built  og-kairos.png resized from ${width} x ${height}`);
    }
  }
}

mkdirSync(ART, { recursive: true });
if (placeholders) await makePlaceholders();
await deriveCrops();
