import React from 'react';
import { Pencil, Trash } from 'lucide-react';
import { maskWhatsApp, whatsAppLink } from '../../../utils/whatsapp';
import { instagramHref } from '../utils/peopleHelpers';
import BoolBadge from './BoolBadge';
import ActionMenu from '../../../components/ActionMenu';

const PeopleTable = ({ people, onEdit, onDelete }) => {
  if (people.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          Nenhum cliente cadastrado
        </p>
      </div>
    );
  }

  return (
    <div>
      <table className="w-full text-sm text-left block lg:table lg:table-fixed">
        <thead className="hidden lg:table-header-group bg-gray-50 dark:bg-gray-700">
          <tr>
            <th
              scope="col"
              className="w-[16%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              Nome
            </th>
            <th
              scope="col"
              className="w-[12%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              Grupos em Comum
            </th>
            <th
              scope="col"
              className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              WhatsApp
            </th>
            <th
              scope="col"
              className="w-[10%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              Instagram
            </th>
            <th
              scope="col"
              className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              Endereço
            </th>
            <th
              scope="col"
              className="w-[6%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              VIP
            </th>
            <th
              scope="col"
              className="w-[8%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              Membro doTERRA
            </th>
            <th
              scope="col"
              className="w-[18%] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="block lg:table-row-group bg-white dark:bg-gray-800 lg:divide-y divide-gray-200 dark:divide-gray-700">
          {people.map((person) => {
            const waLink = whatsAppLink(person.whatsapp);
            return (
              <tr
                key={person.id}
                className="block lg:table-row border border-gray-200 dark:border-gray-700 lg:border-0 rounded-lg lg:rounded-none shadow-sm lg:shadow-none mb-3 lg:mb-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
                  {waLink ? (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                      title="Abrir conversa no WhatsApp"
                    >
                      {maskWhatsApp(person.whatsapp)}
                    </a>
                  ) : (
                    person.whatsapp || '-'
                  )}
                </td>
                <td
                  data-label="Instagram"
                  className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 break-words text-sm text-gray-500 dark:text-gray-400 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                >
                  {person.instagram ? (
                    <a
                      href={instagramHref(person.instagram)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                      title={person.instagram}
                    >
                      {person.instagram}
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
                <td
                  data-label="Endereço"
                  className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 break-words text-sm text-gray-500 dark:text-gray-400 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden"
                >
                  {person.address || '-'}
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
  );
};

export default PeopleTable;
