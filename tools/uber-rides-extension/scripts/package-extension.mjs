/**
 * Packages the unpacked Chrome extension into a ZIP that the app serves at
 * `/uber-rides-extension.zip` (copied verbatim from `frontend/public/` during
 * the frontend build).
 *
 * The browser cannot read local paths, and the backend may run in a container
 * that does not see the host filesystem, so the app ships the ZIP for the user
 * to download, extract and point chrome://extensions at. Run:
 *
 *   node tools/uber-rides-extension/scripts/package-extension.mjs
 */
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = join(ROOT, '..', '..');
const OUTPUT_DIR = join(REPO_ROOT, 'frontend', 'public');
const OUTPUT_FILE = join(OUTPUT_DIR, 'uber-rides-extension.zip');

const INCLUDED = ['manifest.json', 'README.md', 'icons', 'src'];

// --- CRC-32 (ZIP requires the standard polynomial) --------------------------

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

// --- ZIP writer (deflate + UTF-8 names) -------------------------------------

const dosDateTime = (date) => ({
  time:
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    (date.getSeconds() >> 1),
  day:
    ((date.getFullYear() - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate(),
});

const buildZip = (files) => {
  const localParts = [];
  const centralParts = [];
  const { time, day } = dosDateTime(new Date());
  let offset = 0;

  for (const file of files) {
    const raw = readFileSync(file.absolute);
    const data = deflateRawSync(raw, { level: 9 });
    const name = Buffer.from(file.relative, 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc32(raw), 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, central, end]);
};

// --- Main -------------------------------------------------------------------

const collectFiles = (entry, files) => {
  const absolute = join(ROOT, entry);
  const stats = statSync(absolute);
  if (stats.isDirectory()) {
    for (const child of readdirSync(absolute)) {
      collectFiles(join(entry, child), files);
    }
    return;
  }
  files.push({
    absolute,
    relative: relative(ROOT, absolute).split('\\').join('/'),
  });
};

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

const files = [];
for (const entry of INCLUDED) {
  if (existsSync(join(ROOT, entry))) collectFiles(entry, files);
}

const zip = buildZip(files);
const stream = createWriteStream(OUTPUT_FILE);
stream.end(zip);
stream.on('finish', () => {
  console.log(
    `wrote ${OUTPUT_FILE} (${zip.length} bytes, ${files.length} files)`,
  );
});
