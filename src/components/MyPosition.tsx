import { positionValuesUsd } from '../amm';
import { fmt, fmtPct, fmtUsd } from '../lib/format';
import { useMe, useStore } from '../store';
import { POOL_DEFS, type PoolId } from '../types';
import { Tooltip } from './Tooltip';

export function MyPosition() {
  const me = useMe();
  const pools = useStore((s) => s.room?.pools);
  const oracle = useStore((s) => s.room?.oracle);

  if (!me || !pools || !oracle) return null;
  const entries = Object.entries(me.positions) as [
    PoolId,
    NonNullable<(typeof me.positions)[PoolId]>,
  ][];

  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">My position</h2>
        <Tooltip tip="impermanent-loss" />
      </div>
      {entries.length === 0 && (
        <p className="text-sm text-slate-400">
          No LP positions yet. Add liquidity to a pool to track IL and fees.
        </p>
      )}
      {entries.map(([poolId, pos]) => {
        const pool = pools[poolId];
        const v = positionValuesUsd(pos, pool, oracle);
        return (
          <div
            key={poolId}
            className="rounded-xl border border-white/10 bg-slate-950/40 p-3"
          >
            <p className="font-semibold text-teal-100">
              {POOL_DEFS[poolId].label}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <Stat label="LP value now" value={fmtUsd(v.currentLpValue)} />
              <Stat label="If just held" value={fmtUsd(v.holdValue)} />
              <Stat label="Est. fees" value={fmtUsd(v.feesValue)} />
              <Stat
                label="Impermanent loss"
                value={fmtPct(v.ilFraction)}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              IL compares LP value to holding your deposit. Fees you earn as an
              LP can offset it. Share: {fmt((pos.lpTokens / pool.totalLp) * 100)}
              % of the pool.
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-400">{label}</p>
      <p className="num text-base font-semibold text-white">{value}</p>
    </div>
  );
}
