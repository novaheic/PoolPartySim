import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const COPY: Record<string, string> = {
  'price-impact':
    'Price impact is how much your trade moves the pool price. Bigger trades relative to reserves = bigger impact.',
  slippage:
    'Slippage tolerance is the worst price change you’ll accept between quoting and executing. If output falls below your minimum, the swap should be rejected.',
  k: 'In a constant-product pool, reserveX × reserveY = k. Swaps slide along that curve; fees make k grow slowly.',
  'lp-token':
    'LP tokens represent your share of the pool. When you remove liquidity, you redeem them for a pro-rata slice of both reserves.',
  fee: 'Each swap pays a 0.3% fee that stays in the pool, so LPs earn a bit whenever others trade.',
  'impermanent-loss':
    'If prices change while you are an LP, your bag can be worth less than simply holding the tokens — that’s impermanent loss (offset partly by fees).',
  tvl: 'TVL is the USD value of tokens sitting in the pool, using the instructor oracle prices.',
  spot: 'Spot price is the instantaneous slope of the curve (reserve ratio) before your trade.',
};

export function Tooltip({
  tip,
  children,
}: {
  tip: keyof typeof COPY | string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();
  const text = COPY[tip] ?? String(tip);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) {
      setCoords(null);
      return;
    }
    const place = () => {
      const btn = btnRef.current!.getBoundingClientRect();
      const tipEl = tipRef.current;
      const tipW = tipEl?.offsetWidth ?? 224;
      const tipH = tipEl?.offsetHeight ?? 80;
      const pad = 8;

      let top = btn.bottom + pad;
      let left = btn.left + btn.width / 2 - tipW / 2;

      // Prefer below; flip above if it would go off-screen
      if (top + tipH > window.innerHeight - pad && btn.top - tipH - pad > pad) {
        top = btn.top - tipH - pad;
      }
      left = Math.max(pad, Math.min(left, window.innerWidth - tipW - pad));

      setCoords({ top, left });
    };
    place();
    // Re-measure after tip mounts with real size
    requestAnimationFrame(place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <button
        ref={btnRef}
        type="button"
        aria-label="Help"
        aria-describedby={open ? tipId : undefined}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/20 text-[11px] font-bold text-slate-300 hover:border-teal-300 hover:text-teal-200"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ?
      </button>
      {open &&
        createPortal(
          <span
            ref={tipRef}
            id={tipId}
            role="tooltip"
            style={{
              position: 'fixed',
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              zIndex: 9999,
              visibility: coords ? 'visible' : 'hidden',
            }}
            className="w-56 rounded-xl border border-white/15 bg-slate-900 p-3 text-left text-xs leading-relaxed text-slate-200 shadow-2xl"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
