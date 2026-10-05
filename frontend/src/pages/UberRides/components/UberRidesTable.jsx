import React from 'react';
import { Trash2 } from 'lucide-react';
import { fromCents, formatBRL } from '../../../utils/money';
import {
  RIDE_LAUNCHED_CLASSES,
  RIDE_STATUS_CLASSES,
  RIDE_TYPE_CLASSES,
} from '../../../utils/badgeStyles';
import {
  formatRideDateTime,
  isRideSelectable,
  profileTypeLabel,
  rideStatusLabel,
  rideTypeLabel,
} from '../utils/uberRideHelpers';

const cellLabel =
  'before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden';

const UberRidesTable = ({
  rides,
  selections,
  onToggle,
  onRemove,
  removingRideId,
  hasActiveFilters,
}) => {
  if (rides.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-ink-faint">
          {hasActiveFilters
            ? 'Nenhuma corrida encontrada para os filtros aplicados.'
            : 'Nenhuma corrida importada. Use "Importar corridas" para começar.'}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <table className="w-full text-sm text-left block lg:table lg:table-fixed">
        <thead className="hidden lg:table-header-group bg-base">
          <tr>
            <th scope="col" className="w-[6%] px-4 py-3" />
            <th
              scope="col"
              className="w-[15%] px-4 py-3 text-left text-xs font-medium text-ink-faint"
            >
              Data
            </th>
            <th
              scope="col"
              className="w-[11%] px-4 py-3 text-left text-xs font-medium text-ink-faint"
            >
              Tipo
            </th>
            <th
              scope="col"
              className="w-[10%] px-4 py-3 text-left text-xs font-medium text-ink-faint"
            >
              Perfil
            </th>
            <th
              scope="col"
              className="w-[20%] px-4 py-3 text-left text-xs font-medium text-ink-faint"
            >
              Destino
            </th>
            <th
              scope="col"
              className="w-[11%] px-4 py-3 text-left text-xs font-medium text-ink-faint"
            >
              Familiar
            </th>
            <th
              scope="col"
              className="w-[11%] px-4 py-3 text-right text-xs font-medium text-ink-faint"
            >
              Valor
            </th>
            <th
              scope="col"
              className="w-[11%] px-4 py-3 text-left text-xs font-medium text-ink-faint"
            >
              Situação
            </th>
            <th
              scope="col"
              className="w-[5%] px-4 py-3 text-center text-xs font-medium text-ink-faint"
            >
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="block lg:table-row-group bg-surface lg:divide-y divide-line">
          {rides.map((ride) => {
            const selectable = isRideSelectable(ride);
            const selected = Boolean(selections[ride.id]?.selected);

            return (
              <tr
                key={ride.id}
                className="block lg:table-row border border-line lg:border-0 rounded-lg lg:rounded-none shadow-sm lg:shadow-none mb-3 lg:mb-0 hover:bg-accent-soft transition-colors"
              >
                <td
                  data-label="Selecionar"
                  className={`block lg:table-cell px-3 lg:px-4 py-2 lg:py-4 text-center ${cellLabel}`}
                >
                  <input
                    type="checkbox"
                    data-testid={`uber-ride-select-${ride.id}`}
                    checked={selected}
                    disabled={!selectable}
                    onChange={() => onToggle(ride)}
                    aria-label={`Selecionar corrida para ${ride.destination ?? 'destino'}`}
                    className="h-4 w-4 rounded border-line text-accent focus:ring-accent disabled:opacity-40"
                  />
                </td>
                <td
                  data-label="Data"
                  className={`block lg:table-cell px-3 lg:px-4 py-2 lg:py-4 lg:whitespace-nowrap text-ink-soft ${cellLabel}`}
                >
                  {formatRideDateTime(ride.requestedAt)}
                </td>
                <td
                  data-label="Tipo"
                  className={`block lg:table-cell px-3 lg:px-4 py-2 lg:py-4 lg:whitespace-nowrap ${cellLabel}`}
                >
                  <span
                    data-testid={`uber-ride-type-${ride.id}`}
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      RIDE_TYPE_CLASSES[ride.rideType] ??
                      'bg-base text-ink-soft'
                    }`}
                  >
                    {rideTypeLabel(ride.rideType)}
                  </span>
                </td>
                <td
                  data-label="Perfil"
                  className={`block lg:table-cell px-3 lg:px-4 py-2 lg:py-4 lg:whitespace-nowrap text-ink-soft ${cellLabel}`}
                >
                  {profileTypeLabel(ride.profileType)}
                </td>
                <td
                  data-label="Destino"
                  className={`block lg:table-cell px-3 lg:px-4 py-2 lg:py-4 lg:min-w-0 break-words text-ink ${cellLabel}`}
                >
                  {ride.destination ?? '—'}
                </td>
                <td
                  data-label="Familiar"
                  className={`block lg:table-cell px-3 lg:px-4 py-2 lg:py-4 lg:min-w-0 break-words text-ink-soft ${cellLabel}`}
                >
                  {ride.riderName ?? '—'}
                </td>
                <td
                  data-label="Valor"
                  data-testid={`uber-ride-amount-${ride.id}`}
                  className={`block lg:table-cell px-3 lg:px-4 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-right font-medium text-ink ${cellLabel}`}
                >
                  {formatBRL(fromCents(ride.amountCents))}
                </td>
                <td
                  data-label="Situação"
                  className={`block lg:table-cell px-3 lg:px-4 py-2 lg:py-4 lg:whitespace-nowrap ${cellLabel}`}
                >
                  {ride.launched ? (
                    <span
                      data-testid={`uber-ride-launched-${ride.id}`}
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${RIDE_LAUNCHED_CLASSES}`}
                    >
                      Lançada
                    </span>
                  ) : (
                    <span
                      data-testid={`uber-ride-status-${ride.id}`}
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        RIDE_STATUS_CLASSES[ride.status] ??
                        'bg-base text-ink-soft'
                      }`}
                    >
                      {rideStatusLabel(ride.status)}
                    </span>
                  )}
                </td>
                <td
                  data-label="Ações"
                  className={`block lg:table-cell px-3 lg:px-4 py-2 lg:py-4 text-center lg:whitespace-nowrap ${cellLabel}`}
                >
                  {!ride.launched && (
                    <button
                      type="button"
                      onClick={() => onRemove(ride)}
                      disabled={removingRideId === ride.id}
                      data-testid={`uber-ride-delete-${ride.id}`}
                      aria-label={`Remover corrida para ${ride.destination ?? 'destino'}`}
                      title="Remover corrida"
                      className="inline-flex items-center justify-center p-1.5 text-danger-fg hover:bg-danger-soft rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default UberRidesTable;
