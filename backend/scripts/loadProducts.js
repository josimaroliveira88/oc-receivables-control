const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { parseProductCsvFile } = require('../src/utils/csvParser');
const { loadProductCatalog } = require('../src/utils/productLoader');

require('dotenv').config();

const prisma = new PrismaClient();

function printSummary(summary, dryRun) {
  console.log(dryRun ? '=== Simulação (nenhuma alteração aplicada) ===' : '=== Resultado da carga ===');
  console.log(`Criados: ${summary.created}`);
  console.log(`Atualizados (nome/tamanho): ${summary.updated}`);
  console.log(`Preços alterados (novo histórico): ${summary.priceChanged}`);
  console.log(`Inalterados: ${summary.unchanged}`);
  console.log(`Desativados (fora da lista): ${summary.deactivated}`);
  if (summary.errors.length > 0) {
    console.log(`Erros: ${summary.errors.length}`);
    summary.errors.forEach((err) => console.error(`  - ${err}`));
  }
  if (!dryRun && summary.deactivated > 0) {
    console.warn(
      `Atenção: ${summary.deactivated} produto(s) foi(foram) desativado(s). ` +
      'Isso acontece para itens presentes no banco, mas ausentes do CSV. ' +
      'Se você carregou uma lista parcial por engano, restaure carregando o catálogo completo.'
    );
  }
}

function parseArgs(argv) {
  const args = { csvPath: null, validFrom: null, dryRun: false };
  const positionals = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--date' || arg === '--valid-from') {
      args.validFrom = argv[i + 1] || null;
      i += 1;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg.startsWith('--')) {
      // ignore unknown flags
    } else {
      positionals.push(arg);
    }
  }

  args.csvPath = positionals[0] || null;
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const csvPath = args.csvPath || path.join(__dirname, '../../docs/tabela_produtos_doterra_2026.csv');

  console.log(`Lendo arquivo: ${csvPath}`);
  const rows = parseProductCsvFile(csvPath);
  console.log(`Linhas válidas: ${rows.length}`);

  const options = { dryRun: args.dryRun };
  if (args.validFrom) {
    const parsed = new Date(`${args.validFrom}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      console.error(`Data inválida: ${args.validFrom}. Use o formato YYYY-MM-DD.`);
      process.exit(1);
    }
    options.validFrom = parsed;
    console.log(`Vigência da carga: ${args.validFrom}`);
  }

  const summary = await loadProductCatalog(prisma, rows, options);
  printSummary(summary, args.dryRun);
}

main()
  .catch((e) => {
    console.error('Erro na carga de produtos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
