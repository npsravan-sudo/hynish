/**
 * Generate PWA icon PNGs from the brand colors (Phase 11).
 * Pure Node.js — no external image dependencies required.
 *
 * Colors match the favicon.svg gradient: blue-indigo on dark navy.
 * Run: node scripts/generate-icons.mjs
 */
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { deflateSync, crc32 } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dir, '../public/icons');

await mkdir(OUT, { recursive: true });

// ---------------------------------------------------------------------------
// Minimal PNG encoder (no external deps, uses built-in zlib)
// ---------------------------------------------------------------------------

function uint32BE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = uint32BE(data.length);
  const crcInput = Buffer.concat([typeBytes, data]);
  // crc32 from node:zlib returns a number with the sign bit potentially set;
  // we need unsigned, so >>> 0 it.
  const crcVal = crc32(crcInput) >>> 0;
  return Buffer.concat([len, typeBytes, data, uint32BE(crcVal)]);
}

function writePNG(filePath, width, height, pixelFn) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw scanlines: filter byte (0x00) + RGB per pixel
  const rowBytes = 1 + width * 3;
  const raw = Buffer.alloc(height * rowBytes);
  for (let y = 0; y < height; y++) {
    raw[y * rowBytes] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelFn(x, y, width, height);
      const offset = y * rowBytes + 1 + x * 3;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
    }
  }

  const idat = deflateSync(raw, { level: 6 });
  const iend = Buffer.alloc(0);

  const png = Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', iend),
  ]);

  createWriteStream(filePath).end(png);
  console.log(`Written: ${filePath} (${width}x${height}, ${png.length} bytes)`);
}

// ---------------------------------------------------------------------------
// Pixel functions
// ---------------------------------------------------------------------------

// Rounded rectangle helper: returns true if point (px,py) is inside the rounded rect
function inRoundedRect(px, py, w, h, r) {
  // distance from nearest corner
  const cx = Math.max(r, Math.min(w - r, px));
  const cy = Math.max(r, Math.min(h - r, py));
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
    || (px >= r && px <= w - r)
    || (py >= r && py <= h - r);
}

// Brand gradient: blue #5B73FA → indigo #7C54FA on navy #172033 background
function brandPixel(px, py, w, h) {
  const inRect = inRoundedRect(px, py, w, h, w * 0.22);
  if (!inRect) return [23, 32, 51]; // #172033 background

  // Linear gradient top-left → bottom-right
  const t = (px / w + py / h) / 2;
  // #5B73FA = [91, 115, 250]
  // #7C54FA = [124, 84, 250]
  const r = Math.round(91 + t * (124 - 91));
  const g = Math.round(115 + t * (84 - 115));
  const b = 250;
  return [r, g, b];
}

// Simple "H" lettermark — draw a 1-bit bitmap of "H" scaled to icon
function withH(px, py, w, h) {
  const [r, g, b] = brandPixel(px, py, w, h);
  if (r === 23 && g === 32 && b === 51) return [r, g, b]; // outside rect, skip

  // Scale "H" to ~55% of icon width, centered
  const scale = w * 0.55;
  const ox = (w - scale) / 2;
  const oy = (h - scale) / 2;
  const lx = (px - ox) / scale; // 0..1
  const ly = (py - oy) / scale; // 0..1

  const inH = ly >= 0 && ly <= 1 && lx >= 0 && lx <= 1 && (
    lx <= 0.24 || lx >= 0.76 ||
    (ly >= 0.40 && ly <= 0.60)
  );

  if (inH) return [255, 255, 255];
  return [r, g, b];
}

// Maskable: fill entire icon (no rounded rect) — safe-zone is inner 80%
function maskablePixel(px, py, w, h) {
  // Solid brand background with H in center safe zone (80%)
  const t = (px / w + py / h) / 2;
  const r = Math.round(91 + t * (124 - 91));
  const g = Math.round(115 + t * (84 - 115));
  const b = 250;

  // H inside 80% safe zone, same logic
  const sa = w * 0.10; // 10% from each edge
  const scale = w * 0.55;
  const ox = (w - scale) / 2;
  const oy = (h - scale) / 2;
  const lx = (px - ox) / scale;
  const ly = (py - oy) / scale;
  const inSafe = px >= sa && px <= w - sa && py >= sa && py <= h - sa;
  const inH = inSafe && ly >= 0 && ly <= 1 && lx >= 0 && lx <= 1 && (
    lx <= 0.24 || lx >= 0.76 || (ly >= 0.40 && ly <= 0.60)
  );
  if (inH) return [255, 255, 255];
  return [r, g, b];
}

// ---------------------------------------------------------------------------
// Write all icon files
// ---------------------------------------------------------------------------

writePNG(path.join(OUT, 'icon-192.png'), 192, 192, withH);
writePNG(path.join(OUT, 'icon-512.png'), 512, 512, withH);
writePNG(path.join(OUT, 'maskable-192.png'), 192, 192, maskablePixel);
writePNG(path.join(OUT, 'maskable-512.png'), 512, 512, maskablePixel);

// Apple touch icon: 180×180, solid square (no transparent corners)
writePNG(path.join(OUT, 'apple-touch-icon.png'), 180, 180, (px, py, w, h) => {
  const t = (px / w + py / h) / 2;
  const r = Math.round(91 + t * (124 - 91));
  const g = Math.round(115 + t * (84 - 115));
  const b = 250;
  const scale = w * 0.55;
  const ox = (w - scale) / 2;
  const oy = (h - scale) / 2;
  const lx = (px - ox) / scale;
  const ly = (py - oy) / scale;
  const inH = ly >= 0 && ly <= 1 && lx >= 0 && lx <= 1 && (
    lx <= 0.24 || lx >= 0.76 || (ly >= 0.40 && ly <= 0.60)
  );
  if (inH) return [255, 255, 255];
  return [r, g, b];
});

console.log('Icons generated in public/icons/');
