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
            className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
          />
          {open && (
            <>
              <div
                className="fixed inset-0 z-[60]"
                onClick={() => setOpen(false)}
              />
              <ul className="absolute z-[70] mt-1 max-h-60 w-full overflow-auto bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
                {filtered.length === 0 && (
                  <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                    Nenhum produto encontrado
                  </li>
                )}
                {filtered.map((p) => (
                  <li
                    key={p.id}
                    onMouseDown={() => handleSelect(p.id)}
                    className="cursor-pointer px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-primary-50 dark:hover:bg-primary-900/40 transition-colors"
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
            className="px-3 py-2 text-xs font-medium text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md transition-colors whitespace-nowrap"
          >
            Limpar produto
          </button>
        )}
      </div>
    </div>
  );
};

export default ProductCombobox;
