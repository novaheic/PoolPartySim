import { useId, useMemo } from 'react';
import {
  getAmountOut,
  getReservesForSwap,
  poolK,
  spotPrice,
} from '../amm';
import { compact, niceTicks, useElementSize } from '../lib/chart';
import { fmt, fmtSignedPct } from '../lib/format';
import { useStore } from '../store';
import type { TokenId } from '../types';

const PAD = { top: 16, right: 20, bottom: 44, left: 64 };
const SAMPLES = 120;

export function CurveChart({
  tokenIn,
  amountIn,
}: {
  tokenIn?: TokenId;
  amountIn?: number;
}) {
  const pool = useStore((s) => s.room?.pools[s.selectedPoolId]);
  const hasReserves = !!pool && pool.reserveA > 0 && pool.reserveB > 0;
  const [boxRef, { width: W, height: H }] = useElementSize<HTMLDivElement>(hasReserves);
  const uid = useId().replace(/:/g, '');

  const model = useMemo(() => {
    if (!pool || pool.reserveA <= 0 || pool.reserveB <= 0) return null;
    const k = poolK(pool);
    const x0 = pool.reserveA;
    const y0 = pool.reserveB;

    let ghost: { x: number; y: number; out: number } | null = null;
    const token = tokenIn ?? pool.tokenA;
    const amt = amountIn ?? 0;
    if (amt > 0) {
      const reserves = getReservesForSwap(pool, token);
      if (reserves) {
        const out = getAmountOut(amt, reserves.reserveIn, reserves.reserveOut);
        ghost =
          token === pool.tokenA
            ? { x: x0 + amt, y: y0 - out, out }
            : { x: x0 - out, y: y0 + amt, out };
      }
    }

    // Keep the current point roughly centred, but widen to fit the preview.
    let xmin = x0 * 0.35;
    let xmax = x0 * 1.8;
    if (ghost) {
      xmin = Math.min(xmin, ghost.x * 0.85);
      xmax = Math.max(xmax, ghost.x * 1.15);
    }
    const samples: { x: number; y: number }[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const x = xmin + ((xmax - xmin) * i) / SAMPLES;
      samples.push({ x, y: k / x });
    }
    const ymin = 0;
    const ymax = Math.max(k / xmin, y0 * 1.2) * 1.02;

    const spot = spotPrice(x0, y0);
    const spotAfter = ghost ? spotPrice(ghost.x, ghost.y) : null;
    return { k, x0, y0, samples, xmin, xmax, ymin, ymax, ghost, spot, spotAfter };
  }, [pool, tokenIn, amountIn]);

  const header = pool && (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
      <div>
        <h2 className="text-xl font-semibold">x · y = k curve</h2>
        <p className="text-sm text-slate-400">
          {pool.tokenA} reserve (x) vs {pool.tokenB} reserve (y)
        </p>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <Legend swatch="bg-teal-400" label="Pool now" />
        <Legend swatch="bg-amber-400" label="Spot price (tangent)" dashed />
        <Legend swatch="bg-pink-400" label="Your swap preview" />
      </div>
    </div>
  );

  if (!pool || !model) {
    return (
      <div className="card flex h-80 items-center justify-center p-4 text-slate-400">
        Select a pool
      </div>
    );
  }

  const innerW = Math.max(0, W - PAD.left - PAD.right);
  const innerH = Math.max(0, H - PAD.top - PAD.bottom);
  const sx = (x: number) =>
    PAD.left + ((x - model.xmin) / (model.xmax - model.xmin)) * innerW;
  const sy = (y: number) =>
    PAD.top + innerH - ((y - model.ymin) / (model.ymax - model.ymin)) * innerH;

  const path = model.samples
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`)
    .join(' ');
  const areaPath = `${path} L ${sx(model.xmax)} ${sy(0)} L ${sx(model.xmin)} ${sy(0)} Z`;

  const tLen = (model.xmax - model.xmin) * 0.14;
  const tangent = {
    x1: sx(model.x0 - tLen),
    y1: sy(model.y0 + model.spot * tLen),
    x2: sx(model.x0 + tLen),
    y2: sy(model.y0 - model.spot * tLen),
  };

  const xTicks = niceTicks(model.xmin, model.xmax, Math.max(2, Math.floor(innerW / 90)));
  const yTicks = niceTicks(model.ymin, model.ymax, Math.max(2, Math.floor(innerH / 60)));

  const cx = sx(model.x0);
  const cy = sy(model.y0);
  const g = model.ghost;
  const priceMove =
    model.spotAfter != null && model.spot > 0 ? model.spotAfter / model.spot - 1 : null;

  return (
    <div className="card flex flex-col p-5">
      {header}

      <div ref={boxRef} className="relative h-[300px] w-full sm:h-[360px] xl:h-[420px]">
        {W > 0 && H > 0 && (
          <svg width={W} height={H} className="absolute inset-0 overflow-visible">
            <defs>
              <linearGradient id={`curve-${uid}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#2dd4bf" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
              <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
              </linearGradient>
              <marker
                id={`arrow-${uid}`}
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6 Z" fill="#f472b6" />
              </marker>
              <clipPath id={`clip-${uid}`}>
                <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} />
              </clipPath>
            </defs>

            {/* grid + ticks */}
            {xTicks.map((t) => (
              <g key={`x${t}`}>
                <line
                  x1={sx(t)}
                  x2={sx(t)}
                  y1={PAD.top}
                  y2={PAD.top + innerH}
                  stroke="#1e293b"
                />
                <text
                  x={sx(t)}
                  y={PAD.top + innerH + 18}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="11"
                >
                  {compact(t)}
                </text>
              </g>
            ))}
            {yTicks.map((t) => (
              <g key={`y${t}`}>
                <line
                  x1={PAD.left}
                  x2={PAD.left + innerW}
                  y1={sy(t)}
                  y2={sy(t)}
                  stroke="#1e293b"
                />
                <text
                  x={PAD.left - 8}
                  y={sy(t) + 4}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="11"
                >
                  {compact(t)}
                </text>
              </g>
            ))}
            <line
              x1={PAD.left}
              y1={PAD.top + innerH}
              x2={PAD.left + innerW}
              y2={PAD.top + innerH}
              stroke="#334155"
            />
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH} stroke="#334155" />
            <text
              x={PAD.left + innerW / 2}
              y={H - 6}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="12"
            >
              {pool.tokenA} reserve
            </text>
            <text
              transform={`translate(14 ${PAD.top + innerH / 2}) rotate(-90)`}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="12"
            >
              {pool.tokenB} reserve
            </text>

            <g clipPath={`url(#clip-${uid})`}>
              <path d={areaPath} fill={`url(#area-${uid})`} />
              <path d={path} fill="none" stroke={`url(#curve-${uid})`} strokeWidth="3" />

              {/* guides from the current point to the axes */}
              <line x1={cx} y1={cy} x2={cx} y2={PAD.top + innerH} stroke="#2dd4bf" strokeOpacity="0.35" strokeDasharray="3 4" />
              <line x1={PAD.left} y1={cy} x2={cx} y2={cy} stroke="#2dd4bf" strokeOpacity="0.35" strokeDasharray="3 4" />

              <line
                {...tangent}
                stroke="#fbbf24"
                strokeWidth="2"
                strokeDasharray="6 4"
                opacity="0.85"
              />

              {g && (
                <>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={sx(g.x)}
                    y2={sy(g.y)}
                    stroke="#f472b6"
                    strokeWidth="2.5"
                    markerEnd={`url(#arrow-${uid})`}
                  />
                  <circle cx={sx(g.x)} cy={sy(g.y)} r="9" fill="#f472b6" opacity="0.35" />
                  <circle cx={sx(g.x)} cy={sy(g.y)} r="4" fill="#f9a8d4" />
                </>
              )}
            </g>

            <circle cx={cx} cy={cy} r="7" fill="#2dd4bf" />
            <circle cx={cx} cy={cy} r="3" fill="#042f2e" />
            <PointLabel
              x={cx}
              y={cy}
              bounds={{ left: PAD.left, right: PAD.left + innerW, top: PAD.top }}
              color="#5eead4"
              lines={[`now`, `${fmt(model.x0)} · ${fmt(model.y0)}`]}
            />
            {g && (
              <PointLabel
                x={sx(g.x)}
                y={sy(g.y)}
                bounds={{ left: PAD.left, right: PAD.left + innerW, top: PAD.top }}
                color="#f9a8d4"
                below
                lines={['after swap', `${fmt(g.x)} · ${fmt(g.y)}`]}
              />
            )}
          </svg>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-white/5 pt-3 text-sm sm:grid-cols-4">
        <Stat label="k" value={fmt(model.k, 0)} />
        <Stat
          label={`Spot (${pool.tokenB}/${pool.tokenA})`}
          value={fmt(model.spot, 4)}
        />
        <Stat
          label="Spot after preview"
          value={model.spotAfter != null ? fmt(model.spotAfter, 4) : '—'}
        />
        <Stat
          label="Price move"
          value={priceMove != null ? fmtSignedPct(priceMove) : '—'}
          tone={
            priceMove == null ? undefined : priceMove >= 0 ? 'text-emerald-300' : 'text-rose-300'
          }
        />
      </dl>
    </div>
  );
}

