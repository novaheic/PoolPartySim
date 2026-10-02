import { useMemo, useState, type MouseEvent } from 'react';
import { compact, niceTicks, useElementSize } from '../lib/chart';
import { fmt, fmtSignedPct, fmtUsd } from '../lib/format';
import { lpUnderlying, snapshotHoldings, snapshotValueUsd } from '../lib/holdings';
import { TOKEN_TEXT } from '../lib/tokens';
import { useMe, useStore } from '../store';
import { TOKENS, type HoldingSnapshot, type OraclePrices, type TokenId } from '../types';

const PAD = { top: 12, right: 16, bottom: 28, left: 56 };

type Mode = 'value' | 'tokens';
type Series = { id: string; label: string; color: string; values: number[] };

const COLORS: Record<TokenId | 'LP', string> = {
  WOOD: '#fb923c',
  STONE: '#94a3b8',
  GOLD: '#facc15',
  LP: '#2dd4bf',
};

function buildSeries(points: HoldingSnapshot[], oracle: OraclePrices, mode: Mode): Series[] {
  if (mode === 'value') {
    return [
      ...TOKENS.map((t) => ({
        id: t,
        label: `${t} (wallet)`,
        color: COLORS[t],
        values: points.map((p) => p.wallet[t] * oracle[t]),
      })),
      {
        id: 'LP',
        label: 'LP positions',
        color: COLORS.LP,
        values: points.map((p) => snapshotValueUsd(p, oracle).lp),
      },
    ];
  }
  return TOKENS.map((t) => ({
    id: t,
    label: `${t} (wallet + LP)`,
    color: COLORS[t],
    values: points.map((p) => p.wallet[t] + p.lp[t]),
  }));
}

