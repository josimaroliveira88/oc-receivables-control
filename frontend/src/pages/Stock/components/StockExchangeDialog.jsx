import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../../../components/Modal';
import ProductCombobox from '../../../components/ProductCombobox';
import CurrencyInput from '../../../components/CurrencyInput';
import NumericInput from '../../../components/NumericInput';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { formatBRL } from '../../../utils/money';
import {
  emptyExchangeForm,
  emptyExchangeLine,
  exchangeTotals,
  validateExchange,
  buildExchangePayload,
  STOCK_EXCHANGE_LINE_MAX_OBSERVATION,
} from '../utils/stockExchangeHelpers';

const GAP = 4;
const MAX_HEIGHT = 240;
const MIN_HEIGHT = 120;
const COMBOBOX_LIST_TESTID = 'person-combobox-list';

const PersonCombobox = ({ people, value, onChange }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const anchorRef = useRef(null);
  const selected = people.find((p) => p.id === value) || null;
  const hasSelection = Boolean(value);

  const displayLabel = selected ? selected.name : query;

  const filtered = people
    .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 100);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    const openUp = spaceBelow < MIN_HEIGHT && spaceAbove > spaceBelow;
    setPosition({
      left: rect.left,
      width: rect.width,
      top: openUp ? undefined : rect.bottom + GAP,
      bottom: openUp ? window.innerHeight - rect.top + GAP : undefined,
      maxHeight: Math.max(
        MIN_HEIGHT,
        Math.min(MAX_HEIGHT, openUp ? spaceAbove : spaceBelow),
      ),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;
    const handle = () => updatePosition();
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [open, updatePosition]);

  const close = () => {
    setOpen(false);
    setPosition(null);
  };

  const handleSelect = (id) => {
    onChange(id);
    setQuery('');
    close();
  };

  const handleClear = () => {
    onChange('');
    setQuery('');
    close();
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1" ref={anchorRef}>
          <input
            type="text"
            value={displayLabel}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar pessoa..."
            aria-label="Pessoa da troca"
            className="w-full px-3 py-2 pr-8 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors text-sm"
          />
        </div>
        {hasSelection && (
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-2 text-xs font-medium text-danger-fg bg-danger-soft rounded-md transition-colors whitespace-nowrap"
          >
            Limpar pessoa
          </button>
        )}
      </div>

      {open &&
        position &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={close} />
            <ul
              data-testid={COMBOBOX_LIST_TESTID}
              style={{
                position: 'fixed',
                left: position.left,
                width: position.width,
                top: position.top,
                bottom: position.bottom,
                maxHeight: position.maxHeight,
              }}
              className="z-[70] overflow-auto bg-surface border border-line rounded-md shadow-lg"
            >
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-ink-faint">
                  Nenhuma pessoa encontrada
                </li>
              )}
              {filtered.map((p) => (
                <li
                  key={p.id}
                  onMouseDown={() => handleSelect(p.id)}
                  className="cursor-pointer px-3 py-2 text-sm text-ink hover:bg-accent-soft transition-colors"
                >
                  <span className="font-medium">{p.name}</span>
                </li>
              ))}
            </ul>
          </>,
          document.body,
        )}
    </div>
  );
};

const inputClass =
  'w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors disabled:bg-base disabled:text-ink-faint disabled:cursor-not-allowed';

