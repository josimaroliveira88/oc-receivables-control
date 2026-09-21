import { expect, test } from '@playwright/test';
import {
  generateE2EUser,
  createUserViaApi,
  login,
  loginAndGetToken,
  createSaleProductViaApi,
  apiRequest,
  listOrdersViaApi,
  uniqueOrderNumber,
  saveScreenshot,
  API_URL,
} from './helpers.js';

// End-to-end coverage for the credit-card feature (phases A-D):
// - new order with paymentType CARTAO_CREDITO (à vista and parcelado)
// - editing an existing CARTAO_CREDITO order between à vista / parcelado
// - switching a credit-card order back to PIX removes the bill
// - Finances "Pendente" card + Efetividade filter + installment badges
// - Credit Cards page: detail, mark installment paid, manual bill modal
// - Finances "Novo lançamento" credit-card tab
test.describe('Cartão de crédito nos pedidos e nas finanças (e2e)', () => {
  test.describe.configure({ mode: 'serial' });

  let testUser;
  let token;
  let product;
  let existingAvista;
  let existingParcelado;
  let newAvistaNumber;
  let newParceladoNumber;

  const billsViaApi = async (request) =>
    (await apiRequest(request, 'get', '/api/credit-cards/bills', token)).json();

  const billForOrder = async (request, orderId) => {
    const bills = await billsViaApi(request);
    return bills.find((bill) => bill.orderId === orderId);
  };

  const orderByNumber = async (request, number) => {
    const orders = await listOrdersViaApi(request, token, {
      q: number,
      searchField: 'orderNumber',
    });
    return orders.find((order) => order.orderNumber === number);
  };

  test.beforeAll(async ({ request, playwright }) => {
    testUser = generateE2EUser();
    await createUserViaApi(request, testUser);

    const api = await playwright.request.newContext({ baseURL: API_URL });
    token = await loginAndGetToken(api, testUser.username, testUser.password);
    await apiRequest(api, 'post', '/api/people/self', token);
    product = await createSaleProductViaApi(api, token);

    existingAvista = await apiRequest(api, 'post', '/api/orders', token, {
      orderNumber: uniqueOrderNumber('CC-AVISTA'),
      orderDate: '2026-09-20',
      paymentType: 'CARTAO_CREDITO',
      installments: 1,
      firstInstallmentAt: '2026-10-05',
      items: [{ productId: product.id, chargedValue: 100, quantity: 1 }],
    }).then((res) => res.json());

    existingParcelado = await apiRequest(api, 'post', '/api/orders', token, {
      orderNumber: uniqueOrderNumber('CC-PARC'),
      orderDate: '2026-09-20',
      paymentType: 'CARTAO_CREDITO',
      installments: 3,
      firstInstallmentAt: '2026-10-10',
      items: [{ productId: product.id, chargedValue: 300, quantity: 1 }],
    }).then((res) => res.json());
  });

  test.beforeEach(async ({ page, baseURL }) => {
    await login(page, baseURL, testUser.username, testUser.password);
  });

  const openOrderCreate = async (page) => {
    await page.goto('/orders');
    await expect(
      page.getByRole('heading', { name: 'Pedidos dōTERRA' }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Novo Pedido' }).click();
    const modal = page.getByTestId('modal-backdrop');
    await expect(
      modal.getByPlaceholder('Informe o número do pedido da dōTERRA'),
    ).toBeVisible({ timeout: 10_000 });
    return modal;
  };

  const pickProduct = async (page, modal) => {
    await modal.getByPlaceholder('Busque um produto...').fill(product.name);
    await page
      .getByTestId('product-combobox-list')
      .getByText(new RegExp(product.name))
      .click();
  };

  const saveOrderModal = (modal) =>
    modal.getByRole('button', { name: /^(Salvar|Atualizar)$/ }).click();

  const openOrderEdit = async (page, number) => {
    await page.goto('/orders');
    await expect(
      page.getByRole('heading', { name: 'Pedidos dōTERRA' }),
    ).toBeVisible({ timeout: 15_000 });
    const row = page.getByRole('row').filter({ hasText: number });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.locator('[data-testid$="-trigger"]').click();
    await page.getByTestId(/order-actions-.*-item-Editar/).click();
    const modal = page.getByTestId('modal-backdrop');
    await expect(page.getByText('Editar Pedido')).toBeVisible();
    return modal;
  };

  test('CT1 - pedido novo no cartão à vista (1x)', async ({
    page,
    request,
  }) => {
    const modal = await openOrderCreate(page);
    newAvistaNumber = uniqueOrderNumber('CC-NOVO-AV');

    await modal
      .getByPlaceholder('Informe o número do pedido da dōTERRA')
      .fill(newAvistaNumber);
    await modal.getByLabel('Tipo de Pagamento').selectOption('CARTAO_CREDITO');

    // The credit-card fields appear only for this payment type.
    await expect(modal.getByLabel('Parcelas')).toBeVisible();
    await expect(modal.getByLabel('Primeira parcela')).toBeVisible();

    await modal.getByLabel('Parcelas').fill('1');
    await modal.getByLabel('Primeira parcela').fill('2026-11-01');
    await pickProduct(page, modal);

    await saveScreenshot(page, 'cc-01-novo-pedido-avista-preenchido');
    await modal.getByRole('button', { name: 'Salvar' }).click();
    await expect(
      page.getByRole('row').filter({ hasText: newAvistaNumber }),
    ).toBeVisible({ timeout: 15_000 });

    const order = await orderByNumber(request, newAvistaNumber);
    const bill = await billForOrder(request, order.id);
    expect(bill.installments).toBe(1);
    expect(bill.transactions).toHaveLength(1);
    expect(bill.transactions[0].isEffective).toBe(false);
    expect(Number(bill.transactions[0].amount)).toBe(100);

    await saveScreenshot(page, 'cc-02-lista-pedidos-apos-avista');
  });

  test('CT2 - pedido novo no cartão parcelado (3x)', async ({
    page,
    request,
  }) => {
    const modal = await openOrderCreate(page);
    newParceladoNumber = uniqueOrderNumber('CC-NOVO-PARC');

    await modal
      .getByPlaceholder('Informe o número do pedido da dōTERRA')
      .fill(newParceladoNumber);
    await modal.getByLabel('Tipo de Pagamento').selectOption('CARTAO_CREDITO');
    await modal.getByLabel('Parcelas').fill('3');
    await modal.getByLabel('Primeira parcela').fill('2026-11-15');
    await pickProduct(page, modal);

    await saveScreenshot(page, 'cc-03-novo-pedido-parcelado-preenchido');
    await modal.getByRole('button', { name: 'Salvar' }).click();
    await expect(
      page.getByRole('row').filter({ hasText: newParceladoNumber }),
    ).toBeVisible({ timeout: 15_000 });

    const order = await orderByNumber(request, newParceladoNumber);
    const bill = await billForOrder(request, order.id);
    expect(bill.installments).toBe(3);
    expect(bill.transactions).toHaveLength(3);
    expect(bill.transactions.every((tx) => tx.isEffective === false)).toBe(
      true,
    );
    const sum = bill.transactions.reduce(
      (total, tx) => total + Math.round(Number(tx.amount) * 100),
      0,
    );
    expect(sum).toBe(10000);

    await saveScreenshot(page, 'cc-04-lista-pedidos-apos-parcelado');
  });

  test('CT3 - edita pedido existente à vista para parcelado', async ({
    page,
    request,
  }) => {
    const modal = await openOrderEdit(page, existingAvista.orderNumber);
    await expect(modal.getByLabel('Tipo de Pagamento')).toHaveValue(
      'CARTAO_CREDITO',
    );
    await expect(modal.getByLabel('Parcelas')).toHaveValue('1');

    await modal.getByLabel('Parcelas').fill('4');
    await modal.getByLabel('Primeira parcela').fill('2026-12-05');
    await saveScreenshot(page, 'cc-05-editar-avista-para-parcelado');
    await saveOrderModal(modal);
    await expect(modal).not.toBeVisible({ timeout: 10_000 });

    const bill = await billForOrder(request, existingAvista.id);
    expect(bill.installments).toBe(4);
    expect(bill.transactions).toHaveLength(4);
    expect(bill.transactions.every((tx) => tx.isEffective === false)).toBe(
      true,
    );
    expect(bill.transactions.map((tx) => tx.installmentNumber)).toEqual([
      1, 2, 3, 4,
    ]);

    await page.goto('/credit-cards');
    await expect(
      page.getByRole('heading', { name: 'Cartões de crédito' }),
    ).toBeVisible({ timeout: 15_000 });
    await saveScreenshot(page, 'cc-06-compras-apos-editar-parcelado');
  });

  test('CT4 - edita pedido existente parcelado para à vista', async ({
    page,
    request,
  }) => {
    const modal = await openOrderEdit(page, existingParcelado.orderNumber);
    await expect(modal.getByLabel('Parcelas')).toHaveValue('3');

    await modal.getByLabel('Parcelas').fill('1');
    await modal.getByLabel('Primeira parcela').fill('2026-11-20');
    await saveScreenshot(page, 'cc-07-editar-parcelado-para-avista');
    await saveOrderModal(modal);
    await expect(modal).not.toBeVisible({ timeout: 10_000 });

    const bill = await billForOrder(request, existingParcelado.id);
    expect(bill.installments).toBe(1);
    expect(bill.transactions).toHaveLength(1);
    expect(Number(bill.transactions[0].amount)).toBe(300);
    expect(bill.transactions[0].isEffective).toBe(false);

    await saveScreenshot(page, 'cc-08-lista-pedidos-apos-editar-avista');
  });

  test('CT5 - trocar o tipo do pedido para PIX remove a compra', async ({
    page,
    request,
  }) => {
    const modal = await openOrderEdit(page, existingParcelado.orderNumber);
    await modal.getByLabel('Tipo de Pagamento').selectOption('PIX');
    // The credit-card-only fields hide when the type changes.
    await expect(modal.getByLabel('Parcelas')).toHaveCount(0);
    await expect(modal.getByLabel('Primeira parcela')).toHaveCount(0);
    await saveScreenshot(page, 'cc-09-editar-pedido-para-pix');
    await saveOrderModal(modal);
    await expect(modal).not.toBeVisible({ timeout: 10_000 });

    expect(await billForOrder(request, existingParcelado.id)).toBeUndefined();

    const transactions = await apiRequest(
      request,
      'get',
      '/api/finances/transactions',
      token,
    ).then((res) => res.json());
    const orderRows = transactions.filter(
      (tx) => tx.orderId === existingParcelado.id,
    );
    expect(orderRows).toHaveLength(1);
    expect(orderRows[0].origin).toBe('PEDIDO_DOTERRA');
    expect(orderRows[0].isEffective).toBe(true);
  });

  test('CT6 - finanças mostra o total pendente e filtra por efetividade', async ({
    page,
  }) => {
    await page.goto('/finances');
    await expect(page.getByRole('heading', { name: 'Finanças' })).toBeVisible({
      timeout: 15_000,
    });

    // Pending = 100 (novo à vista) + 100 (novo parcelado) + 100 (existente à
    // vista editado para 4x). The PIX order is effective expense of 300.
    await expect(page.getByTestId('finances-summary-pending')).toContainText(
      /300,00/,
      { timeout: 15_000 },
    );
    await expect(page.getByTestId('finances-summary-expense')).toContainText(
      /300,00/,
    );
    await saveScreenshot(page, 'cc-10-financas-com-pendente');

    await page.getByLabel('Efetividade').selectOption('no');
    await expect(page.getByLabel('Efetividade')).toHaveValue('no');
    await expect(page.getByTestId('finances-summary-pending')).toContainText(
      /300,00/,
    );
    await saveScreenshot(page, 'cc-11-financas-somente-pendentes');

    await page.getByLabel('Efetividade').selectOption('yes');
    await expect(page.getByLabel('Efetividade')).toHaveValue('yes');
    await expect(page.getByTestId('finances-summary-pending')).toContainText(
      /0,00/,
    );
    await saveScreenshot(page, 'cc-12-financas-somente-efetivas');
  });

  test('CT7 - compras: detalhe, parcelas e marcar uma como paga', async ({
    page,
  }) => {
    await page.goto('/credit-cards');
    await expect(
      page.getByRole('heading', { name: 'Cartões de crédito' }),
    ).toBeVisible({ timeout: 15_000 });

    const row = page.getByRole('row').filter({ hasText: newParceladoNumber });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText('Parcelas 0/3 pagas');
    await saveScreenshot(page, 'cc-13-compras-lista');

    await row.getByRole('button', { name: newParceladoNumber }).click();
    const detail = page.getByTestId('bill-detail-modal');
    await expect(detail).toBeVisible();
    await expect(detail.getByText('Parcela 1/3')).toBeVisible();
    await saveScreenshot(page, 'cc-14-compra-detalhe-parcelas');

    await detail
      .getByRole('button', { name: 'Marcar como paga' })
      .first()
      .click();
    await expect(detail.getByText('Paga').first()).toBeVisible({
      timeout: 10_000,
    });
    await saveScreenshot(page, 'cc-15-compra-uma-parcela-paga');

    await detail.getByLabel('Fechar compra').click();
    await expect(detail).not.toBeVisible();

    await page.goto('/finances');
    await expect(page.getByRole('heading', { name: 'Finanças' })).toBeVisible({
      timeout: 15_000,
    });
    // 300 - 33,33 = 266,67
    await expect(page.getByTestId('finances-summary-pending')).toContainText(
      /266,67/,
      { timeout: 15_000 },
    );
    await saveScreenshot(page, 'cc-16-financas-pendente-apos-baixa');
  });

  test('CT8 - nova compra manual (à vista e parcelada) e aba nas finanças', async ({
    page,
    request,
  }) => {
    await page.goto('/credit-cards');
    await expect(
      page.getByRole('heading', { name: 'Cartões de crédito' }),
    ).toBeVisible({ timeout: 15_000 });

    const manualAvista = `Compra manual à vista ${Date.now()}`;
    await page.getByRole('button', { name: 'Nova compra' }).click();
    const modal = page.getByTestId('bill-form-modal');
    await expect(modal).toBeVisible();
    await modal.getByLabel('Descrição').fill(manualAvista);
    await modal.getByTestId('bill-total-amount').fill('20000');
    await modal.getByLabel('Parcelas').fill('1');
    await modal.getByLabel('Primeira parcela').fill('2026-11-25');
    await saveScreenshot(page, 'cc-17-nova-compra-manual-avista');
    await modal.getByRole('button', { name: 'Salvar' }).click();
    await expect(modal).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(manualAvista)).toBeVisible({ timeout: 10_000 });

    const manualParcelado = `Compra manual parcelada ${Date.now()}`;
    await page.getByRole('button', { name: 'Nova compra' }).click();
    await expect(modal).toBeVisible();
    await modal.getByLabel('Descrição').fill(manualParcelado);
    await modal.getByTestId('bill-total-amount').fill('30000');
    await modal.getByLabel('Parcelas').fill('3');
    await modal.getByLabel('Primeira parcela').fill('2026-12-10');
    await saveScreenshot(page, 'cc-18-nova-compra-manual-parcelada');
    await modal.getByRole('button', { name: 'Salvar' }).click();
    await expect(modal).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(manualParcelado)).toBeVisible({
      timeout: 10_000,
    });

    const bills = await billsViaApi(request);
    const avista = bills.find((bill) => bill.description === manualAvista);
    const parcelada = bills.find(
      (bill) => bill.description === manualParcelado,
    );
    expect(avista.transactions).toHaveLength(1);
    expect(parcelada.transactions).toHaveLength(3);
    await saveScreenshot(page, 'cc-19-compras-manuais-criadas');

    // Finances "Novo lançamento" now exposes the Cartão de crédito tab.
    await page.goto('/finances');
    await expect(page.getByRole('heading', { name: 'Finanças' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Novo lançamento' }).click();
    const txModal = page.getByTestId('transaction-form-modal');
    await expect(txModal).toBeVisible();
    await txModal.getByRole('button', { name: 'Cartão de crédito' }).click();
    await expect(txModal.getByLabel('Valor total (R$)')).toBeVisible();
    await expect(txModal.getByLabel('Parcelas')).toBeVisible();
    await expect(txModal.getByLabel('Primeira parcela')).toBeVisible();
    await saveScreenshot(page, 'cc-20-financas-aba-cartao-de-credito');
  });
});
