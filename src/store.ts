import PartySocket from 'partysocket';
import { create } from 'zustand';
import {
  GLOBAL_ROOM_ID,
  type ClientMessage,
  type HoldingSnapshot,
  type PoolId,
  type RoomState,
  type TokenId,
} from './types';

const PLAYER_KEY = 'pool-party-player-id';
const NAME_KEY = 'pool-party-player-name';
const JOINED_FLAG = 'pool-party-has-joined';
const CRASH_KEY = 'pool-party-crash';

function partyHost(): string {
  const env = import.meta.env.VITE_PARTYKIT_HOST as string | undefined;
  if (env) return env;
  if (typeof window !== 'undefined') {
    if (import.meta.env.DEV) {
      return `${window.location.hostname}:1999`;
    }
    return window.location.host;
  }
  return '127.0.0.1:1999';
}

let socket: PartySocket | null = null;
let openWaiters: Array<{ resolve: () => void; reject: (e: Error) => void }> =
  [];

type ConnStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting';

interface ClientState {
  connected: boolean;
  connStatus: ConnStatus;
  joining: boolean;
  myPlayerId: string | null;
  room: RoomState | null;
  myHistory: HoldingSnapshot[];
  selectedPoolId: PoolId;
  slippageBps: number;
  instructorOpen: boolean;
  challengesOpen: boolean;
  lastError: string | null;
  host: string;

  connect: () => void;
  disconnect: () => void;
  joinAs: (name: string) => Promise<void>;
  clearSession: () => void;
  selectPool: (id: PoolId) => void;
  setSlippage: (bps: number) => void;
  setInstructorOpen: (open: boolean) => void;
  setChallengesOpen: (open: boolean) => void;
  clearError: () => void;
  requestSwap: (
    poolId: PoolId,
    tokenIn: TokenId,
    amountIn: number,
    minAmountOut?: number,
  ) => void;
  requestAddLiquidity: (poolId: PoolId, amountA: number, amountB: number) => void;
  requestRemoveLiquidity: (poolId: PoolId, lpTokens: number) => void;
  requestSetOracle: (token: TokenId, usd: number) => void;
  requestWhale: (poolId: PoolId, tokenIn: TokenId, amountIn: number) => void;
  requestGiveTokens: (amountPerToken: number) => void;
  requestResetSandbox: () => void;
  requestMarkChallenge: (challengeId: string) => void;
}

function flushOpenWaiters(ok: boolean) {
  const waiters = openWaiters;
  openWaiters = [];
  for (const w of waiters) {
    if (ok) w.resolve();
    else w.reject(new Error('Connection closed'));
  }
}

async function parseSocketData(data: unknown): Promise<unknown> {
  if (typeof data === 'string') return JSON.parse(data);
  if (data instanceof ArrayBuffer) {
    return JSON.parse(new TextDecoder().decode(data));
  }
  if (ArrayBuffer.isView(data)) {
    return JSON.parse(
      new TextDecoder().decode(
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      ),
    );
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return JSON.parse(await data.text());
  }
  return data;
}

