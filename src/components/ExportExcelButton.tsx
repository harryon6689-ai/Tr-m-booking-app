"use client";

import { exportToExcel } from "@/lib/export-excel";

export default function ExportExcelButton({
  filename,
  rows,
  sheetName,
}: {
  filename: string;
  rows: Record<string, string | number>[];
  sheetName?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => exportToExcel(filename, rows, sheetName)}
      disabled={rows.length === 0}
      className="rounded-lg border border-brand-forest/30 px-3 py-1.5 text-sm font-semibold text-brand-forest hover:bg-brand-cream disabled:opacity-50"
    >
      Xuất file
    </button>
  );
}
