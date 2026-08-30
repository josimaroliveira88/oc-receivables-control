import React from 'react';
import { formatDateBR } from '../../../utils/dates';
import { StatusBadge, PaymentTypeBadge } from '../../Orders/components/Badges';

export const DeliveryBadge = ({ deliveredAt }) => {
  if (deliveredAt) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        Entregue
        <span className="font-normal">{formatDateBR(deliveredAt)}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
      <span className="w-2 h-2 rounded-full bg-amber-500" />
      Pendente de entrega
    </span>
  );
};

export { StatusBadge, PaymentTypeBadge };
