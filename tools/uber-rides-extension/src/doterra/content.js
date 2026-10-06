/**
 * ISOLATED-world content script for the dōTERRA Back Office order history
 * (single self-contained file).
 *
 * Mounts a floating box on `evo_Modules.OrderHistoryFull` (Rastreamento de
 * Pedidos e Pacotes). It parses the order table, can auto-paginate the page's
 * "Ver mais" flow, fetches the detail page of orders the backend does not have
 * yet, and either copies a capture JSON or sends it straight to the app.
 *
 * Deliberately self-contained: no imports, no shared `globalThis` namespace
 * with the Uber scripts. The only cross-context bridges are
 * `chrome.runtime.sendMessage` (background: lookup + import POST) and
 * `chrome.storage.local` (read-only token gate).
 */
(() => {
  'use strict';

  const VERSION = '0.6.0';
  const BUILD_LABEL = 'doterra-orders';
  const BOX_ID = 'doterra-orders-capture-box';
  const TOKEN_KEY = 'uber-rides:api-token';

  const STATUS_COLORS = {
    error: '#d6336c',
    warning: '#e8590c',
    success: '#2f9e44',
    info: '#555',
  };

  const describeFailure = (failure) => {
    const order = failure?.orderNumber
      ? `pedido ${failure.orderNumber}`
      : 'pedido sem número';
    const reason = failure?.error || 'erro desconhecido';
    return `${order}: ${reason}`;
  };

  console.info(
    `[Doterra Orders Capture] ISOLATED v${VERSION} (${BUILD_LABEL}) carregado em ${location.href}`,
  );

  // --- Helpers --------------------------------------------------------------

  const pad = (value) => String(value).padStart(2, '0');

  const stripTags = (html) => {
    const area = document.createElement('div');
    area.innerHTML = html;
    return (area.textContent || '').replace(/\u00a0/g, ' ').trim();
  };

  // Money in both pages appears as `R$ 150.00` (dot decimal) or
  // `R$ 1,045.63` (comma thousands + dot decimal). Strip the currency/spaces,
  // drop the thousands comma, then parse the decimal.
  const parseMoney = (value) => {
    if (value == null) return null;
    const cleaned = String(value)
      .replace(/R\$/gi, '')
      .replace(/[\s\u00a0]/g, '')
      .trim();
    if (!cleaned) return null;
    const normalized = cleaned.includes(',')
      ? cleaned.replace(/,/g, '')
      : cleaned;
    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const parseQuantity = (value) => {
    const parsed = parseInt(String(value).replace(/\D/g, ''), 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  // `dd/mm/yyyy` -> `YYYY-MM-DD` (no Date parsing to avoid timezone shifts).
  const toIsoDate = (value) => {
    const match = String(value)
      .trim()
      .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  };

  // `M/YYYY` or `MM/YYYY` -> `YYYY-MM`.
  const toIsoMonth = (value) => {
    const match = String(value)
      .trim()
      .match(/^(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    return `${match[2]}-${pad(match[1])}`;
  };

  const splitBr = (cell) => {
    if (!cell) return [];
    return cell.innerHTML
      .split(/<br\s*\/?>/i)
      .map((part) => stripTags(part))
      .filter((part) => part !== '');
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const fetchWithTimeout = async (url, timeoutMs) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        credentials: 'same-origin',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  // --- Storage --------------------------------------------------------------

  const hasStorage = () =>
    typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  const loadStoredToken = () =>
    new Promise((resolve) => {
      if (!hasStorage()) {
        resolve('');
        return;
      }
      try {
        chrome.storage.local.get([TOKEN_KEY], (result) => {
          if (chrome.runtime.lastError) {
            resolve('');
            return;
          }
          resolve(result[TOKEN_KEY] ?? '');
        });
      } catch (_err) {
        resolve('');
      }
    });

  // --- Clipboard ------------------------------------------------------------

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_err) {
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(area);
        return ok;
      } catch (__err) {
        return false;
      }
    }
  };

  // --- Background bridge ----------------------------------------------------

  const sendBackground = (message) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      return Promise.resolve({ ok: false, error: 'NO_BACKGROUND' });
    }
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (data) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: 'NO_BACKGROUND' });
            return;
          }
          resolve(data ?? { ok: false, error: 'NO_BACKGROUND' });
        });
      } catch (_err) {
        resolve({ ok: false, error: 'NO_BACKGROUND' });
      }
    });
  };

  // --- List parsing ---------------------------------------------------------

  const accountOwnerFromPage = () => {
    const heading = document.querySelector('h3.white');
    if (!heading) return null;
    const italic = heading.querySelector('i');
    if (italic && italic.textContent.trim()) return italic.textContent.trim();
    const text = heading.textContent.replace(/Pedidos de/gi, '').trim();
    return text || null;
  };

  const paymentHintFromCell = (cell) => {
    const text = cell ? cell.textContent : '';
    if (/Abrir\s+Boleto/i.test(text)) return 'BOLETO';
    if (/Abrir\s+Pix/i.test(text)) return 'PIX';
    return null;
  };

  const sortValue = (cell) => {
    if (!cell) return null;
    const raw = cell.getAttribute('data-sort-value');
    return parseMoney(raw != null && raw !== '' ? raw : cell.textContent);
  };

  const parseRow = (row, owner) => {
    const cells = row.cells;
    if (!cells || cells.length < 14) return null;

    // Rows with a "Cancelar" link are unpaid and always excluded.
    if (cells[13].querySelector('.OrderCancelLink')) return null;

    const numberLink = cells[0].querySelector('a');
    const orderNumber = (
      numberLink ? numberLink.textContent : cells[0].textContent
    ).trim();
    if (!orderNumber) return null;

    const detailHref = numberLink ? numberLink.getAttribute('href') : null;
    const codes = splitBr(cells[5]);
    const quantities = splitBr(cells[6]).map(parseQuantity);

    const items = codes.map((code, index) => ({
      code,
      quantity: quantities[index] > 0 ? quantities[index] : 1,
    }));

    return {
      orderNumber,
      detailHref,
      orderDate: toIsoDate(cells[8].textContent),
      accountOwner: owner,
      listTypeCode: cells[1].textContent.trim() || null,
      listOriginCode: cells[2].textContent.trim() || null,
      pvMonth: toIsoMonth(cells[10].textContent),
      doterraPv: sortValue(cells[11]),
      listValue: sortValue(cells[12]),
      paymentHint: paymentHintFromCell(cells[7]),
      items,
    };
  };

  const parseOrders = () => {
    const owner = accountOwnerFromPage();
    const rows = document.querySelectorAll('#OrderhistoryRows tr');
    const orders = [];
    rows.forEach((row) => {
      const parsed = parseRow(row, owner);
      if (parsed) orders.push(parsed);
    });
    return orders;
  };

  // --- Auto-pagination ("Carregar mais antigos") ----------------------------

  const currentCursor = () => {
    const inputs = document.querySelectorAll('.startdate');
    return inputs.length ? inputs[inputs.length - 1].value : '';
  };

  const viewMoreUrl = (cursor) => {
    const params = new URLSearchParams({
      Fuseaction: 'evo_Modules.OrderHistoryFull',
      SupressDTSPopup: '1',
      PopupDiv: 'orderhistoryrows',
      noheader: '1',
      nofooter: '1',
      api: '1',
      no_meta: '1',
      axn: 'ViewMoreCount',
      startdate: cursor,
      _: String(Date.now()),
    });
    return `index.cfm?${params.toString()}`;
  };

  // Replicates the page's own VIEWMORE handler: fetch the fragment, move its
  // rows into `#OrderhistoryRows`, keep the returned hidden `.startdate` cursor
  // and drop the fragment table so the page's "Ver mais" keeps working.
  const loadMore = async (log) => {
    const target = document.querySelector('#OrderhistoryRows');
    if (!target) return { added: 0, done: true };

    let cursor = currentCursor();
    if (!cursor) return { added: 0, done: true };

    const maxIterations = 40;
    let totalAdded = 0;

    for (let i = 0; i < maxIterations; i += 1) {
      const response = await fetchWithTimeout(viewMoreUrl(cursor), 15000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const rows = doc.querySelectorAll('#ajaxrowstable tbody tr');
      const rowList = rows.length
        ? rows
        : doc.querySelectorAll('#ajaxrowstable tr');

      const hidden = doc.querySelector('input.startdate');
      const newCursor = hidden ? hidden.value : '';

      if (rowList.length === 0) {
        log('Sem mais pedidos antigos.');
        return { added: totalAdded, done: true };
      }

      rowList.forEach((row) =>
        target.appendChild(document.importNode(row, true)),
      );
      totalAdded += rowList.length;

      // Keep the fragment's cursor visible to the page's own handler.
      if (hidden) document.body.appendChild(document.importNode(hidden, true));

      log(`Carregados ${totalAdded} pedido(s) antigos...`);

      if (!newCursor || newCursor === cursor) {
        log('Cursor não avançou; parando a paginação.');
        return { added: totalAdded, done: true };
      }
      cursor = newCursor;
      await sleep(300);
    }

    return { added: totalAdded, done: true };
  };

  // --- Detail parsing -------------------------------------------------------

  const findItemsTable = (doc) =>
    doc.querySelector('.ui.basic.segment.tabledivnm table') ||
    [...doc.querySelectorAll('table')].find((table) =>
      /Qtde\s+encomendada/i.test(table.textContent),
    ) ||
    null;

  const cleanDetailDescription = (cell) => {
    if (!cell) return null;
    const clone = cell.cloneNode(true);
    clone.querySelectorAll('sup').forEach((node) => node.remove());
    clone.querySelectorAll('br').forEach((node) => {
      node.replaceWith(document.createTextNode(' '));
    });
    return (clone.textContent || '').replace(/\s+/g, ' ').trim() || null;
  };

  const parseDetailItems = (doc) => {
    const table = findItemsTable(doc);
    if (!table) return [];
    const rows = [...table.querySelectorAll('tr')];
    const items = [];

    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 7) continue; // header / totals rows
      const rowText = row.textContent;
      if (/Volume total:|Subtotal:|Total:/i.test(rowText)) continue;

      const code = cells[0].textContent.trim();
      if (!code) continue;

      const ordered = parseQuantity(cells[2].textContent);
      const shipped = parseQuantity(cells[1].textContent);

      items.push({
        code,
        description: cleanDetailDescription(cells[3]),
        quantity: ordered > 0 ? ordered : shipped || 1,
        unitPv: parseMoney(cells[4].textContent),
        unitPrice: parseMoney(cells[6].textContent),
      });
    }

    return items;
  };

  const matchAmount = (text, label) => {
    const pattern = new RegExp(`${label}[^0-9R]*R\\$\\s*([\\d.,]+)`, 'i');
    const match = text.match(pattern);
    return match ? parseMoney(match[1]) : null;
  };

  const parseDetail = (doc) => {
    const bodyText = doc.body ? doc.body.textContent : '';

    const installmentsMatch = bodyText.match(
      /(\d{1,2})\s*Parcelas?\s+de\s+R\$\s*([\d.,]+)/i,
    );
    const installments = installmentsMatch
      ? parseQuantity(installmentsMatch[1])
      : null;
    const installmentValue = installmentsMatch
      ? parseMoney(installmentsMatch[2])
      : null;

    const shippingValue = matchAmount(bodyText, 'Frete');
    const total = matchAmount(bodyText, 'Total a Pagar');

    // Payment table: `Tipo de Pagamento` followed by its value cell.
    let paymentType = null;
    const paymentLabel = [...doc.querySelectorAll('td, th, span, div')].find(
      (node) => /Tipo de Pagamento/i.test(node.textContent.trim()),
    );
    if (paymentLabel) {
      const row = paymentLabel.closest('tr');
      const cells = row ? [...row.querySelectorAll('td')] : [];
      const valueCell =
        cells.find((cell) => !/Tipo de Pagamento/i.test(cell.textContent)) ||
        null;
      const value = valueCell ? valueCell.textContent.trim() : '';
      if (/^Card Payment/i.test(value)) paymentType = 'CARTAO_CREDITO';
    }
    // Fallback: the installments line only exists on card purchases.
    if (!paymentType && installments) paymentType = 'CARTAO_CREDITO';

    return {
      items: parseDetailItems(doc),
      shippingValue,
      total,
      installments,
      installmentValue,
      paymentType,
    };
  };

  const fetchDetail = async (order) => {
    const href =
      order.detailHref ||
      `index.cfm?Fuseaction=evo_Modules.OrderInvoice&ODHNumber=${encodeURIComponent(order.orderNumber)}`;
    const url = new URL(href, location.href).href;
    const response = await fetchWithTimeout(url, 15000);
    if (!response.ok || /login/i.test(response.url)) {
      throw new Error(`Falha ao abrir o detalhe (${response.status})`);
    }
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return parseDetail(doc);
  };

  // --- Payload --------------------------------------------------------------

  const buildOrderPayload = (list, detail) => {
    const paymentType = detail.paymentType ?? list.paymentHint ?? null;
    const payload = {
      orderNumber: list.orderNumber,
      orderDate: list.orderDate,
      accountOwner: list.accountOwner ?? null,
      listTypeCode: list.listTypeCode ?? null,
      listOriginCode: list.listOriginCode ?? null,
      pvMonth: list.pvMonth ?? null,
      doterraPv: list.doterraPv,
      listValue: list.listValue,
      shippingValue: detail.shippingValue ?? 0,
      paymentType,
      installments: detail.installments,
      installmentValue: detail.installmentValue,
      items: detail.items.map((item) => ({
        code: item.code,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? 0,
        unitPv: item.unitPv ?? 0,
      })),
    };
    return payload;
  };

  // Builds the full payload for the given orders by fetching each detail page.
  // A detail that cannot be loaded fails that single order and never blocks the
  // batch; returns { orders, failed }.
  const buildPayload = async (orders, log) => {
    const built = [];
    const failed = [];

    for (let i = 0; i < orders.length; i += 1) {
      const order = orders[i];
      log(`Detalhe ${i + 1}/${orders.length}: pedido ${order.orderNumber}...`);
      try {
        const detail = await fetchDetail(order);
        if (!detail.items.length) {
          throw new Error('Sem itens no detalhe');
        }
        built.push(buildOrderPayload(order, detail));
      } catch (err) {
        failed.push({
          orderNumber: order.orderNumber,
          error: String(err.message || err),
        });
      }
      if (i < orders.length - 1) await sleep(400);
    }

    return { orders: built, failed };
  };

  // --- Floating box ---------------------------------------------------------

  const createBox = () => {
    const box = document.createElement('div');
    box.id = BOX_ID;
    box.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:2147483647',
      'width:320px',
      'background:#fff',
      'color:#111',
      'border:1px solid #ddd',
      'border-radius:10px',
      'box-shadow:0 6px 24px rgba(0,0,0,.25)',
      'font:13px/1.4 system-ui,sans-serif',
      'padding:12px',
    ].join(';');

    box.innerHTML = `
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px">
        <span style="font-weight:600">Pedidos dōTERRA</span>
        <span data-role="version" style="font-size:10px;color:#999"></span>
      </div>
      <div data-role="status" style="font-size:11px;color:#555;margin-bottom:8px"></div>
      <button data-role="more" type="button" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:6px;background:#fff;color:#333;cursor:pointer;margin-bottom:6px">Carregar mais antigos</button>
      <button data-role="import" type="button" style="width:100%;padding:8px;border:0;border-radius:6px;background:#1c7ed6;color:#fff;font-weight:600;cursor:pointer">Importar novos pedidos</button>
      <button data-role="copy" type="button" style="width:100%;padding:8px;border:0;border-radius:6px;background:#d6336c;color:#fff;font-weight:600;cursor:pointer;margin-top:6px">Capturar e copiar JSON</button>
      <div data-role="token" style="margin-top:6px;font-size:10px;color:#999"></div>
      <div data-role="log" style="margin-top:6px;max-height:110px;overflow:auto;font-size:10px;color:#888"></div>
    `;

    document.body.appendChild(box);

    const versionEl = box.querySelector('[data-role="version"]');
    const statusEl = box.querySelector('[data-role="status"]');
    const moreEl = box.querySelector('[data-role="more"]');
    const importEl = box.querySelector('[data-role="import"]');
    const copyEl = box.querySelector('[data-role="copy"]');
    const tokenEl = box.querySelector('[data-role="token"]');
    const logEl = box.querySelector('[data-role="log"]');

    versionEl.textContent = `v${VERSION} · ${BUILD_LABEL}`;

    const setStatus = (message, kind = 'info') => {
      statusEl.textContent = message;
      statusEl.dataset.kind = kind;
      statusEl.style.color = STATUS_COLORS[kind] ?? STATUS_COLORS.info;
    };

    const appendLog = (message) => {
      const line = document.createElement('div');
      line.textContent = message;
      logEl.appendChild(line);
      logEl.scrollTop = logEl.scrollHeight;
    };

    const clearLog = () => {
      logEl.innerHTML = '';
    };

    const setTokenState = (token) => {
      const ready = Boolean(token);
      importEl.disabled = !ready;
      tokenEl.textContent = ready
        ? `Token salvo (termina em ${token.slice(-4)}).`
        : 'Sem token. Abra o popup da extensão e salve o token gerado no app.';
    };

    const setBusy = (busy) => {
      moreEl.disabled = busy;
      importEl.disabled = busy;
      copyEl.disabled = busy;
    };

    return {
      setStatus,
      appendLog,
      clearLog,
      setTokenState,
      setBusy,
      elements: { more: moreEl, import: importEl, copy: copyEl },
    };
  };

  // --- Orchestration --------------------------------------------------------

  const renderCounts = (controller, orders) => {
    const total = orders.length;
    controller.setStatus(`${total} pedido(s) capturado(s) na página.`);
  };

  let controller = null;
  let busy = false;
  let lastCount = -1;

  const refreshCounts = () => {
    if (!controller) return;
    const orders = parseOrders();
    lastCount = orders.length;
    renderCounts(controller, orders);
  };

  const doLookup = async (numbers) => {
    const response = await sendBackground({ type: 'DOTERRA_LOOKUP', numbers });
    return response;
  };

  const importFlow = async () => {
    if (!controller || busy) return;
    const orders = parseOrders();
    if (orders.length === 0) {
      controller.setStatus('Nenhum pedido encontrado na página.', 'error');
      return;
    }

    busy = true;
    controller.clearLog();
    controller.setBusy(true);
    controller.setStatus('Consultando pedidos já importados...');

    try {
      const lookup = await doLookup(orders.map((order) => order.orderNumber));
      if (!lookup.ok) {
        throw new Error(
          lookup.error === 'AUTH'
            ? lookup.message || 'token inválido ou expirado'
            : lookup.error === 'NO_TOKEN'
              ? 'sem token salvo no popup'
              : lookup.message || `erro ${lookup.error}`,
        );
      }

      const missingNumbers = new Set(lookup.data?.missing ?? []);
      const missing = orders.filter((order) =>
        missingNumbers.has(order.orderNumber),
      );
      const existingCount = (lookup.data?.existing ?? []).length;

      controller.appendLog(
        `${orders.length} pedido(s), ${existingCount} já importado(s), ${missing.length} novo(s).`,
      );

      if (missing.length === 0) {
        controller.setStatus('Nenhum pedido novo para importar.', 'success');
        return;
      }

      controller.setStatus('Buscando o detalhe dos pedidos novos...');
      const payload = await buildPayload(missing, controller.appendLog);

      payload.failed.forEach((failure) => {
        controller.appendLog(
          `Falha no pedido ${failure.orderNumber}: ${failure.error}`,
        );
      });

      if (payload.orders.length === 0) {
        controller.setStatus(
          'Não foi possível montar nenhum pedido novo.',
          'error',
        );
        return;
      }

      const sendResult = await sendBackground({
        type: 'DOTERRA_SEND_TO_APP',
        payload: { orders: payload.orders },
      });

      if (sendResult.ok) {
        const summary = sendResult.summary ?? {};
        const serverFailures = summary.failed ?? [];

        // Surface every server-side failure (parse, validation or transaction)
        // so the reason is visible without opening DevTools.
        serverFailures.forEach((failure) => {
          controller.appendLog(`Falha em ${describeFailure(failure)}`);
        });

        const counts = `${(summary.created ?? []).length} criado(s), ${(summary.existing ?? []).length} já existia(m), ${serverFailures.length} falha(s)`;
        const detail = serverFailures.length
          ? ` Falha: ${describeFailure(serverFailures[0])}${serverFailures.length > 1 ? ` (+${serverFailures.length - 1})` : ''}.`
          : '';

        controller.setStatus(
          `Importado: ${counts}.${detail} Abrindo o app…`,
          serverFailures.length ? 'warning' : 'success',
        );
        return;
      }

      const reason =
        sendResult.error === 'AUTH'
          ? sendResult.message || 'token inválido ou expirado'
          : sendResult.error === 'NO_TOKEN'
            ? 'sem token salvo no popup'
            : sendResult.message || `erro ${sendResult.error}`;
      controller.setStatus(
        `Envio falhou (${reason}). JSON copiado: cole na tela de importação do app.`,
        'error',
      );
      await copyToClipboard(
        JSON.stringify({ orders: payload.orders }, null, 2),
      );
    } catch (err) {
      controller.setStatus(`Falha: ${String(err.message || err)}`, 'error');
    } finally {
      busy = false;
      controller.setBusy(false);
      if (controller) controller.setTokenState(currentToken);
    }
  };

  const copyFlow = async () => {
    if (!controller || busy) return;
    const orders = parseOrders();
    if (orders.length === 0) {
      controller.setStatus('Nenhum pedido encontrado na página.', 'error');
      return;
    }

    busy = true;
    controller.clearLog();
    controller.setBusy(true);
    controller.setStatus('Buscando o detalhe dos pedidos...');

    try {
      // The manual path has no server lookup: build the detail for every order
      // currently in the table (already-imported ones are ignored server-side).
      const payload = await buildPayload(orders, controller.appendLog);
      const json = JSON.stringify({ orders: payload.orders }, null, 2);
      const copied = await copyToClipboard(json);
      controller.setStatus(
        copied
          ? `JSON copiado (${payload.orders.length} pedido(s)). Cole na tela de importação do app.`
          : 'JSON gerado, mas a cópia falhou. Veja o console (F12).',
        copied ? 'success' : 'error',
      );
      if (!copied) console.log(json);
    } catch (err) {
      controller.setStatus(`Falha: ${String(err.message || err)}`, 'error');
    } finally {
      busy = false;
      controller.setBusy(false);
      if (controller) controller.setTokenState(currentToken);
    }
  };

  // --- Mount ----------------------------------------------------------------

  let currentToken = '';

  const isOrderHistoryPage = () =>
    /fuseaction=evo_modules\.orderhistoryfull/i.test(location.search);

  const mount = async () => {
    if (document.getElementById(BOX_ID)) return;
    if (!isOrderHistoryPage()) return;

    controller = createBox();
    refreshCounts();
    controller.setStatus('Lendo os pedidos da página...');

    currentToken = await loadStoredToken();
    controller.setTokenState(currentToken);
    controller.setBusy(false);

    controller.elements.more.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      controller.setBusy(true);
      controller.setStatus('Carregando pedidos mais antigos...');
      try {
        await loadMore(controller.appendLog);
        refreshCounts();
        controller.setStatus('Paginação concluída.');
      } catch (err) {
        controller.setStatus(
          `Falha na paginação: ${String(err.message || err)}`,
          'error',
        );
      } finally {
        busy = false;
        controller.setBusy(false);
        controller.setTokenState(currentToken);
      }
    });

    controller.elements.import.addEventListener('click', importFlow);
    controller.elements.copy.addEventListener('click', copyFlow);

    const target = document.querySelector('#OrderhistoryRows');
    if (target && typeof MutationObserver !== 'undefined') {
      let debounce = null;
      const observer = new MutationObserver(() => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          const orders = parseOrders();
          if (orders.length !== lastCount) refreshCounts();
        }, 250);
      });
      observer.observe(target, { childList: true });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
