import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ExternalLink,
  Trash2,
  ShoppingCart,
  Warehouse,
  ArrowLeftRight,
  Boxes,
} from 'lucide-react';
import Modal from '../../../components/Modal';
import ConfirmDialog from '../../../components/ConfirmDialog';
import {
  BLOCKER_ORDER,
  REFERENCE_KIND_LABELS,
  usageSummaryLine,
  referenceImpactMessage,
  hardDeleteImpactMessage,
  orderItemLocationLabel,
  orderItemValueLabel,
} from '../utils/productUsageHelpers';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
};

const EmptyLine = ({ children }) => (
  <p className="text-sm text-ink-faint py-2">{children}</p>
);

const Section = ({ icon: Icon, title, count, children }) => (
  <section className="mb-5">
    <h4 className="flex items-center gap-2 text-sm font-semibold text-ink mb-1">
      <Icon className="w-4 h-4 text-ink-faint" aria-hidden="true" />
      {title}
      {typeof count === 'number' && (
        <span className="text-xs font-normal text-ink-faint">({count})</span>
      )}
    </h4>
    {children}
  </section>
);

const OpenButton = ({ onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1 text-accent hover:text-accent-hover text-sm font-medium transition-colors"
  >
    {label}
    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
  </button>
);

// "Where is this product used" panel. Lists every reference, lets the user
// navigate to each location, remove a blocking reference, and finally delete
// the product. Every removal has its own confirmation with an impact alert.
const ProductUsageModal = ({
  product,
  snapshot,
  loading,
  error,
  onClose,
  onRemoveReference,
  onHardDelete,
  onRefresh,
}) => {
  const navigate = useNavigate();
  const [confirmKind, setConfirmKind] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busyKind, setBusyKind] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const isOpen = Boolean(product);

  const go = (path) => {
    onClose();
    navigate(path);
  };

  const confirmRemoveReference = async () => {
    if (!confirmKind) return;
    setBusyKind(confirmKind);
    await onRemoveReference(confirmKind);
    setBusyKind(null);
    setConfirmKind(null);
  };

  const confirmHardDelete = async () => {
    setDeleting(true);
    await onHardDelete();
    setDeleting(false);
    setConfirmDelete(false);
  };

  const blockers = snapshot?.blockers;
  const activeBlockers = blockers
    ? BLOCKER_ORDER.filter((kind) => blockers[kind])
    : [];

  return (
    <>
      <Modal
        isOpen={isOpen}
        title="Locais onde o produto é usado"
        onClose={onClose}
        maxWidth="max-w-2xl"
        testId="product-usage-modal"
        closeAriaLabel="Fechar locais de uso"
      >
        {() => (
          <div className="px-6 py-4">
            {product && (
              <div className="mb-4">
                <p className="text-sm text-ink">
                  <span className="font-semibold">{product.code}</span>
                  {product.name ? ` — ${product.name}` : ''}
                </p>
                <p className="text-xs text-ink-faint">
                  {usageSummaryLine(snapshot?.counts)}
                </p>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
                <span className="ml-2 text-sm text-ink-faint">
                  Carregando referências...
                </span>
              </div>
            )}

            {!loading && error && (
              <div className="p-3 bg-danger-soft rounded-md">
                <p className="text-sm text-danger-fg">{error}</p>
                <button
                  type="button"
                  onClick={onRefresh}
                  className="mt-2 text-sm font-medium text-accent hover:text-accent-hover"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!loading && !error && snapshot && (
              <>
                {activeBlockers.length > 0 && (
                  <div
                    data-testid="product-usage-blockers"
                    className="mb-5 p-3 bg-warning-soft rounded-md"
                  >
                    <p className="flex items-center gap-2 text-sm font-semibold text-warning-fg">
                      <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                      Referências bloqueadoras
                    </p>
                    <p className="text-xs text-ink-soft mt-1 mb-2">
                      Estas referências impedem a exclusão direta. Você pode
                      removê-las individualmente abaixo ou simplesmente excluir
                      o produto — a exclusão remove todas elas de uma vez, com o
                      impacto informado na confirmação.
                    </p>
                    <ul className="space-y-2">
                      {activeBlockers.map((kind) => (
                        <li
                          key={kind}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="text-sm text-ink-soft">
                            {REFERENCE_KIND_LABELS[kind]}
                          </span>
                          <button
                            type="button"
                            data-testid={`product-usage-remove-${kind}`}
                            onClick={() => setConfirmKind(kind)}
                            disabled={busyKind === kind}
                            className="text-sm font-medium text-danger-fg hover:underline disabled:opacity-50"
                          >
                            Remover referência
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Section
                  icon={ShoppingCart}
                  title="Pedidos e vendas"
                  count={snapshot.references.orderItems.length}
                >
                  {snapshot.references.orderItems.length === 0 ? (
                    <EmptyLine>
                      Nenhum item de pedido ou venda usa este produto.
                    </EmptyLine>
                  ) : (
                    <ul className="divide-y divide-line border border-line rounded-md">
                      {snapshot.references.orderItems.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-ink truncate">
                              {orderItemLocationLabel(item)}
                              {item.personName ? ` — ${item.personName}` : ''}
                            </p>
                            <p className="text-xs text-ink-faint">
                              {item.quantity} un. • {orderItemValueLabel(item)}
                            </p>
                          </div>
                          <OpenButton
                            label="Abrir"
                            onClick={() =>
                              go(
                                item.orderType === 'VENDA'
                                  ? `/sales?editSale=${item.orderId}`
                                  : `/orders?editOrder=${item.orderId}`,
                              )
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-ink-faint mt-1">
                    Ao excluir o produto, estes itens serão removidos dos
                    pedidos/vendas e o total — junto da transação financeira
                    vinculada — será recalculado. O impacto em R$ aparece na
                    confirmação da exclusão.
                  </p>
                </Section>

                <Section icon={Warehouse} title="Estoque atual">
                  {!snapshot.references.inventory ? (
                    <EmptyLine>
                      Nenhum registro de estoque para este produto.
                    </EmptyLine>
                  ) : (
                    <div className="flex items-center justify-between gap-3 px-3 py-2 border border-line rounded-md">
                      <p className="text-sm text-ink">
                        Quantidade em estoque:{' '}
                        <span className="font-semibold">
                          {snapshot.references.inventory.quantity}
                        </span>
                      </p>
                      <OpenButton
                        label="Abrir estoque"
                        onClick={() => go('/stock')}
                      />
                    </div>
                  )}
                </Section>

                <Section
                  icon={ArrowLeftRight}
                  title="Movimentações de estoque"
                  count={snapshot.references.stockMovements.length}
                >
                  {snapshot.references.stockMovements.length === 0 ? (
                    <EmptyLine>
                      Nenhuma movimentação de estoque registrada.
                    </EmptyLine>
                  ) : (
                    <ul className="divide-y divide-line border border-line rounded-md max-h-48 overflow-y-auto">
                      {snapshot.references.stockMovements.map((movement) => (
                        <li
                          key={movement.id}
                          className="flex items-center justify-between gap-3 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-ink">
                              {movement.type} • {movement.quantity} un.
                            </p>
                            <p className="text-xs text-ink-faint truncate">
                              {movement.reason || 'Sem motivo'}
                              {movement.orderId ? ' • vinculada a pedido' : ''}
                            </p>
                          </div>
                          <span className="text-xs text-ink-faint shrink-0">
                            {formatDate(
                              movement.effectiveDate || movement.createdAt,
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Section
                  icon={ArrowLeftRight}
                  title="Trocas de estoque"
                  count={snapshot.references.stockExchangeLines.length}
                >
                  {snapshot.references.stockExchangeLines.length === 0 ? (
                    <EmptyLine>Nenhuma troca de estoque.</EmptyLine>
                  ) : (
                    <ul className="divide-y divide-line border border-line rounded-md">
                      {snapshot.references.stockExchangeLines.map((line) => (
                        <li
                          key={line.id}
                          className="flex items-center justify-between gap-3 px-3 py-2"
                        >
                          <p className="text-sm text-ink">
                            {line.direction === 'OUT' ? 'Saída' : 'Entrada'} •{' '}
                            {line.quantity} un.
                            {line.personName ? ` — ${line.personName}` : ''}
                          </p>
                          <span className="text-xs text-ink-faint">
                            {formatDate(line.effectiveDate)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                {(snapshot.references.kitComponents.length > 0 ||
                  snapshot.references.kitComposition.length > 0) && (
                  <Section icon={Boxes} title="Kits">
                    {snapshot.references.kitComponents.length > 0 && (
                      <ul className="divide-y divide-line border border-line rounded-md mb-2">
                        {snapshot.references.kitComponents.map((kit) => (
                          <li
                            key={kit.id}
                            className="flex items-center justify-between gap-3 px-3 py-2"
                          >
                            <p className="text-sm text-ink">
                              Componente de{' '}
                              <span className="font-semibold">
                                {kit.kitName}
                              </span>{' '}
                              ({kit.kitCode}) • {kit.quantity} un.
                            </p>
                            <OpenButton
                              label="Abrir kit"
                              onClick={() =>
                                go(`/products?edit=${kit.kitProductId}`)
                              }
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                    {snapshot.references.kitComposition.length > 0 && (
                      <ul className="divide-y divide-line border border-line rounded-md">
                        {snapshot.references.kitComposition.map((component) => (
                          <li key={component.id} className="px-3 py-2">
                            <p className="text-sm text-ink-soft">
                              Este kit contém {component.componentName} (
                              {component.componentCode}) • {component.quantity}{' '}
                              un.
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                )}
              </>
            )}

            <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-line">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
              >
                Fechar
              </button>
              <button
                type="button"
                data-testid="product-usage-delete"
                onClick={() => setConfirmDelete(true)}
                title="Excluir produto definitivamente"
                className="inline-flex items-center gap-2 px-4 py-2 bg-danger-soft text-danger-fg font-medium rounded-md transition-colors hover:bg-danger-soft"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Excluir produto
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmKind)}
        title="Remover referência"
        message={referenceImpactMessage(confirmKind, snapshot)}
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        loading={busyKind === confirmKind}
        onConfirm={confirmRemoveReference}
        onCancel={() => setConfirmKind(null)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir produto definitivamente"
        message={hardDeleteImpactMessage(snapshot)}
        confirmLabel="Excluir definitivamente"
        cancelLabel="Cancelar"
        loading={deleting}
        onConfirm={confirmHardDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
};

export default ProductUsageModal;
