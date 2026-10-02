import { useState } from 'react';
import { useStore } from '../store';
import { ALL_POOL_IDS, POOL_DEFS, TOKENS, type PoolId, type TokenId } from '../types';
import { Button, Input } from './ui';

export function InstructorMode() {
  const open = useStore((s) => s.instructorOpen);
  const setOpen = useStore((s) => s.setInstructorOpen);
  const oracle = useStore((s) => s.room?.oracle);
  const requestSetOracle = useStore((s) => s.requestSetOracle);
  const requestWhale = useStore((s) => s.requestWhale);
  const requestGiveTokens = useStore((s) => s.requestGiveTokens);
  const requestResetSandbox = useStore((s) => s.requestResetSandbox);

  const [whalePool, setWhalePool] = useState<PoolId>('WOOD_STONE');
  const [whaleToken, setWhaleToken] = useState<TokenId>('WOOD');
  const [whaleAmt, setWhaleAmt] = useState('500');
  const [airdrop, setAirdrop] = useState('100');

  if (!open) return null;

  return (
    <div className="card space-y-4 border-amber-400/30 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-amber-100">Instructor mode</h2>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
      <p className="text-sm text-slate-400">
        Change oracle prices to demo IL, inject a whale trade, top up balances,
        or reset the sandbox. Also auto-reseeds Saturday 00:00 Europe/Amsterdam.
      </p>

      <div className="grid gap-3 md:grid-cols-3">
        {TOKENS.map((t) => (
          <label key={t} className="text-sm text-slate-300">
            Oracle {t} (USD)
            <input
              type="range"
              min={0.1}
              max={t === 'GOLD' ? 50 : 10}
              step={0.1}
              value={oracle?.[t] ?? 1}
              onChange={(e) => requestSetOracle(t, Number(e.target.value))}
              className="mt-2 w-full"
            />
            <span className="num ml-2 text-white">
              ${oracle?.[t]?.toFixed(2) ?? '—'}
            </span>
          </label>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm">
          Whale pool
          <select
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2"
            value={whalePool}
            onChange={(e) => {
              const id = e.target.value as PoolId;
              setWhalePool(id);
              setWhaleToken(POOL_DEFS[id].tokenA);
            }}
          >
            {ALL_POOL_IDS.map((id) => (
              <option key={id} value={id}>
                {POOL_DEFS[id].label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Token in
          <select
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2"
            value={whaleToken}
            onChange={(e) => setWhaleToken(e.target.value as TokenId)}
          >
            <option value={POOL_DEFS[whalePool].tokenA}>
              {POOL_DEFS[whalePool].tokenA}
            </option>
            <option value={POOL_DEFS[whalePool].tokenB}>
              {POOL_DEFS[whalePool].tokenB}
            </option>
          </select>
        </label>
        <Input label="Amount" type="number" value={whaleAmt} onChange={setWhaleAmt} />
        <div className="flex items-end">
          <Button
            className="w-full"
            onClick={() =>
              requestWhale(whalePool, whaleToken, Number(whaleAmt) || 0)
            }
          >
            Inject whale
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="Airdrop each token"
          type="number"
          value={airdrop}
          onChange={setAirdrop}
        />
        <Button onClick={() => requestGiveTokens(Number(airdrop) || 0)}>
          Give everyone tokens
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <p className="text-sm text-slate-400">
          Resets pools, oracle, LP positions, and wallets. Players stay joined.
        </p>
        <Button
          variant="ghost"
          className="border border-amber-400/40 text-amber-100 hover:bg-amber-400/10"
          onClick={() => {
            if (
              window.confirm(
                'Reset the sandbox? Pools, oracle, and balances will restart. Players stay joined.',
              )
            ) {
              requestResetSandbox();
            }
          }}
        >
          Reset sandbox
        </Button>
      </div>
    </div>
  );
}
