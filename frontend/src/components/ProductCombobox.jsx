import React, { useState } from 'react';
import { formatBRL } from '../utils/money';

const defaultSubtitle = (p) => formatBRL(parseFloat(p.memberPrice) || 0);

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

  const handleSelect = (id) => {
    onChange(id);
    setQuery('');
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setQuery('');
    setOpen(false);
  };

  const handleType = (e) => {
    setQuery(e.target.value);
    setOpen(true);
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={displayLabel}
            onChange={handleType}
            onFocus={() => setOpen(true)}
            placeholder="Busque um produto..."
            aria-label="Produto"
            className="w-full px-3 py-2 pr-8 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors text-sm"
          />
          {open && (
            <>
              <div
                className="fixed inset-0 z-[60]"
                onClick={() => setOpen(false)}
              />
              <ul className="absolute z-[70] mt-1 max-h-60 w-full overflow-auto bg-surface border border-line rounded-md shadow-lg">
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
            </>
          )}
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
    </div>
  );
};

export default ProductCombobox;