const LineRow = ({ line, products, onChange, onRemove, side }) => {
  return (
    // Mobile keeps the 12-column grid; from `sm` on, the quantity cell is pinned
    // to a fixed 5rem so it never grows wider than the two digits it holds and
    // never crowds the unit-value field.
    <div className="grid grid-cols-12 gap-2 items-end mb-2 sm:grid-cols-[minmax(0,2fr)_5rem_minmax(0,1fr)_auto]">
      <div className="col-span-12 sm:col-span-1">
        <label className="block text-xs font-medium text-ink-faint mb-1">
          Produto
        </label>
        <ProductCombobox
          products={products}
          value={line.productId}
          onChange={(id) => onChange('productId', id)}
        />
      </div>
      <div className="col-span-3 sm:col-span-1">
        <label className="block text-xs font-medium text-ink-faint mb-1">
          Quantidade
        </label>
        <NumericInput
          value={line.quantity}
          onChange={(e) => onChange('quantity', e.target.value)}
          required
          placeholder="Qtd"
          className="w-full"
          aria-label="Quantidade"
        />
      </div>
      <div className="col-span-7 sm:col-span-1">
        <label className="block text-xs font-medium text-ink-faint mb-1">
          Valor Membro (opcional)
        </label>
        <CurrencyInput
          value={line.unitValue}
          onChange={(e) => onChange('unitValue', e.target.value)}
          placeholder="R$ 0,00"
          aria-label="Valor Membro"
        />
      </div>
      <div className="col-span-2 sm:col-span-1 flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover produto ${side}`}
          data-testid={`stock-exchange-remove-${side}`}
          className="px-2 py-2 text-danger-fg bg-danger-soft hover:bg-danger-soft/80 rounded-md transition-colors"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

const StockExchangeDialog = ({
  isOpen,
  people = [],
  products = [],
  productPriceMap = {},
  form,
  isDirty,
  submitting = false,
  error,
  onChange,
  onChangeLine,
  onAddLine,
  onRemoveLine,
  onSubmit,
  onClose,
}) => {
  const [showForceClose, setShowForceClose] = useState(false);
  const requestClose = useCallback(() => {
    if (submitting) return;
    if (isDirty) {
      setShowForceClose(true);
      return;
    }
    onClose();
  }, [submitting, isDirty, onClose]);

  const handleLineChange = (side, uid) => (fieldName, value) => {
    onChangeLine(side, uid, fieldName, value);
  };

  const totals = exchangeTotals(form, productPriceMap);

  return (
    <Modal
      isOpen={isOpen}
      title="Trocar produtos"
      onClose={requestClose}
      isDirty={isDirty}
      submitting={submitting}
      maxWidth="max-w-4xl"
      testId="stock-exchange-dialog"
    >
      {(requestClose) => (
        <>
          <form
            onSubmit={onSubmit}
            data-testid="stock-exchange-form"
            className="px-6 py-4 space-y-5"
          >
            {error && (
              <div className="p-3 bg-danger-soft rounded-md">
                <p
                  className="text-sm text-danger-fg"
                  data-testid="stock-exchange-error"
                >
                  {error}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Pessoa da troca
                </label>
                <PersonCombobox
                  people={people}
                  value={form.personId}
                  onChange={(id) => onChange('personId', id)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">
                  Data efetiva
                </label>
                <input
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => onChange('effectiveDate', e.target.value)}
                  required
                  className={inputClass}
                  aria-label="Data efetiva"
                />
              </div>
            </div>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-ink">
                  Produtos que saem do seu estoque
                </h4>
                <button
                  type="button"
                  onClick={() => onAddLine('outgoingLines')}
                  className="text-xs text-accent hover:text-accent-hover font-medium inline-flex items-center gap-1"
                >
                  <Plus size={14} aria-hidden="true" /> Adicionar produto
                </button>
              </div>
              {form.outgoingLines.length === 0 && (
                <p className="text-sm text-ink-faint px-3 py-2 border border-dashed border-line rounded-md">
                  Adicione ao menos um produto que sai.
                </p>
              )}
              {form.outgoingLines.map((line) => (
                <LineRow
                  key={line.uid}
                  line={line}
                  products={products}
                  onChange={handleLineChange('outgoingLines', line.uid)}
                  onRemove={() => onRemoveLine('outgoingLines', line.uid)}
                  side="out"
                />
              ))}
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-ink">
                  Produtos que entram no seu estoque
                </h4>
                <button
                  type="button"
                  onClick={() => onAddLine('incomingLines')}
                  className="text-xs text-accent hover:text-accent-hover font-medium inline-flex items-center gap-1"
                >
                  <Plus size={14} aria-hidden="true" /> Adicionar produto
                </button>
              </div>
              {form.incomingLines.length === 0 && (
                <p className="text-sm text-ink-faint px-3 py-2 border border-dashed border-line rounded-md">
                  Adicione ao menos um produto que entra.
                </p>
              )}
              {form.incomingLines.map((line) => (
                <LineRow
                  key={line.uid}
                  line={line}
                  products={products}
                  onChange={handleLineChange('incomingLines', line.uid)}
                  onRemove={() => onRemoveLine('incomingLines', line.uid)}
                  side="in"
                />
              ))}
            </section>

            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1">
                Observação (opcional)
              </label>
              <textarea
                value={form.observation}
                onChange={(e) => onChange('observation', e.target.value)}
                maxLength={STOCK_EXCHANGE_LINE_MAX_OBSERVATION}
                rows={3}
                className={inputClass}
                placeholder="Detalhes sobre a troca"
                aria-label="Observação"
              />
              <p className="mt-1 text-xs text-ink-faint">
                {(form.observation || '').length}/
                {STOCK_EXCHANGE_LINE_MAX_OBSERVATION}
              </p>
            </div>

            <div
              className="bg-base border border-line rounded-md p-3 text-sm"
              data-testid="stock-exchange-totals"
            >
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-ink-soft">
                <span>
                  Total que sai:{' '}
                  <span className="font-medium text-ink">
                    {formatBRL(totals.outgoingCents / 100)}
                  </span>
                </span>
                <span>
                  Total que entra:{' '}
                  <span className="font-medium text-ink">
                    {formatBRL(totals.incomingCents / 100)}
                  </span>
                </span>
                <span>
                  Diferença:{' '}
                  <span
                    className={`font-medium ${
                      totals.diffCents > 0
                        ? 'text-success-fg'
                        : totals.diffCents < 0
                          ? 'text-danger-fg'
                          : 'text-ink'
                    }`}
                  >
                    {formatBRL(totals.diffCents / 100)}
                  </span>
                </span>
              </div>
              <p className="text-xs text-ink-faint mt-1">
                {totals.diffCents > 0
                  ? 'A diferença sugere que você recebe a mais nesta troca.'
                  : totals.diffCents < 0
                    ? 'A diferença sugere que você paga a mais nesta troca.'
                    : 'Sem diferença de valor entre os produtos que saem e os que entram.'}
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={requestClose}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Salvando...' : 'Trocar'}
              </button>
            </div>
          </form>
          <ConfirmDialog
            open={showForceClose}
            title="Descartar troca?"
            message="Há alterações não salvas neste formulário. Deseja descartá-las e fechar?"
            confirmLabel="Descartar"
            cancelLabel="Continuar editando"
            onConfirm={() => {
              setShowForceClose(false);
              onClose();
            }}
            onCancel={() => setShowForceClose(false)}
          />
        </>
      )}
    </Modal>
  );
};

export default StockExchangeDialog;
