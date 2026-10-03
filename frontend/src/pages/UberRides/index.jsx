import React from 'react';
import { Upload, HelpCircle } from 'lucide-react';
import Modal from '../../components/Modal';
import { useUberRides } from './useUberRides';
import UberRidesTable from './components/UberRidesTable';
import UberRideImportModal from './components/UberRideImportModal';
import UberRidesWelcomeModal from './components/UberRidesWelcomeModal';
import UberRideSelectionPanel from './components/UberRideSelectionPanel';
import { fromCents, formatBRL } from '../../utils/money';
import {
  isRideSelectable,
  PROFILE_FILTER_OPTIONS,
  RIDE_STATUS_FILTER_OPTIONS,
  RIDE_TYPE_FILTER_OPTIONS,
} from './utils/uberRideHelpers';

const SummaryCard = ({ label, value, testId }) => (
  <div className="rounded-lg border border-line bg-surface px-4 py-3">
    <p className="text-xs font-medium text-ink-faint">{label}</p>
    <p data-testid={testId} className="mt-1 text-lg font-semibold text-ink">
      {value}
    </p>
  </div>
);

const selectClass =
  'w-full sm:w-auto px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors';

const UberRides = ({
  embeddedOnly = false,
  isOpen = true,
  onClose,
  onOpenGuide,
  initialView = null,
}) => {
  const {
    rides,
    visibleRides,
    loading,
    error,
    categories,
    filters,
    setFilters,
    resetFilters,
    summary,
    visibleSummary,
    selections,
    selectedItems,
    selectedTotalCents,
    launching,
    toggleRide,
    setRideField,
    clearSelections,
    launchSelected,
    showImport,
    importForm,
    importError,
    importing,
    importDirty,
    openImport,
    openImportForm,
    closeImport,
    setImportField,
    submitImport,
    showWelcome,
    openWelcome,
    closeWelcome,
  } = useUberRides({ initialView });

  const selectedRides = rides.filter(
    (ride) => isRideSelectable(ride) && selections[ride.id]?.selected,
  );

  const hasActiveFilters = Boolean(
    filters.status ||
    filters.profileType ||
    filters.rideType ||
    filters.launched ||
    filters.search.trim(),
  );

  const content = (
    <>
      <div className="bg-surface border border-line rounded-lg shadow-md">
        {embeddedOnly ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line px-6 py-3">
            <p className="text-sm text-ink-soft">
              Importe o JSON capturado ou lance as corridas direto da extensão.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openWelcome}
                data-testid="uber-ride-howto-open"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
              >
                <HelpCircle className="w-4 h-4" aria-hidden="true" />
                Como capturar?
              </button>
              <button
                type="button"
                onClick={openImport}
                data-testid="uber-ride-import-open"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                Importar corridas
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-line px-6 py-4">
            <h2 className="text-xl font-semibold text-ink">Corridas Uber</h2>
            <div className="mt-3 sm:mt-0 flex items-center gap-2">
              <button
                type="button"
                onClick={openWelcome}
                data-testid="uber-ride-howto-open"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
              >
                <HelpCircle className="w-4 h-4" aria-hidden="true" />
                Como capturar?
              </button>
              <button
                type="button"
                onClick={openImport}
                data-testid="uber-ride-import-open"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                Importar corridas
              </button>
            </div>
          </div>
        )}

        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-danger-soft rounded-md">
              <p className="text-sm text-danger-fg">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard
              label="Corridas"
              value={summary.total}
              testId="uber-rides-summary-total"
            />
            <SummaryCard
              label="Canceladas"
              value={summary.cancelled}
              testId="uber-rides-summary-cancelled"
            />
            <SummaryCard
              label="Já lançadas"
              value={summary.launched}
              testId="uber-rides-summary-launched"
            />
            <SummaryCard
              label="A lançar"
              value={formatBRL(fromCents(summary.pendingCents))}
              testId="uber-rides-summary-pending"
            />
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
            <select
              data-testid="uber-ride-filter-status"
              value={filters.status}
              onChange={(event) => setFilters({ status: event.target.value })}
              className={selectClass}
              aria-label="Filtrar por status"
            >
              {RIDE_STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              data-testid="uber-ride-filter-profile"
              value={filters.profileType}
              onChange={(event) =>
                setFilters({ profileType: event.target.value })
              }
              className={selectClass}
              aria-label="Filtrar por perfil"
            >
              {PROFILE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              data-testid="uber-ride-filter-type"
              value={filters.rideType}
              onChange={(event) => setFilters({ rideType: event.target.value })}
              className={selectClass}
              aria-label="Filtrar por tipo"
            >
              {RIDE_TYPE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                data-testid="uber-ride-filter-pending"
                checked={filters.launched === 'no'}
                onChange={(event) =>
                  setFilters({ launched: event.target.checked ? 'no' : '' })
                }
                className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
              />
              Somente a lançar
            </label>

            <input
              type="search"
              data-testid="uber-ride-filter-search"
              value={filters.search}
              onChange={(event) => setFilters({ search: event.target.value })}
              placeholder="Buscar destino ou familiar"
              className={`${selectClass} sm:flex-1`}
              aria-label="Buscar corridas"
            />

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
              >
                Limpar filtros
              </button>
            )}
          </div>

          <div
            data-testid="uber-rides-filter-totalizer"
            className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-line bg-base px-4 py-3"
          >
            <p className="text-sm text-ink-soft">
              <span
                data-testid="uber-rides-filter-count"
                className="font-semibold text-ink"
              >
                {visibleSummary.total}
              </span>{' '}
              corrida(s) no filtro
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-soft">
              <p>
                Total:{' '}
                <span
                  data-testid="uber-rides-filter-total"
                  className="font-semibold text-ink"
                >
                  {formatBRL(fromCents(visibleSummary.totalCents))}
                </span>
              </p>
              <p>
                A lançar:{' '}
                <span
                  data-testid="uber-rides-filter-pending"
                  className="font-semibold text-ink"
                >
                  {formatBRL(fromCents(visibleSummary.pendingCents))}
                </span>
              </p>
            </div>
          </div>

          <UberRidesTable
            rides={visibleRides}
            selections={selections}
            onToggle={toggleRide}
            hasActiveFilters={hasActiveFilters}
          />

          <UberRideSelectionPanel
            rides={selectedRides}
            selections={selections}
            categories={categories}
            totalCents={selectedTotalCents}
            launching={launching}
            onFieldChange={setRideField}
            onLaunch={launchSelected}
            onClear={clearSelections}
          />

          {selectedItems.length > 0 && (
            <p className="mt-3 text-xs text-ink-faint">
              As despesas serão lançadas no financeiro com origem “Corrida
              Uber”.
            </p>
          )}
        </div>
      </div>

      <UberRideImportModal
        isOpen={showImport}
        form={importForm}
        error={importError}
        submitting={importing}
        isDirty={importDirty}
        onChange={setImportField}
        onSubmit={submitImport}
        onClose={closeImport}
        onOpenGuide={onOpenGuide}
      />

      <UberRidesWelcomeModal
        isOpen={showWelcome}
        onClose={closeWelcome}
        onOpenImport={openImportForm}
        onOpenGuide={onOpenGuide}
      />
    </>
  );

  if (!embeddedOnly) {
    return content;
  }

  return (
    <Modal
      isOpen={isOpen}
      title="Importar corridas"
      onClose={onClose || (() => {})}
      maxWidth="max-w-5xl"
      testId="uber-rides-embedded-modal"
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          <span className="ml-2 text-ink-faint">Carregando...</span>
        </div>
      ) : (
        content
      )}
    </Modal>
  );
};

export default UberRides;
