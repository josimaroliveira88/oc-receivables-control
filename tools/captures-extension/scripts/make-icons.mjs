/**
 * Generates the extension icons (16/48/128 PNG) without external dependencies.
 *
 * Draws a rounded brand-colored square with a white "U" and encodes the result
 * as a PNG using only Node's built-in `zlib`. Run with:
 *
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SIZES = [16, 48, 128];
const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

const BACKGROUND = { r: 214, g: 51, b: 108 };
const FOREGROUND = { r: 255, g: 255, b: 255 };

// --- PNG encoding -----------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
};

const encodePng = (width, height, rgba) => {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const raw = Buffer.alloc(height * (1 + stride));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + stride);
    raw[rowStart] = 0; // filter type: none
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

// --- Shape sampling ---------------------------------------------------------

const insideRoundedRect = (u, v) => {
  const half = 0.47;
  const radius = 0.22;
  if (Math.abs(u - 0.5) > half || Math.abs(v - 0.5) > half) return false;
  const dx = Math.abs(u - 0.5) - (half - radius);
  const dy = Math.abs(v - 0.5) - (half - radius);
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return ox * ox + oy * oy <= radius * radius;
};

const insideU = (u, v) => {
  const left = u >= 0.26 && u <= 0.39 && v >= 0.26 && v <= 0.74;
  const right = u >= 0.61 && u <= 0.74 && v >= 0.26 && v <= 0.74;
  const bottom = u >= 0.26 && u <= 0.74 && v >= 0.61 && v <= 0.74;
  return left || right || bottom;
};

const sample = (u, v) => {
  if (!insideRoundedRect(u, v)) return { ...BACKGROUND, a: 0 };
  if (insideU(u, v)) return { ...FOREGROUND, a: 1 };
  return { ...BACKGROUND, a: 1 };
};

const renderIcon = (size) => {
  const supersample = 4;
  const samples = supersample * supersample;
  const grid = size * supersample;
  const rgba = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < supersample; sy += 1) {
        for (let sx = 0; sx < supersample; sx += 1) {
          const u = (x * supersample + sx + 0.5) / grid;
          const v = (y * supersample + sy + 0.5) / grid;
          const pixel = sample(u, v);
          r += pixel.r * pixel.a;
          g += pixel.g * pixel.a;
          b += pixel.b * pixel.a;
          a += pixel.a;
        }
      }

      const alpha = a / samples;
      const index = (y * size + x) * 4;
      rgba[index] = a > 0 ? Math.round(r / a) : 0;
      rgba[index + 1] = a > 0 ? Math.round(g / a) : 0;
      rgba[index + 2] = a > 0 ? Math.round(b / a) : 0;
      rgba[index + 3] = Math.round(alpha * 255);
    }
  }

  return rgba;
};

// --- Main -------------------------------------------------------------------

mkdirSync(OUTPUT_DIR, { recursive: true });

for (const size of SIZES) {
  const png = encodePng(size, size, renderIcon(size));
  const target = join(OUTPUT_DIR, `${size}.png`);
  writeFileSync(target, png);
  console.log(`wrote ${target} (${png.length} bytes)`);
}
