"use client";

import { useState } from "react";

function formatNumber(n: number) {
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("vi-VN");
}

function parseNumber(s: string) {
  const digits = s.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export default function CurrencyInput({
  value,
  onChange,
  onBlur,
  disabled,
  className,
  id,
}: CurrencyInputProps) {
  const [display, setDisplay] = useState(formatNumber(value));
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    setDisplay(formatNumber(value));
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={display}
      disabled={disabled}
      onChange={(e) => {
        const parsed = parseNumber(e.target.value);
        setDisplay(formatNumber(parsed));
        onChange(parsed);
      }}
      onBlur={onBlur}
      className={className}
    />
  );
}
