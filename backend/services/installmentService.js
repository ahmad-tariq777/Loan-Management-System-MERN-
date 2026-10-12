import Installment from "../models/Installment.js";
import { SETTLED_INSTALLMENT_STATES } from "../config/loanConfig.js";
import { EPSILON, round2 } from "../utils/helpers.js";
import { buildSchedule } from "./loanCalculator.js";

const MS_PER_DAY = 86400000;

export const isSettled = (installment) => SETTLED_INSTALLMENT_STATES.includes(installment.status);

export const baseOutstanding = (installment) =>
  isSettled(installment) ? 0 : Math.max(0, round2(installment.amount - installment.paidAmount));

export const lateFeeOutstanding = (installment) =>
  installment.status === "restructured" ? 0 : Math.max(0, round2(installment.lateFee - installment.lateFeePaid));

export const totalOutstanding = (installment) => round2(baseOutstanding(installment) + lateFeeOutstanding(installment));

export const daysOverdue = (installment, now = new Date()) =>
  Math.max(0, Math.floor((now - new Date(installment.dueDate)) / MS_PER_DAY));

export const deriveStatus = (installment, now = new Date()) => {
  if (installment.status === "restructured") return "restructured";
  const baseLeft = round2(installment.amount - installment.paidAmount);
  const lateLeft = round2(installment.lateFee - installment.lateFeePaid);
  if (baseLeft <= EPSILON && lateLeft <= EPSILON) return "paid";
  if (new Date(installment.dueDate) < now) return "overdue";
  return installment.paidAmount > 0 ? "partial" : "pending";
};

export const applyState = (installment, now = new Date()) => {
  installment.status = deriveStatus(installment, now);
  installment.paid = installment.status === "paid";
  installment.isOverdue = installment.status === "overdue";
  if (installment.paid && !installment.paidAt) installment.paidAt = now;
  if (!installment.paid) installment.paidAt = null;
  return installment;
};

export const allocatePayment = (installments, amount, now = new Date()) => {
  let remaining = round2(amount);
  const allocations = [];

  for (const installment of installments) {
    if (remaining <= EPSILON) break;
    const lateDue = lateFeeOutstanding(installment);
    const baseDue = baseOutstanding(installment);
    if (lateDue + baseDue <= EPSILON) continue;

    const lateFeePart = Math.min(remaining, lateDue);
    remaining = round2(remaining - lateFeePart);
    const basePart = Math.min(remaining, baseDue);
    remaining = round2(remaining - basePart);

    const interestPart = installment.amount > 0 ? round2((basePart * installment.interest) / installment.amount) : 0;

    installment.lateFeePaid = round2(installment.lateFeePaid + lateFeePart);
    installment.paidAmount = round2(installment.paidAmount + basePart);
    applyState(installment, now);

    allocations.push({
      installment: installment._id,
      installmentNumber: installment.installmentNumber,
      principal: round2(basePart - interestPart),
      interest: interestPart,
      lateFee: lateFeePart,
      amount: round2(lateFeePart + basePart)
    });
  }

  return { allocations, unallocated: remaining };
};

export const assessLateFee = (installment, loan, now = new Date()) => {
  if (installment.lateFeeWaived || installment.lateFee > 0 || loan.lateFeePercent <= 0) return 0;
  if (daysOverdue(installment, now) <= loan.gracePeriodDays) return 0;
  return round2((baseOutstanding(installment) * loan.lateFeePercent) / 100);
};

export const createSchedule = async (loan, firstDueDate, { principal, months, annualRate, startNumber = 1 } = {}) => {
  const rows = buildSchedule({
    principal: principal ?? loan.approvedAmount,
    annualRate: annualRate ?? loan.interestRate,
    months: months ?? loan.tenureMonths,
    firstDueDate,
    startNumber
  });
  const documents = rows.map((row) => ({
    loan: loan._id,
    applicant: loan.applicant,
    installmentNumber: row.installmentNumber,
    amount: row.amount,
    principal: row.principal,
    interest: row.interest,
    dueDate: row.dueDate
  }));
  return Installment.insertMany(documents);
};
