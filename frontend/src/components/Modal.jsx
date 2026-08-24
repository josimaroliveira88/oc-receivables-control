import React, { useEffect, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

const Modal = ({
  isOpen = true,
  title,
  onClose,
  isDirty = false,
  submitting = false,
  maxWidth = 'max-w-lg',
  testId,
  closeAriaLabel = 'Fechar',
  children,
}) => {
  const [showDiscard, setShowDiscard] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowDiscard(false);
      return undefined;
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !showDiscard) {
        requestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (!isOpen) return null;

  const requestClose = () => {
    if (submitting) return;
    if (isDirty) {
      setShowDiscard(true);
      return;
    }
    onClose();
  };

  const confirmDiscard = () => {
    setShowDiscard(false);
    onClose();
  };

  return (
    <div
      data-testid={testId || 'modal-backdrop'}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          requestClose();
        }
      }}
    >
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <button
            type="button"
            aria-label={closeAriaLabel}
            onClick={requestClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none disabled:opacity-50"
          >
            &times;
          </button>
        </div>
        {typeof children === 'function' ? children(requestClose) : children}
      </div>

      <ConfirmDialog
        open={showDiscard}
        title="Descartar alterações?"
        message="Há alterações não salvas neste formulário. Deseja descartá-las e fechar?"
        confirmLabel="Descartar"
        cancelLabel="Continuar editando"
        onConfirm={confirmDiscard}
        onCancel={() => setShowDiscard(false)}
      />
    </div>
  );
};

export default Modal;
