import React from 'react';
import { paymentTypeLabel } from '../utils/orderHelpers';
import {
  ORDER_STATUS_CLASSES,
  ORDER_STATUS_FALLBACK,
  ORDER_ORIGIN_CLASSES,
  PAYMENT_TYPE_CLASSES,
  PAYMENT_TYPE_FALLBACK,
} from '../../../utils/badgeStyles';

const STATUS_LABELS = {
  PENDENTE: 'Pendente',
  PARCIAL: 'Parcial',
  QUITADO: 'Quitado',
  EQUIPE: 'Equipe',
};

export const StatusBadge = ({ status }) => {
  const cfg = ORDER_STATUS_CLASSES[status] || ORDER_STATUS_FALLBACK;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full ${cfg.className}`}
    >
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {STATUS_LABELS[status] || status}
    </span>
  );
};

export const PaymentTypeBadge = ({ type, testId }) => {
  if (!type) return <span className="text-ink-faint">—</span>;
  const className = PAYMENT_TYPE_CLASSES[type] || PAYMENT_TYPE_FALLBACK;
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${className}`}
    >
      {paymentTypeLabel(type)}
    </span>
  );
};

export const OrderOriginBadge = ({ isTeamOrder }) => {
  const isTeam = Boolean(isTeamOrder);
  return (
    <span
      data-testid="order-origin-badge"
      className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
        isTeam ? ORDER_ORIGIN_CLASSES.team : ORDER_ORIGIN_CLASSES.user
      }`}
    >
      {isTeam ? 'Equipe' : 'Usuário'}
    </span>
  );
};
