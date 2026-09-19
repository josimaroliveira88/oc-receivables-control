#!/usr/bin/env node
// Validates WCAG AA contrast for the design-token pairs defined in
// src/index.css. Run with: node scripts/contrast-check.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../src/index.css'), 'utf8');

const parseBlock = (selector) => {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`Missing ${selector} block`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);
  const vars = {};
  for (const line of body.split('\n')) {
    const match = line.match(/(--[\w-]+)\s*:\s*([^;]+);/);
    if (match) vars[match[1]] = match[2].trim();
  }
  return vars;
};

const light = parseBlock(':root');
const dark = parseBlock('.dark');

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};

const parseColor = (value) => {
  const v = value.trim();
  if (v.startsWith('#')) return [...hexToRgb(v), 1];
  const rgba = v.match(/rgba?\(([^)]+)\)/);
  if (rgba) {
    const parts = rgba[1].split(',').map((p) => parseFloat(p.trim()));
    return [parts[0], parts[1], parts[2], parts[3] ?? 1];
  }
  throw new Error(`Unsupported color: ${value}`);
};

const composite = (fg, bg) => {
  const a = fg[3];
  return [0, 1, 2].map((i) => Math.round(a * fg[i] + (1 - a) * bg[i]));
};

const luminance = ([r, g, b]) => {
  const lin = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
};

const ratio = (fg, bg) => {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

const resolveBg = (mode, varName) => {
  const vars = mode === 'dark' ? dark : light;
  const value = parseColor(vars[varName]);
  if (value[3] < 1) {
    return composite(value, parseColor(vars['--bg-surface']));
  }
  return value;
};

const TEXT_PAIRS = [
  ['--text-primary', '--bg-surface'],
  ['--text-primary', '--bg'],
  ['--text-secondary', '--bg-surface'],
  ['--accent', '--bg-surface'],
  ['--accent-on-soft', '--accent-soft'],
  ['--accent-text-on', '--accent'],
  ['--accent-text-on', '--accent-hover'],
  ['--badge-boleto-fg', '--badge-boleto-bg'],
  ['--badge-dinheiro-fg', '--badge-dinheiro-bg'],
  ['--badge-infinitepay-fg', '--badge-infinitepay-bg'],
  ['--badge-pix-fg', '--badge-pix-bg'],
  ['--success-fg', '--success-bg'],
  ['--warning-fg', '--warning-bg'],
  ['--info-fg', '--info-bg'],
  ['--mystic-fg', '--mystic-bg'],
  ['--danger-fg', '--danger-bg'],
];

const THRESHOLD = 4.5;
let failures = 0;

for (const mode of ['light', 'dark']) {
  const vars = mode === 'dark' ? dark : light;
  console.log(`\n${mode.toUpperCase()}`);
  for (const [fgVar, bgVar] of TEXT_PAIRS) {
    const fg = parseColor(vars[fgVar]);
    const bg = resolveBg(mode, bgVar);
    const value = ratio(fg, bg);
    const ok = value >= THRESHOLD;
    if (!ok) failures++;
    console.log(
      `  ${ok ? 'PASS' : 'FAIL'}  ${value.toFixed(2).padStart(5)}  ${fgVar} on ${bgVar}`,
    );
  }
}

if (failures > 0) {
  console.error(`\n${failures} pair(s) below WCAG AA (${THRESHOLD}:1).`);
  process.exit(1);
}
console.log('\nAll token pairs meet WCAG AA.');
