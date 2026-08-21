import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown } from 'lucide-react';
import { PRODUCT_STATUS } from '../utils/productHelpers';

const STATUS_OPTIONS = ['ATIVO', 'INDISPONIVEL', 'INATIVO'];

const StatusBadgeDropdown = ({ product, onStatusChange }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const status = product.status || 'INATIVO';
  const cfg = PRODUCT_STATUS[status] || PRODUCT_STATUS.INATIVO;

  useEffect(() => {
    if (!open) return undefined;

    const handleDocumentMouseDown = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
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

  const handleSelect = (event, newStatus) => {
    event.stopPropagation();
    setOpen(false);
    if (newStatus !== status) {
      onStatusChange(product, newStatus);
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={handleTriggerClick}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Alterar status do produto ${product.name}`}
        data-testid={`product-status-${status}`}
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className} hover:ring-2 hover:ring-primary-500/40 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer transition-all`}
      >
        {status === 'INDISPONIVEL' && <AlertCircle className="w-3.5 h-3.5" />}
        {cfg.label}
        <ChevronDown className="w-3.5 h-3.5 opacity-60" aria-hidden="true" />
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
            data-testid={`product-status-${product.id}-backdrop`}
          />
          <div
            role="menu"
            aria-orientation="vertical"
            data-testid={`product-status-menu-${product.id}`}
            className="absolute left-1/2 -translate-x-1/2 mt-2 z-[80] w-44 origin-top bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 focus:outline-none"
          >
            {STATUS_OPTIONS.map((option) => {
              const optionCfg =
                PRODUCT_STATUS[option] || PRODUCT_STATUS.INATIVO;
              const isCurrent = option === status;
              return (
                <button
                  key={option}
                  type="button"
                  role="menuitem"
                  onClick={(e) => handleSelect(e, option)}
                  data-testid={`product-status-${product.id}-option-${option}`}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none transition-colors"
                >
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${optionCfg.className}`}
                  >
                    {option === 'INDISPONIVEL' && (
                      <AlertCircle className="w-3 h-3" />
                    )}
                    {optionCfg.label}
                  </span>
                  {isCurrent && (
                    <Check
                      className="w-3.5 h-3.5 ml-auto text-primary-600 dark:text-primary-400"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default StatusBadgeDropdown;
