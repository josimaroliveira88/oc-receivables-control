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
        className="mb-4 p-3 bg-danger-soft rounded-md"
      >
        <p className="text-sm text-danger-fg">{error}</p>
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
        className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
      >
        Fechar
      </button>
      <button
        type="submit"
        className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
      >
        Salvar
      </button>
    </div>
  </form>
);

export default PersonForm;
