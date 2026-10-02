import { CHALLENGES } from '../lib/challenges';
import { useStore } from '../store';
import { Button } from './ui';

const NONE: string[] = [];

export function Challenges() {
  const open = useStore((s) => s.challengesOpen);
  const setOpen = useStore((s) => s.setChallengesOpen);
  const myId = useStore((s) => s.myPlayerId);
  const completed = useStore((s) =>
    myId ? (s.room?.completedChallenges[myId] ?? NONE) : NONE,
  );
  const done = new Set(completed);
  const doneCount = CHALLENGES.filter((c) => done.has(c.id)).length;

  return (
    <aside className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          Challenges{' '}
          <span className="num text-sm font-normal text-slate-400">
            {doneCount}/{CHALLENGES.length}
          </span>
        </h2>
        <Button variant="ghost" className="!px-2 !py-1 text-sm" onClick={() => setOpen(!open)}>
          {open ? 'Hide' : 'Show'}
        </Button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-950/70">
        <div
          className="h-full bg-teal-400 transition-all"
          style={{ width: `${(doneCount / CHALLENGES.length) * 100}%` }}
        />
      </div>
      {open && (
        <ol className="mt-3 space-y-3">
          {CHALLENGES.map((c, i) => {
            const ok = done.has(c.id);
            return (
              <li
                key={c.id}
                className={`rounded-xl border px-3 py-2 ${
                  ok
                    ? 'border-teal-400/40 bg-teal-400/10'
                    : 'border-white/10 bg-slate-950/40'
                }`}
              >
                <p className="text-sm font-semibold text-white">
                  {ok ? '✓ ' : `${i + 1}. `}
                  {c.title}
                </p>
                <p className="text-xs text-slate-400">{c.description}</p>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
