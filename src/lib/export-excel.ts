"use client";

type Sheet = { name: string; rows: Record<string, string | number>[]; title?: string };

/**
 * `exceljs` is a large library — loaded on demand here instead of being
 * bundled into every page that merely renders an export button. (`xlsx`
 * was used previously, but its free build silently drops cell styling —
 * exceljs actually writes bold/size/alignment into the .xlsx.)
 */
export async function buildExcelWorkbookBytes(sheets: Sheet[]): Promise<Uint8Array> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);

    // Prefix every row with a "STT" (thứ tự) column so exported lists read
    // like a numbered report instead of an unordered dump.
    const numberedRows = sheet.rows.map((row, i) => ({ STT: i + 1, ...row }));
    const columns = numberedRows[0] ? Object.keys(numberedRows[0]) : ["STT"];

    // A title row above the header makes the file self-explanatory when
    // opened outside the app (e.g. forwarded by email) — spans the full
    // column width of the table below it, with 2 blank rows before the list.
    let headerRowNumber = 1;
    if (sheet.title) {
      worksheet.mergeCells(1, 1, 1, columns.length);
      const titleCell = worksheet.getCell(1, 1);
      titleCell.value = sheet.title;
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      headerRowNumber = 4;
    }

    worksheet.getRow(headerRowNumber).values = columns;
    numberedRows.forEach((row, i) => {
      const record = row as Record<string, string | number>;
      worksheet.getRow(headerRowNumber + 1 + i).values = columns.map((c) => record[c]);
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer as ArrayBuffer);
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
