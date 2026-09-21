import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PORT = process.env.PORT || 4000;
export const JWT_SECRET =
  process.env.JWT_SECRET || 'default-secret-change-in-production';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
export const NODE_ENV = process.env.NODE_ENV || 'development';

// In production the API also serves the built SPA (same origin, no CORS/proxy).
// Explicit SERVE_STATIC wins; otherwise production implies serving.
export const SERVE_STATIC =
  process.env.SERVE_STATIC === 'true' || NODE_ENV === 'production';
export const STATIC_DIR =
  process.env.STATIC_DIR ||
  path.resolve(__dirname, '..', '..', 'frontend', 'dist');
