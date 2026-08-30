import React, { useEffect, useState } from 'react';
import api from '../../../services/api';
import Modal from '../../../components/Modal';

// Read-only modal that fetches and displays the order's dōTERRA order
// screenshot. The image is fetched with the authenticated axios instance
// (blob) and shown via an object URL, so no system path is ever exposed.
const AttachmentPreviewModal = ({ order, onClose }) => {
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let objectUrl = '';
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/orders/${order.id}/attachment`, {
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
  }, [order.id]);

  return (
    <Modal
      isOpen
      title={`Anexo do Pedido ${order.orderNumber}`}
      onClose={onClose}
      maxWidth="max-w-2xl"
      closeAriaLabel="Fechar anexo"
    >
      <div className="px-6 py-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="ml-2 text-gray-500 dark:text-gray-400">
              Carregando...
            </span>
          </div>
        )}
        {error && (
          <div
            data-testid="attachment-preview-error"
            className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md"
          >
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        {imageUrl && (
          <img
            data-testid="attachment-preview-image"
            src={imageUrl}
            alt={`Print do pedido ${order.orderNumber}`}
            className="mx-auto max-h-[70vh] rounded-md border border-gray-200 dark:border-gray-700"
          />
        )}
      </div>
    </Modal>
  );
};

export default AttachmentPreviewModal;
