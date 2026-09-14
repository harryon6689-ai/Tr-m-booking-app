"use client";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export default function DayOfMonthPicker({
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
        : [...value, day].sort((a, b) => a - b)
    );
  }

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {DAYS.map((day) => (
        <button
          key={day}
          type="button"
          onClick={() => toggle(day)}
          className={`rounded-lg border px-0 py-1.5 text-sm font-semibold transition ${
            value.includes(day)
              ? "border-brand-forest bg-brand-forest text-brand-cream"
              : "border-brand-forest/20 text-brand-forest/70 hover:bg-brand-cream"
          }`}
        >
          {day}
        </button>
      ))}
    </div>
  );
}
