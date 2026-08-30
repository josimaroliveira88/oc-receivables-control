const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

// Allowed image formats for order attachments (screenshots of the dōTERRA
// order). The extension is derived from the whitelisted mimetype, never from
// the client-supplied filename.
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
      const error = new Error('Invalid file type');
      error.code = 'INVALID_FILE_TYPE';
      return cb(error);
    }
    cb(null, true);
  },
});

// The stored filename is always a server-generated UUID + whitelisted
// extension, so resolving it never involves user-supplied path segments.
const resolveAttachmentPath = (filename) =>
  path.join(resolveUploadsDir(), filename);

module.exports = { upload, resolveAttachmentPath };
