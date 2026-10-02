import type * as Party from 'partykit/server';
import {
  applySwapToPool,
  canRemoveLiquidity,
  getReservesForSwap,
  priceImpact,
  quoteAddLiquidity,
  quoteRemoveLiquidity,
  spotPrice,
  executionPrice,
} from '../src/amm';
import { evaluateChallenges } from '../src/lib/challenges';
import { snapshotHoldings } from '../src/lib/holdings';
import { isPeriodStale, currentPeriodId } from '../src/lib/period';
import {
  createInitialPools,
  createInitialState,
  cryptoRandomId,
  defaultOracle,
  makeActivity,
  randomBalances,
} from '../src/seed';
import {
  MAX_PLAYERS,
  POOL_DEFS,
  type ClientMessage,
  type HoldingSnapshot,
  type Player,
  type RoomState,
  type ServerMessage,
  type TokenId,
} from '../src/types';

const ORACLE_MERGE_MS = 15_000;
const MAX_HISTORY = 300;

async function messageToString(
  message: string | ArrayBuffer | ArrayBufferView,
): Promise<string> {
  if (typeof message === 'string') return message;
  if (message instanceof ArrayBuffer) {
    return new TextDecoder().decode(message);
  }
  if (ArrayBuffer.isView(message)) {
    return new TextDecoder().decode(
      message.buffer.slice(
        message.byteOffset,
        message.byteOffset + message.byteLength,
      ),
    );
  }
  // Blob or unknown — PartyKit may pass non-typed payloads at runtime
  const maybe = message as { text?: () => Promise<string> };
  if (typeof maybe.text === 'function') return maybe.text();
  return String(message);
}

export default class SandboxServer implements Party.Server {
  state: RoomState;
  room: Party.Room;
  /** Kept out of RoomState so each player only receives their own history. */
  histories = new Map<string, HoldingSnapshot[]>();

  constructor(room: Party.Room) {
    this.room = room;
    this.state = createInitialState();
  }

  onStart() {
    // In-memory only. Durable storage writes were racing Vite/HMR and
    // made the browser look like it "refreshed" on every join.
    this.ensureFreshPeriod();
  }

  onConnect(connection: Party.Connection) {
    this.ensureFreshPeriod();
    this.sendState(connection);
  }

  onClose(connection: Party.Connection) {
    let changed = false;
    for (const p of this.state.players) {
      if (p.connectionId === connection.id) {
        p.connectionId = null;
        changed = true;
      }
    }
    if (changed) this.broadcastState();
  }

  async onMessage(message: string | ArrayBuffer, sender: Party.Connection) {
    let raw: string;
    try {
      raw = await messageToString(message);
    } catch {
      this.send(sender, { type: 'error', message: 'Could not read message' });
      return;
    }

    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      this.send(sender, { type: 'error', message: 'Invalid message' });
      return;
    }

    this.ensureFreshPeriod();

    try {
      switch (msg.type) {
        case 'join':
          this.handleJoin(sender, msg.name, msg.playerId);
          break;
        case 'swap':
          this.handleSwap(sender, msg);
          break;
        case 'addLiquidity':
          this.handleAddLiquidity(sender, msg);
          break;
        case 'removeLiquidity':
          this.handleRemoveLiquidity(sender, msg);
          break;
        case 'setOracle':
          this.handleSetOracle(sender, msg.token, msg.usd);
          break;
        case 'injectWhale':
          this.handleWhale(sender, msg);
          break;
        case 'giveTokens':
          this.handleGiveTokens(sender, msg.amountPerToken);
          break;
        case 'resetSandbox':
          this.handleResetSandbox(sender);
          break;
        case 'markChallenge':
          this.handleMarkChallenge(sender, msg.challengeId);
          break;
        default:
          this.send(sender, { type: 'error', message: 'Unknown action' });
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Action failed';
      this.send(sender, { type: 'error', message: text });
    }
  }

