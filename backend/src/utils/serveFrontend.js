import fs from 'fs';
import path from 'path';
import express from 'express';

// Serves the built SPA (frontend/dist) from the API server in production.
// API routes stay untouched, and every other GET falls back to index.html so
// React Router deep-links keep working. Returns false when there is nothing to
// serve, letting the caller keep the API-only behavior.
export function registerFrontend(app, staticDir) {
  if (!staticDir) return false;

  const indexFile = path.join(staticDir, 'index.html');
  if (!fs.existsSync(indexFile)) return false;

  app.use(express.static(staticDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(indexFile);
  });
  return true;
}
