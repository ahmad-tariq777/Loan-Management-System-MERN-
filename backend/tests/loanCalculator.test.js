import test from "node:test";
import assert from "node:assert/strict";
import { buildSchedule, calculateEmi, firstDueDateFrom, maxPrincipalForEmi, summarizeSchedule } from "../services/loanCalculator.js";

const firstDueDate = firstDueDateFrom(new Date(Date.UTC(2026, 0, 15)));

test("first due date is the first day of the following month", () => {
  assert.equal(firstDueDate.toISOString(), "2026-02-01T00:00:00.000Z");
});

test("interest-free schedule splits principal evenly and totals exactly", () => {
  const rows = buildSchedule({ principal: 100000, annualRate: 0, months: 7, firstDueDate });
  const summary = summarizeSchedule(rows);
  assert.equal(rows.length, 7);
  assert.equal(summary.totalPayable, 100000);
  assert.equal(summary.totalInterest, 0);
  assert.equal(rows.at(-1).balance, 0);
});

test("reducing balance schedule amortizes to zero", () => {
  const rows = buildSchedule({ principal: 250000, annualRate: 12, months: 24, firstDueDate });
  const summary = summarizeSchedule(rows);
  assert.equal(rows.at(-1).balance, 0);
  assert.equal(summary.totalPrincipal, 250000);
  assert.ok(summary.totalInterest > 0);
  assert.equal(calculateEmi(250000, 12, 24), rows[0].amount);
});

test("due dates advance one month at a time across year ends", () => {
  const rows = buildSchedule({ principal: 12000, annualRate: 0, months: 12, firstDueDate });
  assert.equal(rows[0].dueDate.toISOString().slice(0, 10), "2026-02-01");
  assert.equal(rows[11].dueDate.toISOString().slice(0, 10), "2027-01-01");
});

test("max principal inverts the EMI calculation", () => {
  const principal = maxPrincipalForEmi(calculateEmi(300000, 10, 36), 10, 36);
  assert.ok(Math.abs(principal - 300000) < 5);
  assert.equal(maxPrincipalForEmi(5000, 0, 12), 60000);
  assert.equal(maxPrincipalForEmi(0, 5, 12), 0);
});
