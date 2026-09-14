"use client";

type Sheet = { name: string; rows: Record<string, string | number>[] };

/**
 * `xlsx` is a large library — loaded on demand here instead of being bundled
 * into every page that merely renders an export button.
 */
export async function buildExcelWorkbookBytes(sheets: Sheet[]): Promise<Uint8Array> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
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
  sheetName = "Sheet1"
) {
  const bytes = await buildExcelWorkbookBytes([{ name: sheetName, rows }]);
  downloadExcelBytes(bytes, `${filename}.xlsx`);
}

/** Same as exportToExcel but writes multiple named sheets into one workbook. */
export async function exportMultiSheetExcel(filename: string, sheets: Sheet[]) {
  const bytes = await buildExcelWorkbookBytes(sheets);
  downloadExcelBytes(bytes, `${filename}.xlsx`);
}
