import test from "node:test";
import assert from "node:assert/strict";
import { allocatePayment, assessLateFee, baseOutstanding, deriveStatus, totalOutstanding } from "../services/installmentService.js";

const makeInstallment = (number, dueDate, overrides = {}) => ({
  _id: `inst-${number}`,
  installmentNumber: number,
  amount: 10000,
  principal: 9000,
  interest: 1000,
  dueDate: new Date(dueDate),
  status: "pending",
  paid: false,
  paidAmount: 0,
  lateFee: 0,
  lateFeePaid: 0,
  lateFeeWaived: false,
  ...overrides
});

const now = new Date("2026-05-10T00:00:00Z");

test("payment clears the oldest installment first", () => {
  const installments = [makeInstallment(1, "2026-03-01"), makeInstallment(2, "2026-04-01")];
  const { allocations, unallocated } = allocatePayment(installments, 15000, now);
  assert.equal(unallocated, 0);
  assert.equal(allocations.length, 2);
  assert.equal(installments[0].status, "paid");
  assert.equal(installments[1].paidAmount, 5000);
  assert.equal(installments[1].status, "overdue");
});

test("late fees are settled before the installment amount", () => {
  const installments = [makeInstallment(1, "2026-03-01", { lateFee: 500 })];
  const { allocations } = allocatePayment(installments, 10000, now);
  assert.equal(allocations[0].lateFee, 500);
  assert.equal(installments[0].paidAmount, 9500);
  assert.equal(installments[0].status, "overdue");
  assert.equal(totalOutstanding(installments[0]), 500);
});

test("interest and principal are split proportionally", () => {
  const installments = [makeInstallment(1, "2026-06-01")];
  const { allocations } = allocatePayment(installments, 5000, now);
  assert.equal(allocations[0].interest, 500);
  assert.equal(allocations[0].principal, 4500);
  assert.equal(installments[0].status, "partial");
});

test("status derivation covers pending, overdue and paid", () => {
  assert.equal(deriveStatus(makeInstallment(1, "2026-06-01"), now), "pending");
  assert.equal(deriveStatus(makeInstallment(1, "2026-04-01"), now), "overdue");
  assert.equal(deriveStatus(makeInstallment(1, "2026-04-01", { paidAmount: 10000 }), now), "paid");
});

test("late fee is assessed only after the grace period and only once", () => {
  const loan = { lateFeePercent: 2, gracePeriodDays: 5 };
  assert.equal(assessLateFee(makeInstallment(1, "2026-05-08"), loan, now), 0);
  assert.equal(assessLateFee(makeInstallment(1, "2026-05-01"), loan, now), 200);
  assert.equal(assessLateFee(makeInstallment(1, "2026-05-01", { lateFee: 200 }), loan, now), 0);
  assert.equal(assessLateFee(makeInstallment(1, "2026-05-01", { lateFeeWaived: true }), loan, now), 0);
});

test("restructured installments carry no outstanding balance", () => {
  assert.equal(baseOutstanding(makeInstallment(1, "2026-03-01", { status: "restructured" })), 0);
});