export function HoldingsHistory() {
  const me = useMe();
  const history = useStore((s) => s.myHistory);
  const pools = useStore((s) => s.room?.pools);
  const oracle = useStore((s) => s.room?.oracle);
  const [mode, setMode] = useState<Mode>('value');
  const [hover, setHover] = useState<number | null>(null);

  const points = useMemo(() => {
    if (!me || !pools) return history;
    // Live tail: LP holdings drift as others trade even when you don't.
    return [...history, snapshotHoldings(me, pools, 'Now')];
  }, [history, me, pools]);

  const [boxRef, { width: W, height: H }] = useElementSize<HTMLDivElement>(points.length > 0);

  if (!me || !pools || !oracle) return null;

  const series = buildSeries(points, oracle, mode);
  const n = points.length;
  const stacked = mode === 'value';

  const tops: number[][] = [];
  let maxY = 0;
  if (stacked) {
    let running = new Array(n).fill(0);
    for (const s of series) {
      running = running.map((v, i) => v + s.values[i]);
      tops.push(running);
    }
    maxY = Math.max(...running);
  } else {
    for (const s of series) maxY = Math.max(maxY, ...s.values);
  }
  maxY = maxY > 0 ? maxY * 1.08 : 1;

  const innerW = Math.max(0, W - PAD.left - PAD.right);
  const innerH = Math.max(0, H - PAD.top - PAD.bottom);
  const sx = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const sy = (v: number) => PAD.top + innerH - (v / maxY) * innerH;
  const line = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`).join(' ');

  const yTicks = niceTicks(0, maxY, Math.max(2, Math.floor(innerH / 50)));

  const first = points[0];
  const last = points[n - 1];
  const startUsd = first ? snapshotValueUsd(first, oracle).total : 0;
  const nowUsd = last ? snapshotValueUsd(last, oracle).total : 0;
  const change = startUsd > 0 ? nowUsd / startUsd - 1 : 0;

  const onMove = (e: MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1)))));
  };

  const h = hover != null && hover < n ? hover : null;
  const hp = h != null ? points[h] : null;

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Portfolio value (at current oracle prices)</p>
          <p className="num text-2xl font-semibold text-white">
            {fmtUsd(nowUsd)}{' '}
            <span className={`text-base ${change >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {fmtSignedPct(change)}
            </span>
          </p>
          <p className="num text-xs text-slate-500">
            from {fmtUsd(startUsd)} at your first snapshot · {history.length} changes recorded
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-950/50 p-1">
          {(
            [
              ['value', 'Value (USD)'],
              ['tokens', 'Token amounts'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                mode === id ? 'bg-teal-400/20 text-teal-200' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div ref={boxRef} className="relative h-[240px] w-full xl:h-[280px]">
        {W > 0 && H > 0 && n > 0 && (
          <svg width={W} height={H} className="absolute inset-0">
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={PAD.left + innerW} y1={sy(t)} y2={sy(t)} stroke="#1e293b" />
                <text x={PAD.left - 8} y={sy(t) + 4} textAnchor="end" fill="#64748b" fontSize="11">
                  {stacked ? `$${compact(t)}` : compact(t)}
                </text>
              </g>
            ))}
            <line
              x1={PAD.left}
              x2={PAD.left + innerW}
              y1={PAD.top + innerH}
              y2={PAD.top + innerH}
              stroke="#334155"
            />
            <text x={PAD.left} y={H - 8} fill="#64748b" fontSize="11">
              {first ? new Date(first.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </text>
            <text x={PAD.left + innerW} y={H - 8} textAnchor="end" fill="#64748b" fontSize="11">
              now
            </text>

            {stacked
              ? series.map((s, j) => {
                  const top = tops[j];
                  const bottom = j === 0 ? new Array(n).fill(0) : tops[j - 1];
                  const xs = n === 1 ? [PAD.left, PAD.left + innerW] : null;
                  const d = xs
                    ? `M ${xs[0]} ${sy(top[0])} L ${xs[1]} ${sy(top[0])} L ${xs[1]} ${sy(bottom[0])} L ${xs[0]} ${sy(bottom[0])} Z`
                    : `${line(top)} ${bottom
                        .map((_, k) => {
                          const i = n - 1 - k;
                          return `L ${sx(i).toFixed(1)} ${sy(bottom[i]).toFixed(1)}`;
                        })
                        .join(' ')} Z`;
                  return (
                    <path key={s.id} d={d} fill={s.color} fillOpacity="0.28" stroke={s.color} strokeOpacity="0.9" strokeWidth="1.5" />
                  );
                })
              : series.map((s) => (
                  <g key={s.id}>
                    <path d={line(s.values)} fill="none" stroke={s.color} strokeWidth="2.5" />
                    {s.values.map((v, i) => (
                      <circle key={i} cx={sx(i)} cy={sy(v)} r="2.5" fill={s.color} />
                    ))}
                  </g>
                ))}

            {h != null && (
              <line x1={sx(h)} x2={sx(h)} y1={PAD.top} y2={PAD.top + innerH} stroke="#e2e8f0" strokeOpacity="0.4" strokeDasharray="3 3" />
            )}
            <rect
              x={PAD.left}
              y={PAD.top}
              width={innerW}
              height={innerH}
              fill="transparent"
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
            />
          </svg>
        )}

        {hp && h != null && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-56 rounded-xl border border-white/15 bg-slate-900/95 p-3 text-xs shadow-2xl"
            style={
              sx(h) > W / 2
                ? { right: W - sx(h) + 12 }
                : { left: sx(h) + 12 }
            }
          >
            <p className="font-semibold text-white">{hp.label}</p>
            <p className="mb-2 text-slate-500">{new Date(hp.ts).toLocaleTimeString()}</p>
            {series.map((s) => {
              const prev = h > 0 ? s.values[h - 1] : null;
              const delta = prev != null ? s.values[h] - prev : 0;
              return (
                <div key={s.id} className="num flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <span className="text-slate-100">
                    {stacked ? fmtUsd(s.values[h]) : fmt(s.values[h])}
                    {Math.abs(delta) > 1e-6 && (
                      <span className={`ml-1 ${delta > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {delta > 0 ? '+' : '−'}
                        {stacked ? fmtUsd(Math.abs(delta)) : fmt(Math.abs(delta))}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
            {stacked && (
              <div className="num mt-1.5 flex justify-between border-t border-white/10 pt-1.5 font-semibold">
                <span className="text-slate-300">Total</span>
                <span className="text-white">{fmtUsd(snapshotValueUsd(hp, oracle).total)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        {series.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <TokenDeltaTable first={first} me={me} pools={pools} oracle={oracle} />
    </div>
  );
}

function TokenDeltaTable({
  first,
  me,
  pools,
  oracle,
}: {
  first?: HoldingSnapshot;
  me: NonNullable<ReturnType<typeof useMe>>;
  pools: Parameters<typeof lpUnderlying>[1];
  oracle: OraclePrices;
}) {
  if (!first) return null;
  const lpNow = lpUnderlying(me, pools);
  return (
    <table className="num w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-slate-500">
          <th className="py-1 font-normal">Token</th>
          <th className="py-1 text-right font-normal">Start</th>
          <th className="py-1 text-right font-normal">Wallet</th>
          <th className="py-1 text-right font-normal">In LP</th>
          <th className="py-1 text-right font-normal">Change</th>
        </tr>
      </thead>
      <tbody>
        {TOKENS.map((t) => {
          const start = first.wallet[t] + first.lp[t];
          const now = me.balances[t] + lpNow[t];
          const d = now - start;
          return (
            <tr key={t} className="border-t border-white/5">
              <td className={`py-1.5 font-semibold ${TOKEN_TEXT[t]}`}>{t}</td>
              <td className="py-1.5 text-right text-slate-400">{fmt(start)}</td>
              <td className="py-1.5 text-right text-slate-200">{fmt(me.balances[t])}</td>
              <td className="py-1.5 text-right text-slate-200">{lpNow[t] > 0 ? fmt(lpNow[t]) : '—'}</td>
              <td
                className={`py-1.5 text-right font-semibold ${
                  Math.abs(d) < 1e-6 ? 'text-slate-500' : d > 0 ? 'text-emerald-300' : 'text-rose-300'
                }`}
                title={fmtUsd(d * oracle[t])}
              >
                {d > 0 ? '+' : d < 0 ? '−' : ''}
                {fmt(Math.abs(d))}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
