import { useMe, useStore } from '../store';
import { fmt } from '../lib/format';
import { TOKENS, type Player } from '../types';
import { Button } from './ui';

export function TopBar() {
  const me = useMe();
  const room = useStore((s) => s.room);
  const connected = useStore((s) => s.connected);
  const setInstructorOpen = useStore((s) => s.setInstructorOpen);
  const instructorOpen = useStore((s) => s.instructorOpen);
  const online = room?.players.filter((p) => p.connectionId).length ?? 0;

  return (
    <header className="card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
          Pool Party
        </h1>
        <p className="text-sm text-slate-400">
          {connected ? 'Live' : 'Reconnecting…'} · {online} online · period{' '}
          <span className="text-slate-300">{room?.periodId ?? '—'}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="rounded-xl border border-teal-400/30 bg-teal-400/10 px-4 py-2">
          <p className="text-xs uppercase tracking-wider text-teal-200/80">You</p>
          <p className="text-xl font-semibold text-teal-100">{me?.name ?? '—'}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {TOKENS.map((t) => (
            <div key={t} className="min-w-[5.5rem]">
              <p className="text-xs text-slate-400">{t}</p>
              <p className="num text-xl font-semibold text-white">
                {fmt(me?.balances[t] ?? 0)}
              </p>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          onClick={() => setInstructorOpen(!instructorOpen)}
        >
          Instructor
        </Button>
      </div>
    </header>
  );
}

const NO_PLAYERS: Player[] = [];

export function Presence() {
  const players = useStore((s) => s.room?.players ?? NO_PLAYERS);
  const myId = useStore((s) => s.myPlayerId);
  if (players.length === 0) return null;
  return (
    <div className="card flex max-h-28 flex-wrap gap-2 overflow-auto p-3">
      {players.map((p) => (
        <span
          key={p.id}
          className={`rounded-full px-3 py-1 text-sm ${
            p.id === myId
              ? 'bg-teal-400/20 text-teal-100'
              : p.connectionId
                ? 'bg-sky-400/15 text-sky-100'
                : 'bg-white/5 text-slate-500'
          }`}
        >
          {p.name}
          {p.connectionId ? '' : ' (away)'}
        </span>
      ))}
    </div>
  );
}
