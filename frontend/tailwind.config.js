import flowbitePlugin from 'flowbite/plugin.js';

const cssVar = (name) => `var(${name})`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/flowbite/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        base: cssVar('--bg'),
        surface: cssVar('--bg-surface'),
        elevated: cssVar('--bg-elevated'),
        line: cssVar('--border'),
        ink: {
          DEFAULT: cssVar('--text-primary'),
          soft: cssVar('--text-secondary'),
          faint: cssVar('--text-tertiary'),
        },
        accent: {
          DEFAULT: cssVar('--accent'),
          hover: cssVar('--accent-hover'),
          soft: cssVar('--accent-soft'),
          on: cssVar('--accent-text-on'),
          'on-soft': cssVar('--accent-on-soft'),
        },
        success: {
          soft: cssVar('--success-bg'),
          fg: cssVar('--success-fg'),
        },
        warning: {
          soft: cssVar('--warning-bg'),
          fg: cssVar('--warning-fg'),
        },
        info: {
          soft: cssVar('--info-bg'),
          fg: cssVar('--info-fg'),
        },
        danger: {
          soft: cssVar('--danger-bg'),
          fg: cssVar('--danger-fg'),
        },
        mystic: {
          soft: cssVar('--mystic-bg'),
          fg: cssVar('--mystic-fg'),
        },
        badge: {
          boleto: {
            bg: cssVar('--badge-boleto-bg'),
            fg: cssVar('--badge-boleto-fg'),
          },
          infinitepay: {
            bg: cssVar('--badge-infinitepay-bg'),
            fg: cssVar('--badge-infinitepay-fg'),
          },
          pix: {
            bg: cssVar('--badge-pix-bg'),
            fg: cssVar('--badge-pix-fg'),
          },
        },
      },
    },
  },
  plugins: [flowbitePlugin],
};
