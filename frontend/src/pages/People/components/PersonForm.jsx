import React from 'react';
import PersonFormFields from './PersonFormFields';

const PersonForm = ({
  values,
  onChange,
  onSubmit,
  onClose,
  error,
  showSelfCheckbox = true,
}) => (
  <form onSubmit={onSubmit} className="px-6 py-4">
    {error && (
      <div
        data-testid="person-form-error"
        className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md"
      >
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    )}
    <PersonFormFields
      values={values}
      onChange={onChange}
      showSelfCheckbox={showSelfCheckbox}
    />
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

export default PersonForm;
