import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  executionPrice,
  getAmountOut,
  getReservesForSwap,
  priceImpact,
  spotPrice,
} from '../amm';
import { fmt, fmtPct } from '../lib/format';
import { TOKEN_TEXT } from '../lib/tokens';
import { useMe, useStore } from '../store';
import { POOL_DEFS, type TokenId } from '../types';
import { Tooltip } from './Tooltip';
import { Button, Input } from './ui';

export function SwapPanel({
  onPreviewChange,
}: {
  onPreviewChange?: (tokenIn: TokenId, amountIn: number) => void;
}) {
  const poolId = useStore((s) => s.selectedPoolId);
  const pool = useStore((s) => s.room?.pools[s.selectedPoolId]);
  const slippageBps = useStore((s) => s.slippageBps);
  const setSlippage = useStore((s) => s.setSlippage);
  const requestSwap = useStore((s) => s.requestSwap);
  const clearError = useStore((s) => s.clearError);
  const lastError = useStore((s) => s.lastError);
  const me = useMe();

  const [tokenIn, setTokenIn] = useState<TokenId>('WOOD');
  const [amountStr, setAmountStr] = useState('10');

  const tokens = pool ? ([pool.tokenA, pool.tokenB] as TokenId[]) : [];
  const effectiveIn =
    pool && tokens.includes(tokenIn) ? tokenIn : (pool?.tokenA ?? 'WOOD');

  useEffect(() => {
    if (pool && tokenIn !== pool.tokenA && tokenIn !== pool.tokenB) {
      setTokenIn(pool.tokenA);
    }
  }, [pool, tokenIn]);

  useEffect(() => {
    onPreviewChange?.(effectiveIn, Number(amountStr) || 0);
  }, [effectiveIn, amountStr, onPreviewChange]);

  const quote = useMemo(() => {
    if (!pool) return null;
    const amountIn = Number(amountStr);
    if (!(amountIn > 0)) return null;
    const reserves = getReservesForSwap(pool, effectiveIn);
    if (!reserves) return null;
    const amountOut = getAmountOut(
      amountIn,
      reserves.reserveIn,
      reserves.reserveOut,
    );
    const spot = spotPrice(reserves.reserveIn, reserves.reserveOut);
    const exec = executionPrice(amountIn, amountOut);
    const impact = priceImpact(spot, exec);
    const feePaid = amountIn * 0.003;
    const minOut = amountOut * (1 - slippageBps / 10_000);
    return {
      amountOut,
      spot,
      exec,
      impact,
      feePaid,
      minOut,
      tokenOut: reserves.tokenOut,
    };
  }, [pool, amountStr, effectiveIn, slippageBps]);

  if (!pool || !me) return null;

  const amountIn = Number(amountStr);
  const balanceIn = me.balances[effectiveIn];
  const insufficient = amountIn > balanceIn;
  const tokenOut = effectiveIn === pool.tokenA ? pool.tokenB : pool.tokenA;
  const highImpact = quote ? quote.impact >= 0.05 : false;
  const customSlippage = !SLIPPAGE_PRESETS.includes(slippageBps);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className={TOKEN_TEXT[effectiveIn]}>{effectiveIn}</span>
          <button
            type="button"
            title="Flip direction"
            onClick={() => setTokenIn(tokenOut)}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-slate-300 transition hover:border-teal-400/40 hover:text-teal-200"
          >
            ⇄
          </button>
          <span className={TOKEN_TEXT[tokenOut]}>{tokenOut}</span>
        </div>
        <span className="text-sm text-slate-400">{POOL_DEFS[poolId].label}</span>
      </div>

      <div>
        <Input
          label={`You pay (${effectiveIn})`}
          type="number"
          min={0}
          step={1}
          value={amountStr}
          onChange={setAmountStr}
        />
        <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
          <span className="num">
            Balance: {fmt(balanceIn)} {effectiveIn}
          </span>
          <div className="flex gap-1">
            {[0.25, 0.5, 1].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setAmountStr(String(roundDown(balanceIn * f)))}
                className="rounded-md bg-white/5 px-2 py-0.5 font-semibold text-slate-300 hover:bg-white/10"
              >
                {f === 1 ? 'Max' : `${f * 100}%`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {quote && (
        <div className="space-y-2 rounded-xl bg-slate-950/50 p-3 text-sm">
          <Row
            label="Expected out"
            value={`${fmt(quote.amountOut, 4)} ${quote.tokenOut}`}
          />
          <Row
            label={
              <>
                Spot vs exec <Tooltip tip="spot" />
              </>
            }
            value={`${fmt(quote.spot, 4)} → ${fmt(quote.exec, 4)}`}
          />
          <Row
            label={
              <>
                Price impact <Tooltip tip="price-impact" />
              </>
            }
            value={fmtPct(quote.impact)}
          />
          <Row
            label={
              <>
                Fee (0.3%) <Tooltip tip="fee" />
              </>
            }
            value={`${fmt(quote.feePaid, 4)} ${effectiveIn}`}
          />
          <Row label="Min received" value={`${fmt(quote.minOut, 4)} ${quote.tokenOut}`} />
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center gap-1 text-sm text-slate-300">
          Slippage tolerance <Tooltip tip="slippage" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {SLIPPAGE_PRESETS.map((bps) => (
            <button
              key={bps}
              type="button"
              onClick={() => setSlippage(bps)}
              className={`num rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                slippageBps === bps
                  ? 'bg-teal-400/20 text-teal-100'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200'
              }`}
            >
              {bps / 100}%
            </button>
          ))}
          <label
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-sm ${
              customSlippage ? 'border-teal-400/40' : 'border-white/10'
            }`}
          >
            <input
              type="number"
              min={0.01}
              max={50}
              step={0.1}
              value={slippageBps / 100}
              onChange={(e) => {
                const pct = Number(e.target.value);
                if (pct > 0 && pct <= 50) setSlippage(Math.round(pct * 100));
              }}
              className="num w-14 bg-transparent text-right text-slate-100 outline-none"
              aria-label="Custom slippage percent"
            />
            <span className="text-slate-500">%</span>
          </label>
        </div>
      </div>

      {insufficient && (
        <p className="text-sm text-amber-300">
          Insufficient {effectiveIn} balance.
        </p>
      )}
      {!insufficient && highImpact && (
        <p className="text-sm text-amber-300">
          High price impact — this trade moves the pool price a lot. Smaller
          trades get a better rate.
        </p>
      )}
      {lastError && <p className="text-sm text-rose-300">{lastError}</p>}

      <Button
        className="w-full text-lg"
        disabled={
          !quote || !(amountIn > 0) || insufficient || quote.amountOut <= 0
        }
        onClick={() => {
          clearError();
          requestSwap(poolId, effectiveIn, amountIn, quote?.minOut);
        }}
      >
        {quote
          ? `Swap for ~${fmt(quote.amountOut, 2)} ${quote.tokenOut}`
          : 'Swap'}
      </Button>
    </div>
  );
}

const SLIPPAGE_PRESETS = [10, 50, 100, 300];

function roundDown(n: number): number {
  return Math.floor(n * 100) / 100;
}

function Row({
  label,
  value,
}: {
  label: ReactNode;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="num font-medium text-slate-100">{value}</span>
    </div>
  );
}
