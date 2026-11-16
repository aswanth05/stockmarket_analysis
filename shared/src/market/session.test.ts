import { describe, expect, it } from 'vitest';
import { easternClock, marketStatusAt } from './session';

describe('marketStatusAt (Eastern Time)', () => {
  it('is closed on a weekend, even during session hours', () => {
    expect(marketStatusAt(new Date('2026-11-14T15:00:00Z'))).toBe('closed'); // Sat 10:00 ET
    expect(marketStatusAt(new Date('2026-11-15T15:00:00Z'))).toBe('closed'); // Sun
  });

  it('handles each weekday window', () => {
    expect(marketStatusAt(new Date('2026-11-13T13:00:00Z'))).toBe('pre-market'); // Fri 8:00 ET
    expect(marketStatusAt(new Date('2026-11-13T14:30:00Z'))).toBe('open'); // 9:30 ET
    expect(marketStatusAt(new Date('2026-11-13T21:00:00Z'))).toBe('after-hours'); // 16:00 ET
    expect(marketStatusAt(new Date('2026-11-14T01:00:00Z'))).toBe('closed'); // Fri 20:00 ET
  });

  it('uses daylight time in summer', () => {
    expect(marketStatusAt(new Date('2026-07-01T13:30:00Z'))).toBe('open'); // Wed 9:30 EDT
  });

  it('formats the ET clock', () => {
    expect(easternClock(new Date('2026-11-13T21:05:00Z')).label).toBe('4:05 PM');
    expect(easternClock(new Date('2026-11-13T05:00:00Z')).label).toBe('12:00 AM');
  });
});
