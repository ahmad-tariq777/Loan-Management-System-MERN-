import { POLICY } from "../config/loanConfig.js";

const NEW_BORROWER_POINTS = 20;

export const evaluateEligibility = (applicant, { monthlyObligations = 0, defaultedLoans = 0, hasRepaymentHistory = true } = {}) => {
  const income = applicant.income || 0;
  const liabilities = applicant.liabilities || 0;
  const repaymentScore = applicant.repaymentHistoryScore || 0;
  const totalObligations = liabilities + monthlyObligations;
  const reasons = [];
  let score = 0;

  if (income >= 100000) score += 35;
  else if (income >= 60000) score += 28;
  else if (income >= 30000) score += 20;
  else if (income >= 15000) score += 12;
  else if (income > 0) score += 5;
  else reasons.push("No declared income");

  const dti = income > 0 ? (totalObligations / income) * 100 : 100;
  if (dti <= 10) score += 30;
  else if (dti <= 20) score += 24;
  else if (dti <= 35) score += 16;
  else if (dti <= 50) score += 8;
  else reasons.push("Debt-to-income ratio exceeds 50%");

  if (repaymentScore >= 90) score += 35;
  else if (repaymentScore >= 75) score += 28;
  else if (repaymentScore >= 60) score += 20;
  else if (repaymentScore >= 40) score += 12;
  else if (repaymentScore > 0) score += 5;
  else if (!hasRepaymentHistory) score += NEW_BORROWER_POINTS;

  if (defaultedLoans > 0) {
    score = Math.max(0, score - 25 * defaultedLoans);
    reasons.push("Applicant has a defaulted or written-off loan");
  }

  const finalScore = Math.min(score, 100);
  const eligible = finalScore >= 50 && defaultedLoans === 0;
  if (finalScore < 50) reasons.push("Eligibility score is below the minimum of 50");

  let loanLimit = 0;
  if (eligible) {
    if (finalScore >= 85) loanLimit = income * 12;
    else if (finalScore >= 70) loanLimit = income * 9;
    else if (finalScore >= 60) loanLimit = income * 6;
    else loanLimit = income * 3;

    loanLimit = Math.min(loanLimit, 2000000);
    loanLimit = Math.max(loanLimit, 10000);
    loanLimit = Math.round(loanLimit / 1000) * 1000;
  }

  const maxMonthlyInstallment = Math.max(0, Math.floor(income * POLICY.affordabilityRatio - totalObligations));

  return {
    eligibilityScore: finalScore,
    loanLimit,
    eligible,
    dti: parseFloat(dti.toFixed(2)),
    maxMonthlyInstallment,
    reasons: eligible ? [] : reasons
  };
};
