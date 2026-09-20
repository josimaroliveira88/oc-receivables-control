import React from 'react';
import { ENTRY_MODES } from '../useOrderEntryMode';

const OPTIONS = [
  {
    value: ENTRY_MODES.DETAILED,
    label: 'Formulário detalhado',
    testId: 'order-entry-mode-detailed',
  },
  {
    value: ENTRY_MODES.SPREADSHEET,
    label: 'Planilha',
    testId: 'order-entry-mode-spreadsheet',
  },
];

// Lets the user pick how the order items are filled in. Switching is always
// allowed; whether the choice becomes the default is decided by the page.
const OrderEntryModeSelector = ({ value, onChange, isEdit = false }) => (
  <fieldset className="mb-4" data-testid="order-entry-mode">
    <legend className="block text-sm font-medium text-ink-soft mb-1">
      Modo de inclusão
    </legend>
    <div className="flex flex-col sm:flex-row gap-3">
      {OPTIONS.map((option) => (
        <label
          key={option.value}
          className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer select-none"
        >
          <input
            type="radio"
            name="orderEntryMode"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            data-testid={option.testId}
            className="h-4 w-4 border-line text-accent focus:ring-accent"
          />
          {option.label}
        </label>
      ))}
    </div>
    <p className="mt-1 text-xs text-ink-faint">
      {isEdit
        ? 'Trocar o modo pode descartar alterações não salvas nos itens.'
        : 'Escolha como preencher os itens do pedido.'}
    </p>
  </fieldset>
);

export default OrderEntryModeSelector;
