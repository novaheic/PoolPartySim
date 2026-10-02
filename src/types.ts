export type TokenId = 'WOOD' | 'STONE' | 'GOLD';
export type PoolId = 'WOOD_STONE' | 'STONE_GOLD' | 'WOOD_GOLD';

export const TOKENS: TokenId[] = ['WOOD', 'STONE', 'GOLD'];

export const POOL_DEFS: Record<
  PoolId,
  { id: PoolId; tokenA: TokenId; tokenB: TokenId; label: string }
> = {
  WOOD_STONE: {
    id: 'WOOD_STONE',
    tokenA: 'WOOD',
    tokenB: 'STONE',
    label: 'WOOD / STONE',
  },
  STONE_GOLD: {
    id: 'STONE_GOLD',
    tokenA: 'STONE',
    tokenB: 'GOLD',
    label: 'STONE / GOLD',
  },
  WOOD_GOLD: {
    id: 'WOOD_GOLD',
    tokenA: 'WOOD',
    tokenB: 'GOLD',
    label: 'WOOD / GOLD',
  },
};

export const ALL_POOL_IDS = Object.keys(POOL_DEFS) as PoolId[];

export const FEE = 0.003;
export const MIN_LIQUIDITY = 100;
export const MAX_PLAYERS = 50;
export const GLOBAL_ROOM_ID = 'global';

export interface Pool {
  id: PoolId;
  tokenA: TokenId;
  tokenB: TokenId;
  reserveA: number;
  reserveB: number;
  totalLp: number;
  feesEarnedA: number;
  feesEarnedB: number;
}

export interface LpPosition {
  poolId: PoolId;
  lpTokens: number;
  entryReserveA: number;
  entryReserveB: number;
  entryLpSupply: number;
  depositedA: number;
  depositedB: number;
}

export interface Player {
  id: string;
  name: string;
  balances: Record<TokenId, number>;
  positions: Partial<Record<PoolId, LpPosition>>;
  connectionId: string | null;
}

/** Pool prices are always quoted as tokenB per tokenA. */
export type ActivityDetail =
  | {
      kind: 'swap';
      poolId: PoolId;
      tokenIn: TokenId;
      amountIn: number;
      tokenOut: TokenId;
      amountOut: number;
      fee: number;
      impact: number;
      priceBefore: number;
      priceAfter: number;
      whale?: boolean;
    }
  | {
      kind: 'addLiquidity' | 'removeLiquidity';
      poolId: PoolId;
      amountA: number;
      amountB: number;
      lp: number;
      shareAfter: number;
    }
  | { kind: 'oracle'; token: TokenId; from: number; to: number }
  | { kind: 'airdrop'; amount: number; recipients: number }
  | { kind: 'join' }
  | { kind: 'system' };

export type ActivityKind = ActivityDetail['kind'];

export interface ActivityEvent {
  id: string;
  ts: number;
  playerId: string | null;
  message: string;
  /** Display name of whoever triggered the event (also set for instructor actions). */
  actor?: string;
  detail?: ActivityDetail;
}

/** A player's holdings right after something changed them. */
export interface HoldingSnapshot {
  ts: number;
  label: string;
  wallet: Record<TokenId, number>;
  /** Underlying tokens the player's LP positions could be redeemed for. */
  lp: Record<TokenId, number>;
}

export interface OraclePrices {
  WOOD: number;
  STONE: number;
  GOLD: number;
}

export interface RoomState {
  periodId: string;
  players: Player[];
  pools: Record<PoolId, Pool>;
  oracle: OraclePrices;
  activity: ActivityEvent[];
  completedChallenges: Record<string, string[]>;
}

export type ClientMessage =
  | { type: 'join'; name: string; playerId?: string }
  | {
      type: 'swap';
      poolId: PoolId;
      tokenIn: TokenId;
      amountIn: number;
      minAmountOut?: number;
    }
  | { type: 'addLiquidity'; poolId: PoolId; amountA: number; amountB: number }
  | { type: 'removeLiquidity'; poolId: PoolId; lpTokens: number }
  | { type: 'setOracle'; token: TokenId; usd: number }
  | { type: 'injectWhale'; poolId: PoolId; tokenIn: TokenId; amountIn: number }
  | { type: 'giveTokens'; amountPerToken: number }
  | { type: 'resetSandbox' }
  | { type: 'markChallenge'; challengeId: string };

export type ServerMessage =
  | {
      type: 'state';
      state: RoomState;
      yourPlayerId: string | null;
      yourHistory?: HoldingSnapshot[];
    }
  | { type: 'error'; message: string }
  | { type: 'joined'; playerId: string };
