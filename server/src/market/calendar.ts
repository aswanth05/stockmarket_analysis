import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { easternClock, lastCompletedTradingDay, sessionAt, type MarketCalendar, type MarketStatusView } from '@ust/shared';
import { config } from '../config';

interface CalendarFile extends MarketCalendar {
  source: string;
  retrievedAt: string;
}

export const CALENDAR: CalendarFile = JSON.parse(readFileSync(resolve(config.serverDir, 'data/nyse-calendar.json'), 'utf8'));

export function marketStatus(now = new Date()): MarketStatusView {
  const s = sessionAt(now, CALENDAR);
  const c = easternClock(now);
  return {
    ...s,
    etTime: c.label,
    etDate: c.date,
    lastCompletedTradingDay: lastCompletedTradingDay(now, CALENDAR),
    calendarSource: CALENDAR.source,
  };
}

export const lastTradingDay = (now = new Date()) => lastCompletedTradingDay(now, CALENDAR);
