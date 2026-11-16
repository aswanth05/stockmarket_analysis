import type { MarketStatus } from '../types/market';

/**
 * Session status from the clock in America/New_York.
 *
 * PROVISIONAL (step 30): weekdays and session hours only. Step 29 adds the stored
 * NYSE holiday/early-close calendar, and the pre-market/after-hours windows below
 * must be confirmed against the chosen data provider (CLAUDE.md, Market rules).
 */
export const SESSION_MINUTES = {
  preMarketStart: 4 * 60,
  regularOpen: 9 * 60 + 30,
  regularClose: 16 * 60,
  afterHoursEnd: 20 * 60,
} as const;

const etParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function easternClock(date: Date): { weekday: string; minutes: number; label: string } {
  const parts = Object.fromEntries(etParts.formatToParts(date).map((p) => [p.type, p.value]));
  const h = Number(parts.hour);
  const m = Number(parts.minute);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return {
    weekday: parts.weekday ?? '',
    minutes: h * 60 + m,
    label: `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`,
  };
}

export function marketStatusAt(date: Date): MarketStatus {
  const { weekday, minutes } = easternClock(date);
  if (weekday === 'Sat' || weekday === 'Sun') return 'closed';
  const s = SESSION_MINUTES;
  if (minutes >= s.regularOpen && minutes < s.regularClose) return 'open';
  if (minutes >= s.preMarketStart && minutes < s.regularOpen) return 'pre-market';
  if (minutes >= s.regularClose && minutes < s.afterHoursEnd) return 'after-hours';
  return 'closed';
}
