import React from 'react';
import { AlertCircle } from 'lucide-react';
import { PRODUCT_STATUS } from '../utils/productHelpers';

const StatusBadge = ({ status }) => {
  const cfg = PRODUCT_STATUS[status] || PRODUCT_STATUS.INATIVO;
  return (
    <span
      data-testid={`product-status-${status || 'INATIVO'}`}
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}
    >
      {status === 'INDISPONIVEL' && <AlertCircle className="w-3.5 h-3.5" />}
      {cfg.label}
    </span>
  );
};

export default StatusBadge;
