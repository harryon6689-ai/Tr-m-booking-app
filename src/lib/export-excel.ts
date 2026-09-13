"use client";

/**
 * Downloads an array of plain objects as an .xlsx file in the browser.
 * Column headers are taken from the keys of the first row.
 *
 * `xlsx` is a large library — loaded on demand here instead of being bundled
 * into every page that merely renders an export button.
 */
export async function exportToExcel(
  filename: string,
  rows: Record<string, string | number>[],
  sheetName = "Sheet1"
) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/** Same as exportToExcel but writes multiple named sheets into one workbook. */
export async function exportMultiSheetExcel(
  filename: string,
  sheets: { name: string; rows: Record<string, string | number>[] }[]
) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
