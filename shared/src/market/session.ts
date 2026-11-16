import type { MarketStatus } from '../types/market';

/** Holidays and early closes, loaded from stored data (server/data/nyse-calendar.json). Never hardcoded. */
export interface MarketCalendar {
  holidays: Record<string, string>;
  /** date → regular close time "HH:MM" on early-close days */
  earlyCloses: Record<string, string>;
  /** Highest year the calendar covers; status beyond it is reported as unknown-calendar. */
  coversThroughYear?: number;
}

export const SESSION_MINUTES = {
  preMarketStart: 4 * 60,
  regularOpen: 9 * 60 + 30,
  regularClose: 16 * 60,
  afterHoursEnd: 20 * 60,
  earlyCloseAfterHoursEnd: 17 * 60,
} as const;

const etParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export interface EasternClock {
  /** YYYY-MM-DD in Eastern Time */
  date: string;
  weekday: string;
  minutes: number;
  label: string;
}

export function easternClock(date: Date): EasternClock {
  const p = Object.fromEntries(etParts.formatToParts(date).map((x) => [x.type, x.value]));
  const h = Number(p.hour);
  const m = Number(p.minute);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    weekday: p.weekday ?? '',
    minutes: h * 60 + m,
    label: `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`,
  };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export interface SessionInfo {
  status: MarketStatus;
  /** Why the market is closed on a weekday, e.g. "Thanksgiving Day". */
  holiday?: string;
  /** Regular close time "HH:MM" when today is an early-close day. */
  earlyClose?: string;
}

export function sessionAt(date: Date, calendar?: MarketCalendar): SessionInfo {
  const c = easternClock(date);
  if (c.weekday === 'Sat' || c.weekday === 'Sun') return { status: 'closed' };
  const holiday = calendar?.holidays[c.date];
  if (holiday) return { status: 'closed', holiday };
  const early = calendar?.earlyCloses[c.date];
  const s = SESSION_MINUTES;
  const close = early ? toMinutes(early) : s.regularClose;
  const afterEnd = early ? s.earlyCloseAfterHoursEnd : s.afterHoursEnd;
  const base = early ? { earlyClose: early } : {};
  if (c.minutes >= s.regularOpen && c.minutes < close) return { status: 'open', ...base };
  if (c.minutes >= s.preMarketStart && c.minutes < s.regularOpen) return { status: 'pre-market', ...base };
  if (c.minutes >= close && c.minutes < afterEnd) return { status: 'after-hours', ...base };
  return { status: 'closed', ...base };
}

export function marketStatusAt(date: Date, calendar?: MarketCalendar): MarketStatus {
  return sessionAt(date, calendar).status;
}

/** True when `isoDate` (YYYY-MM-DD) is a weekday and not a stored holiday. */
export function isTradingDay(isoDate: string, calendar: MarketCalendar): boolean {
  const day = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6 && !calendar.holidays[isoDate];
}

/** Most recent trading day whose regular session has finished, as of `now`. */
export function lastCompletedTradingDay(now: Date, calendar: MarketCalendar): string {
  const c = easternClock(now);
  const close = calendar.earlyCloses[c.date] ? toMinutes(calendar.earlyCloses[c.date]!) : SESSION_MINUTES.regularClose;
  const d = new Date(`${c.date}T12:00:00Z`);
  if (!(isTradingDay(c.date, calendar) && c.minutes >= close)) d.setUTCDate(d.getUTCDate() - 1);
  for (let i = 0; i < 10; i++) {
    const iso = d.toISOString().slice(0, 10);
    if (isTradingDay(iso, calendar)) return iso;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}
