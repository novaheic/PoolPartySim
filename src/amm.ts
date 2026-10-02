import { FEE, MIN_LIQUIDITY, type Pool, type LpPosition, type TokenId } from './types';

export function getAmountOut(
  amountIn: number,
  reserveIn: number,
  reserveOut: number,
  fee = FEE,
): number {
  if (amountIn <= 0 || reserveIn <= 0 || reserveOut <= 0) return 0;
  const amountInWithFee = amountIn * (1 - fee);
  return (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);
}

/** Spot price of tokenA in terms of tokenB (B per A). */
export function spotPrice(reserveA: number, reserveB: number): number {
  if (reserveA <= 0) return 0;
  return reserveB / reserveA;
}

/** Execution price: tokenOut received per tokenIn. */
export function executionPrice(amountIn: number, amountOut: number): number {
  if (amountIn <= 0) return 0;
  return amountOut / amountIn;
}

/** Absolute price impact as a fraction (0.01 = 1%). */
export function priceImpact(spot: number, execution: number): number {
  if (spot <= 0) return 0;
  return Math.abs(1 - execution / spot);
}

export function poolK(pool: Pool): number {
  return pool.reserveA * pool.reserveB;
}

export interface AddLiquidityQuote {
  amountA: number;
  amountB: number;
  lpMinted: number;
  shareAfter: number;
}

export function quoteAddLiquidity(
  pool: Pool,
  amountADesired: number,
  amountBDesired: number,
): AddLiquidityQuote {
  if (amountADesired <= 0 || amountBDesired <= 0) {
    return { amountA: 0, amountB: 0, lpMinted: 0, shareAfter: 0 };
  }

  if (pool.totalLp === 0 || pool.reserveA === 0 || pool.reserveB === 0) {
    const lpMinted = Math.sqrt(amountADesired * amountBDesired);
    return {
      amountA: amountADesired,
      amountB: amountBDesired,
      lpMinted,
      shareAfter: 1,
    };
  }

  const amountBOptimal = (amountADesired * pool.reserveB) / pool.reserveA;
  let amountA = amountADesired;
  let amountB = amountBDesired;

  if (amountBOptimal <= amountBDesired) {
    amountB = amountBOptimal;
  } else {
    amountA = (amountBDesired * pool.reserveA) / pool.reserveB;
  }

  const lpMinted = Math.min(
    (amountA * pool.totalLp) / pool.reserveA,
    (amountB * pool.totalLp) / pool.reserveB,
  );
  const shareAfter = lpMinted / (pool.totalLp + lpMinted);

  return { amountA, amountB, lpMinted, shareAfter };
}

/** Given one side of a later deposit, compute the matching other side. */
export function autoFillOtherSide(
  pool: Pool,
  known: 'A' | 'B',
  amount: number,
): number {
  if (amount <= 0 || pool.reserveA <= 0 || pool.reserveB <= 0) return 0;
  if (known === 'A') return (amount * pool.reserveB) / pool.reserveA;
  return (amount * pool.reserveA) / pool.reserveB;
}

export interface RemoveLiquidityQuote {
  amountA: number;
  amountB: number;
  lpBurned: number;
}

export function quoteRemoveLiquidity(
  pool: Pool,
  lpTokens: number,
): RemoveLiquidityQuote {
  if (lpTokens <= 0 || pool.totalLp <= 0) {
    return { amountA: 0, amountB: 0, lpBurned: 0 };
  }
  const lpBurned = Math.min(lpTokens, pool.totalLp);
  const remaining = pool.totalLp - lpBurned;
  if (remaining < MIN_LIQUIDITY && remaining > 0) {
    return { amountA: 0, amountB: 0, lpBurned: 0 };
  }
  const amountA = (lpBurned * pool.reserveA) / pool.totalLp;
  const amountB = (lpBurned * pool.reserveB) / pool.totalLp;
  return { amountA, amountB, lpBurned };
}

