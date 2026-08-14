import React from 'react';
import { paymentTypeLabel } from '../utils/orderHelpers';

export const StatusBadge = ({ status }) => {
  const config = {
    PENDENTE: {
      label: 'Pendente',
      dot: 'bg-amber-500',
      className:
        'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    },
    PARCIAL: {
      label: 'Parcial',
      dot: 'bg-blue-500',
      className:
        'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    },
    QUITADO: {
      label: 'Quitado',
      dot: 'bg-emerald-500',
      className:
        'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    },
  };
  const cfg = config[status] || {
    label: status,
    dot: 'bg-gray-500',
    className: 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full ${cfg.className}`}
    >
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

export const PaymentTypeBadge = ({ type }) => {
  if (!type) return <span className="text-gray-400 dark:text-gray-500">—</span>;
  const config = {
    PIX: {
      className:
        'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    },
    BOLETO: {
      className:
        'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    },
    CARTAO_CREDITO: {
      className:
        'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    },
  };
  const cfg = config[type] || {
    className: 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${cfg.className}`}
    >
      {paymentTypeLabel(type)}
    </span>
  );
};
