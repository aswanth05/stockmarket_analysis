import { describe, expect, it } from 'vitest';
import {
  freeCashFlow,
  linearScore,
  median,
  netMargin,
  pctChange,
  returnOnEquity,
  revenueGrowth,
  sma,
} from '../src/calculations/engine';

describe('revenueGrowth', () => {
  it('computes growth', () => {
    expect(revenueGrowth(110, 100).value).toBeCloseTo(0.1);
    expect(revenueGrowth(90, 100).value).toBeCloseTo(-0.1);
  });
  it('refuses a zero or negative base', () => {
    expect(revenueGrowth(100, 0)).toEqual({ value: null, reason: 'prior-year revenue is zero or negative' });
    expect(revenueGrowth(100, -5).value).toBeNull();
  });
  it('never treats missing as zero', () => {
    expect(revenueGrowth(null, 100).value).toBeNull();
    expect(revenueGrowth(100, null).value).toBeNull();
  });
});

describe('netMargin', () => {
  it('allows a loss', () => {
    expect(netMargin(-20, 100).value).toBeCloseTo(-0.2);
  });
  it('refuses zero or negative revenue', () => {
    expect(netMargin(5, 0).value).toBeNull();
    expect(netMargin(5, -1).reason).toMatch(/zero or negative/);
  });
});

describe('returnOnEquity', () => {
  it('uses average equity', () => {
    expect(returnOnEquity(20, 90, 110).value).toBeCloseTo(0.2);
  });
  it('refuses zero or negative average equity', () => {
    expect(returnOnEquity(20, -50, -30).value).toBeNull();
    expect(returnOnEquity(20, 0, 0).value).toBeNull();
    expect(returnOnEquity(20, -100, 60).reason).toMatch(/zero or negative/);
  });
  it('falls back to year-end equity and says so', () => {
    const r = returnOnEquity(10, null, 100);
    expect(r.value).toBeCloseTo(0.1);
    expect(r.reason).toMatch(/year-end equity only/);
  });
});

describe('freeCashFlow', () => {
  it('subtracts capex whatever its sign in the filing', () => {
    expect(freeCashFlow(100, 30).value).toBe(70);
    expect(freeCashFlow(100, -30).value).toBe(70);
  });
  it('can be negative', () => {
    expect(freeCashFlow(-10, 30).value).toBe(-40);
  });
  it('handles zero inputs as real zeros', () => {
    expect(freeCashFlow(0, 0).value).toBe(0);
  });
  it('is null when an input is missing', () => {
    expect(freeCashFlow(null, 5).value).toBeNull();
  });
});

describe('helpers', () => {
  it('pctChange refuses a non-positive base', () => {
    expect(pctChange(105, 100)).toBe(5);
    expect(pctChange(5, 0)).toBeNull();
    expect(pctChange(null, 100)).toBeNull();
  });
  it('sma is null until enough values', () => {
    expect(sma([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3]);
  });
  it('linearScore clamps and passes null through', () => {
    expect(linearScore(0.15, 0, 0.3)).toBe(50);
    expect(linearScore(1, 0, 0.3)).toBe(100);
    expect(linearScore(-1, 0, 0.3)).toBe(0);
    expect(linearScore(null, 0, 1)).toBeNull();
  });
  it('median ignores missing values', () => {
    expect(median([3, null, 1, 2])).toBe(2);
    expect(median([null])).toBeNull();
  });
});
