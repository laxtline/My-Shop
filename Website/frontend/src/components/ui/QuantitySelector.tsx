"use client";

export function QuantitySelector({ value, max, onChange, disabled = false, label = 'Quantity' }: {
  value: number; max: number; onChange: (value: number) => void; disabled?: boolean; label?: string;
}) {
  const unavailable = max < 1;
  return <div className="inline-flex items-center rounded-lg border border-slate-300" role="group" aria-label={label}>
    <button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={disabled || unavailable || value <= 1}
      onClick={() => onChange(Math.max(1, Math.min(max, value - 1)))}
      className="grid h-10 w-10 place-items-center rounded-l-lg text-xl focus-ring hover:bg-slate-50 disabled:opacity-40">−</button>
    <output aria-live="polite" aria-label={label} className="grid h-10 min-w-12 place-items-center border-x border-slate-300 px-2 text-sm font-semibold">{value}</output>
    <button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={disabled || unavailable || value >= max}
      onClick={() => onChange(Math.min(max, value + 1))}
      className="grid h-10 w-10 place-items-center rounded-r-lg text-xl focus-ring hover:bg-slate-50 disabled:opacity-40">+</button>
  </div>;
}
