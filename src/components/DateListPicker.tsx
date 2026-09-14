"use client";

import { useState } from "react";

/** Add/remove list of dates — used for "ngày cụ thể" (exact one-time dates) and
 * for "hàng năm" (day+month of each date recurs every year, year ignored). */
export default function DateListPicker({
  value,
  onChange,
  formatChip,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  formatChip?: (date: string) => string;
}) {
  const [newDate, setNewDate] = useState("");

  function add() {
    if (newDate && !value.includes(newDate)) {
      onChange([...value, newDate].sort());
      setNewDate("");
    }
  }

  function remove(d: string) {
    onChange(value.filter((x) => x !== d));
  }

  return (
    <div>
      <div className="mb-2 flex gap-2">
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="rounded-lg border border-brand-forest/30 px-3 py-2 outline-none focus:border-brand-amber"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-brand-forest/30 px-3 py-2 text-sm font-medium text-brand-forest hover:bg-brand-cream"
        >
          + Thêm
        </button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {value.map((d) => (
          <li
            key={d}
            className="flex items-center gap-1 rounded-full bg-brand-cream px-2 py-1 text-xs text-brand-forest"
          >
            {formatChip ? formatChip(d) : d}
            <button
              type="button"
              onClick={() => remove(d)}
              className="text-brand-forest/60 hover:text-red-600"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
