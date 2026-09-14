"use client";

export const WEEKDAY_LABELS = [
  "Chủ nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];

export default function WeekdayPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (value: number[]) => void;
}) {
  function toggle(day: number) {
    onChange(
      value.includes(day)
        ? value.filter((d) => d !== day)
        : [...value, day].sort()
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {WEEKDAY_LABELS.map((label, day) => (
        <label
          key={day}
          className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-sm ${
            value.includes(day)
              ? "border-brand-forest bg-brand-forest/10 text-brand-forest"
              : "border-brand-forest/20 text-brand-forest/70"
          }`}
        >
          <input
            type="checkbox"
            checked={value.includes(day)}
            onChange={() => toggle(day)}
            className="accent-brand-forest"
          />
          {label}
        </label>
      ))}
    </div>
  );
}
