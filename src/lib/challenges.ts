import type { ActivityEvent, RoomState } from '../types';

export interface Challenge {
  id: string;
  title: string;
  description: string;
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'swap',
    title: 'Make a swap',
    description: 'Swap any amount and watch the pool price move.',
  },
  {
    id: 'impact',
    title: 'Feel price impact',
    description: 'Make a large swap with at least 5% price impact.',
  },
  {
    id: 'lp',
    title: 'Become an LP',
    description: 'Add liquidity to any pool.',
  },
  {
    id: 'fees',
    title: 'Earn fees',
    description:
      'After others have traded against your pool, remove some liquidity.',
  },
];

export function evaluateChallenges(
  state: RoomState,
  playerId: string,
  activity: ActivityEvent[],
): string[] {
  const done = new Set(state.completedChallenges[playerId] ?? []);
  const mine = activity.filter((a) => a.playerId === playerId);
  const msgs = mine.map((a) => a.message);

  if (msgs.some((m) => m.includes('swapped'))) done.add('swap');
  if (msgs.some((m) => /swapped.*impact/i.test(m) && parseImpact(m) >= 5)) {
    done.add('impact');
  }

  const player = state.players.find((p) => p.id === playerId);
  if (player && Object.values(player.positions).some((p) => p && p.lpTokens > 0)) {
    done.add('lp');
  }
  if (msgs.some((m) => m.includes('removed liquidity'))) {
    done.add('fees');
  }

  // Drop legacy arb completions if present
  done.delete('arb');

  return [...done];
}

function parseImpact(message: string): number {
  const m = message.match(/([\d.]+)%\s*impact/i);
  return m ? Number(m[1]) : 0;
}
