import React, { useEffect } from 'react';
import { Plus } from 'lucide-react';
import { lineValueCents } from '../utils/orderHelpers';
import OrderDetailsFields from './OrderDetailsFields';
import OrderEntryModeSelector from './OrderEntryModeSelector';
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
  entryMode,
  onEntryModeChange,
  onChangeField,
  onItemUpdate,
  onItemPersonSelect,
  onTeamPersonSelect,
  onItemProductSelect,
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

  return (
    <form onSubmit={onSubmit} className="px-6 py-4">
      <OrderEntryModeSelector
        value={entryMode}
        onChange={onEntryModeChange}
        isEdit={isEdit}
      />

      <OrderDetailsFields
        orderNumber={orderNumber}
        orderNumberBlurred={orderNumberBlurred}
        orderNumberError={orderNumberError}
        accountOwner={accountOwner}
        isTeamOrder={isTeamOrder}
        teamPersonId={teamPersonId}
        teamPersonIdError={teamPersonIdError}
        usesOrderLevelClient={usesOrderLevelClient}
        people={people}
        orderDate={orderDate}
        paymentType={paymentType}
        doterraPv={doterraPv}
        doterraPvError={doterraPvError}
        attachmentFile={attachmentFile}
        attachmentRemoved={attachmentRemoved}
        hasExistingAttachment={hasExistingAttachment}
        orderNotes={orderNotes}
        isEdit={isEdit}
        onChangeField={onChangeField}
        onTeamPersonSelect={onTeamPersonSelect}
      />

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
