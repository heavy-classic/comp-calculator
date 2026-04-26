/**
 * Commission Calculation Rules:
 *
 * Services:
 *   IdeaGen - Implementation: 10%
 *   IdeaGen - Renewal:        5%
 *   Other   - Implementation: 4%
 *   Other   - Renewal:        2%
 *
 * Software Resale:
 *   Invoke Public Sector gets 35% of the license amount.
 *   Rep commission = 35% of the Invoke PS amount = 12.25% of license amount.
 *
 * Exclusions:
 *   - Pass-through revenue or low margin (≤25% Gross Margin)
 */

export const COMMISSION_RATES = {
  IdeaGen: {
    Implementation: 0.10,
    Renewal: 0.05,
  },
  Other: {
    Implementation: 0.04,
    Renewal: 0.02,
  },
  'Software Resale': {
    InvokePS: 0.35,       // Invoke Public Sector gets 35% of license amount
    RepOfInvokePS: 0.35,  // Rep gets 35% of Invoke PS amount (= 12.25% of license)
  },
};

export const LOW_MARGIN_THRESHOLD = 25; // percent

/**
 * Calculate commission for a single line item.
 * Returns invokePsAmount for Software Resale items.
 */
export function calculateLineItemCommission({
  dealType,           // 'Implementation' | 'Renewal' | 'Software Resale'
  serviceType,        // 'IdeaGen' | 'Other'
  amount,             // gross license / contract amount
  netProfit,          // unused for Software Resale (kept for API compat)
  grossMarginPercent, // if provided and ≤25, excluded
  yearNumber = 1,     // kept for display / tracking
  isUpsell = false,   // kept for display / tracking
}) {
  // Check for low margin exclusion
  if (
    grossMarginPercent !== null &&
    grossMarginPercent !== undefined &&
    grossMarginPercent !== '' &&
    parseFloat(grossMarginPercent) <= LOW_MARGIN_THRESHOLD
  ) {
    return {
      rate: 0,
      commissionAmount: 0,
      invokePsAmount: 0,
      isExcluded: true,
      exclusionReason: `Gross margin (${grossMarginPercent}%) is ≤25% threshold`,
    };
  }

  let rate = 0;
  let commissionAmount = 0;
  let invokePsAmount = 0;
  const baseAmount = parseFloat(amount) || 0;

  if (dealType === 'Software Resale') {
    const invoicePsRate = COMMISSION_RATES['Software Resale'].InvokePS;
    const repRate = COMMISSION_RATES['Software Resale'].RepOfInvokePS;
    invokePsAmount = +(baseAmount * invoicePsRate).toFixed(2);
    commissionAmount = +(invokePsAmount * repRate).toFixed(2);
    rate = invoicePsRate * repRate; // effective rate = 12.25%
  } else if (dealType === 'Implementation') {
    rate = serviceType === 'IdeaGen'
      ? COMMISSION_RATES.IdeaGen.Implementation
      : COMMISSION_RATES.Other.Implementation;
    commissionAmount = +(baseAmount * rate).toFixed(2);
  } else if (dealType === 'Renewal') {
    rate = serviceType === 'IdeaGen'
      ? COMMISSION_RATES.IdeaGen.Renewal
      : COMMISSION_RATES.Other.Renewal;
    commissionAmount = +(baseAmount * rate).toFixed(2);
  }

  return {
    rate,
    commissionAmount,
    invokePsAmount,
    isExcluded: false,
    exclusionReason: null,
  };
}

/**
 * Calculate commission for all line items in a deal
 */
export function calculateDealCommission(deal, lineItems) {
  const results = lineItems.map((item) => {
    const { rate, commissionAmount, isExcluded, exclusionReason } = calculateLineItemCommission({
      dealType: deal.deal_type,
      serviceType: deal.service_type,
      amount: item.amount,
      netProfit: item.net_profit,
      grossMarginPercent: item.gross_margin_percent,
      yearNumber: item.year_number,
      isUpsell: item.is_upsell,
    });

    return {
      ...item,
      commission_rate: rate,
      commission_amount: commissionAmount,
      is_excluded: isExcluded,
      exclusion_reason: exclusionReason,
    };
  });

  const totalCommission = results
    .filter((r) => !r.is_excluded)
    .reduce((sum, r) => sum + (r.commission_amount || 0), 0);

  const invoicedCommission = results
    .filter((r) => !r.is_excluded && r.invoiced)
    .reduce((sum, r) => sum + (r.commission_amount || 0), 0);

  return {
    lineItems: results,
    totalCommission: +totalCommission.toFixed(2),
    invoicedCommission: +invoicedCommission.toFixed(2),
    pendingCommission: +(totalCommission - invoicedCommission).toFixed(2),
  };
}

/**
 * For monthly-billing line items: count how many months have been invoiced
 * as of today, based on the deal close date.
 *
 * Rule: invoice goes out on the LAST DAY of each month, starting from
 * the month the deal closed.
 *
 * Example — close date Feb 26 2026:
 *   Feb 26 → 0 months (Feb 28 hasn't passed)
 *   Feb 28 → 1 month  (end of Feb has passed)
 *   Mar 31 → 2 months (end of Mar has passed)
 */
export function getMonthsInvoiced(closeDate, totalMonths = 12) {
  if (!closeDate) return 0;
  const datePart = String(closeDate).split('T')[0];
  const [y, m] = datePart.split('-').map(Number);
  const today = new Date();

  let months = 0;
  let year = y;
  let month = m - 1; // convert to 0-indexed

  while (months < totalMonths) {
    const lastDayOfMonth = new Date(year, month + 1, 0); // day 0 of next month = last day of this month
    if (lastDayOfMonth > today) break;
    months++;
    month++;
    if (month > 11) { month = 0; year++; }
  }
  return months;
}

/**
 * Format currency
 */
export function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(parseFloat(value));
}

/**
 * Format percentage
 */
export function formatPercent(rate) {
  if (rate === null || rate === undefined) return '0%';
  return `${(parseFloat(rate) * 100).toFixed(1)}%`;
}

/**
 * Get commission rate label for display
 */
export function getCommissionRateLabel(dealType, serviceType, yearNumber, isUpsell) {
  if (dealType === 'Software Resale') {
    return '35% to Invoke PS → 35% of that = 12.25% of license';
  }
  if (dealType === 'Implementation') {
    return serviceType === 'IdeaGen' ? '10%' : '4%';
  }
  if (dealType === 'Renewal') {
    return serviceType === 'IdeaGen' ? '5%' : '2%';
  }
  return 'N/A';
}
