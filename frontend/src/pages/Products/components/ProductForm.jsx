import React from 'react';
import { Plus } from 'lucide-react';
import { inputClass, emptyComponent } from '../utils/productHelpers';
import CurrencyInput from '../../../components/CurrencyInput';
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
          className="mb-4 p-3 bg-danger-soft rounded-md"
        >
          <p className="text-sm text-danger-fg">{error}</p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <div className="mb-4">
          <label className="block text-sm font-medium text-ink-soft mb-1">
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
              <p className="mt-1 text-xs text-ink-faint">
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
          <label className="block text-sm font-medium text-ink-soft mb-1">
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
          <label className="block text-sm font-medium text-ink-soft mb-1">
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
          <span className="block text-sm font-medium text-ink-soft mb-1">
            Tipo de produto
          </span>
          <div className="flex items-center gap-4 pt-1">
            <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="radio"
                name="product-type"
                value="SIMPLES"
                checked={(values.productType || 'SIMPLES') === 'SIMPLES'}
                onChange={() => handleTypeChange('SIMPLES')}
                data-testid="product-type-radio-SIMPLES"
                className="text-accent focus:ring-accent"
              />
              Simples
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="radio"
                name="product-type"
                value="KIT"
                checked={(values.productType || 'SIMPLES') === 'KIT'}
                onChange={() => handleTypeChange('KIT')}
                data-testid="product-type-radio-KIT"
                className="text-accent focus:ring-accent"
              />
              Kit
            </label>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-ink-soft mb-1">
            Preço Regular (R$)
          </label>
          <CurrencyInput
            value={values.regularPrice}
            onChange={(e) => onChangeField('regularPrice', e.target.value)}
            required
            className="disabled:bg-base disabled:text-ink-faint disabled:cursor-not-allowed"
            placeholder="Digite o preço regular"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-ink-soft mb-1">
            Preço de Membro (R$)
          </label>
          <CurrencyInput
            value={values.memberPrice}
            onChange={(e) => onChangeField('memberPrice', e.target.value)}
            required
            className="disabled:bg-base disabled:text-ink-faint disabled:cursor-not-allowed"
            placeholder="Digite o preço de membro"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-ink-soft mb-1">
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
        {isEdit && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-ink-soft mb-1">
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
      </div>
      {isKit && (
        <div className="mb-4 p-3 border border-line rounded-md">
          <label className="block text-sm font-medium text-ink-soft mb-1">
            Componentes do kit
          </label>
          <p className="text-xs text-ink-faint mb-3">
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
                className="w-20 px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors text-sm"
              />
              <button
                type="button"
                onClick={() => removeComponent(index)}
                className="px-3 py-2 text-xs font-medium text-danger-fg bg-danger-soft rounded-md transition-colors whitespace-nowrap"
              >
                Remover
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addComponent}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-accent-on-soft hover:bg-accent-soft rounded-md transition-colors"
          >
            <Plus size={16} /> Adicionar componente
          </button>
        </div>
      )}
      <div className="mb-4">
        <label className="block text-sm font-medium text-ink-soft mb-1">
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
      <div className="flex items-center justify-end space-x-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
        >
          Fechar
        </button>
        {isEdit && onSaveAndEditNext && (
          <button
            type="button"
            onClick={onSaveAndEditNext}
            disabled={!hasNextProduct}
            className="px-4 py-2 text-sm font-medium text-accent-on-soft bg-accent-soft hover:bg-accent-soft disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            Salvar e editar próximo
          </button>
        )}
        <button
          type="submit"
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
        >
          Salvar
        </button>
      </div>
    </form>
  );
};

export default ProductForm;
