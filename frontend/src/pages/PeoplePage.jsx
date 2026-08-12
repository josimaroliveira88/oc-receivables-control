import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import api from '../services/api';
import {
  onlyDigits,
  isDigitsOnly,
  isWhatsAppOutOfPattern,
  maskWhatsApp,
  whatsAppLink,
} from '../utils/whatsapp';

const fieldClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors';

const inputLabelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const instagramHref = (value) =>
  value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`;

const BoolBadge = ({ value }) => (
  <span
    className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
      value
        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
    }`}
  >
    {value ? 'Sim' : 'Não'}
  </span>
);

const SimNaoSelect = ({ value, onChange, id }) => (
  <select
    id={id}
    value={value ? 'true' : 'false'}
    onChange={(e) => onChange(e.target.value === 'true')}
    className={fieldClass}
  >
    <option value="false">Não</option>
    <option value="true">Sim</option>
  </select>
);

const WhatsappField = ({ value, onChange }) => {
  const display = isDigitsOnly(value) ? maskWhatsApp(value) : value || '';
  const outOfPattern = isWhatsAppOutOfPattern(value);

  return (
    <div className="mb-4">
      <label className={`${inputLabelClass}`}>WhatsApp</label>
      <input
        type="tel"
        value={display}
        onChange={(e) => onChange(onlyDigits(e.target.value))}
        className={fieldClass}
        placeholder="+55 (11) 99999-8888"
        inputMode="numeric"
      />
      {outOfPattern && (
        <div className="mt-2 flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Número fora do padrão (código do país + DDD + número). Ex.: +55 (11) 99999-8888. Você pode salvar mesmo assim.
          </p>
        </div>
      )}
    </div>
  );
};

const PersonFormFields = ({ values, onChange }) => {
  return (
    <>
      <div className="mb-4">
        <label className={inputLabelClass}>Nome</label>
        <input
          type="text"
          value={values.name}
          onChange={(e) => onChange('name', e.target.value)}
          required
          className={fieldClass}
          placeholder="Digite o nome"
        />
      </div>

      <div className="mb-4">
        <label className={inputLabelClass}>Grupos em comum</label>
        <input
          type="text"
          value={values.commonGroups}
          onChange={(e) => onChange('commonGroups', e.target.value)}
          maxLength={255}
          className={fieldClass}
          placeholder="Ex.: Grupo do WhatsApp, vizinho, família..."
        />
      </div>

      <WhatsappField value={values.whatsapp} onChange={(v) => onChange('whatsapp', v)} />

      <div className="mb-4">
        <label className={inputLabelClass}>Instagram</label>
        <input
          type="text"
          value={values.instagram}
          onChange={(e) => onChange('instagram', e.target.value)}
          maxLength={255}
          className={fieldClass}
          placeholder="https://instagram.com/usuario"
        />
      </div>

      <div className="mb-4">
        <label className={inputLabelClass}>Endereço</label>
        <input
          type="text"
          value={values.address}
          onChange={(e) => onChange('address', e.target.value)}
          maxLength={500}
          className={fieldClass}
          placeholder="Digite o endereço completo"
        />
      </div>

      <div className="mb-4">
        <label className={inputLabelClass} htmlFor="person-vip">Grupo VIP</label>
        <SimNaoSelect id="person-vip" value={values.isVip} onChange={(v) => onChange('isVip', v)} />
      </div>

      <div className="mb-4">
        <label className={inputLabelClass} htmlFor="person-member">Cadastrado/Membro doTERRA</label>
        <SimNaoSelect id="person-member" value={values.isDoterraMember} onChange={(v) => onChange('isDoterraMember', v)} />
      </div>
    </>
  );
};

