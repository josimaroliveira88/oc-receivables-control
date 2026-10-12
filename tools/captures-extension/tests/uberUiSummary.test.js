/**
 * Tests for the post-import feedback summary shown by the Uber floating box
 * (`tools/captures-extension/src/ui/content.js`).
 *
 * The box used to close the send flow with "Abrindo o Controle de Recebíveis…"
 * because the service worker opened the app in a new tab. It no longer does:
 * the box renders the server summary itself, so the wording of that summary is
 * part of the user-visible contract. The formatter is a pure function exported
 * through the `globalThis.__UBER_UI__` escape hatch (set by `tests/setup.js`),
 * which is why it can be exercised without the live DOM.
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const scriptUrl = pathToFileURL(
  path.resolve(__dirname, '../src/ui/content.js'),
).href;
await import(scriptUrl);

const { buildRideSummary, describeSendError } = globalThis.__UBER_UI__ ?? {};

if (!buildRideSummary || !describeSendError) {
  throw new Error(
    'buildRideSummary/describeSendError are not exposed by the Uber UI escape hatch.',
  );
}

describe('buildRideSummary', () => {
  it('summarizes a successful import without mentioning a new tab', () => {
    const result = buildRideSummary(
      { total: 12, created: 8, updated: 4, cancelled: 1, warnings: [] },
      { period: '01/09/2026 a 30/09/2026' },
    );

    expect(result.kind).toBe('success');
    expect(result.title).toBe('Corridas importadas.');
    expect(result.lines).toEqual([
      '12 corrida(s) importada(s) para o app (01/09/2026 a 30/09/2026).',
      '8 nova(s) e 4 atualizada(s).',
      '1 cancelada(s), marcada(s) como tal no app.',
    ]);
    expect(result.hint).toBe('Consulte as corridas em Finanças › Corridas.');
    expect(result.lines.join(' ')).not.toMatch(/abrin|nova aba/i);
  });

  it('lists the capture warnings and downgrades the feedback to a warning', () => {
    const result = buildRideSummary({
      total: 2,
      created: 2,
      updated: 0,
      cancelled: 0,
      warnings: [
        'uuid-1: valor inválido, ignorada',
        'uuid-2: duplicada, ignorada',
      ],
    });

    expect(result.kind).toBe('warning');
    expect(result.lines).toContain('2 atividade(s) ignorada(s) na captura.');
    expect(result.lines).toContain('• uuid-1: valor inválido, ignorada');
    expect(result.lines).toContain('• uuid-2: duplicada, ignorada');
  });

  it('caps the listed warnings but keeps the full count', () => {
    const warnings = Array.from(
      { length: 5 },
      (_, index) => `uuid-${index}: valor inválido, ignorada`,
    );

    const result = buildRideSummary({
      total: 1,
      created: 1,
      updated: 0,
      cancelled: 0,
      warnings,
    });

    const listed = result.lines.filter((line) => line.startsWith('• '));
    expect(listed).toHaveLength(3);
    expect(result.lines).toContain('5 atividade(s) ignorada(s) na captura.');
  });

  it('reports an empty period instead of a zero-count success', () => {
    const result = buildRideSummary({
      total: 0,
      created: 0,
      updated: 0,
      cancelled: 0,
      warnings: [],
    });

    expect(result.kind).toBe('warning');
    expect(result.title).toBe('Nenhuma corrida importada.');
    expect(result.lines[0]).toMatch(/não retornou corrida válida/i);
    expect(result.hint).toMatch(/período/i);
  });

  it('survives a missing summary', () => {
    expect(buildRideSummary(undefined).title).toBe(
      'Nenhuma corrida importada.',
    );
    expect(buildRideSummary(undefined).lines).toHaveLength(1);
  });
});

describe('describeSendError', () => {
  it('maps the stable error codes to a readable reason', () => {
    expect(describeSendError({ error: 'NO_TOKEN' })).toBe(
      'sem token salvo no popup da extensão',
    );
    expect(describeSendError({ error: 'NETWORK' })).toBe(
      'sem conexão com o servidor',
    );
    expect(
      describeSendError({ error: 'AUTH', message: 'Token expirado' }),
    ).toBe('Token expirado');
    expect(describeSendError({ error: 'AUTH' })).toBe(
      'token inválido ou expirado',
    );
    expect(describeSendError({ error: 'HTTP', status: 500 })).toBe('erro 500');
    expect(describeSendError({ error: 'HTTP', message: 'Falha interna' })).toBe(
      'Falha interna',
    );
    expect(describeSendError(undefined)).toBe('erro desconhecido');
  });
});
