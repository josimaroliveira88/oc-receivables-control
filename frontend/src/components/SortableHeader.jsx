import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

const SortableHeader = ({
  label,
  field,
  sortBy,
  sortDir,
  onSort,
  width,
  align = 'left',
  testIdPrefix,
}) => {
  const isActive = sortBy === field;
  const nextDir = isActive && sortDir === 'asc' ? 'desc' : 'asc';
  const Icon = isActive
    ? sortDir === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;
  const alignClass = align === 'right' ? 'text-right' : 'text-left';
  const ariaSort = isActive
    ? sortDir === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none';

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`${width || ''} px-6 py-3 ${alignClass} text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider`}
    >
      <button
        type="button"
        onClick={() => onSort(field, nextDir)}
        data-testid={testIdPrefix ? `${testIdPrefix}-sort-${field}` : undefined}
        className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''} group hover:text-primary-600 dark:hover:text-primary-400 transition-colors`}
      >
        {label}
        <Icon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
      </button>
    </th>
  );
};

export default SortableHeader;
