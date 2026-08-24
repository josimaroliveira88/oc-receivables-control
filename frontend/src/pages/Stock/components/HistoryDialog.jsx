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
            <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
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
                  className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md"
                >
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    A última movimentação está vinculada ao Pedido #
                    {lastMovementOrder.orderNumber} e só pode ser desfeita
                    editando ou removendo o item correspondente nesse pedido.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      onGoToOrder && onGoToOrder(lastMovementOrder.id)
                    }
                    className="mt-2 px-3 py-1.5 text-sm font-medium text-white bg-primary-700 hover:bg-primary-800 rounded-md transition-colors"
                    data-testid="go-to-order-from-history"
                  >
                    Ver pedido
                  </button>
                </div>
              )}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                <span className="ml-2 text-gray-500 dark:text-gray-400">
                  Carregando histórico...
                </span>
              </div>
            ) : movements.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhuma movimentação registrada para este produto.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm text-left block lg:table">
                <thead className="hidden lg:table-header-group bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th
                      scope="col"
                      className="w-[20%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Data Efetiva
                    </th>
                    <th
                      scope="col"
                      className="w-[25%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Data de Registro
                    </th>
                    <th
                      scope="col"
                      className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Tipo
                    </th>
                    <th
                      scope="col"
                      className="w-[15%] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Quantidade
                    </th>
                    <th
                      scope="col"
                      className="w-[25%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      Motivo
                    </th>
                  </tr>
                </thead>
                <tbody className="block lg:table-row-group bg-white dark:bg-gray-800 lg:divide-y divide-gray-200 dark:divide-gray-700">
                  {movements.map((m) => {
                    const meta = MOVEMENT_TYPES[m.type] || {
                      label: m.type,
                      className:
                        'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300',
                    };
                    const isPositive = Number(m.quantity ?? 0) >= 0;
                    const quantityClass = isPositive
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-red-700 dark:text-red-400';
                    return (
                      <tr
                        key={m.id}
                        className="block lg:table-row border border-gray-200 dark:border-gray-700 lg:border-0 rounded-lg lg:rounded-none shadow-sm lg:shadow-none mb-3 lg:mb-0"
                      >
                        <td
                          data-label="Data Efetiva"
                          className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                        >
                          {formatDate(m.effectiveDate || m.createdAt)}
                        </td>
                        <td
                          data-label="Data de Registro"
                          className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 text-sm text-gray-500 dark:text-gray-400 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                        >
                          {formatDateTime(m.createdAt)}
                        </td>
                        <td
                          data-label="Tipo"
                          className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
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
                          className={`block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-left lg:text-right text-sm font-medium before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden ${quantityClass}`}
                        >
                          {formatSignedQuantity(m.quantity)}
                        </td>
                        <td
                          data-label="Motivo"
                          className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 text-sm text-gray-700 dark:text-gray-300 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                        >
                          {m.order && (
                            <span
                              data-testid={`movement-order-${m.type}`}
                              className="mr-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                            >
                              Pedido #{m.order.orderNumber}
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
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end">
              <button
                type="button"
                onClick={requestClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
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
