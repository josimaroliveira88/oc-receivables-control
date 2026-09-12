import React from 'react';
import { Search } from 'lucide-react';

const SearchInput = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
}) => (
  <div className={`relative flex-1 ${className || ''}`}>
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full pl-9 pr-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  </div>
);

export default SearchInput;
