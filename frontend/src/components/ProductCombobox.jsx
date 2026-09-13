import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { formatBRL } from '../utils/money';

const defaultSubtitle = (p) => formatBRL(parseFloat(p.memberPrice) || 0);

const GAP = 4;
const MAX_HEIGHT = 240;
const MIN_HEIGHT = 120;

const ProductCombobox = ({
  products,
  value,
  onChange,
  selectedName,
  selectedCode,
  subtitle = defaultSubtitle,
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const anchorRef = useRef(null);
  const selected = products.find((p) => p.id === value) || null;
  const hasSelection = Boolean(value);

  const displayLabel = selected
    ? `${selected.name} (${selected.code})`
    : value && (selectedName || selectedCode)
      ? `${selectedName || ''}${selectedCode ? ` (${selectedCode})` : ''}`
      : query;

  const filtered = products
    .filter(
      (p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.code.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 100);

  // The dropdown is rendered in a portal so it is never clipped by a modal's
  // overflow. Its coordinates are recomputed from the input on open, scroll
  // and resize, flipping above the input when there is not enough room below.
  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    const openUp = spaceBelow < MIN_HEIGHT && spaceAbove > spaceBelow;
    setPosition({
      left: rect.left,
      width: rect.width,
      top: openUp ? undefined : rect.bottom + GAP,
      bottom: openUp ? window.innerHeight - rect.top + GAP : undefined,
      maxHeight: Math.max(
        MIN_HEIGHT,
        Math.min(MAX_HEIGHT, openUp ? spaceAbove : spaceBelow),
      ),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;
    const handle = () => updatePosition();
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [open, updatePosition]);

  const close = () => {
    setOpen(false);
    setPosition(null);
  };

  const handleSelect = (id) => {
    onChange(id);
    setQuery('');
    close();
  };

  const handleClear = () => {
    onChange('');
    setQuery('');
    close();
  };

  const handleType = (e) => {
    setQuery(e.target.value);
    setOpen(true);
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1" ref={anchorRef}>
          <input
            type="text"
            value={displayLabel}
            onChange={handleType}
            onFocus={() => setOpen(true)}
            placeholder="Busque um produto..."
            aria-label="Produto"
            className="w-full px-3 py-2 pr-8 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors text-sm"
          />
        </div>
        {hasSelection && (
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-2 text-xs font-medium text-danger-fg bg-danger-soft rounded-md transition-colors whitespace-nowrap"
          >
            Limpar produto
          </button>
        )}
      </div>

      {open &&
        position &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={close} />
            <ul
              data-testid="product-combobox-list"
              style={{
                position: 'fixed',
                left: position.left,
                width: position.width,
                top: position.top,
                bottom: position.bottom,
                maxHeight: position.maxHeight,
              }}
              className="z-[70] overflow-auto bg-surface border border-line rounded-md shadow-lg"
            >
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-ink-faint">
                  Nenhum produto encontrado
                </li>
              )}
              {filtered.map((p) => (
                <li
                  key={p.id}
                  onMouseDown={() => handleSelect(p.id)}
                  className="cursor-pointer px-3 py-2 text-sm text-ink hover:bg-accent-soft transition-colors"
                >
                  <span className="font-medium">{p.name}</span> ({p.code}) —{' '}
                  {subtitle(p)}
                </li>
              ))}
            </ul>
          </>,
          document.body,
        )}
    </div>
  );
};

export default ProductCombobox;
