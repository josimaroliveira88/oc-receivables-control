import React from 'react';
import { inputClass } from '../utils/productHelpers';

const ProductForm = ({
  values,
  isEdit,
  status,
  onChangeField,
  onChangeStatus,
  onSubmit,
  onClose,
}) => {
  return (
    <form onSubmit={onSubmit} className="px-6 py-4">
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
