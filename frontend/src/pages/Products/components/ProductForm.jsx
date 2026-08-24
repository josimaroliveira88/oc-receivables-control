import React from 'react';
import { Plus } from 'lucide-react';
import { inputClass, emptyComponent } from '../utils/productHelpers';
import ProductCombobox from '../../../components/ProductCombobox';

const ProductForm = ({
  values,
  isEdit,
  status,
  error,
  products,
  onChangeField,
  onChangeStatus,
  onSubmit,
  onSaveAndEditNext,
  hasNextProduct,
  onClose,
}) => {
  const simpleProducts = (products || []).filter(
    (p) => !p.productType || p.productType === 'SIMPLES',
  );
  const components = values.components || [];
  const isKit = values.productType === 'KIT';

  const addComponent = () => {
    onChangeField('components', [...components, emptyComponent()]);
  };

  const removeComponent = (index) => {
    onChangeField(
      'components',
      components.filter((_, i) => i !== index),
    );
  };

  const updateComponent = (index, field, value) => {
    onChangeField(
      'components',
      components.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    );
  };

  const handleTypeChange = (value) => {
    onChangeField('productType', value);
    if (value === 'KIT' && components.length === 0) {
      onChangeField('components', [emptyComponent()]);
    } else if (value === 'SIMPLES') {
      onChangeField('components', []);
    }
  };

  return (
    <form onSubmit={onSubmit} className="px-6 py-4">
      {error && (
        <div
          data-testid="product-form-error"
          className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md"
        >
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Código
        </label>
        {isEdit ? (
          <>
            <input
              type="text"
              value={values.code}
              disabled
              title="O código não pode ser alterado"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              O código não pode ser alterado.
            </p>
          </>
        ) : (
          <input
            type="text"
            value={values.code}
            onChange={(e) => onChangeField('code', e.target.value)}
            required
            className={inputClass}
            placeholder="Digite o código"
          />
        )}
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Produto
        </label>
        <input
          type="text"
          value={values.name}
          onChange={(e) => onChangeField('name', e.target.value)}
          required
          className={inputClass}
          placeholder={isEdit ? undefined : 'Digite o nome do produto'}
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Tamanho
        </label>
        <input
          type="text"
          value={values.size}
          onChange={(e) => onChangeField('size', e.target.value)}
          required
          className={inputClass}
          placeholder={isEdit ? undefined : 'Digite o tamanho'}
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Tipo de produto
        </label>
        <select
          data-testid="product-type-select"
          value={values.productType || 'SIMPLES'}
          onChange={(e) => handleTypeChange(e.target.value)}
          className={inputClass}
        >
          <option value="SIMPLES">Simples</option>
          <option value="KIT">Kit</option>
        </select>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Preço Regular (R$)
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={values.regularPrice}
          onChange={(e) => onChangeField('regularPrice', e.target.value)}
          required
          className={inputClass}
          placeholder="Digite o preço regular"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Preço de Membro (R$)
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={values.memberPrice}
          onChange={(e) => onChangeField('memberPrice', e.target.value)}
          required
          className={inputClass}
          placeholder="Digite o preço de membro"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          PV
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={values.pv}
          onChange={(e) => onChangeField('pv', e.target.value)}
          required
          className={inputClass}
          placeholder="Digite o PV"
        />
      </div>
      {isKit && (
        <div className="mb-4 p-3 border border-primary-200 dark:border-primary-800 rounded-md">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Componentes do kit
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Vincule ao menos um produto simples ao kit.
          </p>
          {components.map((comp, index) => (
            <div
              key={comp.id}
              data-testid={`kit-component-row-${index}`}
              className="flex items-center gap-2 mb-2"
            >
              <div className="flex-1">
                <ProductCombobox
                  products={simpleProducts}
                  value={comp.componentProductId}
                  onChange={(id) =>
                    updateComponent(index, 'componentProductId', id)
                  }
                />
              </div>
              <input
                type="number"
                min="1"
                step="1"
                aria-label="Quantidade no kit"
                data-testid={`kit-component-quantity-${index}`}
                value={comp.quantity}
                onChange={(e) =>
                  updateComponent(index, 'quantity', e.target.value)
                }
                className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
              />
              <button
                type="button"
                onClick={() => removeComponent(index)}
                className="px-3 py-2 text-xs font-medium text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md transition-colors whitespace-nowrap"
              >
                Remover
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addComponent}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-md transition-colors"
          >
            <Plus size={16} /> Adicionar componente
          </button>
        </div>
      )}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          URL do produto no site da dōTERRA
        </label>
        <input
          type="url"
          value={values.doterraUrl}
          onChange={(e) => onChangeField('doterraUrl', e.target.value)}
          className={inputClass}
          placeholder="https://www.doterra.com/BR/pt_BR/..."
        />
      </div>
      {isEdit && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => onChangeStatus(e.target.value)}
            data-testid="edit-status-select"
            className={inputClass}
          >
            <option value="ATIVO">Ativo</option>
            <option value="INDISPONIVEL">Indisponível</option>
            <option value="INATIVO">Inativo</option>
          </select>
        </div>
      )}
      <div className="flex items-center justify-end space-x-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
        >
          Fechar
        </button>
        {isEdit && onSaveAndEditNext && (
          <button
            type="button"
            onClick={onSaveAndEditNext}
            disabled={!hasNextProduct}
            className="px-4 py-2 text-sm font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            Salvar e editar próximo
          </button>
        )}
        <button
          type="submit"
          className="px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        >
          Salvar
        </button>
      </div>
    </form>
  );
};

export default ProductForm;
