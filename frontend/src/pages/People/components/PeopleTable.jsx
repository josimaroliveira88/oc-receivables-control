import React from 'react';
import { Pencil, Trash, Info } from 'lucide-react';
import { SiWhatsapp, SiInstagram } from 'react-icons/si';
import { maskWhatsApp, whatsAppLink } from '../../../utils/whatsapp';
import { instagramHref, CLASSIFICATION_OPTIONS } from '../utils/peopleHelpers';
import BoolBadge from './BoolBadge';
import ActionMenu from '../../../components/ActionMenu';
import SearchInput from '../../../components/SearchInput';
import SortableHeader from '../../../components/SortableHeader';

const birthMonthOf = (birthday) => {
  if (!birthday) return null;
  const match = birthday.match(/^\d{2}\/(\d{2})$/);
  return match ? parseInt(match[1], 10) : null;
};

const PeopleTable = ({
  people,
  totalCount,
  hasActiveFilters,
  search,
  classification,
  sortBy,
  sortDir,
  onSearchChange,
  onClassificationChange,
  onSort,
  onDetails,
  onEdit,
  onDelete,
}) => {
  const currentMonth = new Date().getMonth() + 1;

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Buscar por nome, WhatsApp ou Observação..."
          ariaLabel="Buscar clientes"
        />
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          <span className="sr-only">Classificação</span>
          <select
            value={classification}
            onChange={(e) => onClassificationChange(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            aria-label="Classificação"
          >
            {CLASSIFICATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {totalCount > 0 && (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {totalCount === 1 ? '1 cliente' : `${totalCount} clientes`}
        </p>
      )}

      {people.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            {hasActiveFilters
              ? 'Nenhum cliente encontrado para os filtros aplicados.'
              : 'Nenhum cliente cadastrado'}
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <table className="w-full text-sm text-left block lg:table lg:table-fixed">
            <thead className="hidden lg:table-header-group bg-gray-50 dark:bg-gray-700">
              <tr>
                <SortableHeader
                  label="Nome"
                  field="name"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[15%]"
                  testIdPrefix="people"
                />
                <SortableHeader
                  label="Grupos em Comum"
                  field="commonGroups"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[17%]"
                />
                <SortableHeader
                  label="WhatsApp"
                  field="whatsapp"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[7%]"
                />
                <SortableHeader
                  label="Instagram"
                  field="instagram"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[7%]"
                />
                <th
                  scope="col"
                  className="w-[9%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  Aniversário
                </th>
                <th
                  scope="col"
                  className="w-[22%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  Observação
                </th>
                <SortableHeader
                  label="VIP"
                  field="isVip"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[7%]"
                />
                <SortableHeader
                  label="Membro doTERRA"
                  field="isDoterraMember"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  width="w-[9%]"
                />
                <th
                  scope="col"
                  className="w-[7%] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="block lg:table-row-group bg-white dark:bg-gray-800 lg:divide-y divide-gray-200 dark:divide-gray-700">
              {people.map((person) => {
                const waLink = whatsAppLink(person.whatsapp);
                const isBirthdayMonth =
                  currentMonth === birthMonthOf(person.birthday);
                const rowClasses = isBirthdayMonth
                  ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700';
                return (
                  <tr
                    key={person.id}
                    className={`block lg:table-row border border-gray-200 dark:border-gray-700 lg:border-0 rounded-lg lg:rounded-none shadow-sm lg:shadow-none mb-3 lg:mb-0 transition-colors ${rowClasses}`}
                  >
                    <td
                      data-label="Nome"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 break-words text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      {person.name}
                    </td>
                    <td
                      data-label="Grupos em Comum"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 break-words text-sm text-gray-500 dark:text-gray-400 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      {person.commonGroups || '-'}
                    </td>
                    <td
                      data-label="WhatsApp"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      {person.whatsapp ? (
                        waLink ? (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={maskWhatsApp(person.whatsapp)}
                            aria-label={`Abrir WhatsApp ${maskWhatsApp(person.whatsapp)}`}
                            className="inline-flex text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                          >
                            <SiWhatsapp size={20} />
                          </a>
                        ) : (
                          <span
                            title={person.whatsapp}
                            aria-label={`WhatsApp: ${person.whatsapp}`}
                            className="inline-flex text-gray-400 dark:text-gray-500"
                          >
                            <SiWhatsapp size={20} />
                          </span>
                        )
                      ) : (
                        '-'
                      )}
                    </td>
                    <td
                      data-label="Instagram"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      {person.instagram ? (
                        <a
                          href={instagramHref(person.instagram)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={person.instagram}
                          aria-label={`Abrir Instagram ${person.instagram}`}
                          className="inline-flex text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                        >
                          <SiInstagram size={20} />
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td
                      data-label="Aniversário"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      {person.birthday ? (
                        <span
                          className={
                            isBirthdayMonth
                              ? 'font-medium text-amber-700 dark:text-amber-400'
                              : ''
                          }
                        >
                          {person.birthday}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td
                      data-label="Observação"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 text-sm text-gray-500 dark:text-gray-400 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      {person.observacao ? (
                        <span
                          title={person.observacao}
                          className="block truncate"
                        >
                          {person.observacao}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td
                      data-label="VIP"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      <BoolBadge value={person.isVip} />
                    </td>
                    <td
                      data-label="Membro doTERRA"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                    >
                      <BoolBadge value={person.isDoterraMember} />
                    </td>
                    <td
                      data-label="Ações"
                      className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 text-left lg:text-right text-sm font-medium before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden relative"
                    >
                      <div className="flex justify-end">
                        <ActionMenu
                          actions={[
                            {
                              label: 'Detalhes',
                              icon: Info,
                              onClick: () => onDetails(person),
                            },
                            {
                              label: 'Editar',
                              icon: Pencil,
                              onClick: () => onEdit(person),
                            },
                            {
                              label: 'Excluir',
                              icon: Trash,
                              onClick: () => onDelete(person.id),
                              variant: 'danger',
                            },
                          ]}
                          ariaLabel="Ações do cliente"
                          testIdPrefix={`client-actions-${person.id}`}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PeopleTable;
