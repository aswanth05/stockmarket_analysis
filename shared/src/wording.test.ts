import { describe, expect, it } from 'vitest';
import { findBannedWording } from './wording';

describe('findBannedWording', () => {
  it('flags recommendation wording in any case', () => {
    expect(findBannedWording('AI Signal: Strong Buy')).toContain('strong buy');
    expect(findBannedWording('Rating: SELL')).toContain('sell');
    expect(findBannedWording('strong-buy')).toContain('strong-buy');
  });

  it('does not flag words that merely contain the letters', () => {
    expect(findBannedWording('Buyback announced; seller financing; sellside')).toEqual([]);
  });

  it('passes neutral research wording', () => {
    expect(findBannedWording('AI review · experimental score 62/100')).toEqual([]);
  });
});
