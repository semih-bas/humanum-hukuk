export function buildSpreadsheetCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  return `\uFEFF${rows.map((row) => row.map(formatCell).join(";")).join("\n")}`;
}

function formatCell(value: unknown): string {
  let text = String(value ?? "");

  // Spreadsheet applications may execute cells beginning with these characters as formulas.
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replaceAll('"', '""')}"`;
}