  private ensureFreshPeriod() {
    if (!this.state.periodId || isPeriodStale(this.state.periodId)) {
      const periodId = currentPeriodId();
      this.state = createInitialState();
      this.histories.clear();
      this.state.periodId = periodId;
      this.state.activity = [
        makeActivity(`Sandbox refreshed for the new week (${periodId})`, null, {
          detail: { kind: 'system' },
        }),
      ];
    }
  }

  private playerIdForConnection(connectionId: string): string | null {
    return (
      this.state.players.find((p) => p.connectionId === connectionId)?.id ?? null
    );
  }

  private requirePlayer(connection: Party.Connection): Player {
    const player = this.state.players.find(
      (p) => p.connectionId === connection.id,
    );
    if (!player) throw new Error('Join with a name before trading');
    return player;
  }

  private handleJoin(
    connection: Party.Connection,
    rawName: string,
    preferredId?: string,
  ) {
    const name = rawName.trim().slice(0, 24);
    if (!name) throw new Error('Name is required');

    for (const p of this.state.players) {
      if (p.connectionId === connection.id) p.connectionId = null;
    }

    if (preferredId) {
      const existing = this.state.players.find((p) => p.id === preferredId);
      if (existing) {
        existing.connectionId = connection.id;
        existing.name = name;
        this.send(connection, { type: 'joined', playerId: existing.id });
        this.broadcastState();
        return;
      }
    }

    const byName = this.state.players.find(
      (p) => p.name.toLowerCase() === name.toLowerCase(),
    );
    if (byName) {
      if (byName.connectionId && byName.connectionId !== connection.id) {
        const stillLive = [...this.room.getConnections()].some(
          (c) => c.id === byName.connectionId,
        );
        if (stillLive) {
          throw new Error(`"${name}" is already online`);
        }
      }
      byName.connectionId = connection.id;
      this.send(connection, { type: 'joined', playerId: byName.id });
      this.broadcastState();
      return;
    }

    if (this.state.players.length >= MAX_PLAYERS) {
      throw new Error('Sandbox is full (50 players). Try again later.');
    }

    const player: Player = {
      id: cryptoRandomId(),
      name,
      balances: randomBalances(),
      positions: {},
      connectionId: connection.id,
    };
    this.state.players.push(player);
    this.state.completedChallenges[player.id] = [];
    this.recordHolding(player, 'Starting balance');
    this.state.activity.unshift(
      makeActivity(`${name} joined the pool party`, player.id, {
        actor: name,
        detail: { kind: 'join' },
      }),
    );
    this.trimActivity();
    this.send(connection, { type: 'joined', playerId: player.id });
    this.broadcastState();
  }

  private handleSwap(
    connection: Party.Connection,
    msg: Extract<ClientMessage, { type: 'swap' }>,
  ) {
    const player = this.requirePlayer(connection);
    if (msg.amountIn <= 0) throw new Error('Amount must be positive');
    const pool = this.state.pools[msg.poolId];
    if (!pool) throw new Error('Unknown pool');
    if (player.balances[msg.tokenIn] < msg.amountIn) {
      throw new Error('Insufficient balance');
    }

    const result = applySwapToPool(pool, msg.tokenIn, msg.amountIn);
    if (!result) throw new Error('Swap failed');
    if (
      msg.minAmountOut != null &&
      result.amountOut < msg.minAmountOut - 1e-9
    ) {
      throw new Error(
        `Price moved: would receive ${round(result.amountOut)} ${result.tokenOut}, below your minimum of ${round(msg.minAmountOut)}. Re-quote or raise slippage.`,
      );
    }

    const reserves = getReservesForSwap(pool, msg.tokenIn)!;
    const spot = spotPrice(reserves.reserveIn, reserves.reserveOut);
    const exec = executionPrice(msg.amountIn, result.amountOut);
    const impact = priceImpact(spot, exec);

    player.balances[msg.tokenIn] -= msg.amountIn;
    player.balances[result.tokenOut] += result.amountOut;
    this.state.pools[msg.poolId] = result.pool;
    this.recordHolding(
      player,
      `Swapped ${round(msg.amountIn)} ${msg.tokenIn} → ${round(result.amountOut)} ${result.tokenOut}`,
    );

    const label = POOL_DEFS[msg.poolId].label;
    this.state.activity.unshift(
      makeActivity(
        `${player.name} swapped ${round(msg.amountIn)} ${msg.tokenIn} for ${round(result.amountOut)} ${result.tokenOut} on ${label}, ${(impact * 100).toFixed(1)}% impact`,
        player.id,
        {
          actor: player.name,
          detail: {
            kind: 'swap',
            poolId: msg.poolId,
            tokenIn: msg.tokenIn,
            amountIn: msg.amountIn,
            tokenOut: result.tokenOut,
            amountOut: result.amountOut,
            fee: result.feePaid,
            impact,
            priceBefore: spotPrice(pool.reserveA, pool.reserveB),
            priceAfter: spotPrice(result.pool.reserveA, result.pool.reserveB),
          },
        },
      ),
    );
    this.trimActivity();
    this.refreshChallenges(player.id);
    this.broadcastState();
  }

