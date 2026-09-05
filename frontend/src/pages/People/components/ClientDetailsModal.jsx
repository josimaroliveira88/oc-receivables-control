import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { formatBRL, fromCents } from '../../../utils/money';
import { formatDateBR } from '../../../utils/dates';
import { maskWhatsApp, whatsAppLink } from '../../../utils/whatsapp';
import { instagramHref } from '../utils/peopleHelpers';
import { SiWhatsapp, SiInstagram } from 'react-icons/si';
import Modal from '../../../components/Modal';
import BoolBadge from './BoolBadge';
import api from '../../../services/api';

const DetailItem = ({ label, children }) => (
  <div>
    <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
    <dd className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
      {children}
    </dd>
  </div>
);

// Only non-empty groups are rendered: a client present in just one order type
// never sees a header for the empty one.
const PURCHASE_GROUPS = [
  { type: 'COMPRA', label: 'Compras', testId: 'client-purchases-compra' },
  { type: 'VENDA', label: 'Vendas', testId: 'client-purchases-venda' },
];

const PurchaseTable = ({ label, testId, rows, onProductClick }) => (
  <div className="mb-3 last:mb-0">
    <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {label}
    </h4>
    <div
      className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700"
      data-testid={testId}
    >
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 dark:bg-gray-900/50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              Data
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              Produto
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              Qtd
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {rows.map((row, index) => (
            <tr key={`${row.orderId}-${index}`}>
              <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                {formatDateBR(row.orderDate)}
              </td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  data-testid="client-purchase-product"
                  onClick={() => onProductClick(row)}
                  className="text-left text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 hover:underline transition-colors"
                >
                  {row.name || '—'}
                </button>
              </td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                {row.quantity}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-right text-gray-900 dark:text-gray-100">
                {formatBRL(fromCents(row.totalCents))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const ClientDetailsModal = ({ person, onClose }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPurchases, setShowPurchases] = useState(false);
  const [purchases, setPurchases] = useState(null);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchasesError, setPurchasesError] = useState('');
  const purchasesPersonIdRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!person) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    setShowPurchases(false);
    setPurchases(null);
    setPurchasesError('');
    purchasesPersonIdRef.current = null;
    api
      .get(`/people/${person.id}/summary`)
      .then((res) => {
        if (!active) return;
        setSummary(res.data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError('Erro ao carregar o resumo financeiro.');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [person]);

  if (!person) return null;

  const waLink = whatsAppLink(person.whatsapp);

  // Expanding fetches the purchases once per person; collapsing never
  // discards the cache, so re-expanding does not refetch.
  const togglePurchases = () => {
    const next = !showPurchases;
    setShowPurchases(next);
    if (!next) return;
    const personId = person.id;
    if (purchasesPersonIdRef.current === personId) return;
    purchasesPersonIdRef.current = personId;
    setPurchasesLoading(true);
    setPurchasesError('');
    api
      .get(`/people/${personId}/purchases`)
      .then((res) => {
        if (purchasesPersonIdRef.current !== personId) return;
        setPurchases(res.data);
        setPurchasesLoading(false);
      })
      .catch(() => {
        if (purchasesPersonIdRef.current !== personId) return;
        setPurchasesError('Erro ao carregar os produtos comprados.');
        setPurchasesLoading(false);
      });
  };

  // Purchases link back to their source: orders go to the details view,
  // sales go to the sale form (both pages support the deep-link params).
  const goToProduct = (row) => {
    if (row.orderType === 'VENDA') {
      navigate(`/sales?editSale=${row.orderId}`);
    } else {
      navigate(`/orders?detailsOrder=${row.orderId}`);
    }
  };

  return (
    <Modal
      title="Detalhes do Cliente"
      onClose={onClose}
      maxWidth="max-w-3xl"
      testId="client-details-modal"
      closeAriaLabel="Fechar detalhes do cliente"
    >
      {(requestClose) => (
        <div className="px-6 py-4">
          <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <DetailItem label="Nome">{person.name}</DetailItem>
              <DetailItem label="Grupos em Comum">
                {person.commonGroups || '—'}
              </DetailItem>
              <DetailItem label="Aniversário">
                {person.birthday || '—'}
              </DetailItem>
              <DetailItem label="Endereço">{person.address || '—'}</DetailItem>
              <DetailItem label="WhatsApp">
                {person.whatsapp ? (
                  waLink ? (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                    >
                      <SiWhatsapp size={16} />
                      {maskWhatsApp(person.whatsapp)}
                    </a>
                  ) : (
                    person.whatsapp
                  )
                ) : (
                  '—'
                )}
              </DetailItem>
              <DetailItem label="Instagram">
                {person.instagram ? (
                  <a
                    href={instagramHref(person.instagram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                  >
                    <SiInstagram size={16} />
                    {person.instagram}
                  </a>
                ) : (
                  '—'
                )}
              </DetailItem>
              <DetailItem label="VIP">
                <BoolBadge value={person.isVip} />
              </DetailItem>
              <DetailItem label="Membro doTERRA">
                <BoolBadge value={person.isDoterraMember} />
              </DetailItem>
              <DetailItem label="Equipe">
                <BoolBadge value={person.isTeamMember} />
              </DetailItem>
              <div className="sm:col-span-2">
                <DetailItem label="Observação">
                  {person.observacao || '—'}
                </DetailItem>
              </div>
            </dl>
          </div>

          <h3 className="mt-5 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Resumo financeiro
          </h3>
          {loading ? (
            <div className="flex items-center justify-center py-6 text-sm text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600 mr-2" />
              Carregando resumo...
            </div>
          ) : error ? (
            <p className="py-4 text-center text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : (
            <div
              role="button"
              tabIndex={0}
              aria-expanded={showPurchases}
              data-testid="client-summary-toggle"
              onClick={togglePurchases}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  togglePurchases();
                }
              }}
              className="relative rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={`absolute right-3 top-3 text-gray-400 dark:text-gray-500 transition-transform ${
                  showPurchases ? 'rotate-180' : ''
                }`}
              />
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 pr-5">
                <DetailItem label="Pedidos">
                  <span data-testid="client-summary-orders">
                    {summary.ordersCount}
                  </span>
                </DetailItem>
                <DetailItem label="Total dos itens">
                  <span data-testid="client-summary-items">
                    {formatBRL(fromCents(summary.totalItemsCents))}
                  </span>
                </DetailItem>
                <DetailItem label="Total pago">
                  <span
                    data-testid="client-summary-paid"
                    className="text-emerald-700 dark:text-emerald-400"
                  >
                    {formatBRL(fromCents(summary.totalPaidCents))}
                  </span>
                </DetailItem>
                <DetailItem label="Total em aberto">
                  <span
                    data-testid="client-summary-open"
                    className={
                      summary.totalOpenCents > 0
                        ? 'text-primary-700 dark:text-primary-400'
                        : ''
                    }
                  >
                    {formatBRL(fromCents(summary.totalOpenCents))}
                  </span>
                </DetailItem>
              </dl>
            </div>
          )}

          {showPurchases && (
            <div className="mt-3" data-testid="client-purchases">
              {purchasesLoading ? (
                <div className="flex items-center justify-center py-4 text-sm text-gray-500 dark:text-gray-400">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600 mr-2" />
                  Carregando produtos...
                </div>
              ) : purchasesError ? (
                <p className="py-3 text-center text-sm text-red-600 dark:text-red-400">
                  {purchasesError}
                </p>
              ) : !purchases || purchases.length === 0 ? (
                <p className="py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                  Nenhum produto comprado.
                </p>
              ) : (
                PURCHASE_GROUPS.map(({ type, label, testId }) => {
                  const rows = purchases.filter(
                    (row) => row.orderType === type,
                  );
                  if (rows.length === 0) return null;
                  return (
                    <PurchaseTable
                      key={type}
                      label={label}
                      testId={testId}
                      rows={rows}
                      onProductClick={goToProduct}
                    />
                  );
                })
              )}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={requestClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ClientDetailsModal;
