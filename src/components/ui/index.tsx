import type { MouseEvent, ReactNode } from 'react';

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  className = '',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  className?: string;
  type?: 'button' | 'submit';
}) {
  const styles =
    variant === 'primary'
      ? 'bg-teal-400/90 text-slate-950 hover:bg-teal-300'
      : variant === 'danger'
        ? 'bg-rose-500/80 text-white hover:bg-rose-400'
        : 'bg-white/5 text-slate-100 hover:bg-white/10 border border-white/10';
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = '',
  onClick,
  active,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`card p-4 ${active ? 'ring-2 ring-teal-400/70' : ''} ${onClick ? 'cursor-pointer hover:border-teal-400/40' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function Input({
  label,
  value,
  onChange,
  type = 'text',
  min,
  max,
  step,
  placeholder,
}: {
  label?: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}) {
  return (
    <label className="flex w-full flex-col gap-1 text-sm text-slate-300">
      {label && <span>{label}</span>}
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="num rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-lg text-slate-50 outline-none focus:border-teal-400/50"
      />
    </label>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-slate-950/50 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
            value === t.id
              ? 'bg-teal-400/20 text-teal-200'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
