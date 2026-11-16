import type { CompanyFacts, FactEntry } from '../providers/edgar';

/**
 * Which XBRL tags feed each concept, in order of preference. Companies switch tags over the years
 * (e.g. SalesRevenueNet before 2018), so the choice is made per fiscal year, not per company.
 */
export const CONCEPT_TAGS = {
  revenue: [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'Revenues',
    'SalesRevenueNet',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
    'RevenuesNetOfInterestExpense',
    // Property companies (REITs) often report total rent only as lease income.
    'OperatingLeaseLeaseIncome',
    'RealEstateRevenueNet',
  ],
  netIncome: ['NetIncomeLoss', 'ProfitLoss'],
  operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
  equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
} as const;

export type Concept = keyof typeof CONCEPT_TAGS;
export const INSTANT_CONCEPTS: Concept[] = ['equity'];
/** Concepts where the largest value across candidate tags is the right one (totals vs. partial lines). */
export const MAX_WINS: Concept[] = ['revenue'];

export interface AnnualFact {
  concept: Concept;
  periodStart: string | null;
  periodEnd: string;
  value: number;
  unit: 'USD';
  tag: string;
  accn: string;
  form: string;
  filed: string;
}

const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;
const isAnnualForm = (form: string) => form === '10-K' || form === '10-K/A';

/**
 * Annual values from a company-facts file. Units are kept as reported (USD, already in dollars:
 * XBRL stores the full value even when the filing's tables say "in millions").
 * When several filings report the same period, the most recently filed value wins (it includes restatements).
 */
export function extractAnnual(facts: CompanyFacts, years = 6): AnnualFact[] {
  const gaap = facts.facts['us-gaap'] ?? {};
  const out: AnnualFact[] = [];
  for (const concept of Object.keys(CONCEPT_TAGS) as Concept[]) {
    const instant = INSTANT_CONCEPTS.includes(concept);
    const byEnd = new Map<string, AnnualFact>();
    CONCEPT_TAGS[concept].forEach((tag) => {
      const entries: FactEntry[] = gaap[tag]?.units.USD ?? [];
      const candidates = new Map<string, FactEntry>();
      for (const e of entries) {
        if (!isAnnualForm(e.form) || e.fp !== 'FY' || !Number.isFinite(e.val)) continue;
        if (!instant) {
          if (!e.start) continue;
          const d = days(e.start, e.end);
          if (d < 340 || d > 390) continue;
        }
        const prev = candidates.get(e.end);
        if (!prev || e.filed > prev.filed) candidates.set(e.end, e);
      }
      for (const [end, e] of candidates) {
        const have = byEnd.get(end);
        // Revenue: companies often report a partial line (e.g. REITs report non-lease "contract" revenue
        // beside total "Revenues"). Every candidate is a revenue figure, so the largest is the total.
        // Other concepts: the first (preferred) tag wins.
        if (have && !(MAX_WINS.includes(concept) && e.val > have.value)) continue;
        byEnd.set(end, {
          concept,
          periodStart: e.start ?? null,
          periodEnd: end,
          value: e.val,
          unit: 'USD',
          tag,
          accn: e.accn,
          form: e.form,
          filed: e.filed,
        });
      }
    });
    out.push(...[...byEnd.values()].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)).slice(0, instant ? years + 1 : years));
  }
  return out;
}

/** Fiscal-year label from a period end, e.g. "FY ending 2025-09-27". */
export const fyLabel = (end: string) => `FY ending ${end}`;
