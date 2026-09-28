"use client";

type Sheet = { name: string; rows: Record<string, string | number>[]; title?: string };

/**
 * `xlsx` is a large library — loaded on demand here instead of being bundled
 * into every page that merely renders an export button.
 */
export async function buildExcelWorkbookBytes(sheets: Sheet[]): Promise<Uint8Array> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    // Prefix every row with a "STT" (thứ tự) column so exported lists read
    // like a numbered report instead of an unordered dump.
    const numberedRows = sheet.rows.map((row, i) => ({ STT: i + 1, ...row }));

    // A title row above the header makes the file self-explanatory when
    // opened outside the app (e.g. forwarded by email) — spans the full
    // column width of the table below it.
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.title ? [[sheet.title], []] : []);
    XLSX.utils.sheet_add_json(worksheet, numberedRows, { origin: -1 });
    if (sheet.title) {
      const columnCount = numberedRows[0] ? Object.keys(numberedRows[0]).length : 1;
      worksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, columnCount - 1) } },
      ];
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }
  const result = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  // `type: "array"` actually returns a plain ArrayBuffer (no `.length`/`.subarray`),
  // not a Uint8Array — normalize it so downstream code can rely on typed-array methods.
  return result instanceof Uint8Array ? result : new Uint8Array(result as ArrayBuffer);
}

export function downloadExcelBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function excelBytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Downloads an array of plain objects as an .xlsx file in the browser.
 * Column headers are taken from the keys of the first row.
 */
export async function exportToExcel(
  filename: string,
  rows: Record<string, string | number>[],
  sheetName = "Sheet1",
  title?: string
) {
  const bytes = await buildExcelWorkbookBytes([{ name: sheetName, rows, title }]);
  downloadExcelBytes(bytes, `${filename}.xlsx`);
}

/** Same as exportToExcel but writes multiple named sheets into one workbook. */
export async function exportMultiSheetExcel(filename: string, sheets: Sheet[]) {
  const bytes = await buildExcelWorkbookBytes(sheets);
  downloadExcelBytes(bytes, `${filename}.xlsx`);
}
