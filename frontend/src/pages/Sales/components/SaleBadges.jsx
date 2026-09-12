import React from 'react';
import { formatDateBR } from '../../../utils/dates';
import { DELIVERY_CLASSES } from '../../../utils/badgeStyles';
import { StatusBadge, PaymentTypeBadge } from '../../Orders/components/Badges';

export const DeliveryBadge = ({ deliveredAt }) => {
  const cfg = deliveredAt
    ? DELIVERY_CLASSES.delivered
    : DELIVERY_CLASSES.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full ${cfg.className}`}
    >
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {deliveredAt ? 'Entregue' : 'Pendente de entrega'}
      {deliveredAt && (
        <span className="font-normal">{formatDateBR(deliveredAt)}</span>
      )}
    </span>
  );
};

export { StatusBadge, PaymentTypeBadge };
