/** Whether a value is current, delayed by the provider, or the last good value after a failed refresh. */
export type Freshness = 'real-time' | 'delayed' | 'stale';

/** US market session state, always evaluated in America/New_York. */
export type MarketStatus = 'open' | 'closed' | 'pre-market' | 'after-hours';

/** A stored quote. `price` is null when the provider returned no value; never fill it with 0. */
export interface Quote {
  ticker: string;
  price: number | null;
  /** ISO 8601 timestamp of the quote itself, not of when we fetched it. */
  asOf: string;
  source: string;
  freshness: Freshness;
  /** Minutes of provider delay, when freshness is 'delayed'. */
  delayMinutes?: number;
}

export interface HealthResponse {
  status: 'ok';
  serverTime: string;
}
