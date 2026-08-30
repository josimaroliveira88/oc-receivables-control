import '@testing-library/jest-dom';

// Mock window.matchMedia for jsdom (used by ThemeContext)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Polyfill Element.scrollIntoView for jsdom (not implemented by default)
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

// Polyfill URL.createObjectURL/revokeObjectURL for jsdom (image previews and
// attachment viewing rely on object URLs).
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = vi.fn(() => 'blob:test-object-url');
  URL.revokeObjectURL = vi.fn();
}
