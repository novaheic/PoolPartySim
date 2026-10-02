import {
  TOKENS,
  type HoldingSnapshot,
  type OraclePrices,
  type Player,
  type Pool,
  type PoolId,
  type TokenId,
} from '../types';

function zero(): Record<TokenId, number> {
  return { WOOD: 0, STONE: 0, GOLD: 0 };
}

export function lpUnderlying(
  player: Player,
  pools: Record<PoolId, Pool>,
): Record<TokenId, number> {
  const out = zero();
  for (const pos of Object.values(player.positions)) {
    if (!pos) continue;
    const pool = pools[pos.poolId];
    if (!pool || pool.totalLp <= 0) continue;
    const share = pos.lpTokens / pool.totalLp;
    out[pool.tokenA] += share * pool.reserveA;
    out[pool.tokenB] += share * pool.reserveB;
  }
  return out;
}

export function snapshotHoldings(
  player: Player,
  pools: Record<PoolId, Pool>,
  label: string,
  ts = Date.now(),
): HoldingSnapshot {
  return {
    ts,
    label,
    wallet: { ...player.balances },
    lp: lpUnderlying(player, pools),
  };
}

export function snapshotValueUsd(s: HoldingSnapshot, oracle: OraclePrices) {
  let wallet = 0;
  let lp = 0;
  for (const t of TOKENS) {
    wallet += s.wallet[t] * oracle[t];
    lp += s.lp[t] * oracle[t];
  }
  return { wallet, lp, total: wallet + lp };
}
