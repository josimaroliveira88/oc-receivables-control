import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { listSaleOptions } from '../services/salesApi';
import { formatSaleOptionLabel } from '../utils/saleOption';

const GAP = 4;
const MAX_HEIGHT = 240;
const MIN_HEIGHT = 120;
const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;
const LIMIT = 20;

// Server-backed autocomplete for picking a sale (VENDA). The search is
// debounced and only fires from two characters on, so it never loads the whole
// catalogue. The list is portaled so it is never clipped inside a modal, and
// its placement mirrors ProductCombobox (flips above when there is no room
// below). `onChange` receives the selected option object, or null on clear.
const OrderAutocomplete = ({
  value = null,
  selectedLabel = '',
  onChange,
  placeholder = 'Buscar venda...',
  disabled = false,
  testId = 'order-autocomplete',
  inputId,
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(null);
  const anchorRef = useRef(null);

  const hasSelection = Boolean(value);

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

  useEffect(() => {
    if (!open) return undefined;
    const term = query.trim();
    if (term.length < MIN_QUERY) {
      setOptions([]);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const { data } = await listSaleOptions({ q: term, limit: LIMIT });
        if (active) setOptions(Array.isArray(data) ? data : []);
      } catch (_err) {
        if (active) setOptions([]);
      } finally {
        if (active) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query, open]);

  const close = () => {
    setOpen(false);
    setPosition(null);
  };

  const handleSelect = (option) => {
    onChange(option);
    setQuery('');
    close();
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    close();
  };

  const trimmedQuery = query.trim();
  const displayLabel = query || selectedLabel || '';

  return (
    <div className="relative">
      <div className="relative" ref={anchorRef}>
        <input
          type="text"
          id={inputId}
          value={displayLabel}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          aria-label="Venda vinculada"
          disabled={disabled}
          data-testid={`${testId}-input`}
          className="w-full px-2 py-1.5 pr-7 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors text-sm disabled:opacity-50"
        />
        {hasSelection && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Limpar venda"
            data-testid={`${testId}-clear`}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-ink-faint hover:text-danger-fg rounded"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {open &&
        position &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={close} />
            <ul
              data-testid={`${testId}-list`}
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
              {loading && (
                <li className="px-3 py-2 text-sm text-ink-faint">
                  Buscando...
                </li>
              )}
              {!loading && trimmedQuery.length < MIN_QUERY && (
                <li className="px-3 py-2 text-sm text-ink-faint">
                  Digite ao menos {MIN_QUERY} caracteres
                </li>
              )}
              {!loading &&
                trimmedQuery.length >= MIN_QUERY &&
                options.length === 0 && (
                  <li className="px-3 py-2 text-sm text-ink-faint">
                    Nenhuma venda encontrada
                  </li>
                )}
              {!loading &&
                options.map((option) => (
                  <li
                    key={option.id}
                    onMouseDown={() => handleSelect(option)}
                    data-testid={`${testId}-option-${option.id}`}
                    className="cursor-pointer px-3 py-2 text-sm text-ink hover:bg-accent-soft transition-colors"
                  >
                    {formatSaleOptionLabel(option)}
                  </li>
                ))}
            </ul>
          </>,
          document.body,
        )}
    </div>
  );
};

export default OrderAutocomplete;