  private handleAddLiquidity(
    connection: Party.Connection,
    msg: Extract<ClientMessage, { type: 'addLiquidity' }>,
  ) {
    const player = this.requirePlayer(connection);
    const pool = this.state.pools[msg.poolId];
    if (!pool) throw new Error('Unknown pool');
    const quote = quoteAddLiquidity(pool, msg.amountA, msg.amountB);
    if (quote.lpMinted <= 0) throw new Error('Invalid deposit');
    if (player.balances[pool.tokenA] < quote.amountA) {
      throw new Error(`Insufficient ${pool.tokenA}`);
    }
    if (player.balances[pool.tokenB] < quote.amountB) {
      throw new Error(`Insufficient ${pool.tokenB}`);
    }

    player.balances[pool.tokenA] -= quote.amountA;
    player.balances[pool.tokenB] -= quote.amountB;

    const prev = player.positions[msg.poolId];
    const nextLp = (prev?.lpTokens ?? 0) + quote.lpMinted;
    player.positions[msg.poolId] = {
      poolId: msg.poolId,
      lpTokens: nextLp,
      entryReserveA: prev?.entryReserveA ?? (pool.reserveA || quote.amountA),
      entryReserveB: prev?.entryReserveB ?? (pool.reserveB || quote.amountB),
      entryLpSupply: prev?.entryLpSupply ?? (pool.totalLp || quote.lpMinted),
      depositedA: (prev?.depositedA ?? 0) + quote.amountA,
      depositedB: (prev?.depositedB ?? 0) + quote.amountB,
    };

    this.state.pools[msg.poolId] = {
      ...pool,
      reserveA: pool.reserveA + quote.amountA,
      reserveB: pool.reserveB + quote.amountB,
      totalLp: pool.totalLp + quote.lpMinted,
    };
    this.recordHolding(player, `Added liquidity to ${POOL_DEFS[msg.poolId].label}`);

    this.state.activity.unshift(
      makeActivity(
        `${player.name} added ${round(quote.amountA)} ${pool.tokenA} + ${round(quote.amountB)} ${pool.tokenB} to ${POOL_DEFS[msg.poolId].label}`,
        player.id,
        {
          actor: player.name,
          detail: {
            kind: 'addLiquidity',
            poolId: msg.poolId,
            amountA: quote.amountA,
            amountB: quote.amountB,
            lp: quote.lpMinted,
            shareAfter: nextLp / (pool.totalLp + quote.lpMinted),
          },
        },
      ),
    );
    this.trimActivity();
    this.refreshChallenges(player.id);
    this.broadcastState();
  }

