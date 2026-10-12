import test from "node:test";
import assert from "node:assert/strict";
import { evaluateEligibility } from "../utils/eligibilityEngine.js";

test("first-time borrower with a declared income is eligible", () => {
  const result = evaluateEligibility({ income: 40000, liabilities: 0, repaymentHistoryScore: 0 }, { hasRepaymentHistory: false });
  assert.equal(result.eligible, true);
  assert.ok(result.loanLimit > 0);
});

test("no declared income is not eligible", () => {
  const result = evaluateEligibility({ income: 0 }, { hasRepaymentHistory: false });
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("No declared income"));
});

test("defaulted history blocks eligibility", () => {
  const result = evaluateEligibility({ income: 120000, repaymentHistoryScore: 95 }, { defaultedLoans: 1 });
  assert.equal(result.eligible, false);
});
