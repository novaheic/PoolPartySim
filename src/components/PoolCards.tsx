import { motion } from 'framer-motion';
import { poolK, spotPrice } from '../amm';
import { fmt, fmtUsd } from '../lib/format';
import { TOKEN_DOT, TOKEN_TEXT } from '../lib/tokens';
import { useStore } from '../store';
import { ALL_POOL_IDS, POOL_DEFS, type PoolId } from '../types';
import { Tooltip } from './Tooltip';
import { Card } from './ui';

export function PoolCards() {
  const pools = useStore((s) => s.room?.pools);
  const oracle = useStore((s) => s.room?.oracle);
  const selected = useStore((s) => s.selectedPoolId);
  const selectPool = useStore((s) => s.selectPool);
  if (!pools || !oracle) return null;

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {ALL_POOL_IDS.map((id) => {
        const pool = pools[id];
        const def = POOL_DEFS[id];
        const total =
          pool.reserveA * oracle[pool.tokenA] +
          pool.reserveB * oracle[pool.tokenB];
        const aPct =
          total > 0 ? ((pool.reserveA * oracle[pool.tokenA]) / total) * 100 : 50;
        return (
          <Card
            key={id}
            active={selected === id}
            onClick={() => selectPool(id as PoolId)}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold text-white">{def.label}</h3>
              <Tooltip tip="k" />
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Spot{' '}
              <span className="num text-slate-200">
                {fmt(spotPrice(pool.reserveA, pool.reserveB), 4)} {pool.tokenB}/
                {pool.tokenA}
              </span>{' '}
              <Tooltip tip="spot" />
            </p>
            <div
              className="mt-3 flex h-3 overflow-hidden rounded-full"
              title={`${aPct.toFixed(1)}% ${pool.tokenA} / ${(100 - aPct).toFixed(1)}% ${pool.tokenB} by USD value`}
            >
              <motion.div
                className={`h-full ${TOKEN_DOT[pool.tokenA]}`}
                animate={{ width: `${aPct}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              />
              <div className={`h-full flex-1 ${TOKEN_DOT[pool.tokenB]}`} />
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="num text-slate-200">
                {fmt(pool.reserveA)}{' '}
                <span className={TOKEN_TEXT[pool.tokenA]}>{pool.tokenA}</span>
              </span>
              <span className="num text-slate-200">
                {fmt(pool.reserveB)}{' '}
                <span className={TOKEN_TEXT[pool.tokenB]}>{pool.tokenB}</span>
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-400">
              <div>
                k <Tooltip tip="k" />
                <div className="num text-slate-200">{fmt(poolK(pool), 0)}</div>
              </div>
              <div>
                TVL <Tooltip tip="tvl" />
                <div className="num text-slate-200">{fmtUsd(total)}</div>
              </div>
              <div>
                Fees <Tooltip tip="fee" />
                <div className="num text-slate-200">
                  {fmtUsd(
                    pool.feesEarnedA * oracle[pool.tokenA] +
                      pool.feesEarnedB * oracle[pool.tokenB],
                  )}
                </div>
              </div>
              <div>
                LP supply
                <div className="num text-slate-200">{fmt(pool.totalLp)}</div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
