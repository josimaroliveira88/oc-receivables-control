import React, { useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';

const ActionMenu = ({ actions, ariaLabel = 'Ações', testIdPrefix = 'action-menu' }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleDocumentMouseDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleTriggerClick = (event) => {
    event.stopPropagation();
    setOpen((prev) => !prev);
  };

  const handleItemClick = (event, action) => {
    event.stopPropagation();
    setOpen(false);
    action.onClick(event);
  };

  const slugify = (label) =>
    label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  return (
    <div ref={containerRef} className="relative inline-block text-left">
        <button
          type="button"
          onClick={handleTriggerClick}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={ariaLabel}
          data-testid={`${testIdPrefix}-trigger`}
          className="inline-flex items-center justify-center p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
        >
          <MoreVertical className="w-5 h-5" aria-hidden="true" />
        </button>
        {open && (
          <>
            <div
              className="fixed inset-0 z-[70]"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              aria-hidden="true"
              data-testid={`${testIdPrefix}-backdrop`}
            />
            <div
              role="menu"
              aria-orientation="vertical"
              data-testid={`${testIdPrefix}-menu`}
              className="absolute right-0 mt-2 z-[80] w-44 origin-top-right bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 rounded-lg shadow-lg py-1 focus:outline-none"
            >
              {actions.map((action) => {
                const Icon = action.icon;
                const isDanger = action.variant === 'danger';
                const itemClasses = isDanger
                  ? 'flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300 focus:bg-red-50 dark:focus:bg-red-900/20 focus:outline-none transition-colors'
                  : 'flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none transition-colors';

                return (
                  <button
                    key={action.label}
                    type="button"
                    role="menuitem"
                    onClick={(e) => handleItemClick(e, action)}
                    data-testid={`${testIdPrefix}-item-${slugify(action.label)}`}
                    className={itemClasses}
                  >
                    {Icon ? <Icon className="w-4 h-4" aria-hidden="true" /> : null}
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
  );
};

export default ActionMenu;