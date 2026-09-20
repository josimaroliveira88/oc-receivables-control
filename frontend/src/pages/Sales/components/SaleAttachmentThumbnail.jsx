import React, { useEffect, useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import api from '../../../services/api';

// Small clickable thumbnail for a sale's attached photo. The image is fetched
// as an authenticated blob (same endpoint the preview modal uses) and rendered
// through an object URL, so the file is never exposed statically. The fetch is
// deferred until the thumbnail scrolls into view when IntersectionObserver is
// available; environments without it (jsdom tests) load eagerly.
const SaleAttachmentThumbnail = ({ saleId, onOpen }) => {
  const [imageUrl, setImageUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const buttonRef = useRef(null);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    let observer;

    const load = async () => {
      try {
        const response = await api.get(`/sales/${saleId}/attachment`, {
          responseType: 'blob',
        });
        if (!active) return;
        objectUrl = URL.createObjectURL(response.data);
        setImageUrl(objectUrl);
      } catch (_err) {
        if (active) setFailed(true);
      }
    };

    if (typeof IntersectionObserver === 'undefined') {
      load();
    } else if (buttonRef.current) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          observer = undefined;
          load();
        }
      });
      observer.observe(buttonRef.current);
    } else {
      load();
    }

    return () => {
      active = false;
      if (observer) observer.disconnect();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [saleId]);

  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={() => onOpen()}
      data-testid={`sale-thumbnail-${saleId}`}
      aria-label="Visualizar foto da venda"
      className="inline-flex h-9 w-12 items-center justify-center overflow-hidden rounded border border-line bg-base transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-accent"
    >
      {imageUrl && !failed ? (
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover"
          data-testid={`sale-thumbnail-image-${saleId}`}
        />
      ) : (
        <Paperclip className="h-4 w-4 text-ink-faint" aria-hidden="true" />
      )}
    </button>
  );
};

export default SaleAttachmentThumbnail;
