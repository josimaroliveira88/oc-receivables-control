/**
 * Tests for the post-import feedback summary shown by the dōTERRA floating box
 * (`tools/captures-extension/src/doterra/content.js`).
 *
 * Both Back Office pages — the paginated order list (`evo_Modules
 * .OrderHistoryFull`) and the month-by-month ledger (`evo_Modules
 * .AccountInquiry`) — share `importFlow`, so a single formatter covers the
 * "pedidos do mês" import too. The worker no longer opens the app in a new tab:
 * the box closes the flow with this summary instead, which makes its wording a
 * user-visible contract. It is exported through the `__DOTERRA_PARSERS__`
 * escape hatch (set by `tests/setup.js`).
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const scriptUrl = pathToFileURL(
  path.resolve(__dirname, '../src/doterra/content.js'),
).href;
await import(scriptUrl);

const { buildImportSummary, buildFillAccountOwnerSummary } =
  globalThis.__DOTERRA_PARSERS__ ?? {};

if (!buildImportSummary) {
  throw new Error(
    'buildImportSummary is not exposed by the dōTERRA parser escape hatch.',
  );
}

if (!buildFillAccountOwnerSummary) {
  throw new Error(
    'buildFillAccountOwnerSummary is not exposed by the dōTERRA parser escape hatch.',
  );
}

describe('buildImportSummary', () => {
  it('summarizes a successful import without mentioning a new tab', () => {
    const result = buildImportSummary({
      created: [{ orderNumber: '1234' }, { orderNumber: '1235' }],
      existing: ['1200'],
      failed: [],
      createdProducts: [{ code: '12345678', name: 'Óleo essential' }],
    });

    expect(result.kind).toBe('success');
    expect(result.title).toBe('Pedidos importados.');
    expect(result.lines).toEqual([
      '2 criado(s), 1 já existia(m), 0 falha(s).',
      'Pedidos: 1234, 1235',
      '1 produto(s) novo(s) como PENDENTE_CADASTRO: 12345678',
    ]);
    expect(result.hint).toMatch(/Pedidos/);
    expect([result.title, ...result.lines].join(' ')).not.toMatch(
      /abrin|nova aba/i,
    );
  });

  it('labels the AccountInquiry flow as a month import', () => {
    const result = buildImportSummary(
      { created: [{ orderNumber: '999' }], existing: [], failed: [] },
      { source: 'accountInquiry' },
    );

    expect(result.title).toBe('Pedidos do mês importados.');
  });

  it('caps the created order list with an overflow marker', () => {
    const created = Array.from({ length: 7 }, (_, index) => ({
      orderNumber: `${1000 + index}`,
    }));

    const result = buildImportSummary({ created, existing: [], failed: [] });

    expect(result.lines[1]).toBe('Pedidos: 1000, 1001, 1002, 1003, 1004 (+2)');
  });

  it('surfaces server failures and downgrades the feedback to a warning', () => {
    const result = buildImportSummary({
      created: [{ orderNumber: '1234' }],
      existing: [],
      failed: [{ orderNumber: '1236', error: 'produto inválido' }],
    });

    expect(result.kind).toBe('warning');
    expect(result.title).toBe('Importação concluída com falhas.');
    expect(result.lines[0]).toBe('1 criado(s), 0 já existia(m), 1 falha(s).');
    expect(result.lines).toContain('• Falha — pedido 1236: produto inválido');
  });

  it('surfaces the per-order cross-check warnings', () => {
    const result = buildImportSummary({
      created: [
        {
          orderNumber: '1234',
          warnings: ['Pedido sem valor (R$ 0,00) — provavelmente reposição.'],
        },
        { orderNumber: '1235', warnings: [] },
      ],
      existing: [],
      failed: [],
    });

    expect(result.kind).toBe('warning');
    expect(result.lines).toContain(
      '1 aviso(s) nos pedidos importados — confira as observações de cada pedido.',
    );
    expect(result.lines).toContain(
      '• Aviso — 1234: Pedido sem valor (R$ 0,00) — provavelmente reposição.',
    );
  });

  it('reports an import that created nothing new', () => {
    const result = buildImportSummary({
      created: [],
      existing: ['1200', '1201'],
      failed: [],
    });

    expect(result.kind).toBe('success');
    expect(result.title).toBe('Nenhum pedido novo.');
    expect(result.lines[0]).toBe('0 criado(s), 2 já existia(m), 0 falha(s).');
    expect(result.hint).toMatch(/Nada foi alterado/);
  });

  it('reports a total failure', () => {
    const result = buildImportSummary({
      created: [],
      existing: [],
      failed: [{ orderNumber: '', error: 'sem itens' }],
    });

    expect(result.kind).toBe('warning');
    expect(result.title).toBe('Nenhum pedido importado.');
    expect(result.lines).toContain('• Falha — pedido sem número: sem itens');
  });

  it('survives a missing summary', () => {
    const result = buildImportSummary(undefined);

    expect(result.kind).toBe('success');
    expect(result.lines[0]).toBe('0 criado(s), 0 já existia(m), 0 falha(s).');
  });
});

describe('buildFillAccountOwnerSummary', () => {
  it('summarizes a run that filled the blank fields', () => {
    const result = buildFillAccountOwnerSummary({
      updated: [
        { orderNumber: '1234', accountOwner: '15837743' },
        { orderNumber: '1235', accountOwner: 'Gouveia, Cássia' },
      ],
      unchanged: [],
      notFound: [],
      failed: [],
    });

    expect(result.kind).toBe('success');
    expect(result.title).toBe('Conta ID preenchida.');
    expect(result.lines[0]).toBe(
      '2 preenchido(s), 0 já tinha(m) valor, 0 não encontrado(s), 0 falha(s).',
    );
    expect(result.lines).toContain('Pedidos: 1234, 1235');
    expect(result.hint).toMatch(/Conta ID na tela Pedidos/);
  });

  it('separates the orders that already had a value from the ones it fixed', () => {
    const result = buildFillAccountOwnerSummary({
      updated: [{ orderNumber: '1234' }],
      unchanged: ['1200', '1201'],
      notFound: [],
      failed: [],
    });

    expect(result.lines[0]).toBe(
      '1 preenchido(s), 2 já tinha(m) valor, 0 não encontrado(s), 0 falha(s).',
    );
    // The untouched orders are counted, not listed — the user only needs the
    // numbers of the ones that actually changed.
    expect(result.lines.join('\n')).not.toContain('1200');
  });

  it('lists the order numbers that are not in the app', () => {
    const result = buildFillAccountOwnerSummary({
      updated: [],
      unchanged: [],
      notFound: ['9999'],
      failed: [],
    });

    expect(result.kind).toBe('success');
    expect(result.title).toBe('Nada a preencher.');
    expect(result.lines).toContain('Não estão no app: 9999');
    expect(result.hint).toMatch(/Nada foi alterado/);
  });

  it('downgrades the feedback to a warning when an order fails', () => {
    const result = buildFillAccountOwnerSummary({
      updated: [{ orderNumber: '1234' }],
      unchanged: [],
      notFound: [],
      failed: [{ orderNumber: '1235', error: 'Conta ID não encontrada' }],
    });

    expect(result.kind).toBe('warning');
    expect(result.title).toBe('Conta ID preenchida com falhas.');
    expect(result.lines).toContain(
      '• Falha — pedido 1235: Conta ID não encontrada',
    );
  });

  it('caps the updated list with an overflow marker', () => {
    const result = buildFillAccountOwnerSummary({
      updated: Array.from({ length: 7 }, (_, index) => ({
        orderNumber: `${1000 + index}`,
      })),
      unchanged: [],
      notFound: [],
      failed: [],
    });

    expect(result.lines).toContain(
      'Pedidos: 1000, 1001, 1002, 1003, 1004 (+2)',
    );
  });

  it('survives a missing summary', () => {
    const result = buildFillAccountOwnerSummary(undefined);

    expect(result.kind).toBe('success');
    expect(result.title).toBe('Nada a preencher.');
    expect(result.lines[0]).toBe(
      '0 preenchido(s), 0 já tinha(m) valor, 0 não encontrado(s), 0 falha(s).',
    );
  });
});
