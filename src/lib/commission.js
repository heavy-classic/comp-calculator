/**
 * Commission Calculation Rules:
 *
 * Services:
 *   IdeaGen - Implementation: 10%
 *   IdeaGen - Renewal:        5%
 *   Other   - Implementation: 4%
 *   Other   - Renewal:        2%
 *
 * IdeaGen Software Resale:
 *   Year 1:              35% of License Net Profit
 *   Year 2+ (standard):  15% of Net Profit
 *   Year 2+ (upsell):    35% of Net Profit
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
  SoftwareResale: {
    Year1: 0.35,
    Year2Plus: 0.15,
    Year2PlusUpsell: 0.35,
  },
};

export const LOW_MARGIN_THRESHOLD = 25; // percent

/**
 * Calculate commission for a single line item
 */
export function calculateLineItemCommission({
  dealType,       // 'Implementation' | 'Renewal' | 'SoftwareResale'
  serviceType,    // 'IdeaGen' | 'Other'
  amount,         // gross amount
  netProfit,      // used for SoftwareResale
  grossMarginPercent, // if provided and ≤25, excluded
  yearNumber = 1, // for SoftwareResale: 1 or 2+
  isUpsell = false, // for SoftwareResale Year2+
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
      isExcluded: true,
      exclusionReason: `Gross margin (${grossMarginPercent}%) is ≤25% threshold`,
    };
  }

  let rate = 0;
  let baseAmount = parseFloat(amount) || 0;

  if (dealType === 'SoftwareResale') {
    baseAmount = parseFloat(netProfit) || parseFloat(amount) || 0;
    if (yearNumber <= 1) {
      rate = COMMISSION_RATES.SoftwareResale.Year1;
    } else if (isUpsell) {
      rate = COMMISSION_RATES.SoftwareResale.Year2PlusUpsell;
    } else {
      rate = COMMISSION_RATES.SoftwareResale.Year2Plus;
    }
  } else if (dealType === 'Implementation') {
    rate = serviceType === 'IdeaGen'
      ? COMMISSION_RATES.IdeaGen.Implementation
      : COMMISSION_RATES.Other.Implementation;
  } else if (dealType === 'Renewal') {
    rate = serviceType === 'IdeaGen'
      ? COMMISSION_RATES.IdeaGen.Renewal
      : COMMISSION_RATES.Other.Renewal;
  }

  return {
    rate,
    commissionAmount: +(baseAmount * rate).toFixed(2),
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
    .filter((r) => !r.is_excluded && r.status === 'Invoiced')
    .reduce((sum, r) => sum + (r.commission_amount || 0), 0);

  return {
    lineItems: results,
    totalCommission: +totalCommission.toFixed(2),
    invoicedCommission: +invoicedCommission.toFixed(2),
    pendingCommission: +(totalCommission - invoicedCommission).toFixed(2),
  };
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
  if (dealType === 'SoftwareResale') {
    if (yearNumber <= 1) return '35% of Net Profit (Year 1)';
    if (isUpsell) return '35% of Net Profit (Upsell)';
    return '15% of Net Profit (Year 2+)';
  }
  if (dealType === 'Implementation') {
    return serviceType === 'IdeaGen' ? '10%' : '4%';
  }
  if (dealType === 'Renewal') {
    return serviceType === 'IdeaGen' ? '5%' : '2%';
  }
  return 'N/A';
}
