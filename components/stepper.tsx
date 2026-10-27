"use client";

import { Minus, Plus } from "lucide-react";

/** Number field with large − and + buttons. */
export function Stepper({
  id,
  name,
  label,
  value,
  min,
  max = 50,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  value: number;
  min: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-[15px]">
        {label}
      </label>
      <div className="flex items-center overflow-hidden rounded-xl border border-input bg-card">
        <button
          type="button"
          aria-label={`${label}: weniger`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="flex size-11 items-center justify-center text-zinc-700 transition-colors hover:bg-muted disabled:opacity-40"
        >
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <input
          id={id}
          name={name}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          required
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-11 w-12 [appearance:textfield] border-x border-input bg-transparent text-center text-base font-semibold outline-none focus-visible:bg-muted [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label={`${label}: mehr`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="flex size-11 items-center justify-center text-zinc-700 transition-colors hover:bg-muted disabled:opacity-40"
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