  private handleRemoveLiquidity(
    connection: Party.Connection,
    msg: Extract<ClientMessage, { type: 'removeLiquidity' }>,
  ) {
    const player = this.requirePlayer(connection);
    const pool = this.state.pools[msg.poolId];
    const pos = player.positions[msg.poolId];
    if (!pool || !pos) throw new Error('No position');
    if (msg.lpTokens <= 0 || msg.lpTokens > pos.lpTokens) {
      throw new Error('Invalid LP amount');
    }
    if (!canRemoveLiquidity(pool, msg.lpTokens)) {
      throw new Error('Cannot drain pool below minimum liquidity');
    }
    const quote = quoteRemoveLiquidity(pool, msg.lpTokens);
    if (quote.lpBurned <= 0) throw new Error('Remove failed');

    player.balances[pool.tokenA] += quote.amountA;
    player.balances[pool.tokenB] += quote.amountB;
    const remainingLp = pos.lpTokens - quote.lpBurned;
    if (remainingLp <= 1e-9) {
      delete player.positions[msg.poolId];
    } else {
      const ratio = remainingLp / pos.lpTokens;
      player.positions[msg.poolId] = {
        ...pos,
        lpTokens: remainingLp,
        depositedA: pos.depositedA * ratio,
        depositedB: pos.depositedB * ratio,
      };
    }

    this.state.pools[msg.poolId] = {
      ...pool,
      reserveA: pool.reserveA - quote.amountA,
      reserveB: pool.reserveB - quote.amountB,
      totalLp: pool.totalLp - quote.lpBurned,
    };
    this.recordHolding(
      player,
      `Removed liquidity from ${POOL_DEFS[msg.poolId].label}`,
    );

    this.state.activity.unshift(
      makeActivity(
        `${player.name} removed liquidity from ${POOL_DEFS[msg.poolId].label} (−${round(quote.lpBurned)} LP)`,
        player.id,
        {
          actor: player.name,
          detail: {
            kind: 'removeLiquidity',
            poolId: msg.poolId,
            amountA: quote.amountA,
            amountB: quote.amountB,
            lp: quote.lpBurned,
            shareAfter:
              pool.totalLp - quote.lpBurned > 0
                ? Math.max(0, remainingLp) / (pool.totalLp - quote.lpBurned)
                : 0,
          },
        },
      ),
    );
    this.trimActivity();
    this.refreshChallenges(player.id);
    this.broadcastState();
  }

  private handleSetOracle(
    connection: Party.Connection,
    token: TokenId,
    usd: number,
  ) {
    const player = this.requirePlayer(connection);
    if (!(usd > 0) || usd > 1_000_000) throw new Error('Invalid oracle price');
    const from = this.state.oracle[token];
    this.state.oracle[token] = usd;

    // Slider drags send many ticks; fold them into the latest matching event.
    const last = this.state.activity[0];
    const message = `Oracle: ${token} set to $${usd}`;
    if (
      last?.detail?.kind === 'oracle' &&
      last.detail.token === token &&
      last.actor === player.name &&
      Date.now() - last.ts < ORACLE_MERGE_MS
    ) {
      last.detail.to = usd;
      last.message = message;
      last.ts = Date.now();
    } else {
      this.state.activity.unshift(
        makeActivity(message, null, {
          actor: player.name,
          detail: { kind: 'oracle', token, from, to: usd },
        }),
      );
      this.trimActivity();
    }
    this.broadcastState();
  }

