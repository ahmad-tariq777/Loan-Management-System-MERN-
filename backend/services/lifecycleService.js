import Installment from "../models/Installment.js";
import User from "../models/User.js";
import { POLICY, ACTIVE_STATUSES, SETTLED_INSTALLMENT_STATES } from "../config/loanConfig.js";
import { AppError } from "../utils/AppError.js";
import { formatId, parseNumber, round2 } from "../utils/helpers.js";
import { createNotification } from "../utils/notificationHelper.js";
import { nextSequence } from "../utils/sequence.js";
import { buildSchedule, firstDueDateFrom, summarizeSchedule } from "./loanCalculator.js";
import { baseOutstanding, createSchedule, daysOverdue, lateFeeOutstanding, applyState } from "./installmentService.js";
import { getReviewChecklist, computeEligibility, pushHistory, syncLoanFinancials, transitionLoan } from "./loanService.js";
import { recordPayment } from "./paymentService.js";

export const approveLoan = async ({ loan, product, approver, comments, approvedAmount, interestRate }) => {
  const checklist = await getReviewChecklist(loan);
  if (!checklist.ready) throw new AppError("Loan review checklist is incomplete", 400, checklist.missing);

  const eligibility = await computeEligibility(loan);
  if (!eligibility.eligible) throw new AppError("Applicant is not eligible for this loan", 400, eligibility.reasons);

  loan.eligibilityScore = eligibility.eligibilityScore;
  loan.loanLimit = eligibility.maxEligibleAmount;

  const isAdmin = approver.role === "admin";
  const ceiling = isAdmin ? Math.max(loan.loanLimit, loan.amountRequested) : loan.loanLimit;
  const amount =
    approvedAmount === undefined
      ? Math.min(loan.loanLimit, loan.amountRequested)
      : parseNumber(approvedAmount, "approvedAmount", { min: product?.minAmount ?? 1, max: product?.maxAmount ?? Infinity });
  if (amount > ceiling) throw new AppError(`Approved amount cannot exceed the eligible limit of ${ceiling}`, 400);

  let rate = loan.interestRate;
  if (interestRate !== undefined) {
    if (!isAdmin) throw new AppError("Only an admin can override the interest rate", 403);
    rate = parseNumber(interestRate, "interestRate", { min: 0, max: 100 });
  }

  const schedule = buildSchedule({ principal: amount, annualRate: rate, months: loan.tenureMonths, firstDueDate: firstDueDateFrom(new Date()) });
  const summary = summarizeSchedule(schedule);

  loan.approvedAmount = amount;
  loan.interestRate = rate;
  loan.processingFee = round2((amount * loan.processingFeePercent) / 100);
  loan.monthlyInstallment = summary.monthlyInstallment;
  loan.totalPayable = summary.totalPayable;
  loan.totalInterest = summary.totalInterest;
  loan.remainingBalance = summary.totalPayable;
  loan.officerComments = comments;
  loan.approvedBy = approver.id;
  loan.approvedAt = new Date();
  if (!loan.loanID) loan.loanID = formatId("L", await nextSequence("loanId"), 6);
  transitionLoan(loan, "approved", { userId: approver.id, comment: comments });

  loan.approvalLetter = `${loan.loanID}.pdf`;
  await loan.save();
  await createNotification({
    userID: loan.applicant,
    title: "Loan Approved!",
    message: `Your loan ${loan.loanNumber} has been approved for Rs ${amount.toLocaleString()}.`,
    type: "loan_status",
    relatedLoan: loan._id
  });
  return loan;
};

export const rejectLoan = async ({ loan, rejector, comments }) => {
  if (!comments) throw new AppError("Comments are required when rejecting a loan", 400);
  loan.officerComments = comments;
  loan.approvedBy = rejector.id;
  loan.rejectedAt = new Date();
  transitionLoan(loan, "rejected", { userId: rejector.id, comment: comments });
  await loan.save();
  await createNotification({
    userID: loan.applicant,
    title: "Loan Application Rejected",
    message: `Your loan application ${loan.loanNumber} has been rejected. Reason: ${comments}`,
    type: "loan_status",
    relatedLoan: loan._id
  });
  return loan;
};

export const disburseLoan = async ({ loan, method, reference, userId }) => {
  if (loan.status !== "approved") throw new AppError("Only approved loans can be disbursed", 400);

  const now = new Date();
  await Installment.deleteMany({ loan: loan._id });
  const schedule = await createSchedule(loan, firstDueDateFrom(now));

  loan.disbursedAt = now;
  loan.disbursedBy = userId;
  loan.disbursementMethod = method;
  loan.disbursementReference = reference;
  loan.netDisbursed = round2(loan.approvedAmount - loan.processingFee);
  loan.monthlyInstallment = schedule[0].amount;
  transitionLoan(loan, "disbursed", { userId, comment: `Disbursed via ${method}` });
  await syncLoanFinancials(loan);

  await createNotification({
    userID: loan.applicant,
    title: "Loan Disbursed",
    message: `Rs ${loan.netDisbursed.toLocaleString()} has been disbursed for loan ${loan.loanNumber}. Your first installment is due on ${schedule[0].dueDate.toISOString().slice(0, 10)}.`,
    type: "disbursement",
    relatedLoan: loan._id
  });
  return { loan, schedule };
};

export const cancelLoan = async ({ loan, userId, reason }) => {
  loan.cancelledAt = new Date();
  transitionLoan(loan, "cancelled", { userId, comment: reason });
  await loan.save();
  await createNotification({
    userID: loan.applicant,
    title: "Loan Application Cancelled",
    message: `Loan application ${loan.loanNumber} has been cancelled.`,
    type: "loan_status",
    relatedLoan: loan._id
  });
  return loan;
};

