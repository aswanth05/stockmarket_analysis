import { describe, expect, it } from 'vitest';
import { easternClock, lastCompletedTradingDay, marketStatusAt, sessionAt, type MarketCalendar } from './session';

const cal: MarketCalendar = {
  holidays: { '2026-11-26': 'Thanksgiving Day', '2026-12-25': 'Christmas Day' },
  earlyCloses: { '2026-11-27': '13:00' },
};

describe('sessionAt (Eastern Time, stored calendar)', () => {
  it('is closed on a weekend, even during session hours', () => {
    expect(marketStatusAt(new Date('2026-11-14T15:00:00Z'), cal)).toBe('closed'); // Sat 10:00 ET
    expect(marketStatusAt(new Date('2026-11-15T15:00:00Z'), cal)).toBe('closed'); // Sun
  });

  it('is closed on a stored holiday and names it', () => {
    expect(sessionAt(new Date('2026-11-26T16:00:00Z'), cal)).toEqual({ status: 'closed', holiday: 'Thanksgiving Day' });
  });

  it('closes early on an early-close day', () => {
    expect(sessionAt(new Date('2026-11-27T17:30:00Z'), cal).status).toBe('open'); // 12:30 ET
    expect(sessionAt(new Date('2026-11-27T18:30:00Z'), cal)).toEqual({ status: 'after-hours', earlyClose: '13:00' });
    expect(sessionAt(new Date('2026-11-27T22:30:00Z'), cal).status).toBe('closed'); // 17:30 ET
  });

  it('handles each weekday window', () => {
    expect(marketStatusAt(new Date('2026-11-13T13:00:00Z'), cal)).toBe('pre-market'); // Fri 8:00 ET
    expect(marketStatusAt(new Date('2026-11-13T14:30:00Z'), cal)).toBe('open'); // 9:30 ET
    expect(marketStatusAt(new Date('2026-11-13T21:00:00Z'), cal)).toBe('after-hours'); // 16:00 ET
    expect(marketStatusAt(new Date('2026-11-14T01:00:00Z'), cal)).toBe('closed'); // Fri 20:00 ET
  });

  it('uses daylight time in summer', () => {
    expect(marketStatusAt(new Date('2026-07-01T13:30:00Z'), cal)).toBe('open'); // Wed 9:30 EDT
  });

  it('formats the ET clock and date', () => {
    const c = easternClock(new Date('2026-11-14T02:05:00Z'));
    expect(c.label).toBe('9:05 PM');
    expect(c.date).toBe('2026-11-13');
  });
});

describe('lastCompletedTradingDay', () => {
  it('skips weekends and holidays', () => {
    expect(lastCompletedTradingDay(new Date('2026-11-15T15:00:00Z'), cal)).toBe('2026-11-13'); // Sunday
    expect(lastCompletedTradingDay(new Date('2026-11-27T15:00:00Z'), cal)).toBe('2026-11-25'); // Fri morning after Thanksgiving
  });

  it('counts today once the session has closed', () => {
    expect(lastCompletedTradingDay(new Date('2026-11-13T21:30:00Z'), cal)).toBe('2026-11-13');
    expect(lastCompletedTradingDay(new Date('2026-11-13T15:00:00Z'), cal)).toBe('2026-11-12');
  });
});
