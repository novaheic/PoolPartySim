import { useEffect, useRef, useState } from 'react';
import { randomGhostName } from '../lib/ghostName';
import { readLastCrash, useStore } from '../store';
import { Button } from './ui';

export function JoinLobby() {
  const connStatus = useStore((s) => s.connStatus);
  const connected = useStore((s) => s.connected);
  const joining = useStore((s) => s.joining);
  const joinAs = useStore((s) => s.joinAs);
  const clearSession = useStore((s) => s.clearSession);
  const lastError = useStore((s) => s.lastError);
  const clearError = useStore((s) => s.clearError);
  const [crash] = useState(() => readLastCrash());

  const [ghost] = useState(() => {
    const saved = sessionStorage.getItem('pool-party-player-name');
    return saved?.trim() || randomGhostName();
  });
  const [name, setName] = useState(ghost);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const displayName = name.trim() || ghost;

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-teal-300/80">
          DeFi workshop
        </p>
        <h1 className="mt-2 text-5xl font-bold tracking-tight text-white">
          Pool Party
        </h1>
        <p className="mt-3 text-lg text-slate-300">
          Join the global pool as this ghost — or tap the name to change it.
        </p>
      </div>

      <div className="card space-y-5 p-5">
        <div>
          <p className="mb-2 text-sm text-slate-400">Playing as</p>
          {editing ? (
            <input
              ref={inputRef}
              value={name}
              maxLength={24}
              onChange={(e) => {
                clearError();
                setName(e.target.value);
              }}
              onBlur={() => {
                if (!name.trim()) setName(ghost);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                  joinAs(displayName);
                }
                if (e.key === 'Escape') {
                  setName(ghost);
                  setEditing(false);
                }
              }}
              className="num w-full rounded-xl border border-teal-400/40 bg-slate-950/60 px-4 py-3 text-center text-3xl font-bold tracking-tight text-teal-100 outline-none"
              placeholder={ghost}
              aria-label="Your name"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                clearError();
                setEditing(true);
              }}
              className="group w-full rounded-xl border border-dashed border-white/20 bg-slate-950/40 px-4 py-3 text-center transition hover:border-teal-400/50 hover:bg-teal-400/5"
            >
              <span className="block text-3xl font-bold tracking-tight text-teal-100">
                {displayName}
              </span>
              <span className="mt-1 block text-xs text-slate-500 group-hover:text-teal-300/80">
                Click to type a name
              </span>
            </button>
          )}
        </div>

        <p className="text-center text-xs text-slate-500">
          Sandbox: ws://
          {typeof window !== 'undefined' ? window.location.hostname : 'localhost'}
          :1999/parties/main/global ·{' '}
          {connStatus === 'connected'
            ? 'Connected'
            : connStatus === 'connecting' || connStatus === 'reconnecting'
              ? 'Connecting…'
              : 'Not connected'}
        </p>
        <Button
          className="w-full text-lg"
          type="button"
          disabled={!displayName.trim() || joining}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void joinAs(displayName);
          }}
        >
          {joining ? 'Joining…' : `Join as ${displayName}`}
        </Button>
        {lastError && <p className="text-sm text-rose-300">{lastError}</p>}
        {crash && (
          <p className="rounded-lg bg-rose-500/10 p-2 text-xs text-rose-200">
            Previous crash (survived reload): {crash}
          </p>
        )}
        <button
          type="button"
          className="w-full text-center text-xs text-slate-500 underline hover:text-teal-300"
          onClick={() => {
            clearSession();
            clearError();
          }}
        >
          Use a new identity (clears saved name)
        </button>
        {!connected && connStatus !== 'connecting' && (
          <p className="text-sm text-amber-200/90">
            Run <code className="rounded bg-black/40 px-1">npm run dev:party</code>{' '}
            and confirm the log shows port <strong>1999</strong>.
          </p>
        )}
      </div>
    </div>
  );
}
