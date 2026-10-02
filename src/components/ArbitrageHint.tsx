import { useState } from 'react';
import { detectArbitrage } from '../lib/arbitrage';
import { useStore } from '../store';
import { Button } from './ui';

export function ArbitrageHint() {
  const pools = useStore((s) => s.room?.pools);
  const [showRoute, setShowRoute] = useState(false);
  if (!pools) return null;
  const hints = detectArbitrage(pools);
  if (hints.length === 0) {
    return (
      <div className="card p-5">
        <h2 className="text-xl font-semibold">Arbitrage</h2>
        <p className="mt-2 text-sm text-slate-400">
          No meaningful cross-pool price gap right now. Make a skewed trade or
          wait for someone else to move a pool.
        </p>
      </div>
    );
  }
  const h = hints[0];
  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Arbitrage</h2>
        <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-200">
          {h.edgePct.toFixed(1)}% edge
        </span>
      </div>
      <p className="text-slate-200">{h.summary}</p>
      <Button variant="ghost" onClick={() => setShowRoute((v) => !v)}>
        {showRoute ? 'Hide route' : 'See the route'}
      </Button>
      {showRoute && (
        <p className="rounded-xl bg-slate-950/50 p-3 text-sm text-slate-300">
          {h.route}
        </p>
      )}
    </div>
  );
}
