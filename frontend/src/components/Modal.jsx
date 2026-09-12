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
        className={`bg-surface rounded-lg shadow-xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
      >
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <h3 className="text-lg font-medium text-ink">{title}</h3>
          <button
            type="button"
            aria-label={closeAriaLabel}
            onClick={requestClose}
            disabled={submitting}
            className="text-ink-faint hover:text-ink text-2xl leading-none disabled:opacity-50"
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
