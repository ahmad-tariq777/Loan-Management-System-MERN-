export const ORG_NAME = "Akhuwat Foundation";
export const ORG_TAGLINE = "Interest-Free Microfinance";

export const LOAN_TYPES = ["personal", "business", "education", "housing", "agriculture", "other"];
export const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "online", "mobile_wallet"];
export const IN_PROGRESS_STATUSES = ["pending", "under_review", "eligible"];
export const ACTIVE_STATUSES = ["disbursed", "defaulted"];
export const SETTLED_INSTALLMENT_STATES = ["paid", "restructured"];

export const STATUS_TRANSITIONS = {
  pending: ["under_review", "eligible", "approved", "rejected", "cancelled"],
  under_review: ["eligible", "approved", "rejected", "cancelled"],
  eligible: ["approved", "rejected", "cancelled"],
  approved: ["disbursed", "cancelled"],
  disbursed: ["closed", "defaulted", "written_off"],
  defaulted: ["disbursed", "closed", "written_off"],
  rejected: [],
  closed: [],
  cancelled: [],
  written_off: []
};

export const POLICY = {
  affordabilityRatio: 0.5,
  defaultAfterDaysOverdue: 90,
  reminderLeadDays: 3,
  schedulerIntervalMs: 6 * 60 * 60 * 1000,
  onTimeScoreBonus: 2,
  lateScorePenalty: 3,
  closureScoreBonus: 5
};

const baseProduct = {
  minAmount: 1000,
  minTenureMonths: 3,
  defaultTenureMonths: 12,
  interestRate: 0,
  processingFeePercent: 0,
  lateFeePercent: 2,
  gracePeriodDays: 5,
  requiresGuarantor: true,
  isActive: true
};

export const DEFAULT_PRODUCTS = [
  { ...baseProduct, loanType: "personal", name: "Personal Loan", maxAmount: 500000, maxTenureMonths: 36, guarantorThreshold: 100000 },
  { ...baseProduct, loanType: "business", name: "Business Loan", maxAmount: 2000000, maxTenureMonths: 60, guarantorThreshold: 200000 },
  { ...baseProduct, loanType: "education", name: "Education Loan", maxAmount: 1000000, maxTenureMonths: 60, guarantorThreshold: 300000 },
  { ...baseProduct, loanType: "housing", name: "Housing Loan", maxAmount: 2000000, maxTenureMonths: 120, defaultTenureMonths: 36, guarantorThreshold: 300000 },
  { ...baseProduct, loanType: "agriculture", name: "Agriculture Loan", maxAmount: 1000000, maxTenureMonths: 36, guarantorThreshold: 200000 },
  { ...baseProduct, loanType: "other", name: "General Loan", maxAmount: 300000, maxTenureMonths: 24, guarantorThreshold: 100000 }
];
