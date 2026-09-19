import React from 'react';
import Modal from '../../../components/Modal';
import { CATEGORY_TYPE_OPTIONS } from '../utils/financeHelpers';
import { CATEGORY_BADGE_CLASSES } from '../../../utils/badgeStyles';

const inputClass =
  'w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors disabled:bg-base disabled:text-ink-faint disabled:cursor-not-allowed';

const secondaryButtonClass =
  'px-3 py-1.5 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors';

const CategoryRow = ({ category, onEdit, onToggle }) => (
  <li
    data-testid={`category-row-${category.id}`}
    className="flex items-center justify-between gap-2 px-3 py-2 border-b border-line last:border-b-0"
  >
    <div className="flex items-center gap-2 min-w-0">
      <span
        className={`text-sm truncate ${
          category.active ? 'text-ink' : 'text-ink-faint line-through'
        }`}
      >
        {category.name}
      </span>
      {category.isDefault && (
        <span
          data-testid={`category-default-${category.id}`}
          className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${CATEGORY_BADGE_CLASSES.default}`}
        >
          Padrão
        </span>
      )}
      {!category.active && (
        <span
          data-testid={`category-inactive-${category.id}`}
          className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${CATEGORY_BADGE_CLASSES.inactive}`}
        >
          Inativa
        </span>
      )}
    </div>
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        data-testid={`category-edit-${category.id}`}
        onClick={() => onEdit(category)}
        aria-label={`Editar ${category.name}`}
        className={secondaryButtonClass}
      >
        Editar
      </button>
      <button
        type="button"
        data-testid={`category-toggle-${category.id}`}
        onClick={() => onToggle(category)}
        aria-label={`${category.active ? 'Desativar' : 'Reativar'} ${
          category.name
        }`}
        className={secondaryButtonClass}
      >
        {category.active ? 'Desativar' : 'Reativar'}
      </button>
    </div>
  </li>
);

const CategorySection = ({ type, title, categories, onEdit, onToggle }) => (
  <section
    data-testid={`category-section-${type}`}
    className="rounded-md border border-line overflow-hidden"
  >
    <h4 className="px-3 py-2 bg-base text-sm font-medium text-ink-soft border-b border-line">
      {title}
    </h4>
    {categories.length === 0 ? (
      <p className="px-3 py-3 text-sm text-ink-faint">Nenhuma categoria</p>
    ) : (
      <ul>
        {categories.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            onEdit={onEdit}
            onToggle={onToggle}
          />
        ))}
      </ul>
    )}
  </section>
);

const FinancialCategoryModal = ({
  isOpen = true,
  onClose,
  categories = [],
  loading = false,
  loadError = '',
  form,
  formError = '',
  submitting = false,
  isDirty = false,
  onChangeField,
  onSubmit,
  onStartEdit,
  onCancelEdit,
  onToggleActive,
}) => {
  const isEditing = Boolean(form.id);
  const income = categories.filter((category) => category.type === 'RECEITA');
  const expenses = categories.filter((category) => category.type === 'DESPESA');

  return (
    <Modal
      isOpen={isOpen}
      title="Categorias financeiras"
      onClose={onClose}
      isDirty={isDirty}
      submitting={submitting}
      testId="finance-category-modal"
      maxWidth="max-w-2xl"
      closeAriaLabel="Fechar"
    >
      {(requestClose) => (
        <div className="px-6 py-4">
          {loadError && (
            <div
              data-testid="category-load-error"
              className="mb-4 p-3 bg-danger-soft rounded-md"
            >
              <p className="text-sm text-danger-fg">{loadError}</p>
            </div>
          )}

          <form
            onSubmit={onSubmit}
            className="mb-6 rounded-md border border-line p-4"
          >
            <h4 className="text-sm font-medium text-ink-soft mb-3">
              {isEditing ? 'Editar categoria' : 'Nova categoria'}
            </h4>

            {formError && (
              <div
                data-testid="category-form-error"
                className="mb-3 p-3 bg-danger-soft rounded-md"
              >
                <p className="text-sm text-danger-fg">{formError}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
              <div>
                <label
                  htmlFor="categoryType"
                  className="block text-sm font-medium text-ink-soft mb-1"
                >
                  Tipo
                </label>
                <select
                  id="categoryType"
                  value={form.type}
                  disabled={isEditing}
                  onChange={(e) => onChangeField('type', e.target.value)}
                  className={inputClass}
                >
                  {CATEGORY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="categoryName"
                  className="block text-sm font-medium text-ink-soft mb-1"
                >
                  Nome
                </label>
                <input
                  id="categoryName"
                  type="text"
                  value={form.name}
                  onChange={(e) => onChangeField('name', e.target.value)}
                  placeholder="Nome da categoria"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              {isEditing && (
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting
                  ? 'Salvando...'
                  : isEditing
                    ? 'Salvar'
                    : 'Adicionar'}
              </button>
            </div>
          </form>

          {loading ? (
            <p className="text-sm text-ink-faint">Carregando categorias...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CategorySection
                type="RECEITA"
                title="Receitas"
                categories={income}
                onEdit={onStartEdit}
                onToggle={onToggleActive}
              />
              <CategorySection
                type="DESPESA"
                title="Despesas"
                categories={expenses}
                onEdit={onStartEdit}
                onToggle={onToggleActive}
              />
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={requestClose}
              className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
            >
              Concluído
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default FinancialCategoryModal;