function attachSocketHandlers(s: PartySocket) {
  s.addEventListener('open', () => {
    useStore.setState({
      connected: true,
      connStatus: 'connected',
      lastError: null,
    });
    flushOpenWaiters(true);

    // Reclaim seat after refresh / reconnect
    const savedId = sessionStorage.getItem(PLAYER_KEY);
    const savedName = sessionStorage.getItem(NAME_KEY);
    const hadJoined = sessionStorage.getItem(JOINED_FLAG) === '1';
    if (hadJoined && savedId && savedName) {
      send({ type: 'join', name: savedName, playerId: savedId });
    }
  });

  s.addEventListener('message', (event) => {
    void (async () => {
      try {
        const data = (await parseSocketData(event.data)) as {
          type: string;
          state?: RoomState;
          yourPlayerId?: string | null;
          yourHistory?: HoldingSnapshot[];
          playerId?: string;
          message?: string;
        };
        if (import.meta.env.DEV) {
          console.info('[Pool Party]', data.type, data);
        }
        if (data.type === 'state') {
          let nextId = useStore.getState().myPlayerId;
          if (data.yourPlayerId) {
            nextId = data.yourPlayerId;
            sessionStorage.setItem(PLAYER_KEY, data.yourPlayerId);
            sessionStorage.setItem(JOINED_FLAG, '1');
          }
          useStore.setState({
            room: data.state ?? null,
            ...(data.yourHistory ? { myHistory: data.yourHistory } : {}),
            myPlayerId: nextId,
            joining: data.yourPlayerId ? false : useStore.getState().joining,
          });
        } else if (data.type === 'joined' && data.playerId) {
          sessionStorage.setItem(PLAYER_KEY, data.playerId);
          sessionStorage.setItem(JOINED_FLAG, '1');
          useStore.setState({
            myPlayerId: data.playerId,
            joining: false,
            lastError: null,
          });
        } else if (data.type === 'error') {
          useStore.setState({
            lastError: data.message ?? 'Server error',
            joining: false,
          });
        }
      } catch (err) {
        console.error('[Pool Party] bad message', err, event.data);
        useStore.setState({
          lastError: 'Bad server message',
          joining: false,
        });
      }
    })();
  });

  s.addEventListener('close', () => {
    useStore.setState({
      connected: false,
      connStatus: 'reconnecting',
    });
    flushOpenWaiters(false);
  });
}

function ensureSocket(): PartySocket {
  const host = partyHost();
  if (socket && socket.host !== host) {
    socket.close();
    socket = null;
  }
  if (!socket) {
    socket = new PartySocket({
      host,
      room: GLOBAL_ROOM_ID,
      party: 'main',
      maxReconnectionDelay: 8000,
      minReconnectionDelay: 1000,
      reconnectionDelayGrowFactor: 1.4,
      connectionTimeout: 8000,
    });
    attachSocketHandlers(socket);
  }
  return socket;
}

function waitForOpen(ms = 8000): Promise<void> {
  const s = ensureSocket();
  if (s.readyState === WebSocket.OPEN) return Promise.resolve();
  if (s.readyState === WebSocket.CLOSED) {
    s.reconnect();
  }
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      openWaiters = openWaiters.filter((w) => w.resolve !== resolve);
      reject(new Error('Connection timeout'));
    }, ms);
    openWaiters.push({
      resolve: () => {
        clearTimeout(t);
        resolve();
      },
      reject: (e) => {
        clearTimeout(t);
        reject(e);
      },
    });
  });
}

function send(msg: ClientMessage) {
  const s = ensureSocket();
  if (s.readyState !== WebSocket.OPEN) {
    useStore.setState({
      lastError: 'Not connected to sandbox yet — wait a moment.',
    });
    return;
  }
  const payload = JSON.stringify(msg);
  s.send(payload);
  if (import.meta.env.DEV) {
    console.info('[Pool Party] sent', msg.type, msg);
  }
}

function waitForJoinAck(ms = 12_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (ok: boolean, err?: string) => {
      clearTimeout(t);
      unsub();
      if (ok) resolve();
      else reject(new Error(err ?? 'Join failed'));
    };
    const t = setTimeout(() => done(false, 'Server did not confirm join'), ms);
    const check = () => {
      const state = useStore.getState();
      if (state.myPlayerId && !state.joining) done(true);
      else if (!state.joining && state.lastError) done(false, state.lastError);
    };
    const unsub = useStore.subscribe(check);
    check();
  });
}

