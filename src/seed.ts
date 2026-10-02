import { currentPeriodId } from './lib/period';
import type {
  ActivityEvent,
  OraclePrices,
  Pool,
  PoolId,
  RoomState,
  TokenId,
} from './types';
import { POOL_DEFS } from './types';

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomBalances(): Record<TokenId, number> {
  return {
    WOOD: randomInt(200, 1000),
    STONE: randomInt(200, 1000),
    GOLD: randomInt(200, 1000),
  };
}

function makePool(
  id: PoolId,
  reserveA: number,
  reserveB: number,
  totalLp: number,
): Pool {
  const def = POOL_DEFS[id];
  return {
    id,
    tokenA: def.tokenA,
    tokenB: def.tokenB,
    reserveA,
    reserveB,
    totalLp,
    feesEarnedA: 0,
    feesEarnedB: 0,
  };
}

/** Deliberately slightly mismatched prices so arb exists across the triangle. */
export function createInitialPools(): Record<PoolId, Pool> {
  // WOOD/STONE ≈ 1
  const woodStone = makePool('WOOD_STONE', 1000, 1000, 1000);
  // STONE/GOLD ≈ 5 STONE per GOLD
  const stoneGold = makePool('STONE_GOLD', 1000, 200, Math.sqrt(1000 * 200));
  // WOOD/GOLD slightly off vs path through STONE (~5.56 vs 5)
  const woodGold = makePool('WOOD_GOLD', 1000, 180, Math.sqrt(1000 * 180));
  return {
    WOOD_STONE: woodStone,
    STONE_GOLD: stoneGold,
    WOOD_GOLD: woodGold,
  };
}

export function defaultOracle(): OraclePrices {
  return { WOOD: 1, STONE: 1, GOLD: 5 };
}

export function createInitialState(now = Date.now()): RoomState {
  return {
    periodId: currentPeriodId(now),
    players: [],
    pools: createInitialPools(),
    oracle: defaultOracle(),
    activity: [
      {
        id: cryptoRandomId(),
        ts: now,
        playerId: null,
        message: `Sandbox ready for period ${currentPeriodId(now)}`,
        detail: { kind: 'system' },
      },
    ],
    completedChallenges: {},
  };
}

export function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function makeActivity(
  message: string,
  playerId: string | null = null,
  extra: Pick<ActivityEvent, 'actor' | 'detail'> = {},
): ActivityEvent {
  return {
    id: cryptoRandomId(),
    ts: Date.now(),
    playerId,
    message,
    ...extra,
  };
}
