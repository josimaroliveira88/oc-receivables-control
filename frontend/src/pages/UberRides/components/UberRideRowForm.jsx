import React from 'react';
import OrderAutocomplete from '../../../components/OrderAutocomplete';
import { formatSaleOptionLabel } from '../../../utils/saleOption';
import { formatDateBR } from '../../../utils/dates';
import {
  formatRideDate,
  formatRideMatchLabel,
  matchDateValue,
  matchOriginLabel,
  rideDateValue,
} from '../utils/uberRideHelpers';

const fieldClass =
  'w-full px-2 py-1.5 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors text-sm';

// Inline per-row form: the user picks a ledger row to reconcile (when the ride
// value matches an existing one), adjusts the description/sale and effectivates
// the entry right there — no batch selection panel.
const UberRideRowForm = ({
  ride,
  selection,
  categories,
  launching,
  onFieldChange,
  onSelectMatch,
  onLaunch,
  onReconcile,
  onToggle,
}) => {
  if (!selection) return null;

  const matches = ride.matches ?? [];
  const selectedMatch =
    matches.find(
      (match) => match.transactionId === selection.matchTransactionId,
    ) ?? null;
  const reconciling = Boolean(selection.matchTransactionId);
  const matchHasSale = Boolean(selectedMatch?.orderId);

  return (
    <div
      data-testid={`uber-ride-form-${ride.id}`}
      className="space-y-3 rounded-lg border border-line bg-base px-3 py-3 lg:px-4"
    >
      {matches.length > 0 && (
        <fieldset className="rounded-md border border-line bg-surface px-3 py-2">
          <legend className="px-1 text-xs font-semibold text-ink-soft">
            Possíveis lançamentos existentes (mesmo valor)
          </legend>
          <div className="mt-1 space-y-1.5">
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="radio"
                name={`uber-ride-match-${ride.id}`}
                data-testid={`uber-ride-match-none-${ride.id}`}
                checked={!reconciling}
                onChange={() => onSelectMatch(ride, null)}
                className="mt-0.5 h-4 w-4 border-line text-accent focus:ring-accent"
              />
              <span>Nenhum — lançar nova despesa</span>
            </label>
            {matches.map((match) => (
              <label
                key={match.transactionId}
                className="flex items-start gap-2 text-sm text-ink"
              >
                <input
                  type="radio"
                  name={`uber-ride-match-${ride.id}`}
                  data-testid={`uber-ride-match-option-${match.transactionId}`}
                  checked={selection.matchTransactionId === match.transactionId}
                  onChange={() => onSelectMatch(ride, match)}
                  className="mt-0.5 h-4 w-4 border-line text-accent focus:ring-accent"
                />
                <span>
                  <span className="font-medium">
                    {formatRideMatchLabel(match)}
                  </span>
                  <span className="ml-1 text-xs text-ink-faint">
                    ({matchOriginLabel(match.origin)})
                  </span>
                  {match.orderNumber && (
                    <span className="block text-xs text-ink-faint">
                      {match.orderNumber}
                      {match.clientName ? ` — ${match.clientName}` : ''}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {!reconciling && (
          <div className="lg:col-span-3">
            <label
              htmlFor={`uber-ride-category-${ride.id}`}
              className="block text-xs font-medium text-ink-faint mb-1"
            >
              Categoria
            </label>
            <select
              id={`uber-ride-category-${ride.id}`}
              data-testid={`uber-ride-category-${ride.id}`}
              value={selection.categoryId ?? ''}
              onChange={(event) =>
                onFieldChange(ride.id, { categoryId: event.target.value })
              }
              className={fieldClass}
            >
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={reconciling ? 'lg:col-span-12' : 'lg:col-span-9'}>
          <label
            htmlFor={`uber-ride-description-${ride.id}`}
            className="block text-xs font-medium text-ink-faint mb-1"
          >
            Descrição
          </label>
          <input
            id={`uber-ride-description-${ride.id}`}
            data-testid={`uber-ride-description-${ride.id}`}
            type="text"
            value={selection.description ?? ''}
            onChange={(event) =>
              onFieldChange(ride.id, { description: event.target.value })
            }
            className={fieldClass}
          />
        </div>

        {reconciling && matchHasSale ? (
          <div className="lg:col-span-12">
            <p className="text-xs font-medium text-ink-faint mb-1">
              Venda associada ao lançamento
            </p>
            <p
              data-testid={`uber-ride-match-sale-${ride.id}`}
              className="text-sm text-ink"
            >
              {selection.orderLabel || selectedMatch.orderNumber}
            </p>
          </div>
        ) : (
          <div className="lg:col-span-6">
            <label
              htmlFor={`uber-ride-order-${ride.id}-input`}
              className="block text-xs font-medium text-ink-faint mb-1"
            >
              {reconciling ? 'Associar venda (opcional)' : 'Venda (opcional)'}
            </label>
            <OrderAutocomplete
              value={selection.orderId ?? null}
              selectedLabel={selection.orderLabel ?? ''}
              testId={`uber-ride-order-${ride.id}`}
              inputId={`uber-ride-order-${ride.id}-input`}
              onChange={(option) =>
                onFieldChange(ride.id, {
                  orderId: option?.id ?? null,
                  orderLabel: option ? formatSaleOptionLabel(option) : '',
                })
              }
            />
          </div>
        )}

        {reconciling && (
          <div className="lg:col-span-12">
            <label
              htmlFor={`uber-ride-date-${ride.id}`}
              className="block text-xs font-medium text-ink-faint mb-1"
            >
              Data do lançamento
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id={`uber-ride-date-${ride.id}`}
                data-testid={`uber-ride-date-${ride.id}`}
                type="date"
                value={selection.transactionDate ?? ''}
                onChange={(event) =>
                  onFieldChange(ride.id, {
                    transactionDate: event.target.value,
                  })
                }
                className={`${fieldClass} sm:w-auto`}
              />
              <button
                type="button"
                onClick={() =>
                  onFieldChange(ride.id, {
                    transactionDate: rideDateValue(ride),
                  })
                }
                data-testid={`uber-ride-use-ride-date-${ride.id}`}
                className="px-3 py-1.5 text-sm font-medium text-accent-on-soft bg-accent-soft hover:bg-accent hover:text-accent-on rounded-md transition-colors"
              >
                Usar a data da corrida ({formatRideDate(ride)})
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              Data do lançamento existente:{' '}
              {formatDateBR(matchDateValue(selectedMatch))} · Data da corrida:{' '}
              {formatRideDate(ride)}
            </p>
          </div>
        )}

        {!reconciling && (
          <div className="lg:col-span-6">
            <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                data-testid={`uber-ride-card-payment-${ride.id}`}
                checked={selection.card}
                onChange={(event) =>
                  onFieldChange(ride.id, { card: event.target.checked })
                }
                className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
              />
              Pago no cartão de crédito
            </label>
            {selection.card && (
              <div className="mt-2">
                <label
                  htmlFor={`uber-ride-invoice-${ride.id}`}
                  className="block text-xs font-medium text-ink-faint mb-1"
                >
                  Data da fatura
                </label>
                <input
                  id={`uber-ride-invoice-${ride.id}`}
                  data-testid={`uber-ride-invoice-${ride.id}`}
                  type="date"
                  value={selection.effectiveDate ?? ''}
                  onChange={(event) =>
                    onFieldChange(ride.id, {
                      effectiveDate: event.target.value,
                    })
                  }
                  className={fieldClass}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {reconciling && (
        <p className="text-xs text-ink-faint">
          A conciliação atualiza a descrição, o vínculo da corrida e a data do
          lançamento existente; valor, categoria e pagamento são mantidos.
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => onToggle(ride)}
          disabled={launching}
          className="px-3 py-1.5 text-sm font-medium text-ink-soft hover:text-ink bg-surface hover:bg-elevated rounded-md transition-colors disabled:opacity-50"
        >
          Fechar
        </button>
        {reconciling ? (
          <button
            type="button"
            onClick={() => onReconcile(ride)}
            disabled={launching}
            data-testid={`uber-ride-reconcile-${ride.id}`}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50"
          >
            {launching ? 'Conciliando...' : 'Conciliar com lançamento'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onLaunch(ride)}
            disabled={launching}
            data-testid={`uber-ride-launch-${ride.id}`}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50"
          >
            {launching ? 'Lançando...' : 'Lançar despesa'}
          </button>
        )}
      </div>
    </div>
  );
};

export default UberRideRowForm;
