import React, { useEffect, useMemo } from 'react';
import { ExternalLink, Image as ImageIcon, Plus, X } from 'lucide-react';
import {
  trackingUrl,
  lineValueCents,
  personSelectLabel,
  SELF_PERSON_ID,
} from '../utils/orderHelpers';
import OrderItemFields from './OrderItemFields';
import OrderTotals from './OrderTotals';

const OrderForm = ({
  orderNumber,
  orderNumberBlurred,
  orderDate,
  isTeamOrder,
  teamPersonId,
  teamPersonIdError,
  usesOrderLevelClient,
  accountOwner,
  paymentType,
  orderNotes,
  doterraPv,
  doterraPvError,
  attachmentFile,
  attachmentRemoved,
  hasExistingAttachment,
  shippingValue,
  shippingValueError,
  items,
  people,
  products,
  isEdit,
  orderNumberError,
  itemErrors,
  onChangeField,
  onItemUpdate,
  onItemPersonSelect,
  onTeamPersonSelect,
  onItemProductSelect,
  onItemCashbackToggle,
  onAddItem,
  onRemoveItem,
  addItemBtnRef,
  onSubmit,
  onCancel,
}) => {
  useEffect(() => {
    const firstError = document.querySelector(
      '[data-testid^="order-item-error-"]',
    );
    if (firstError && typeof firstError.scrollIntoView === 'function') {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [itemErrors]);

  const totalChargedCents = items.reduce(
    (total, item) => total + lineValueCents(item),
    0,
  );

  const previewUrl = useMemo(
    () => (attachmentFile ? URL.createObjectURL(attachmentFile) : null),
    [attachmentFile],
  );

  return (
    <form onSubmit={onSubmit} className="px-6 py-4">
      <div className="mb-4">
        <label
          htmlFor="orderNumber"
          className="block text-sm font-medium text-ink-soft mb-1"
        >
          Número do Pedido
        </label>
        <input
          id="orderNumber"
          type="text"
          value={orderNumber}
          onChange={(e) => onChangeField('orderNumber', e.target.value)}
          onBlur={() => onChangeField('orderNumberBlurred', true)}
          required
          className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
          placeholder="Informe o número do pedido da dōTERRA"
        />
        {orderNumberBlurred && orderNumber.trim() && (
          <div className="mt-1">
            <a
              href={trackingUrl(orderNumber.trim())}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver pedido no site
            </a>
          </div>
        )}
        {orderNumberError && (
          <div
            data-testid="order-number-error"
            className="mt-1 p-2 bg-danger-soft rounded-md"
          >
            <p className="text-sm text-danger-fg">{orderNumberError}</p>
          </div>
        )}
      </div>

      <div className="mb-4">
        <label
          htmlFor="accountOwner"
          className="block text-sm font-medium text-ink-soft mb-1"
        >
          Conta ID (ID dōTERRA ou nome)
        </label>
        <input
          id="accountOwner"
          type="text"
          value={accountOwner}
          onChange={(e) => onChangeField('accountOwner', e.target.value)}
          maxLength={120}
          className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
          placeholder="Ex.: 6254862 ou Ana Silva"
        />
      </div>

      <div className="mb-4">
        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input
            id="isTeamOrder"
            type="checkbox"
            checked={isTeamOrder}
            onChange={(e) => onChangeField('isTeamOrder', e.target.checked)}
            data-testid="order-is-team-order"
            className="mt-1 h-4 w-4 rounded border-line text-accent focus:ring-accent"
          />
          <span className="text-sm font-medium text-ink-soft">
            Pedido da equipe (outra pessoa fez o pedido e pagou)
          </span>
        </label>
        {isTeamOrder && (
          <>
            <p
              data-testid="order-team-notice"
              className="mt-1 ml-7 text-xs text-ink-faint"
            >
              Este pedido é apenas um registro: não entra no controle de
              recebimento, nos seus gastos nem no estoque.
            </p>
            <div className="mt-3">
              <label
                htmlFor="teamPersonId"
                className="block text-sm font-medium text-ink-soft mb-1"
              >
                Cliente
              </label>
              <select
                id="teamPersonId"
                data-testid="order-team-person"
                value={teamPersonId}
                onChange={(e) => onTeamPersonSelect(e.target.value)}
                className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
              >
                <option value="">Selecione uma pessoa</option>
                {people
                  .filter((person) => person.isSelf)
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {personSelectLabel(person)}
                    </option>
                  ))}
                {!people.some((person) => person.isSelf) && (
                  <option value={SELF_PERSON_ID}>Eu (você)</option>
                )}
                {people
                  .filter((person) => !person.isSelf)
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {personSelectLabel(person)}
                    </option>
                  ))}
              </select>
              {teamPersonIdError && (
                <div
                  data-testid="order-team-person-error"
                  className="mt-1 p-2 bg-danger-soft rounded-md"
                >
                  <p className="text-sm text-danger-fg">{teamPersonIdError}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mb-4">
        <label
          htmlFor="orderDate"
          className="block text-sm font-medium text-ink-soft mb-1"
        >
          Data do Pedido
        </label>
        <input
          id="orderDate"
          type="date"
          value={orderDate}
          onChange={(e) => onChangeField('orderDate', e.target.value)}
          className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
        />
      </div>

      <div className="mb-4">
        <label
          htmlFor="paymentType"
          className="block text-sm font-medium text-ink-soft mb-1"
        >
          Tipo de Pagamento
        </label>
        <select
          id="paymentType"
          value={paymentType}
          onChange={(e) => onChangeField('paymentType', e.target.value)}
          className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
        >
          <option value="">Selecione...</option>
          <option value="PIX">PIX</option>
          <option value="BOLETO">Boleto</option>
          <option value="CARTAO_CREDITO">Crédito</option>
        </select>
      </div>

      <div className="mb-4">
        <label
          htmlFor="doterraPv"
          className="block text-sm font-medium text-ink-soft mb-1"
        >
          PV doTERRA
        </label>
        <input
          id="doterraPv"
          type="number"
          step="0.01"
          min="0"
          value={doterraPv}
          onChange={(e) => onChangeField('doterraPv', e.target.value)}
          className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
          placeholder="Ex.: 46.5"
        />
        {doterraPvError && (
          <div
            data-testid="order-doterra-pv-error"
            className="mt-1 p-2 bg-danger-soft rounded-md"
          >
            <p className="text-sm text-danger-fg">{doterraPvError}</p>
          </div>
        )}
      </div>

      <div className="mb-4">
        <label
          htmlFor="orderAttachment"
          className="block text-sm font-medium text-ink-soft mb-1"
        >
          Anexo (print do pedido doTERRA)
        </label>
        {isEdit &&
        hasExistingAttachment &&
        !attachmentFile &&
        !attachmentRemoved ? (
          <div
            data-testid="order-attachment-existing"
            className="flex flex-wrap items-center gap-2"
          >
            <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
              <ImageIcon className="w-4 h-4 text-ink-faint" />
              Anexo existente
            </span>
            <button
              type="button"
              data-testid="order-attachment-remove"
              onClick={() => onChangeField('attachmentRemoved', true)}
              className="inline-flex items-center gap-1 text-sm text-danger-fg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Remover
            </button>
          </div>
        ) : (
          <div>
            <input
              id="orderAttachment"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              data-testid="order-attachment-input"
              onChange={(e) =>
                onChangeField('attachmentFile', e.target.files?.[0] || null)
              }
              className="block w-full text-sm text-ink-faint file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-accent-soft file:text-accent-on-soft hover:file:bg-accent-soft transition-colors"
            />
            {previewUrl && (
              <div className="mt-2">
                <img
                  data-testid="order-attachment-preview"
                  src={previewUrl}
                  alt="Prévia do anexo"
                  className="max-h-40 rounded-md border border-line"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mb-4">
        <label
          htmlFor="orderNotes"
          className="block text-sm font-medium text-ink-soft mb-1"
        >
          Descrição do Pedido
        </label>
        <textarea
          id="orderNotes"
          value={orderNotes}
          onChange={(e) => onChangeField('orderNotes', e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
          placeholder="Acrescente informações adicionais — motivo do pedido, promoções, encomendas, etc."
        />
        <div className="mt-1 text-right text-xs text-ink-faint">
          {orderNotes.length}/500
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium text-ink-soft">Itens do Pedido</span>
        </div>

        {items.map((item, index) => (
          <OrderItemFields
            key={item.id}
            item={item}
            index={index}
            error={itemErrors[item.id]}
            people={people}
            products={products}
            canRemove={items.length > 1}
            isTeamOrder={isTeamOrder}
            showPersonSelect={isTeamOrder && !usesOrderLevelClient}
            onUpdateField={(field, value) => onItemUpdate(index, field, value)}
            onPersonSelect={onItemPersonSelect}
            onProductSelect={(productId) =>
              onItemProductSelect(index, productId)
            }
            onCashbackToggle={onItemCashbackToggle}
            onRemove={() => onRemoveItem(index)}
          />
        ))}

        <button
          type="button"
          onClick={onAddItem}
          ref={addItemBtnRef}
          className="w-full px-3 py-2 mt-1 text-sm font-medium text-accent-on-soft hover:text-accent-on-soft bg-accent-soft hover:bg-accent-soft rounded-md transition-colors flex items-center justify-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Adicionar Item
        </button>
      </div>

      <OrderTotals
        totalChargedCents={totalChargedCents}
        shippingValue={shippingValue}
        shippingValueError={shippingValueError}
        onChangeField={onChangeField}
      />

      <div className="flex items-center justify-end space-x-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
        >
          {isEdit ? 'Atualizar' : 'Salvar'}
        </button>
      </div>
    </form>
  );
};

export default OrderForm;
