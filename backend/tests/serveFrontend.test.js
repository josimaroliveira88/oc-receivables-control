import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { registerFrontend } from '../src/utils/serveFrontend.js';

const INDEX_HTML = '<!doctype html><html><body>SPA</body></html>';

function buildApp(staticDir) {
  const app = express();
  app.get('/health', (req, res) => res.json({ status: 'OK' }));
  app.get('/api/known', (req, res) => res.json({ ok: true }));
  registerFrontend(app, staticDir);
  return app;
}

describe('serveFrontend', () => {
  let distDir;

  beforeAll(() => {
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-serve-frontend-'));
    fs.writeFileSync(path.join(distDir, 'index.html'), INDEX_HTML);
    fs.mkdirSync(path.join(distDir, 'assets'));
    fs.writeFileSync(path.join(distDir, 'assets', 'app.js'), 'console.log(1);');
  });

  afterAll(() => {
    fs.rmSync(distDir, { recursive: true, force: true });
  });

  it('serves the SPA index at the root', async () => {
    const res = await request(buildApp(distDir)).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('SPA');
  });

  it('serves built static assets', async () => {
    const res = await request(buildApp(distDir)).get('/assets/app.js');
    expect(res.status).toBe(200);
    expect(res.text).toBe('console.log(1);');
  });

  it('falls back to index.html for client-side routes', async () => {
    const res = await request(buildApp(distDir)).get('/orders/123');
    expect(res.status).toBe(200);
    expect(res.text).toContain('SPA');
  });

  it('leaves known API routes untouched', async () => {
    const res = await request(buildApp(distDir)).get('/api/known');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('does not serve the SPA for unknown API routes', async () => {
    const res = await request(buildApp(distDir)).get('/api/unknown');
    expect(res.status).toBe(404);
    expect(res.text).not.toContain('SPA');
  });

  it('returns false and mounts nothing when index.html is missing', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-serve-empty-'));
    try {
      const app = express();
      expect(registerFrontend(app, emptyDir)).toBe(false);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('returns false when no directory is provided', () => {
    const app = express();
    expect(registerFrontend(app, undefined)).toBe(false);
  });
});
