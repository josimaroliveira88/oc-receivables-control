const fs = require('fs');

function parseProductCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return [];

  const dataLines = lines.slice(1);
  const rows = [];

  for (const line of dataLines) {
    const cols = line.split(';').map((col) => col.trim());
    if (cols.length < 6) {
      throw new Error(`Invalid row: ${line}`);
    }
    const [code, name, size, regularPrice, memberPrice, pv] = cols;
    if (!code || !name) continue;

    rows.push({
      code,
      name,
      size: size || '',
      regularPrice,
      memberPrice,
      pv,
    });
  }

  return rows;
}

function parseProductCsvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return parseProductCsv(content);
}

module.exports = { parseProductCsv, parseProductCsvFile };
