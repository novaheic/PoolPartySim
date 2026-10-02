import { useLayoutEffect, useRef, useState } from 'react';

/** Pass `mounted` so the observer re-attaches once the measured element renders. */
export function useElementSize<T extends HTMLElement>(mounted: boolean) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize((prev) =>
        prev.width === r.width && prev.height === r.height
          ? prev
          : { width: r.width, height: r.height },
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mounted]);
  return [ref, size] as const;
}

export function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min;
  if (!(span > 0)) return [min];
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-9; t += step) {
    ticks.push(t);
  }
  return ticks;
}

export function compact(n: number): string {
  return n.toLocaleString(undefined, {
    notation: Math.abs(n) >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  });
}
