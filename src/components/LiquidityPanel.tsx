import { useMemo, useState } from 'react';
import {
  autoFillOtherSide,
  canRemoveLiquidity,
  quoteAddLiquidity,
} from '../amm';
import { fmt } from '../lib/format';
import { useMe, useStore } from '../store';
import { POOL_DEFS } from '../types';
import { Tooltip } from './Tooltip';
import { Button, Input, Tabs } from './ui';

export function LiquidityPanel() {
  const poolId = useStore((s) => s.selectedPoolId);
  const pool = useStore((s) => s.room?.pools[s.selectedPoolId]);
  const requestAdd = useStore((s) => s.requestAddLiquidity);
  const requestRemove = useStore((s) => s.requestRemoveLiquidity);
  const me = useMe();
  const [tab, setTab] = useState('add');
  const [amountA, setAmountA] = useState('50');
  const [amountB, setAmountB] = useState('50');
  const [lpPct, setLpPct] = useState('50');

  const pos = me?.positions[poolId];
  const quote = useMemo(() => {
    if (!pool) return null;
    return quoteAddLiquidity(pool, Number(amountA) || 0, Number(amountB) || 0);
  }, [pool, amountA, amountB]);

  if (!pool || !me) return null;

  const share =
    pool.totalLp > 0 && pos ? (pos.lpTokens / pool.totalLp) * 100 : 0;
  const lpToBurn = pos ? (pos.lpTokens * (Number(lpPct) || 0)) / 100 : 0;
  const addInsufficient =
    !!quote &&
    (quote.amountA > me.balances[pool.tokenA] + 1e-9 ||
      quote.amountB > me.balances[pool.tokenB] + 1e-9);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-sm text-slate-300">
          LP tokens <Tooltip tip="lp-token" />
        </span>
        <span className="text-sm text-slate-400">{POOL_DEFS[poolId].label}</span>
      </div>
      <Tabs
        tabs={[
          { id: 'add', label: 'Add' },
          { id: 'remove', label: 'Remove' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="rounded-xl bg-slate-950/50 p-3 text-sm text-slate-300">
        <p>
          Your share:{' '}
          <span className="num font-semibold text-white">{fmt(share, 2)}%</span>
        </p>
        <p>
          LP tokens:{' '}
          <span className="num font-semibold text-white">
            {fmt(pos?.lpTokens ?? 0, 4)}
          </span>
        </p>
        <p className="text-slate-400">
          Pool fees accrued: {fmt(pool.feesEarnedA)} {pool.tokenA} /{' '}
          {fmt(pool.feesEarnedB)} {pool.tokenB} (shared by all LPs)
        </p>
      </div>

      {tab === 'add' ? (
        <>
          <Input
            label={pool.tokenA}
            type="number"
            value={amountA}
            onChange={(v) => {
              setAmountA(v);
              if (pool.totalLp > 0) {
                const a = Number(v);
                if (a > 0) setAmountB(String(autoFillOtherSide(pool, 'A', a)));
              }
            }}
          />
          <Input
            label={pool.tokenB}
            type="number"
            value={amountB}
            onChange={(v) => {
              setAmountB(v);
              if (pool.totalLp > 0) {
                const b = Number(v);
                if (b > 0) setAmountA(String(autoFillOtherSide(pool, 'B', b)));
              }
            }}
          />
          <p className="num text-xs text-slate-400">
            Balance: {fmt(me.balances[pool.tokenA])} {pool.tokenA} ·{' '}
            {fmt(me.balances[pool.tokenB])} {pool.tokenB}
          </p>
          {quote && quote.lpMinted > 0 && (
            <p className="text-sm text-slate-400">
              You will mint ~{fmt(quote.lpMinted, 4)} LP (
              {fmt(quote.shareAfter * 100, 2)}% of the pool)
            </p>
          )}
          {addInsufficient && (
            <p className="text-sm text-amber-300">Insufficient balance for this deposit.</p>
          )}
          <Button
            className="w-full"
            disabled={!quote || quote.lpMinted <= 0 || addInsufficient}
            onClick={() => requestAdd(poolId, quote!.amountA, quote!.amountB)}
          >
            Add liquidity
          </Button>
        </>
      ) : (
        <>
          <Input
            label="% of your LP to remove"
            type="number"
            min={1}
            max={100}
            value={lpPct}
            onChange={setLpPct}
          />
          <div className="flex gap-1">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setLpPct(String(p))}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition ${
                  Number(lpPct) === p
                    ? 'bg-teal-400/20 text-teal-100'
                    : 'bg-white/5 text-slate-400 hover:text-slate-200'
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
          <p className="text-sm text-slate-400">
            Burning {fmt(lpToBurn, 4)} LP
          </p>
          <Button
            className="w-full"
            disabled={!pos || lpToBurn <= 0 || !canRemoveLiquidity(pool, lpToBurn)}
            onClick={() => requestRemove(poolId, lpToBurn)}
          >
            Remove liquidity
          </Button>
          {pos && lpToBurn > 0 && !canRemoveLiquidity(pool, lpToBurn) && (
            <p className="text-sm text-amber-300">
              That would leave the pool below minimum liquidity.
            </p>
          )}
        </>
      )}
    </div>
  );
}