export const getSettlementQuote = async (loan, now = new Date()) => {
  if (!ACTIVE_STATUSES.includes(loan.status)) throw new AppError("Only active loans can be settled early", 400);
  const installments = await Installment.find({ loan: loan._id, status: { $nin: SETTLED_INSTALLMENT_STATES } }).sort({ installmentNumber: 1 });
  if (!installments.length) throw new AppError("Loan has no outstanding installments", 400);

  const items = installments.map((installment) => {
    const future = new Date(installment.dueDate) > now;
    const base = future ? Math.max(0, round2(installment.principal - installment.paidAmount)) : baseOutstanding(installment);
    return {
      installment,
      future,
      base,
      lateFee: lateFeeOutstanding(installment),
      interestRebate: future ? round2(Math.max(0, baseOutstanding(installment) - base)) : 0
    };
  });

  return {
    amount: round2(items.reduce((sum, item) => sum + item.base + item.lateFee, 0)),
    interestRebate: round2(items.reduce((sum, item) => sum + item.interestRebate, 0)),
    outstandingInstallments: items.length,
    items
  };
};

export const settleLoan = async ({ loan, amount, method, reference, userId }) => {
  const quote = await getSettlementQuote(loan);
  if (amount !== undefined && Math.abs(parseNumber(amount, "amount", { min: 0.01 }) - quote.amount) > 0.01) {
    throw new AppError(`Settlement amount has changed. Current amount is ${quote.amount}`, 409);
  }

  for (const item of quote.items) {
    if (!item.future || item.interestRebate === 0) continue;
    item.installment.amount = round2(item.installment.paidAmount + item.base);
    item.installment.interest = round2(Math.max(0, item.installment.amount - item.installment.principal));
    applyState(item.installment);
    await item.installment.save();
  }

  return recordPayment({
    loan,
    amount: quote.amount,
    method,
    reference,
    notes: "Early settlement",
    receivedBy: userId,
    type: "settlement"
  });
};

export const restructureLoan = async ({ loan, tenureMonths, interestRate, waiveLateFees, userId, reason }) => {
  if (!ACTIVE_STATUSES.includes(loan.status)) throw new AppError("Only active loans can be restructured", 400);
  const months = parseNumber(tenureMonths, "tenureMonths", { min: 1, max: 120, integer: true });
  const rate = interestRate === undefined ? loan.interestRate : parseNumber(interestRate, "interestRate", { min: 0, max: 100 });

  const installments = await Installment.find({ loan: loan._id, status: { $nin: SETTLED_INSTALLMENT_STATES } }).sort({ installmentNumber: 1 });
  if (!installments.length) throw new AppError("Loan has no outstanding installments", 400);

  const now = new Date();
  let principal = 0;
  for (const installment of installments) {
    const future = new Date(installment.dueDate) > now;
    principal += future ? Math.max(0, installment.principal - installment.paidAmount) : baseOutstanding(installment);
    if (!waiveLateFees) principal += lateFeeOutstanding(installment);
  }
  principal = round2(principal);
  if (principal <= 0) throw new AppError("Nothing left to restructure", 400);

  for (const installment of installments) {
    if (installment.paidAmount > 0) {
      const ratio = installment.paidAmount / installment.amount;
      installment.principal = round2(installment.principal * ratio);
      installment.interest = round2(installment.paidAmount - installment.principal);
      installment.amount = installment.paidAmount;
      installment.lateFee = installment.lateFeePaid;
      applyState(installment, now);
    } else {
      installment.status = "restructured";
      installment.paid = false;
      installment.isOverdue = false;
    }
    await installment.save();
  }

  const last = await Installment.findOne({ loan: loan._id }).sort({ installmentNumber: -1 });
  const paidCount = await Installment.countDocuments({ loan: loan._id, status: "paid" });

  const created = await createSchedule(loan, firstDueDateFrom(now), {
    principal,
    months,
    annualRate: rate,
    startNumber: last.installmentNumber + 1
  });

  loan.interestRate = rate;
  loan.tenureMonths = Math.min(240, paidCount + months);
  loan.monthlyInstallment = created[0].amount;
  loan.restructureCount += 1;
  pushHistory(loan, { userId, comment: `Restructured over ${months} months at ${rate}%: ${reason}` });
  if (loan.status === "defaulted") transitionLoan(loan, "disbursed", { userId, comment: "Rehabilitated through restructuring" });
  await syncLoanFinancials(loan);

  await createNotification({
    userID: loan.applicant,
    title: "Loan Restructured",
    message: `Your loan ${loan.loanNumber} has been restructured. New monthly installment: Rs ${loan.monthlyInstallment.toLocaleString()} for ${months} months.`,
    type: "loan_status",
    relatedLoan: loan._id
  });
  return { loan, installments: created, rolledPrincipal: principal };
};

export const writeOffLoan = async ({ loan, userId, reason }) => {
  if (!reason) throw new AppError("A reason is required to write off a loan", 400);
  loan.writtenOffAt = new Date();
  transitionLoan(loan, "written_off", { userId, comment: reason });
  await loan.save();
  return loan;
};

export const isEligibleForDefault = (installments, now = new Date()) =>
  installments.some((installment) => !SETTLED_INSTALLMENT_STATES.includes(installment.status) && daysOverdue(installment, now) > POLICY.defaultAfterDaysOverdue);
