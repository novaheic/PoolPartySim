import { describe, expect, it } from 'vitest';
import {
  getAmountOut,
  spotPrice,
  executionPrice,
  priceImpact,
  quoteAddLiquidity,
  quoteRemoveLiquidity,
  canRemoveLiquidity,
  impermanentLoss,
  applySwapToPool,
} from './amm';
import { MIN_LIQUIDITY, type Pool } from './types';

function pool(overrides: Partial<Pool> = {}): Pool {
  return {
    id: 'WOOD_STONE',
    tokenA: 'WOOD',
    tokenB: 'STONE',
    reserveA: 1000,
    reserveB: 1000,
    totalLp: 1000,
    feesEarnedA: 0,
    feesEarnedB: 0,
    ...overrides,
  };
}

describe('getAmountOut', () => {
  it('returns 0 for zero or negative input', () => {
    expect(getAmountOut(0, 1000, 1000)).toBe(0);
    expect(getAmountOut(-1, 1000, 1000)).toBe(0);
  });

  it('matches Uniswap V2 fee math for a known vector', () => {
    // Without fee: 100 * 1000 / 1100 ≈ 90.909
    // With 0.3% fee: amountInWithFee = 99.7 → out = 1000 * 99.7 / (1000 + 99.7)
    const out = getAmountOut(100, 1000, 1000, 0.003);
    expect(out).toBeCloseTo((1000 * 99.7) / (1000 + 99.7), 6);
  });

  it('never returns the full reserveOut', () => {
    const out = getAmountOut(1e12, 1000, 1000);
    expect(out).toBeLessThan(1000);
  });
});

describe('prices', () => {
  it('spotPrice is B per A', () => {
    expect(spotPrice(1000, 500)).toBe(0.5);
  });

  it('executionPrice and priceImpact', () => {
    const spot = spotPrice(1000, 1000);
    const out = getAmountOut(100, 1000, 1000);
    const exec = executionPrice(100, out);
    expect(exec).toBeLessThan(spot);
    expect(priceImpact(spot, exec)).toBeGreaterThan(0);
  });
});

describe('liquidity', () => {
  it('first deposit sets price via geometric mean LP', () => {
    const empty = pool({ reserveA: 0, reserveB: 0, totalLp: 0 });
    const q = quoteAddLiquidity(empty, 100, 400);
    expect(q.lpMinted).toBeCloseTo(200);
    expect(q.amountA).toBe(100);
    expect(q.amountB).toBe(400);
  });

  it('later deposit matches ratio', () => {
    const q = quoteAddLiquidity(pool(), 100, 999);
    expect(q.amountA).toBeCloseTo(100);
    expect(q.amountB).toBeCloseTo(100);
  });

  it('remove is pro-rata and respects MIN_LIQUIDITY', () => {
    const p = pool({ totalLp: MIN_LIQUIDITY + 50 });
    expect(canRemoveLiquidity(p, 50)).toBe(true);
    expect(canRemoveLiquidity(p, 51)).toBe(false);
    const q = quoteRemoveLiquidity(p, 50);
    expect(q.amountA).toBeCloseTo((50 * p.reserveA) / p.totalLp);
  });
});

describe('impermanentLoss', () => {
  it('is about -5.72% when price doubles', () => {
    const il = impermanentLoss(1, 2);
    expect(il).toBeCloseTo(Math.sqrt(2) / (0.5 * 2 + 0.5) - 1, 4);
    expect(il).toBeCloseTo(-0.05719, 3);
  });

  it('is 0 when price unchanged', () => {
    expect(impermanentLoss(1, 1)).toBeCloseTo(0);
  });
});

describe('applySwapToPool', () => {
  it('updates reserves and fee counters', () => {
    const result = applySwapToPool(pool(), 'WOOD', 100);
    expect(result).not.toBeNull();
    expect(result!.pool.reserveA).toBeGreaterThan(1000);
    expect(result!.pool.reserveB).toBeLessThan(1000);
    expect(result!.pool.feesEarnedA).toBeCloseTo(0.3);
    expect(result!.amountOut).toBeCloseTo(getAmountOut(100, 1000, 1000));
  });
});