function PointLabel({
  x,
  y,
  lines,
  color,
  bounds,
  below,
}: {
  x: number;
  y: number;
  lines: string[];
  color: string;
  bounds: { left: number; right: number; top: number };
  below?: boolean;
}) {
  const w = 118;
  const h = 34;
  let lx = x + 12;
  if (lx + w > bounds.right) lx = x - 12 - w;
  lx = Math.max(bounds.left + 4, lx);
  let ly = below ? y + 12 : y - 12 - h;
  if (ly < bounds.top) ly = y + 12;
  return (
    <g pointerEvents="none">
      <rect x={lx} y={ly} width={w} height={h} rx="6" fill="#020617" fillOpacity="0.85" stroke={color} strokeOpacity="0.35" />
      <text x={lx + 8} y={ly + 14} fill={color} fontSize="10" fontWeight="600">
        {lines[0]}
      </text>
      <text x={lx + 8} y={ly + 27} fill="#e2e8f0" fontSize="11" className="num">
        {lines[1]}
      </text>
    </g>
  );
}

function Legend({
  swatch,
  label,
  dashed,
}: {
  swatch: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block h-0.5 w-4 rounded ${swatch} ${dashed ? 'opacity-80 [mask-image:repeating-linear-gradient(90deg,#000_0_4px,transparent_4px_7px)]' : ''}`}
      />
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`num font-semibold ${tone ?? 'text-slate-100'}`}>{value}</dd>
    </div>
  );
}
