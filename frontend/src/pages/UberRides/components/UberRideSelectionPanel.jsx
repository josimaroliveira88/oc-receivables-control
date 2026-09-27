import React from 'react';
import { fromCents, formatBRL } from '../../../utils/money';
import { formatRideDateTime } from '../utils/uberRideHelpers';

const fieldClass =
  'w-full px-2 py-1.5 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors text-sm';

const UberRideSelectionPanel = ({
  rides,
  selections,
  categories,
  totalCents,
  launching,
  onFieldChange,
  onLaunch,
  onClear,
}) => {
  if (rides.length === 0) return null;

  return (
    <div className="mt-6 border border-line rounded-lg bg-surface">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">
          {rides.length} corrida(s) selecionada(s) —{' '}
          {formatBRL(fromCents(totalCents))}
        </h3>
        <div className="mt-2 sm:mt-0 flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            disabled={launching}
            className="px-3 py-1.5 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors disabled:opacity-50"
          >
            Limpar seleção
          </button>
          <button
            type="button"
            onClick={onLaunch}
            disabled={launching}
            data-testid="uber-ride-launch"
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50"
          >
            {launching ? 'Lançando...' : 'Lançar despesas'}
          </button>
        </div>
      </div>

      <ul className="divide-y divide-line">
        {rides.map((ride) => (
          <li
            key={ride.id}
            data-testid={`uber-ride-selected-${ride.id}`}
            className="px-4 py-3 grid grid-cols-1 lg:grid-cols-12 gap-3 items-end"
          >
            <div className="lg:col-span-5">
              <p className="text-sm font-medium text-ink">
                {ride.destination ?? 'Corrida'}
              </p>
              <p className="text-xs text-ink-faint">
                {formatRideDateTime(ride.requestedAt)}
                {ride.riderName ? ` • ${ride.riderName}` : ''} •{' '}
                {formatBRL(fromCents(ride.amountCents))}
              </p>
            </div>
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
                value={selections[ride.id]?.categoryId ?? ''}
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
            <div className="lg:col-span-4">
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
                value={selections[ride.id]?.description ?? ''}
                onChange={(event) =>
                  onFieldChange(ride.id, { description: event.target.value })
                }
                className={fieldClass}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UberRideSelectionPanel;
