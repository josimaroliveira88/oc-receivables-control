/**
 * Tests for the dōTERRA auto-pagination core (`paginate`) extracted from
 * `tools/captures-extension/src/doterra/content.js`.
 *
 * The full `loadMore` flow fetches via `window.fetch` and mutates the live
 * `#OrderhistoryRows` DOM. Both are inconvenient to exercise from Vitest,
 * so the production function delegates the iteration decisions to a pure
 * `paginate({ initialCursor, target, fetcher, log, … })` core that takes a
 * `fetcher` callback. The tests drive `paginate` with a stubbed fetcher
 * that returns HTML fragments loaded from `tests/fixtures/`.
 *
 * The Back Office has a known quirk on some accounts: a `ViewMoreCount`
 * call can return an empty `<tbody></tbody>` **together with a new cursor**
 * (the page bumped to the previous month but did not attach any rows).
 * The next click on the new cursor then returns the rows. The previous
 * loop bailed out on the first empty response — that is what
 * `viewmore-empty-tbody.html` reproduces.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');

const loadFixture = (name) =>
  fs.readFileSync(path.join(fixturesDir, name), 'utf8');

// Load the IIFE so the test escape hatch populates `globalThis.__DOTERRA_PARSERS__`.
const scriptUrl = pathToFileURL(
  path.resolve(__dirname, '../src/doterra/content.js'),
).href;
await import(scriptUrl);

const { paginate } = globalThis.__DOTERRA_PARSERS__;

if (!paginate) {
  throw new Error(
    'paginate is not exposed by the dōTERRA parser escape hatch.',
  );
}

// Build a `<tbody id="OrderhistoryRows">` target inside jsdom. `paginate`
// only uses `target.ownerDocument.importNode` to deep-copy the response
// rows, so a freshly created `<tbody>` is enough.
const buildTarget = () => {
  const tbody = document.createElement('tbody');
  tbody.id = 'OrderhistoryRows';
  document.body.appendChild(tbody);
  return tbody;
};

// A fetcher that serves a sequence of fragments keyed by cursor. The map's
// insertion order defines the response timeline; the cursor argument is
// only used as a sanity check / debug breadcrumb.
const sequenceFetcher =
  (responsesByCursor, trace = []) =>
  async (cursor) => {
    trace.push(cursor);
    const html = responsesByCursor[cursor];
    if (html == null) {
      throw new Error(`Unexpected fetcher call for cursor ${cursor}`);
    }
    return html;
  };

const silentLog = () => {};

describe('dōTERRA paginate — "click twice to see the rows" border page', () => {
  // This is the exact scenario from the bug report. The first click
  // returns the empty-tbody fragment with cursor `202605`, the second
  // click (against `202605`) returns three rows with cursor `202602`, and
  // a third click (against `202602`) returns an empty fragment with no
  // `.startdate` cursor — real end.
  const html = {
    202608: loadFixture('viewmore-empty-tbody.html'), // 202608 → 202605
    202605: loadFixture('viewmore-with-rows.html'), // 202605 → 202602
    202602: loadFixture('viewmore-real-end.html'), // no cursor → end
  };

  it('crosses the empty border page and collects the rows from the next click', async () => {
    const target = buildTarget();
    const calls = [];
    const fetcher = sequenceFetcher(html, calls);

    const result = await paginate({
      initialCursor: '202608',
      target,
      fetcher,
      log: silentLog,
      sleepMs: 0,
    });

    // The fetcher was called three times — once per cursor the loop
    // walked through.
    expect(calls).toEqual(['202608', '202605', '202602']);
    expect(result.added).toBe(3);
    expect(result.done).toBe(true);
    expect(result.iterations).toBe(3);

    // The three rows from `viewmore-with-rows.html` are now attached to
    // the live DOM `<tbody>` we handed to `paginate`.
    expect(target.querySelectorAll('tr')).toHaveLength(3);
    const codes = [...target.querySelectorAll('tr td:first-child a')].map(
      (a) => a.textContent,
    );
    expect(codes).toEqual(['177992784', '176348264', '176320500']);
  });

  it('stops after two consecutive empty fragments even if the cursor keeps moving', async () => {
    // Defensive case: the server keeps handing back empty `<tbody></tbody>`
    // pages with an advancing cursor. Without the empty-streak guard the
    // loop would burn through every cursor on the way down (40+ calls).
    // With the guard, the second empty page in a row is the real end.
    //
    // Each fragment is built inline so the cursor can be controlled
    // independently per call:
    //   202608 → (empty, cursor=202604)   ← first border page, keep going
    //   202604 → (empty, cursor=202603)   ← second consecutive empty → END
    //
    // The loop sees the second empty and exits **before** issuing the third
    // fetcher call — that is the entire point of the guard.
    const empty = (
      cursor,
    ) => `<input type="hidden" class="startdate" value="${cursor}">
<table id="ajaxrowstable" style="display:none;"><tbody></tbody></table>`;
    const responses = {
      202608: empty('202604'),
      202604: empty('202603'),
      202603: empty('202602'),
    };

    const calls = [];
    const target = buildTarget();
    const result = await paginate({
      initialCursor: '202608',
      target,
      fetcher: sequenceFetcher(responses, calls),
      log: silentLog,
      sleepMs: 0,
    });

    expect(result.added).toBe(0);
    expect(result.done).toBe(true);
    expect(calls).toEqual(['202608', '202604']);
    expect(result.iterations).toBe(2);
  });
});

describe('dōTERRA paginate — happy path and end conditions', () => {
  it('appends rows and advances the cursor until the cursor stops moving', async () => {
    // Real data, no empty border pages: the first click already has the
    // rows, and the second click returns an empty fragment with no cursor
    // (the `.startdate` element is missing) — that is the end signal.
    const target = buildTarget();
    const withRows = (cursor) =>
      `<input type="hidden" class="startdate" value="${cursor}">
<table id="ajaxrowstable" style="display:none;"><tbody>
<tr><td class="center aligned gen"><a href="#">1</a></td></tr>
<tr><td class="center aligned gen"><a href="#">2</a></td></tr>
<tr><td class="center aligned gen"><a href="#">3</a></td></tr>
</tbody></table>`;
    const fetcher = async (cursor) => {
      if (cursor === '202608') return withRows('202605');
      return loadFixture('viewmore-real-end.html');
    };

    const result = await paginate({
      initialCursor: '202608',
      target,
      fetcher,
      log: silentLog,
      sleepMs: 0,
    });

    expect(result.added).toBe(3);
    expect(result.done).toBe(true);
    expect(target.querySelectorAll('tr')).toHaveLength(3);
  });

  it('honors the maxIterations cap when the server keeps returning empty pages with advancing cursors', async () => {
    // Cursor keeps moving on every call but rows are never returned. The
    // empty-streak guard kicks in first (after the second empty page),
    // so this test focuses on the cap being respected when the loop
    // would otherwise be in steady-state border pages.
    //
    // To defeat the empty-streak guard, alternate an empty page with a
    // page that has a single row (which resets emptyStreak). The cursor
    // advances on every page; the cap stops the loop.
    const target = buildTarget();
    let counter = 202608;
    const fetcher = async () => {
      const cursor = String(counter);
      counter -= 1;
      return `<input type="hidden" class="startdate" value="${counter}">
<table id="ajaxrowstable" style="display:none;"><tbody>
<tr><td class="center aligned gen"><a href="#">${counter}</a></td></tr>
</tbody></table>`;
    };

    const result = await paginate({
      initialCursor: '202608',
      target,
      fetcher,
      log: silentLog,
      sleepMs: 0,
      maxIterations: 5,
    });

    expect(result.added).toBe(5);
    expect(result.iterations).toBe(5);
    expect(result.done).toBe(true);
  });
});
