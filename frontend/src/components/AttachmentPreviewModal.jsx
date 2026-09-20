import React, { useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import api from '../services/api';
import Modal from './Modal';

// Read-only modal that fetches and displays an order/sale attachment image.
// The image is fetched with the authenticated axios instance (blob) and shown
// via an object URL, so no system path is ever exposed. The image itself is
// clickable to toggle between the compact and expanded sizes; the button keeps
// the same behavior available to keyboard users.
const AttachmentPreviewModal = ({
  order,
  endpoint,
  title,
  imageAlt,
  onClose,
}) => {
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const resolvedEndpoint = endpoint || `/orders/${order.id}/attachment`;
  const resolvedTitle = title || `Anexo do Pedido ${order.orderNumber}`;
  const resolvedAlt = imageAlt || `Print do pedido ${order.orderNumber}`;

  useEffect(() => {
    let objectUrl = '';
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(resolvedEndpoint, {
          responseType: 'blob',
        });
        if (!active) return;
        objectUrl = URL.createObjectURL(response.data);
        setImageUrl(objectUrl);
      } catch (err) {
        if (active) setError('Não foi possível carregar o anexo.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [resolvedEndpoint]);

  const toggleExpanded = () => setExpanded((prev) => !prev);

  return (
    <Modal
      isOpen
      title={resolvedTitle}
      onClose={onClose}
      maxWidth={expanded ? 'max-w-[95vw]' : 'max-w-2xl'}
      closeAriaLabel="Fechar anexo"
    >
      <div className="px-6 py-4">
        {imageUrl && (
          <div className="flex justify-end mb-2">
            <button
              type="button"
              data-testid="attachment-preview-expand"
              aria-pressed={expanded}
              onClick={toggleExpanded}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-ink-soft bg-base hover:bg-elevated rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {expanded ? (
                <Minimize2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              )}
              {expanded ? 'Reduzir' : 'Expandir'}
            </button>
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
            <span className="ml-2 text-ink-faint">Carregando...</span>
          </div>
        )}
        {error && (
          <div
            data-testid="attachment-preview-error"
            className="p-3 bg-danger-soft rounded-md"
          >
            <p className="text-sm text-danger-fg">{error}</p>
          </div>
        )}
        {imageUrl && (
          <img
            data-testid="attachment-preview-image"
            src={imageUrl}
            alt={resolvedAlt}
            role="button"
            tabIndex={0}
            aria-label={expanded ? 'Reduzir imagem' : 'Ampliar imagem'}
            onClick={toggleExpanded}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleExpanded();
              }
            }}
            className={
              (expanded
                ? 'mx-auto w-full max-h-[85vh] object-contain rounded-md border border-line'
                : 'mx-auto max-h-[70vh] rounded-md border border-line') +
              (expanded ? ' cursor-zoom-out' : ' cursor-zoom-in')
            }
          />
        )}
      </div>
    </Modal>
  );
};

export default AttachmentPreviewModal;
