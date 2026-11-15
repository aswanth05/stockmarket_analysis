/**
 * Recommendation wording the app must never show (PROJECT_STEPS Part G, UI_DESIGN §3).
 * Tests run visible text through findBannedWording().
 */
export const BANNED_TERMS = ['strong buy', 'strong-buy', 'strong sell', 'strong-sell', 'buy', 'sell'] as const;

export function findBannedWording(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_TERMS.filter((term) => new RegExp(`\\b${term.replace('-', '[- ]?')}\\b`).test(lower));
}