export function canRemoveLiquidity(pool: Pool, lpTokens: number): boolean {
  if (lpTokens <= 0 || pool.totalLp <= 0) return false;
  const remaining = pool.totalLp - Math.min(lpTokens, pool.totalLp);
  return remaining === 0 || remaining >= MIN_LIQUIDITY;
}

/**
 * Classic constant-product IL vs holding.
 * entryPrices / currentPrices are B-per-A style relative prices (tokenB/tokenA).
 * Returns fraction (negative means loss), e.g. -0.057 for ~5.7% at 2x.
 */
export function impermanentLoss(
  entryPrice: number,
  currentPrice: number,
): number {
  if (entryPrice <= 0 || currentPrice <= 0) return 0;
  const ratio = currentPrice / entryPrice;
  const holdValue = 0.5 * ratio + 0.5;
  const lpValue = Math.sqrt(ratio);
  return lpValue / holdValue - 1;
}

export function positionValuesUsd(
  position: LpPosition,
  pool: Pool,
  oracle: Record<TokenId, number>,
): {
  currentLpValue: number;
  holdValue: number;
  feesValue: number;
  ilFraction: number;
} {
  const share = pool.totalLp > 0 ? position.lpTokens / pool.totalLp : 0;
  const currentA = share * pool.reserveA;
  const currentB = share * pool.reserveB;
  const priceA = oracle[pool.tokenA];
  const priceB = oracle[pool.tokenB];

  const currentLpValue = currentA * priceA + currentB * priceB;
  const holdValue = position.depositedA * priceA + position.depositedB * priceB;

  const entryPrice = spotPrice(position.entryReserveA, position.entryReserveB);
  const currentPrice = spotPrice(pool.reserveA, pool.reserveB);
  const ilFraction = impermanentLoss(entryPrice, currentPrice);

  // Approximate fees as LP value minus what IL alone would imply vs hold
  const valueIfNoFees = holdValue * (1 + ilFraction);
  const feesValue = Math.max(0, currentLpValue - valueIfNoFees);

  return { currentLpValue, holdValue, feesValue, ilFraction };
}

export function getReservesForSwap(
  pool: Pool,
  tokenIn: TokenId,
): { reserveIn: number; reserveOut: number; tokenOut: TokenId } | null {
  if (tokenIn === pool.tokenA) {
    return {
      reserveIn: pool.reserveA,
      reserveOut: pool.reserveB,
      tokenOut: pool.tokenB,
    };
  }
  if (tokenIn === pool.tokenB) {
    return {
      reserveIn: pool.reserveB,
      reserveOut: pool.reserveA,
      tokenOut: pool.tokenA,
    };
  }
  return null;
}

export function applySwapToPool(
  pool: Pool,
  tokenIn: TokenId,
  amountIn: number,
  fee = FEE,
): { pool: Pool; amountOut: number; feePaid: number; tokenOut: TokenId } | null {
  const reserves = getReservesForSwap(pool, tokenIn);
  if (!reserves || amountIn <= 0) return null;
  const amountOut = getAmountOut(
    amountIn,
    reserves.reserveIn,
    reserves.reserveOut,
    fee,
  );
  if (amountOut <= 0 || amountOut >= reserves.reserveOut) return null;

  const feePaid = amountIn * fee;
  const next: Pool = { ...pool };

  if (tokenIn === pool.tokenA) {
    next.reserveA = pool.reserveA + amountIn;
    next.reserveB = pool.reserveB - amountOut;
    next.feesEarnedA = pool.feesEarnedA + feePaid;
  } else {
    next.reserveB = pool.reserveB + amountIn;
    next.reserveA = pool.reserveA - amountOut;
    next.feesEarnedB = pool.feesEarnedB + feePaid;
  }

  return { pool: next, amountOut, feePaid, tokenOut: reserves.tokenOut };
}