  private handleWhale(
    connection: Party.Connection,
    msg: Extract<ClientMessage, { type: 'injectWhale' }>,
  ) {
    const player = this.requirePlayer(connection);
    const pool = this.state.pools[msg.poolId];
    if (!pool) throw new Error('Unknown pool');
    if (msg.amountIn <= 0) throw new Error('Amount must be positive');
    const result = applySwapToPool(pool, msg.tokenIn, msg.amountIn);
    if (!result) throw new Error('Whale trade failed');
    const reserves = getReservesForSwap(pool, msg.tokenIn)!;
    const impact = priceImpact(
      spotPrice(reserves.reserveIn, reserves.reserveOut),
      executionPrice(msg.amountIn, result.amountOut),
    );
    this.state.pools[msg.poolId] = result.pool;
    this.state.activity.unshift(
      makeActivity(
        `Whale swapped ${round(msg.amountIn)} ${msg.tokenIn} on ${POOL_DEFS[msg.poolId].label}`,
        null,
        {
          actor: player.name,
          detail: {
            kind: 'swap',
            whale: true,
            poolId: msg.poolId,
            tokenIn: msg.tokenIn,
            amountIn: msg.amountIn,
            tokenOut: result.tokenOut,
            amountOut: result.amountOut,
            fee: result.feePaid,
            impact,
            priceBefore: spotPrice(pool.reserveA, pool.reserveB),
            priceAfter: spotPrice(result.pool.reserveA, result.pool.reserveB),
          },
        },
      ),
    );
    this.trimActivity();
    this.broadcastState();
  }

  private handleGiveTokens(connection: Party.Connection, amount: number) {
    const player = this.requirePlayer(connection);
    if (!(amount > 0) || amount > 100_000) throw new Error('Invalid amount');
    for (const p of this.state.players) {
      p.balances.WOOD += amount;
      p.balances.STONE += amount;
      p.balances.GOLD += amount;
      this.recordHolding(p, `Airdrop +${amount} of each token`);
    }
    this.state.activity.unshift(
      makeActivity(`Airdrop: +${amount} of each token to everyone`, null, {
        actor: player.name,
        detail: {
          kind: 'airdrop',
          amount,
          recipients: this.state.players.length,
        },
      }),
    );
    this.trimActivity();
    this.broadcastState();
  }

  private handleResetSandbox(connection: Party.Connection) {
    const player = this.requirePlayer(connection);
    const kept = this.state.players.map((p) => ({
      ...p,
      balances: randomBalances(),
      positions: {},
    }));
    this.state.pools = createInitialPools();
    this.state.oracle = defaultOracle();
    this.state.completedChallenges = Object.fromEntries(
      kept.map((p) => [p.id, [] as string[]]),
    );
    this.state.players = kept;
    this.state.activity = [
      makeActivity(`Sandbox reset by ${player.name}`, null, {
        actor: player.name,
        detail: { kind: 'system' },
      }),
    ];
    this.broadcastState();
  }

  private handleMarkChallenge(
    connection: Party.Connection,
    challengeId: string,
  ) {
    const player = this.requirePlayer(connection);
    const list = new Set(this.state.completedChallenges[player.id] ?? []);
    list.add(challengeId);
    this.state.completedChallenges[player.id] = [...list];
    this.broadcastState();
  }

  private refreshChallenges(playerId: string) {
    const completed = evaluateChallenges(
      this.state,
      playerId,
      this.state.activity,
    );
    this.state.completedChallenges[playerId] = completed;
  }

  private trimActivity() {
    if (this.state.activity.length > 100) {
      this.state.activity = this.state.activity.slice(0, 100);
    }
  }

  private send(connection: Party.Connection, msg: ServerMessage) {
    connection.send(JSON.stringify(msg));
  }

  private sendState(conn: Party.Connection) {
    const playerId = this.playerIdForConnection(conn.id);
    this.send(conn, {
      type: 'state',
      state: this.state,
      yourPlayerId: playerId,
      yourHistory: playerId ? (this.histories.get(playerId) ?? []) : undefined,
    });
  }

  private broadcastState() {
    for (const conn of this.room.getConnections()) {
      this.sendState(conn);
    }
  }

  private recordHolding(player: Player, label: string) {
    const list = this.histories.get(player.id) ?? [];
    list.push(snapshotHoldings(player, this.state.pools, label));
    if (list.length > MAX_HISTORY) list.splice(0, list.length - MAX_HISTORY);
    this.histories.set(player.id, list);
  }
}

function round(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