export const useStore = create<ClientState>((set) => ({
  connected: false,
  connStatus: 'idle',
  joining: false,
  myPlayerId: null,
  room: null,
  myHistory: [],
  selectedPoolId: 'WOOD_STONE',
  slippageBps: 50,
  instructorOpen: false,
  challengesOpen: true,
  lastError: null,
  host: partyHost(),

  connect: () => {
    const host = partyHost();
    set({ connStatus: 'connecting', lastError: null, host });
    ensureSocket();
    waitForOpen().catch(() => {
      set({
        connStatus: 'idle',
        connected: false,
        lastError: `Could not reach the sandbox at ${host}. Run npm run dev:party and confirm :1999 in the log.`,
      });
    });
  },

  disconnect: () => {
    socket?.close();
    socket = null;
    openWaiters = [];
    set({
      connected: false,
      connStatus: 'idle',
      myPlayerId: null,
      joining: false,
      room: null,
      myHistory: [],
    });
  },

  clearSession: () => {
    sessionStorage.removeItem(PLAYER_KEY);
    sessionStorage.removeItem(NAME_KEY);
    sessionStorage.removeItem(JOINED_FLAG);
    sessionStorage.removeItem(CRASH_KEY);
    set({ myPlayerId: null, lastError: null, joining: false });
  },

  joinAs: async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      set({ lastError: 'Enter a name' });
      return;
    }
    set({ joining: true, lastError: null });
    try {
      await waitForOpen();
    } catch {
      set({
        joining: false,
        lastError: `Could not reach the sandbox at ${partyHost()}. Is npm run dev:party running?`,
      });
      return;
    }

    sessionStorage.setItem(NAME_KEY, trimmed);
    const hadJoined = sessionStorage.getItem(JOINED_FLAG) === '1';
    const preferred = hadJoined
      ? (sessionStorage.getItem(PLAYER_KEY) ?? undefined)
      : undefined;

    send({ type: 'join', name: trimmed, playerId: preferred });

    try {
      await waitForJoinAck();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Join failed — try another name';
      set({
        joining: false,
        lastError:
          msg === 'Server did not confirm join'
            ? `${msg}. Restart npm run dev:party, then click “Use a new identity”.`
            : msg,
      });
    }
  },

  selectPool: (id) => set({ selectedPoolId: id }),
  setSlippage: (bps) => set({ slippageBps: bps }),
  setInstructorOpen: (open) => set({ instructorOpen: open }),
  setChallengesOpen: (open) => set({ challengesOpen: open }),
  clearError: () => set({ lastError: null }),

  requestSwap: (poolId, tokenIn, amountIn, minAmountOut) =>
    send({ type: 'swap', poolId, tokenIn, amountIn, minAmountOut }),
  requestAddLiquidity: (poolId, amountA, amountB) =>
    send({ type: 'addLiquidity', poolId, amountA, amountB }),
  requestRemoveLiquidity: (poolId, lpTokens) =>
    send({ type: 'removeLiquidity', poolId, lpTokens }),
  requestSetOracle: (token, usd) => send({ type: 'setOracle', token, usd }),
  requestWhale: (poolId, tokenIn, amountIn) =>
    send({ type: 'injectWhale', poolId, tokenIn, amountIn }),
  requestGiveTokens: (amountPerToken) =>
    send({ type: 'giveTokens', amountPerToken }),
  requestResetSandbox: () => send({ type: 'resetSandbox' }),
  requestMarkChallenge: (challengeId) =>
    send({ type: 'markChallenge', challengeId }),
}));

if (import.meta.hot) {
  // Keep the module hot without a full document reload (which looked like a
  // "refresh" right after Join while we were editing this file).
  import.meta.hot.accept();
}

export function useMe() {
  return useStore((s) => {
    if (!s.room || !s.myPlayerId) return null;
    return s.room.players.find((p) => p.id === s.myPlayerId) ?? null;
  });
}

export function useHasJoined() {
  return useStore((s) => Boolean(s.myPlayerId));
}

/** Call once from main.tsx so crashes survive a full page reload. */
export function installCrashGuards() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => {
    sessionStorage.setItem(
      CRASH_KEY,
      `${e.message} @ ${e.filename}:${e.lineno}`,
    );
  });
  window.addEventListener('unhandledrejection', (e) => {
    sessionStorage.setItem(CRASH_KEY, String(e.reason));
  });
}

export function readLastCrash(): string | null {
  try {
    return sessionStorage.getItem(CRASH_KEY);
  } catch {
    return null;
  }
}
