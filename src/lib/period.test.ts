import { describe, expect, it } from 'vitest';
import {
  currentPeriodId,
  currentPeriodStartAmsterdam,
  isPeriodStale,
} from './period';

describe('period', () => {
  it('returns a stable Sat-prefixed id', () => {
    const id = currentPeriodId(Date.parse('2026-10-02T12:00:00Z')); // Thursday
    expect(id).toMatch(/^\d{4}-Sat-\d{2}-\d{2}$/);
  });

  it('period start is a Saturday in Amsterdam', () => {
    const start = currentPeriodStartAmsterdam(
      Date.parse('2026-10-02T12:00:00Z'),
    );
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Amsterdam',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(start)).map((p) => [p.type, p.value]),
    );
    expect(parts.weekday).toBe('Sat');
    expect(parts.hour === '00' || parts.hour === '0').toBe(true);
  });

  it('detects stale period across Saturday boundary', () => {
    // Friday evening Amsterdam before Saturday reset
    const friday = Date.parse('2026-10-02T20:00:00Z'); // Fri 22:00 Amsterdam (CEST)
    const idBefore = currentPeriodId(friday);
    // Saturday morning after midnight Amsterdam
    const saturday = Date.parse('2026-10-03T00:00:00+02:00');
    expect(isPeriodStale(idBefore, saturday)).toBe(true);
  });
});
