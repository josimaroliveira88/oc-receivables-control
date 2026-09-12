import React from 'react';
import Modal from '../../../components/Modal';
import {
  MOVEMENT_TYPES,
  formatDate,
  formatDateTime,
  formatSignedQuantity,
} from '../utils/stockHelpers';

const HistoryDialog = ({
  isOpen,
  product,
  movements,
  loading = false,
  canUndo = false,
  lastMovementOrder = null,
  undoing = false,
  onRequestUndo,
  onGoToOrder,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      title={
        <>
          Histórico de Estoque
          {product && (
            <p className="text-sm font-normal text-ink-faint">
              {product.code} — {product.name}
            </p>
          )}
        </>
      }
      onClose={onClose}
      maxWidth="max-w-2xl"
      testId="history-dialog"
      closeAriaLabel="Fechar"
    >
      {(requestClose) => (
        <>
          <div className="px-6 py-4">
            {!loading && movements.length > 0 && canUndo && (
              <div className="mb-4 flex items-center justify-end">
                <button
                  type="button"
                  onClick={onRequestUndo}
                  disabled={undoing}
                  className="px-3 py-2 text-sm font-medium text-danger-fg bg-danger-soft rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="undo-last-movement"
                >
                  Desfazer última movimentação
                </button>
              </div>
            )}
            {!loading &&
              movements.length > 0 &&
              !canUndo &&
              lastMovementOrder && (
                <div
                  data-testid="history-order-locked-notice"
                  className="mb-4 p-3 bg-info-soft rounded-md"
                >
                  {lastMovementOrder.orderType === 'VENDA' ? (
                    <p className="text-sm text-info-fg">
                      A última movimentação está vinculada à Venda #
                      {lastMovementOrder.orderNumber} e só pode ser desfeita
                      editando ou removendo o item correspondente nessa venda.
                    </p>
                  ) : (
                    <p className="text-sm text-info-fg">
                      A última movimentação está vinculada ao Pedido #
                      {lastMovementOrder.orderNumber} e só pode ser desfeita
                      editando ou removendo o item correspondente nesse pedido.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      onGoToOrder && onGoToOrder(lastMovementOrder)
                    }
                    className="mt-2 px-3 py-1.5 text-sm font-medium text-accent-on bg-accent hover:bg-accent-hover rounded-md transition-colors"
                    data-testid="go-to-order-from-history"
                  >
                    {lastMovementOrder.orderType === 'VENDA'
                      ? 'Ver venda'
                      : 'Ver pedido'}
                  </button>
                </div>
              )}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                <span className="ml-2 text-ink-faint">
                  Carregando histórico...
                </span>
              </div>
            ) : movements.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-ink-faint">
                  Nenhuma movimentação registrada para este produto.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm text-left block lg:table">
                <thead className="hidden lg:table-header-group bg-base">
                  <tr>
                    <th
                      scope="col"
                      className="w-[20%] px-6 py-3 text-left text-xs font-medium text-ink-faint tracking-wider"
                    >
                      Data Efetiva
                    </th>
                    <th
                      scope="col"
                      className="w-[25%] px-6 py-3 text-left text-xs font-medium text-ink-faint tracking-wider"
                    >
                      Data de Registro
                    </th>
                    <th
                      scope="col"
                      className="w-[15%] px-6 py-3 text-left text-xs font-medium text-ink-faint tracking-wider"
                    >
                      Tipo
                    </th>
                    <th
                      scope="col"
                      className="w-[15%] px-6 py-3 text-right text-xs font-medium text-ink-faint tracking-wider"
                    >
                      Quantidade
                    </th>
                    <th
                      scope="col"
                      className="w-[25%] px-6 py-3 text-left text-xs font-medium text-ink-faint tracking-wider"
                    >
                      Motivo
                    </th>
                  </tr>
                </thead>
                <tbody className="block lg:table-row-group bg-surface lg:divide-y divide-line">
                  {movements.map((m) => {
                    const meta = MOVEMENT_TYPES[m.type] || {
                      label: m.type,
                      className: 'bg-base text-ink-soft',
                    };
                    const isPositive = Number(m.quantity ?? 0) >= 0;
                    const quantityClass = isPositive
                      ? 'text-success-fg'
                      : 'text-danger-fg';
                    return (
                      <tr
                        key={m.id}
                        className="block lg:table-row border border-line lg:border-0 rounded-lg lg:rounded-none shadow-sm lg:shadow-none mb-3 lg:mb-0"
                      >
                        <td
                          data-label="Data Efetiva"
                          className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-ink before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                        >
                          {formatDate(m.effectiveDate || m.createdAt)}
                        </td>
                        <td
                          data-label="Data de Registro"
                          className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 text-sm text-ink-faint before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                        >
                          {formatDateTime(m.createdAt)}
                        </td>
                        <td
                          data-label="Tipo"
                          className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                        >
                          <span
                            data-testid={`movement-type-${m.type}`}
                            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${meta.className}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td
                          data-label="Quantidade"
                          className={`block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-right text-sm font-medium before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden ${quantityClass}`}
                        >
                          {formatSignedQuantity(m.quantity)}
                        </td>
                        <td
                          data-label="Motivo"
                          className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 text-sm text-ink-soft before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 lg:before:hidden"
                        >
                          {m.order && (
                            <span
                              data-testid={`movement-order-${m.type}`}
                              className="mr-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent-soft text-accent-on-soft"
                            >
                              {m.order.orderType === 'VENDA'
                                ? `Venda ${m.order.orderNumber}`
                                : `Pedido #${m.order.orderNumber}`}
                            </span>
                          )}
                          {m.reason || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {!loading && movements.length > 0 && (
            <div className="px-6 py-4 border-t border-line flex items-center justify-end">
              <button
                type="button"
                onClick={requestClose}
                className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
              >
                Fechar
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
};

export default HistoryDialog;
