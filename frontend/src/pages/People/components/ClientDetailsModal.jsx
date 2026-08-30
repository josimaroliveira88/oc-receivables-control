import React, { useEffect, useState } from 'react';
import { formatBRL, fromCents } from '../../../utils/money';
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

const ClientDetailsModal = ({ person, onClose }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!person) return undefined;
    let active = true;
    setLoading(true);
    setError('');
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
            <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3">
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
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
