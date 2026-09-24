import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Allowed image formats for order/sale attachments (dōTERRA order screenshots
// and sale photos). The extension is derived from the whitelisted mimetype,
// never from the client-supplied filename.
const ALLOWED_TYPES = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

// Resolves the attachment storage folder. Defaults to a predefined folder
// inside the project structure (`backend/uploads/orders`) so files persist on
// the host both when running natively and via Docker (the compose file
// bind-mounts ./backend:/app). Tests override it via ATTACHMENTS_DIR.
const resolveUploadsDir = () =>
  process.env.ATTACHMENTS_DIR ||
  path.join(__dirname, '..', '..', 'uploads', 'orders');

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      const dir = resolveUploadsDir();
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(req, file, cb) {
      const ext = ALLOWED_TYPES[file.mimetype];
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  fileFilter(req, file, cb) {
    if (!ALLOWED_TYPES[file.mimetype]) {
      const error = new Error('Tipo de arquivo inválido');
      error.code = 'INVALID_FILE_TYPE';
      return cb(error);
    }
    cb(null, true);
  },
});

// Wraps multer's `single('file')` so the fileFilter rejection becomes a clean
// 400 instead of a generic error. Shared by the order and sale attachment
// routes (both store the file on the `Order.attachmentFilename` column).
const uploadSingleAttachment = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({ error: 'Tipo de arquivo inválido' });
      }
      return next(err);
    }
    next();
  });
};

// The stored filename is always a server-generated UUID + whitelisted
// extension, so resolving it never involves user-supplied path segments.
const resolveAttachmentPath = (filename) =>
  path.join(resolveUploadsDir(), filename);

// --- InfinitePay statement upload ------------------------------------------

// The InfinitePay statement is parsed in memory and never persisted, so it is
// accepted as text/CSV (browsers often report text/plain or octet-stream for
// .csv files) with a bounded size.
const INFINITEPAY_ALLOWED_TYPES = new Set([
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

const infinitePayMaxBytes = () =>
  Number(process.env.INFINITEPAY_MAX_BYTES) || 2 * 1024 * 1024;

const infinitePayUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: infinitePayMaxBytes() },
  fileFilter(req, file, cb) {
    if (!INFINITEPAY_ALLOWED_TYPES.has(file.mimetype)) {
      const error = new Error('Tipo de arquivo inválido');
      error.code = 'INVALID_FILE_TYPE';
      return cb(error);
    }
    cb(null, true);
  },
});

// Wraps the single-file upload so multer's errors become clean 400 responses.
const uploadSingleInfinitePayCsv = (req, res, next) => {
  infinitePayUpload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res
          .status(400)
          .json({ error: 'Arquivo CSV excede o tamanho máximo' });
      }
      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({ error: 'Tipo de arquivo inválido' });
      }
      return next(err);
    }
    next();
  });
};

export {
  upload,
  uploadSingleAttachment,
  resolveAttachmentPath,
  uploadSingleInfinitePayCsv,
};
