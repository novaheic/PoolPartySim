import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { fmt, fmtAgo, fmtPct, fmtSignedPct, fmtUsd } from '../lib/format';
import { TOKEN_TEXT } from '../lib/tokens';
import { HoldingsHistory } from './HoldingsHistory';
import { useStore } from '../store';
import {
  POOL_DEFS,
  type ActivityEvent,
  type OraclePrices,
  type PoolId,
  type TokenId,
} from '../types';

const NO_ACTIVITY: ActivityEvent[] = [];

type Filter = 'all' | 'swaps' | 'liquidity' | 'mine' | 'events';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'swaps', label: 'Swaps' },
  { id: 'liquidity', label: 'Liquidity' },
  { id: 'mine', label: 'Mine' },
  { id: 'events', label: 'Events' },
];

function matches(a: ActivityEvent, filter: Filter, myId: string | null) {
  const kind = a.detail?.kind;
  switch (filter) {
    case 'all':
      return true;
    case 'swaps':
      return kind === 'swap';
    case 'liquidity':
      return kind === 'addLiquidity' || kind === 'removeLiquidity';
    case 'mine':
      return myId != null && a.playerId === myId;
    case 'events':
      return kind == null || !['swap', 'addLiquidity', 'removeLiquidity'].includes(kind);
  }
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function ActivityFeed() {
  const activity = useStore((s) => s.room?.activity ?? NO_ACTIVITY);
  const oracle = useStore((s) => s.room?.oracle);
  const myId = useStore((s) => s.myPlayerId);
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<'feed' | 'holdings'>('feed');
  const now = useNow(10_000);

  const stats = useMemo(() => {
    let swaps = 0;
    let volume = 0;
    let fees = 0;
    for (const a of activity) {
      if (a.detail?.kind !== 'swap') continue;
      swaps++;
      const usd = oracle?.[a.detail.tokenIn] ?? 0;
      volume += a.detail.amountIn * usd;
      fees += a.detail.fee * usd;
    }
    return { swaps, volume, fees };
  }, [activity, oracle]);

  const visible = activity.filter((a) => matches(a, filter, myId));

  return (
    <section className="card flex min-h-0 flex-col p-5 lg:min-h-[30rem]">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Activity</h2>
          <div className="flex gap-1 rounded-xl bg-slate-950/50 p-1">
            {(
              [
                ['feed', 'Feed'],
                ['holdings', 'My holdings'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`rounded-lg px-3 py-1 text-sm font-semibold transition ${
                  view === id
                    ? 'bg-teal-400/20 text-teal-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {view === 'feed' && (
          <p className="num text-sm text-slate-400">
            {stats.swaps} swaps · {fmtUsd(stats.volume)} volume ·{' '}
            {fmtUsd(stats.fees)} fees to LPs
          </p>
        )}
      </div>

      {view === 'holdings' ? (
        <HoldingsHistory />
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                  filter === f.id
                    ? 'bg-teal-400/20 text-teal-200'
                    : 'bg-white/5 text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* On desktop the list is taken out of flow so the card fills its grid
              row instead of the row growing to fit 100 entries. */}
          <div className="relative mt-3 min-h-40 flex-1">
            <ul className="max-h-[32rem] space-y-2 overflow-y-auto pr-1 text-sm lg:absolute lg:inset-0 lg:max-h-none">
              {visible.length === 0 && (
                <li className="py-6 text-center text-slate-500">
                  Nothing here yet.
                </li>
              )}
              <AnimatePresence initial={false}>
                {visible.map((a) => (
                  <motion.li
                    key={a.id}
                    layout="position"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ActivityRow
                      event={a}
                      isMine={myId != null && a.playerId === myId}
                      oracle={oracle}
                      now={now}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        </>
      )}
    </section>
  );
}

function ActivityRow({
  event,
  isMine,
  oracle,
  now,
}: {
  event: ActivityEvent;
  isMine: boolean;
  oracle?: OraclePrices;
  now: number;
}) {
  const d = event.detail;
  const actor = event.actor ? (
    <span className={`font-semibold ${isMine ? 'text-teal-200' : 'text-white'}`}>
      {event.actor}
      {isMine && <span className="ml-1 text-xs font-normal text-teal-300/70">(you)</span>}
    </span>
  ) : null;

  let icon: ReactNode = '•';
  let tone = 'bg-slate-500/15 text-slate-300';
  let headline: ReactNode = event.message;
  let meta: ReactNode = null;
  let poolId: PoolId | null = null;

  if (d?.kind === 'swap') {
    poolId = d.poolId;
    const def = POOL_DEFS[d.poolId];
    const move = d.priceBefore > 0 ? d.priceAfter / d.priceBefore - 1 : 0;
    icon = '⇄';
    tone = d.whale ? 'bg-indigo-400/15 text-indigo-200' : 'bg-sky-400/15 text-sky-200';
    headline = (
      <>
        {d.whale ? (
          <span className="font-semibold text-indigo-200">Whale</span>
        ) : (
          actor
        )}{' '}
        <span className="text-slate-400">swapped</span>{' '}
        <Amount n={d.amountIn} token={d.tokenIn} />{' '}
        <span className="text-slate-500">→</span>{' '}
        <Amount n={d.amountOut} token={d.tokenOut} />
      </>
    );
    meta = (
      <>
        <ImpactBadge impact={d.impact} />
        <Meta label="Price">
          {fmt(d.priceBefore, 4)} → {fmt(d.priceAfter, 4)}{' '}
          <span className={move >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
            ({fmtSignedPct(move)})
          </span>{' '}
          <span className="text-slate-500">
            {def.tokenB}/{def.tokenA}
          </span>
        </Meta>
        <Meta label="Fee">
          {fmt(d.fee, 4)} {d.tokenIn}
        </Meta>
        {oracle && (
          <Meta label="Value">{fmtUsd(d.amountIn * oracle[d.tokenIn])}</Meta>
        )}
        {d.whale && actor && <Meta label="Triggered by">{actor}</Meta>}
      </>
    );
  } else if (d?.kind === 'addLiquidity' || d?.kind === 'removeLiquidity') {
    poolId = d.poolId;
    const def = POOL_DEFS[d.poolId];
    const adding = d.kind === 'addLiquidity';
    icon = adding ? '+' : '−';
    tone = adding ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200';
    headline = (
      <>
        {actor} <span className="text-slate-400">{adding ? 'added' : 'withdrew'}</span>{' '}
        <Amount n={d.amountA} token={def.tokenA} />{' '}
        <span className="text-slate-500">+</span>{' '}
        <Amount n={d.amountB} token={def.tokenB} />
      </>
    );
    meta = (
      <>
        <Meta label={adding ? 'Minted' : 'Burned'}>{fmt(d.lp, 4)} LP</Meta>
        <Meta label="Pool share now">{fmtPct(d.shareAfter)}</Meta>
        {oracle && (
          <Meta label="Value">
            {fmtUsd(d.amountA * oracle[def.tokenA] + d.amountB * oracle[def.tokenB])}
          </Meta>
        )}
      </>
    );
  } else if (d?.kind === 'oracle') {
    const change = d.from > 0 ? d.to / d.from - 1 : 0;
    icon = '$';
    tone = 'bg-yellow-400/15 text-yellow-200';
    headline = (
      <>
        <span className="text-slate-400">Oracle</span>{' '}
        <span className={`font-semibold ${TOKEN_TEXT[d.token]}`}>{d.token}</span>{' '}
        <span className="num">
          ${fmt(d.from, 2)} → ${fmt(d.to, 2)}
        </span>{' '}
        <span className={change >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
          ({fmtSignedPct(change, 1)})
        </span>
      </>
    );
    meta = actor && <Meta label="Set by">{actor}</Meta>;
  } else if (d?.kind === 'airdrop') {
    icon = '★';
    tone = 'bg-fuchsia-400/15 text-fuchsia-200';
    headline = (
      <>
        <span className="text-slate-400">Airdrop</span>{' '}
        <span className="num font-semibold text-white">+{fmt(d.amount)}</span>{' '}
        <span className="text-slate-400">of each token to</span>{' '}
        <span className="font-semibold text-white">{d.recipients} players</span>
      </>
    );
    meta = actor && <Meta label="By">{actor}</Meta>;
  } else if (d?.kind === 'join') {
    icon = '→';
    tone = 'bg-teal-400/15 text-teal-200';
    headline = (
      <>
        {actor} <span className="text-slate-400">joined the pool party</span>
      </>
    );
  }

  return (
    <div
      className={`flex gap-3 rounded-xl border px-3 py-2.5 ${
        isMine ? 'border-teal-400/25 bg-teal-400/[0.04]' : 'border-white/5 bg-slate-950/40'
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${tone}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="leading-snug text-slate-200">{headline}</p>
          <span
            className="shrink-0 whitespace-nowrap text-xs text-slate-500"
            title={new Date(event.ts).toLocaleString()}
          >
            {fmtAgo(event.ts, now)}
          </span>
        </div>
        {(meta || poolId) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            {poolId && <PoolChip poolId={poolId} />}
            {meta}
          </div>
        )}
      </div>
    </div>
  );
}

function Amount({ n, token }: { n: number; token: TokenId }) {
  return (
    <span className="num whitespace-nowrap font-semibold">
      <span className="text-white">{fmt(n)}</span>{' '}
      <span className={TOKEN_TEXT[token]}>{token}</span>
    </span>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="num">
      <span className="text-slate-500">{label}</span> {children}
    </span>
  );
}

function ImpactBadge({ impact }: { impact: number }) {
  const tone =
    impact >= 0.05
      ? 'bg-rose-400/15 text-rose-200'
      : impact >= 0.01
        ? 'bg-amber-400/15 text-amber-200'
        : 'bg-emerald-400/15 text-emerald-200';
  return (
    <span className={`num rounded-md px-1.5 py-0.5 font-semibold ${tone}`}>
      {fmtPct(impact, 2)} impact
    </span>
  );
}

function PoolChip({ poolId }: { poolId: PoolId }) {
  const selectPool = useStore((s) => s.selectPool);
  const selected = useStore((s) => s.selectedPoolId === poolId);
  return (
    <button
      type="button"
      onClick={() => selectPool(poolId)}
      title="Show this pool"
      className={`rounded-md border px-1.5 py-0.5 font-semibold transition ${
        selected
          ? 'border-teal-400/40 text-teal-200'
          : 'border-white/10 text-slate-300 hover:border-teal-400/40 hover:text-teal-200'
      }`}
    >
      {POOL_DEFS[poolId].label}
    </button>
  );
}
