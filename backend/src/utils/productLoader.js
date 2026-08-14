const { toCents } = require('./money');

const DRY_RUN_ABORT = Symbol('dry-run-abort');

function pricesEqual(a, b) {
  return toCents(a) === toCents(b);
}

function samePriceValues(current, row) {
  return (
    pricesEqual(current.regularPrice, row.regularPrice) &&
    pricesEqual(current.memberPrice, row.memberPrice) &&
    pricesEqual(current.pv, row.pv)
  );
}

/**
 * Intelligent catalog load. Compares the given rows against the database and
 * only applies what changed:
 *  - new products are inserted (with an active price record and status ATIVO)
 *  - existing products have metadata synced and are reactivated if INATIVO
 *  - INDISPONIVEL products present in the CSV keep their manual status (never touched)
 *  - changed prices close the current price record (validTo) and open a new one
 *  - products with status ATIVO but missing from the CSV are marked INATIVO
 *
 * Options:
 *  - validFrom: Date — validity start for this load (supports retroactive loads)
 *  - dryRun: boolean — compute the summary without persisting any change
 */
async function loadProductCatalog(prisma, rows, options = {}) {
  const validFrom = options.validFrom
    ? new Date(options.validFrom)
    : new Date();
  const dryRun = Boolean(options.dryRun);
  const codes = new Set();
  const summary = {
    created: 0,
    updated: 0,
    priceChanged: 0,
    unchanged: 0,
    deactivated: 0,
    errors: [],
  };

  try {
    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        codes.add(row.code);

        const existing = await tx.product.findUnique({
          where: { code: row.code },
        });

        if (!existing) {
          await tx.product.create({
            data: {
              code: row.code,
              name: row.name,
              size: row.size,
              status: 'ATIVO',
              prices: {
                create: {
                  regularPrice: row.regularPrice,
                  memberPrice: row.memberPrice,
                  pv: row.pv,
                  validFrom,
                },
              },
            },
          });
          summary.created += 1;
          continue;
        }

        const nameOrSizeChanged =
          existing.name !== row.name || existing.size !== row.size;
        const needsReactivation = existing.status === 'INATIVO';

        if (nameOrSizeChanged || needsReactivation) {
          const updateData = { name: row.name, size: row.size };
          // Only reactivate INATIVO products; INDISPONIVEL is a manual state preserved by the loader.
          if (needsReactivation) {
            updateData.status = 'ATIVO';
          }
          await tx.product.update({
            where: { id: existing.id },
            data: updateData,
          });
        }

        const metadataChanged = nameOrSizeChanged || needsReactivation;

        const currentPrice = await tx.productPrice.findFirst({
          where: { productId: existing.id, validTo: null },
          orderBy: { validFrom: 'desc' },
        });

        if (!currentPrice) {
          await tx.productPrice.create({
            data: {
              productId: existing.id,
              regularPrice: row.regularPrice,
              memberPrice: row.memberPrice,
              pv: row.pv,
              validFrom,
            },
          });
          summary.priceChanged += 1;
          continue;
        }

        const pricesUnchanged = samePriceValues(currentPrice, row);

        if (pricesUnchanged && !metadataChanged) {
          summary.unchanged += 1;
          continue;
        }

        if (!pricesUnchanged) {
          await tx.productPrice.update({
            where: { id: currentPrice.id },
            data: { validTo: validFrom },
          });
          await tx.productPrice.create({
            data: {
              productId: existing.id,
              regularPrice: row.regularPrice,
              memberPrice: row.memberPrice,
              pv: row.pv,
              validFrom,
            },
          });
          summary.priceChanged += 1;
        } else {
          summary.updated += 1;
        }
      }

      const activeProducts = await tx.product.findMany({
        where: { status: 'ATIVO' },
      });
      for (const product of activeProducts) {
        if (!codes.has(product.code)) {
          await tx.product.update({
            where: { id: product.id },
            data: { status: 'INATIVO' },
          });
          summary.deactivated += 1;
        }
      }

      if (dryRun) throw DRY_RUN_ABORT;
    });
  } catch (err) {
    if (err !== DRY_RUN_ABORT) throw err;
  }

  return summary;
}

module.exports = { loadProductCatalog };