const PeoplePage = () => {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPersonId, setEditPersonId] = useState(null);

  const emptyForm = () => ({
    name: '',
    commonGroups: '',
    whatsapp: '55',
    instagram: '',
    address: '',
    isVip: false,
    isDoterraMember: false,
  });

  const [createForm, setCreateForm] = useState(emptyForm());
  const [editForm, setEditForm] = useState(emptyForm());

  const updateField = (form, field) => (value) =>
    form === 'create' ? setCreateForm((f) => ({ ...f, [field]: value })) : setEditForm((f) => ({ ...f, [field]: value }));

  const fetchPeople = async () => {
    try {
      setLoading(true);
      const response = await api.get('/people');
      setPeople(response.data);
    } catch (err) {
      setError('Erro ao carregar clientes. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const buildPayload = (form) => ({
    name: form.name.trim(),
    whatsapp: form.whatsapp.trim() ? form.whatsapp.trim() : null,
    commonGroups: form.commonGroups.trim() || null,
    instagram: form.instagram.trim() || null,
    address: form.address.trim() || null,
    isVip: form.isVip,
    isDoterraMember: form.isDoterraMember,
  });

  const handleCreatePerson = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      setError('Nome é obrigatório');
      return;
    }
    try {
      await api.post('/people', buildPayload(createForm));
      setCreateForm(emptyForm());
      setShowCreateModal(false);
      fetchPeople();
    } catch (err) {
      setError('Erro ao criar cliente. Tente novamente.');
    }
  };

  const handleUpdatePerson = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      setError('Nome é obrigatório');
      return;
    }
    try {
      await api.put(`/people/${editPersonId}`, buildPayload(editForm));
      setEditPersonId(null);
      setEditForm(emptyForm());
      setShowEditModal(false);
      fetchPeople();
    } catch (err) {
      setError('Erro ao atualizar cliente. Tente novamente.');
    }
  };

  const handleDeletePerson = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este cliente?')) {
      return;
    }
    try {
      await api.delete(`/people/${id}`);
      fetchPeople();
    } catch (err) {
      setError('Erro ao excluir cliente. Tente novamente.');
    }
  };

  const openEditModal = (person) => {
    setEditPersonId(person.id);
    setEditForm({
      name: person.name || '',
      commonGroups: person.commonGroups || '',
      whatsapp: person.whatsapp || '',
      instagram: person.instagram || '',
      address: person.address || '',
      isVip: person.isVip || false,
      isDoterraMember: person.isDoterraMember || false,
    });
    setShowEditModal(true);
  };

  useEffect(() => {
    fetchPeople();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-gray-500 dark:text-gray-400">Carregando...</span>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border-t-4 border-primary-600 dark:border-primary-400">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Cadastro de Clientes
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 sm:mt-0 px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Novo
          </button>
        </div>

        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {people.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">Nenhum cliente cadastrado</p>
            </div>
          ) : (
            <div>
              <table className="w-full text-sm text-left block lg:table lg:table-fixed">
                <thead className="hidden lg:table-header-group bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="w-[16%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Nome
                    </th>
                    <th scope="col" className="w-[12%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Grupos em Comum
                    </th>
                    <th scope="col" className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      WhatsApp
                    </th>
                    <th scope="col" className="w-[10%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Instagram
                    </th>
                    <th scope="col" className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Endereço
                    </th>
                    <th scope="col" className="w-[6%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      VIP
                    </th>
                    <th scope="col" className="w-[8%] px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Membro doTERRA
                    </th>
                    <th scope="col" className="w-[18%] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="block lg:table-row-group bg-white dark:bg-gray-800 lg:divide-y divide-gray-200 dark:divide-gray-700">
                  {people.map((person) => {
                    const waLink = whatsAppLink(person.whatsapp);
                    return (
                      <tr key={person.id} className="block lg:table-row border border-gray-200 dark:border-gray-700 lg:border-0 rounded-lg lg:rounded-none shadow-sm lg:shadow-none mb-3 lg:mb-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td data-label="Nome" className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 break-words text-sm text-gray-900 dark:text-gray-100 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden">
                          {person.name}
                        </td>
                        <td data-label="Grupos em Comum" className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 break-words text-sm text-gray-500 dark:text-gray-400 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden">
                          {person.commonGroups || '-'}
                        </td>
                        <td data-label="WhatsApp" className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden">
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
                        <td data-label="Instagram" className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 break-words text-sm text-gray-500 dark:text-gray-400 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden">
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
                        <td data-label="Endereço" className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 break-words text-sm text-gray-500 dark:text-gray-400 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden">
                          {person.address || '-'}
                        </td>
                        <td data-label="VIP" className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden">
                          <BoolBadge value={person.isVip} />
                        </td>
                        <td data-label="Membro doTERRA" className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:whitespace-nowrap text-sm before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden">
                          <BoolBadge value={person.isDoterraMember} />
                        </td>
                        <td data-label="Ações" className="block lg:table-cell px-3 lg:px-6 py-2 lg:py-4 lg:min-w-0 text-left lg:text-right text-sm font-medium before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase lg:before:hidden">
                          <button
                            onClick={() => openEditModal(person)}
                            className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 mr-3 transition-colors"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeletePerson(person.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Novo Cliente</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleCreatePerson} className="px-6 py-4">
              <PersonFormFields values={createForm} onChange={(field, value) => updateField('create', field)(value)} />
              <div className="flex items-center justify-end space-x-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors">
                  Fechar
                </button>
                <button type="submit" className="px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Editar Cliente</h3>
              <button
                onClick={() => { setShowEditModal(false); setEditPersonId(null); setEditForm(emptyForm()); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
              >&times;</button>
            </div>
            <form onSubmit={handleUpdatePerson} className="px-6 py-4">
              <PersonFormFields values={editForm} onChange={(field, value) => updateField('edit', field)(value)} />
              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditPersonId(null); setEditForm(emptyForm()); }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >Fechar</button>
                <button type="submit" className="px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default PeoplePage;
