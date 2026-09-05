import fs from 'fs';
import path from 'path';
import { resolveAttachmentPath } from '../middlewares/upload.js';

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Content-Type per stored attachment extension (whitelisted by the uploader).
const CONTENT_TYPE_BY_EXTENSION = {
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const attachmentMaxBytes = () =>
  Number(process.env.ATTACHMENT_MAX_BYTES) || DEFAULT_MAX_BYTES;

const removeAttachmentFile = (filename) => {
  if (!filename) return;
  try {
    fs.unlinkSync(resolveAttachmentPath(filename));
  } catch (error) {
    // Ignore missing files (ENOENT); a stale DB reference must not break flows.
    if (error.code !== 'ENOENT') {
      console.error('Error removing attachment file:', error);
    }
  }
};

// Maps a stored attachment filename to the Content-Type header for serving it.
const attachmentContentType = (filename) =>
  CONTENT_TYPE_BY_EXTENSION[path.extname(filename)] ?? 'image/jpeg';

export {
  DEFAULT_MAX_BYTES,
  CONTENT_TYPE_BY_EXTENSION,
  attachmentMaxBytes,
  attachmentContentType,
  removeAttachmentFile,
};
