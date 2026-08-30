const path = require('path');
const os = require('os');

process.env.JWT_SECRET = 'test-secret-key';
process.env.PORT = '4001';
process.env.DATABASE_URL =
  'postgresql://admin:admin@localhost:5432/receivables?schema=public';
process.env.NODE_ENV = 'test';
process.env.ATTACHMENTS_DIR = path.join(
  os.tmpdir(),
  'receivables-test-attachments',
);
