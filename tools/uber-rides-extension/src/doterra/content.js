/**
 * ISOLATED-world content script for the dōTERRA Back Office (single
 * self-contained file).
 *
 * Mounts a floating box on two Back Office pages:
 * - `evo_Modules.OrderHistoryFull` (Rastreamento de Pedidos e Pacotes): parses
 *   the order table and can auto-paginate the page's "Ver mais" flow.
 * - `evo_Modules.AccountInquiry` (Consulta da Conta): month-by-month ledger;
 *   the box keeps only wholesale rows (type `I`) and navigates the page's own
 *   month AJAX.
 *
 * On both pages it fetches the detail page of orders the backend does not have
 * yet, then either copies a capture JSON or sends it straight to the app.
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

  // Money appears in two shapes on the Back Office pages:
  //
  //   - Brazilian: `R$ 1.045,63` — dot thousands, comma decimal. The list
  //     table, the totals block, and the freight label all use this format.
  //   - Decimal-only: `R$ 199.00` — dot decimal, no thousands. The items
  //     table sometimes drops the thousands separator for single-line orders.
  //
  // The previous implementation treated every comma as a thousands separator
  // (the safe choice for English-shaped numbers), which silently inflated
  // BRL amounts by 100× whenever the value had a decimal comma (e.g.
  // `R$ 7,00` → 700, `R$ 53,33` → 5333). The detail parser only sees the
  // totals block for `installmentValue` and `total`, so the bug stayed
  // quiet on lists and showed up in installment math.
  //
  // Detection rule: if a comma is the **last** numeric separator (i.e. the
  // string ends with `,dd` or `,ddd`), it is the decimal mark; otherwise
  // commas are thousands. This covers every shape seen in the wild without
  // needing a locale library.
  const parseMoney = (value) => {
    if (value == null) return null;
    const cleaned = String(value)
      .replace(/R\$/gi, '')
      .replace(/[\s\u00a0]/g, '')
      .trim();
    if (!cleaned) return null;

    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    let normalized;
    if (lastComma > lastDot) {
      // Comma is the decimal mark: drop dots (thousands) and swap comma → dot.
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Dot is the decimal mark: drop commas (thousands, if any).
      normalized = cleaned.replace(/,/g, '');
    }

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

  const fetchWithTimeout = async (url, timeoutMs, headers) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        credentials: 'same-origin',
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  // --- Module detection -----------------------------------------------------

  // The Back Office exposes the capture on two pages, each with its own URL:
  // `OrderHistoryFull` (a paginated order list) and `AccountInquiry` (a
  // month-by-month ledger). Both feed the same import flow; only the listing
  // differs, so the module decides the parser and the box's navigation buttons.
  const orderHistoryPage = () =>
    /fuseaction=evo_modules\.orderhistoryfull/i.test(location.search);

  const accountInquiryPage = () =>
    /fuseaction=evo_modules\.accountinquiry/i.test(location.search);

  const activeModule = () => {
    if (accountInquiryPage()) return 'accountInquiry';
    if (orderHistoryPage()) return 'orderHistory';
    return null;
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

  // --- AccountInquiry parsing ----------------------------------------------

  const INQUIRY_TABLE_ID = 'AITableDiv';
  const INQUIRY_MONTH_INPUT_ID = 'FromDate';

  const inquiryOwner = () => {
    const headings = document.querySelectorAll(`#${INQUIRY_TABLE_ID} h4`);
    for (const heading of headings) {
      const text = heading.textContent.trim();
      if (text && !/Total de Registros/i.test(text)) return text;
    }
    return null;
  };

  // The ledger mixes transaction types (I = wholesale, P = payment, BC/BE/BP…
  // = bonus adjustments). Only the wholesale order rows (type `I`) map to a
  // dōTERRA order; the rest are intentionally skipped — the app derives the
  // matching ledger entries from the order itself.
  const parseInquiryRow = (row, owner) => {
    const cells = row.cells;
    if (!cells || cells.length < 6) return null;

    const type = cells[0].textContent.trim().toUpperCase();
    if (type !== 'I') return null;

    const numberLink = cells[3].querySelector('a');
    const orderNumber = (
      numberLink ? numberLink.textContent : cells[3].textContent
    ).trim();
    if (!orderNumber) return null;

    return {
      orderNumber,
      detailHref: numberLink ? numberLink.getAttribute('href') : null,
      orderDate: toIsoDate(cells[2].textContent),
      accountOwner: owner,
      listTypeCode: type,
      listOriginCode: null,
      pvMonth: null,
      // The detail page is authoritative for items/freight/payment; the ledger
      // columns only feed the server-side value cross-check.
      doterraPv: parseMoney(cells[4].textContent),
      listValue: parseMoney(cells[5].textContent),
      paymentHint: null,
      items: [],
    };
  };

  const parseInquiryOrders = () => {
    const owner = inquiryOwner();
    const rows = document.querySelectorAll(
      `#${INQUIRY_TABLE_ID} table.evotable tbody tr`,
    );
    const orders = [];
    rows.forEach((row) => {
      const parsed = parseInquiryRow(row, owner);
      if (parsed) orders.push(parsed);
    });
    return orders;
  };

  // --- AccountInquiry month navigation -------------------------------------

  const monthLabel = (iso) => {
    const [year, month] = iso.split('-');
    return `${Number(month)}/${year}`;
  };

  const currentMonthInput = () =>
    document.getElementById(INQUIRY_MONTH_INPUT_ID);

  // Month currently shown: the page input (`MM/YYYY`), then the `?to=YYYYMM`
  // query string, then the current month.
  const currentInquiryMonth = () => {
    const input = currentMonthInput();
    const fromInput = input ? toIsoMonth(input.value) : null;
    if (fromInput) return fromInput;

    const param = new URLSearchParams(location.search).get('to');
    if (param && /^\d{6}$/.test(param)) {
      return `${param.slice(0, 4)}-${param.slice(4)}`;
    }

    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  };

  const shiftInquiryMonth = (iso, delta) => {
    const [year, month] = iso.split('-').map(Number);
    const shifted = new Date(year, month - 1 + delta, 1);
    return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}`;
  };

  const inquiryResultsUrl = (iso) => {
    const params = new URLSearchParams({
      Fuseaction: 'evo_Modules.AccountInquiry',
      axn: 'ResultsTable',
      to: iso.replace('-', ''),
      from: iso.replace('-', ''),
      _: String(Date.now()),
    });
    return `index.cfm?${params.toString()}`;
  };

  // Reproduces the page's own `getAIResults` AJAX (the `#AITableDiv` swap).
  // That function lives in the MAIN world and cannot be called from this
  // ISOLATED script, so the request is reissued here (with jQuery's
  // `X-Requested-With` header) and the fragment is injected back into the page,
  // keeping the month input in sync.
  const loadInquiryMonth = async (iso) => {
    const response = await fetchWithTimeout(inquiryResultsUrl(iso), 15000, {
      'X-Requested-With': 'XMLHttpRequest',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const hasRows = /evotable/i.test(html);
    if (!hasRows && /login/i.test(html)) {
      throw new Error('Sessão expirada — faça login novamente.');
    }

    const input = currentMonthInput();
    if (input) input.value = monthLabel(iso);

    const container = document.getElementById(INQUIRY_TABLE_ID);
    if (container) container.innerHTML = hasRows ? html : '';

    return { hasRows };
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

  // Pure pagination core. Extracted from `loadMore` so the empty-response
  // ("border page") handling can be unit-tested without a real DOM or
  // network — the production caller still does the I/O and DOM work and
  // delegates only the iteration decisions to this function.
  //
  // `fetcher(cursor)` must return the fragment HTML for the given cursor.
  // `target` is the live DOM node to which rows are appended (the live
  // DOM, not a stub, keeps `document.importNode` consistent with the
  // rest of the content script). `log` receives human-readable status
  // lines.
  //
  // Returns `{ added, done, iterations }`. `done: true` means the loop
  // reached a real end (empty body, stalled cursor, or max iterations).
  const paginate = async ({
    initialCursor,
    target,
    fetcher,
    log,
    maxIterations = 40,
    sleepMs = 300,
  }) => {
    let cursor = initialCursor;
    let totalAdded = 0;
    let emptyStreak = 0;
    let iterations = 0;

    const advance = async (nextCursor, hiddenNode) => {
      if (hiddenNode) target.ownerDocument.body.appendChild(hiddenNode);
      cursor = nextCursor;
      await sleep(sleepMs);
    };

    for (let i = 0; i < maxIterations; i += 1) {
      iterations = i + 1;
      const html = await fetcher(cursor);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const rows = doc.querySelectorAll('#ajaxrowstable tbody tr');
      const rowList = rows.length
        ? rows
        : doc.querySelectorAll('#ajaxrowstable tr');

      const hidden = doc.querySelector('input.startdate');
      const hiddenNode = hidden
        ? target.ownerDocument.importNode(hidden, true)
        : null;
      const newCursor = hidden ? hidden.value : '';

      if (rowList.length === 0) {
        emptyStreak += 1;

        // Border page: empty rows but the cursor advanced — keep going.
        // The server may hand back a month whose orders only resolve on
        // the next click (this is the "click twice to see the rows" quirk
        // reproduced in `paginate.test.js`).
        if (newCursor && newCursor !== cursor && emptyStreak < 2) {
          log(
            `Página de borda em ${cursor}; tentando ${newCursor} (sem pedidos nesta resposta).`,
          );
          await advance(newCursor, hiddenNode);
          continue;
        }

        log('Sem mais pedidos antigos.');
        return { added: totalAdded, done: true, iterations };
      }

      emptyStreak = 0;
      const ownerDoc = target.ownerDocument;
      rowList.forEach((row) =>
        target.appendChild(ownerDoc.importNode(row, true)),
      );
      totalAdded += rowList.length;

      log(`Carregados ${totalAdded} pedido(s) antigos...`);

      if (!newCursor || newCursor === cursor) {
        log('Cursor não avançou; parando a paginação.');
        return { added: totalAdded, done: true, iterations };
      }
      await advance(newCursor, hiddenNode);
    }

    log('Limite de paginação atingido.');
    return { added: totalAdded, done: true, iterations };
  };

  // Replicates the page's own VIEWMORE handler: fetch the fragment, move its
  // rows into `#OrderhistoryRows`, keep the returned hidden `.startdate` cursor
  // and drop the fragment table so the page's "Ver mais" keeps working.
  //
  // The Back Office has a quirk on some accounts where a `ViewMoreCount`
  // call returns an empty `<tbody></tbody>` **together with a new cursor**
  // (the page bumped to the previous month but did not attach any rows).
  // The next click on that same cursor then returns the rows. The previous
  // loop bailed out on the first empty response and left the user with a
  // half-loaded table — exactly what the bug report showed. `paginate`
  // treats an empty response as "border page" (continue) unless the cursor
  // stalled **or** we have seen two empties in a row, in which case the
  // real end is reached and the loop stops. The cursor is monotonically
  // decreasing (each click moves one or more months back), so there is no
  // risk of looping forever even without that guard — the empty-twice rule
  // is belt-and-braces against a server that returns the same cursor twice.
  const loadMore = async (log) => {
    const target = document.querySelector('#OrderhistoryRows');
    if (!target) return { added: 0, done: true };

    const initialCursor = currentCursor();
    if (!initialCursor) return { added: 0, done: true };

    return paginate({
      initialCursor,
      target,
      fetcher: async (cursor) => {
        const response = await fetchWithTimeout(viewMoreUrl(cursor), 15000);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      },
      log,
    });
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

  // Identifies the columns of the items table by reading the header labels.
  // The Back Office emits the items table in two layouts depending on the
  // order type:
  //
  //   - 7 columns for items with a PV column:
  //     `Item | Qtde enviada | Qtde encomendada | Descrição | PV | Preço | Preço total`
  //   - 6 columns for kits / promo bundles (`BOGO`, `Loyalty`, `Fast Start`),
  //     replacement orders, or any order where PV is not broken out per line:
  //     `Item | Qtde enviada | Qtde encomendada | Descrição | Preço | Preço total`
  //
  // The first layout has `PV` between Descrição and Preço; the second omits
  // PV entirely. Returning `null` here means `parseDetailItems` falls back to
  // a positional read so a layout change in the header is enough to update
  // the parser — no hard-coded index surgery on `cells[N]`.
  const detectItemsColumns = (headerCells) => {
    if (!headerCells.length) return null;
    const labels = [...headerCells].map((cell) =>
      cell.textContent.trim().toLowerCase(),
    );
    const findIndex = (regex) => labels.findIndex((label) => regex.test(label));

    const codeIdx = findIndex(/^item$/);
    const shippedIdx = findIndex(/qtde\s+enviada|qtde\s+enviado/);
    const orderedIdx = findIndex(/qtde\s+encomendada/);
    const descriptionIdx = findIndex(/^descri[çc][ãa]o$/);
    const pvIdx = findIndex(/^pv$/);
    const unitPriceIdx = findIndex(/^pre[çc]o$/);
    const totalIdx = findIndex(/pre[çc]o\s+total/);

    if (codeIdx < 0 || orderedIdx < 0 || descriptionIdx < 0) return null;

    return {
      codeIdx,
      shippedIdx,
      orderedIdx,
      descriptionIdx,
      pvIdx,
      unitPriceIdx,
      totalIdx,
    };
  };

  const parseDetailItems = (doc) => {
    const table = findItemsTable(doc);
    if (!table) return [];
    const headerCells = table.querySelectorAll('thead th');
    // Fall back to the first body row's <th> cells if the layout uses <th>
    // inside <tbody> for the header.
    const headerSource = headerCells.length
      ? headerCells
      : (
          table.querySelector('tbody tr.InvoiceHeader') ||
          table.querySelector('tbody tr')
        ).querySelectorAll('th');
    const columns = detectItemsColumns(headerSource);
    const items = [];

    for (const row of table.querySelectorAll('tbody tr')) {
      const cells = row.querySelectorAll('td');
      const rowText = row.textContent;
      if (/Volume total:|Subtotal:|Total:/i.test(rowText)) continue;

      // Totals / subtotal rows have colspan; an empty item code is also a
      // strong "not an item" signal. Both bail before the column lookup.
      const codeCell = columns ? cells[columns.codeIdx] : cells[0];
      if (!codeCell) continue;
      const code = codeCell.textContent.trim();
      if (!code) continue;

      const valueAt = (idx) =>
        idx >= 0 && idx < cells.length ? cells[idx] : null;

      const ordered = columns
        ? parseQuantity(valueAt(columns.orderedIdx)?.textContent ?? '')
        : parseQuantity(cells[2]?.textContent ?? '');
      const shipped = columns
        ? parseQuantity(valueAt(columns.shippedIdx)?.textContent ?? '')
        : parseQuantity(cells[1]?.textContent ?? '');

      // Layout-driven mapping. 7-column tables expose `PV`; 6-column tables
      // do not — in that case `Preço` is the only monetary column and the
      // table total is `Preço total`. The previous hard-coded `[4]`/`[6]`
      // read silently returned `0` for every 6-column order, which is the
      // bug that produced "Sem itens no detalhe" for BOGO / replacement
      // orders.
      const unitPv = columns
        ? parseMoney(valueAt(columns.pvIdx)?.textContent ?? '')
        : null;
      const unitPriceCell = columns
        ? (valueAt(columns.unitPriceIdx) ?? valueAt(columns.totalIdx))
        : cells[4];
      const unitPrice = parseMoney(unitPriceCell?.textContent ?? '');

      items.push({
        code,
        description: cleanDetailDescription(
          columns ? valueAt(columns.descriptionIdx) : cells[3],
        ),
        quantity: ordered > 0 ? ordered : shipped || 1,
        unitPv,
        unitPrice: unitPrice ?? 0,
      });
    }

    return items;
  };

  // Finds the first `R$` amount that follows `label`. The gap between the
  // label and the amount may hold digits (a method, a percentage) and letters
  // — notably the "r" of "Envio Normal" — so it is matched lazily with
  // `[\s\S]*?`. The previous `[^0-9R]*` gap silently failed for every order
  // whose freight method contained an "r" (the /i flag also removed lowercase
  // "r" from the negated class), dropping the freight to zero.
  const matchAmount = (text, label) => {
    const pattern = new RegExp(`${label}[\\s\\S]*?R\\$\\s*([\\d.,]+)`, 'i');
    const match = text.match(pattern);
    return match ? parseMoney(match[1]) : null;
  };

  // Reads the order-level freight from the detail page. The totals table labels
  // the row "Frete" and the amount sits either in the same cell ("Frete:
  // R$ 12.50") or in the next cell of the row ("Frete | R$ 12.50" / "12.50").
  // The DOM lookup is the primary path, robust to the label moving around or
  // the value dropping the currency symbol; the textual scan stays as a
  // fallback so a layout change never regresses to a silent zero. Every
  // candidate whose label is "Frete" is tried in document order (a header in
  // the items table must not shadow the real totals row). Returns null when
  // nothing is found.
  const extractShipping = (doc) => {
    const candidates = [
      ...doc.querySelectorAll('td, th, span, div, strong, b'),
    ].filter((node) => {
      const text = node.textContent.trim();
      return /^Frete\b/i.test(text) && text.length <= 40;
    });

    for (const label of candidates) {
      const inline = matchAmount(label.textContent, 'Frete');
      if (inline != null) return inline;

      const row = label.closest('tr');
      if (!row) continue;
      const cells = [...row.querySelectorAll('td, th')];
      const index = cells.findIndex((cell) => cell.contains(label));
      const valueCell =
        index >= 0 ? (cells[index + 1] ?? cells[cells.length - 1]) : null;
      const parsed = valueCell ? parseMoney(valueCell.textContent) : null;
      if (parsed != null) return parsed;
    }

    return matchAmount(doc.body ? doc.body.textContent : '', 'Frete');
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

    const shippingValue = extractShipping(doc);
    const total = matchAmount(bodyText, 'Total a Pagar');

    // A null freight is ambiguous (the order may legitimately ship free). The
    // capture never fails the order; it surfaces a line in the floating box so
    // the user reviews that order during `pendingReview`.
    const warnings = [];
    if (shippingValue == null) {
      warnings.push('Frete não capturado no detalhe — confira o pedido.');
    }

    // Payment table: `Tipo de Pagamento` followed by its value cell.
    //
    // The OrderInvoice payment block has a structural pitfall: the first row
    // uses `<td colspan="2">Tipo de Pagamento</td>` as a section header, then
    // a later row carries the real `<b>Tipo de Pagamento</b> | <value>`
    // pair. Picking the first match would land on the section header — a
    // colspan cell whose row has no sibling cells — and silently produce
    // `paymentType = null` even when the page clearly shows "Card Payment".
    // Iterate every candidate and prefer the one whose own text is just the
    // label (a heading or a `<b>`), so the value cell sits next to it.
    let paymentType = null;
    const paymentLabels = [...doc.querySelectorAll('td, th, span, div')].filter(
      (node) => /^\s*Tipo de Pagamento\s*$/i.test(node.textContent.trim()),
    );
    for (const paymentLabel of paymentLabels) {
      const row = paymentLabel.closest('tr');
      const cells = row ? [...row.querySelectorAll('td')] : [];
      const valueCell =
        cells.find((cell) => !/Tipo de Pagamento/i.test(cell.textContent)) ||
        null;
      const value = valueCell ? valueCell.textContent.trim() : '';
      if (/^Card Payment/i.test(value)) {
        paymentType = 'CARTAO_CREDITO';
        break;
      }
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
      warnings,
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
        (detail.warnings ?? []).forEach((warning) => {
          log(`Pedido ${order.orderNumber}: ${warning}`);
        });
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

  const createBox = (module) => {
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

    const isInquiry = module === 'accountInquiry';
    const importLabel = isInquiry
      ? 'Importar pedidos do mês'
      : 'Importar novos pedidos';

    // The AccountInquiry has no "Ver mais" cursor: the ledger is month-scoped,
    // so the box navigates the page's own month AJAX instead of paginating.
    const navButtons = isInquiry
      ? `
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <button data-role="prev" type="button" style="flex:1;padding:6px;border:1px solid #ccc;border-radius:6px;background:#fff;color:#333;cursor:pointer">‹ Mês anterior</button>
        <button data-role="next" type="button" style="flex:1;padding:6px;border:1px solid #ccc;border-radius:6px;background:#fff;color:#333;cursor:pointer">Mês seguinte ›</button>
      </div>
      <button data-role="goto" type="button" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:6px;background:#fff;color:#333;cursor:pointer;margin-bottom:6px">IR PARA o mês exibido</button>
      `
      : `
      <button data-role="more" type="button" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:6px;background:#fff;color:#333;cursor:pointer;margin-bottom:6px">Carregar mais antigos</button>
      `;

    box.innerHTML = `
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px">
        <span style="font-weight:600">Pedidos dōTERRA</span>
        <span data-role="version" style="font-size:10px;color:#999"></span>
      </div>
      <div data-role="status" style="font-size:11px;color:#555;margin-bottom:8px"></div>
      ${navButtons}
      <button data-role="import" type="button" style="width:100%;padding:8px;border:0;border-radius:6px;background:#1c7ed6;color:#fff;font-weight:600;cursor:pointer">${importLabel}</button>
      <button data-role="copy" type="button" style="width:100%;padding:8px;border:0;border-radius:6px;background:#d6336c;color:#fff;font-weight:600;cursor:pointer;margin-top:6px">Capturar e copiar JSON</button>
      <div data-role="token" style="margin-top:6px;font-size:10px;color:#999"></div>
      <div data-role="log" style="margin-top:6px;max-height:110px;overflow:auto;font-size:10px;color:#888"></div>
    `;

    document.body.appendChild(box);

    const versionEl = box.querySelector('[data-role="version"]');
    const statusEl = box.querySelector('[data-role="status"]');
    const importEl = box.querySelector('[data-role="import"]');
    const copyEl = box.querySelector('[data-role="copy"]');
    const tokenEl = box.querySelector('[data-role="token"]');
    const logEl = box.querySelector('[data-role="log"]');

    const elements = {
      more: box.querySelector('[data-role="more"]'),
      prev: box.querySelector('[data-role="prev"]'),
      next: box.querySelector('[data-role="next"]'),
      goTo: box.querySelector('[data-role="goto"]'),
      import: importEl,
      copy: copyEl,
    };

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
      Object.values(elements).forEach((el) => {
        if (el) el.disabled = busy;
      });
    };

    return {
      setStatus,
      appendLog,
      clearLog,
      setTokenState,
      setBusy,
      elements,
    };
  };

  // --- Orchestration --------------------------------------------------------

  const renderCounts = (controller, orders) => {
    const total = orders.length;
    if (activeKind === 'accountInquiry') {
      controller.setStatus(
        `${total} pedido(s) do tipo I em ${monthLabel(currentInquiryMonth())}.`,
      );
      return;
    }
    controller.setStatus(`${total} pedido(s) capturado(s) na página.`);
  };

  let controller = null;
  let busy = false;
  let lastCount = -1;
  let activeKind = null;

  // Reads the orders from whichever module the tab is on.
  const pullOrders = () =>
    activeKind === 'accountInquiry' ? parseInquiryOrders() : parseOrders();

  const refreshCounts = () => {
    if (!controller) return;
    const orders = pullOrders();
    lastCount = orders.length;
    renderCounts(controller, orders);
  };

  const doLookup = async (numbers) => {
    const response = await sendBackground({ type: 'DOTERRA_LOOKUP', numbers });
    return response;
  };

  const importFlow = async () => {
    if (!controller || busy) return;
    const orders = pullOrders();
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
    const orders = pullOrders();
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

  const mountOrderHistory = (controller) => {
    controller.elements.more?.addEventListener('click', async () => {
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

    const target = document.querySelector('#OrderhistoryRows');
    if (target && typeof MutationObserver !== 'undefined') {
      let debounce = null;
      const observer = new MutationObserver(() => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          const orders = pullOrders();
          if (orders.length !== lastCount) refreshCounts();
        }, 250);
      });
      observer.observe(target, { childList: true });
    }
  };

  const mountAccountInquiry = (controller) => {
    // Reuses the page's month AJAX (reproduced in the ISOLATED world). The
    // `IR PARA` button reloads the displayed month; the arrows shift by one.
    const loadMonth = async (iso, label) => {
      if (busy) return;
      busy = true;
      controller.setBusy(true);
      controller.setStatus(`Carregando ${label}...`);
      try {
        const { hasRows } = await loadInquiryMonth(iso);
        refreshCounts();
        controller.setStatus(
          hasRows ? `Mês ${label} carregado.` : `Nenhum registro em ${label}.`,
          hasRows ? 'success' : 'warning',
        );
      } catch (err) {
        controller.setStatus(
          `Falha ao carregar o mês: ${String(err.message || err)}`,
          'error',
        );
      } finally {
        busy = false;
        controller.setBusy(false);
        controller.setTokenState(currentToken);
      }
    };

    controller.elements.prev?.addEventListener('click', () => {
      const target = shiftInquiryMonth(currentInquiryMonth(), -1);
      loadMonth(target, monthLabel(target));
    });
    controller.elements.next?.addEventListener('click', () => {
      const target = shiftInquiryMonth(currentInquiryMonth(), 1);
      loadMonth(target, monthLabel(target));
    });
    controller.elements.goTo?.addEventListener('click', () => {
      const target = currentInquiryMonth();
      loadMonth(target, monthLabel(target));
    });

    const aiTable = document.getElementById(INQUIRY_TABLE_ID);
    if (aiTable && typeof MutationObserver !== 'undefined') {
      let debounce = null;
      const observer = new MutationObserver(() => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          const orders = pullOrders();
          if (orders.length !== lastCount) refreshCounts();
        }, 250);
      });
      observer.observe(aiTable, { childList: true });
    }
  };

  const mount = async () => {
    if (document.getElementById(BOX_ID)) return;
    activeKind = activeModule();
    if (!activeKind) return;

    controller = createBox(activeKind);

    // `setBusy(false)` re-enables every button, so the token gate must be
    // reapplied afterwards (no token → import stays disabled).
    currentToken = await loadStoredToken();
    controller.setBusy(false);
    controller.setTokenState(currentToken);

    if (activeKind === 'accountInquiry') {
      mountAccountInquiry(controller);
    } else {
      mountOrderHistory(controller);
    }

    controller.elements.import?.addEventListener('click', importFlow);
    controller.elements.copy?.addEventListener('click', copyFlow);

    controller.setStatus('Lendo os pedidos da página...');
    refreshCounts();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  // --- Test escape hatch -----------------------------------------------------
  //
  // The dōTERRA content script is intentionally a single self-contained file
  // (see AGENTS.md): it must not import modules or share a namespace with the
  // other content scripts. The trade-off is that the parsers live inside the
  // IIFE and would otherwise be untestable from Vitest.
  //
  // When `globalThis.__DOTERRA_PARSERS__` is set (only by `tests/setup.js`,
  // which runs before this file in the Vitest environment), we hand the pure
  // helpers to the test runner. In production the sentinel is missing and
  // nothing is exposed. The list is intentionally narrow: parsers, never the
  // UI orchestrators, so the floating box stays bound to the live DOM.
  if (typeof globalThis !== 'undefined' && globalThis.__DOTERRA_PARSERS__) {
    globalThis.__DOTERRA_PARSERS__ = {
      detectItemsColumns,
      parseDetail,
      parseDetailItems,
      parseMoney,
      parseQuantity,
      parseRow,
      parseOrders,
      parseInquiryRow,
      parseInquiryOrders,
      findItemsTable,
      extractShipping,
      matchAmount,
      toIsoDate,
      toIsoMonth,
      cleanDetailDescription,
      buildOrderPayload,
      viewMoreUrl,
      currentCursor,
      paginate,
    };
  }
})();
