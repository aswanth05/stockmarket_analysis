import { createContext, useContext } from 'react';
import type { MarketStatusResponse } from '@ust/shared';

/** Server-computed market status (stored NYSE calendar), shared with every screen. */
export const MarketContext = createContext<MarketStatusResponse | null>(null);
export const useMarket = () => useContext(MarketContext);
