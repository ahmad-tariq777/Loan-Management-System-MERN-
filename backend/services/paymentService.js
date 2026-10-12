import Installment from "../models/Installment.js";
import Payment from "../models/Payment.js";
import Loan from "../models/Loan.js";
import { ACTIVE_STATUSES, PAYMENT_METHODS, POLICY, SETTLED_INSTALLMENT_STATES } from "../config/loanConfig.js";
import { AppError } from "../utils/AppError.js";
import { EPSILON, assertObjectId, cleanText, formatId, parseNumber, round2 } from "../utils/helpers.js";
import { createNotification } from "../utils/notificationHelper.js";
import { nextSequence } from "../utils/sequence.js";
import { allocatePayment, applyState, totalOutstanding } from "./installmentService.js";
import { adjustRepaymentScore, pushHistory, syncLoanFinancials } from "./loanService.js";

const MS_PER_DAY = 86400000;

export const recordPayment = async ({ loan, amount, method = "cash", reference, notes, receivedBy, installmentId, type = "installment" }) => {
  if (!ACTIVE_STATUSES.includes(loan.status)) {
    throw new AppError("Payments can only be recorded against disbursed loans", 400);
  }
  if (!PAYMENT_METHODS.includes(method)) throw new AppError(`Invalid payment method. Allowed: ${PAYMENT_METHODS.join(", ")}`, 400);
  const value = round2(parseNumber(amount, "amount", { min: 0.01 }));

  const filter = { loan: loan._id, status: { $nin: SETTLED_INSTALLMENT_STATES } };
  if (installmentId) filter._id = assertObjectId(installmentId, "installment ID");
  const installments = await Installment.find(filter).sort({ installmentNumber: 1 });
  if (!installments.length) throw new AppError("No outstanding installments found for this payment", 400);

  const due = round2(installments.reduce((sum, installment) => sum + totalOutstanding(installment), 0));
  if (value > due + EPSILON) throw new AppError(`Amount exceeds the outstanding due of ${due}`, 400);

  const now = new Date();
  const { allocations } = allocatePayment(installments, value, now);

  let scoreDelta = 0;
  for (const installment of installments) {
    if (installment.status === "paid") {
      installment.paidBy = receivedBy;
      const deadline = new Date(installment.dueDate).getTime() + loan.gracePeriodDays * MS_PER_DAY;
      scoreDelta += now.getTime() <= deadline ? POLICY.onTimeScoreBonus : -POLICY.lateScorePenalty;
    }
  }
  await Promise.all(installments.map((installment) => installment.save()));

  const breakdown = allocations.reduce(
    (total, allocation) => ({
      principal: round2(total.principal + allocation.principal),
      interest: round2(total.interest + allocation.interest),
      lateFee: round2(total.lateFee + allocation.lateFee)
    }),
    { principal: 0, interest: 0, lateFee: 0 }
  );

  const payment = await Payment.create({
    receiptNumber: formatId("RCP", await nextSequence("receipt"), 6),
    loan: loan._id,
    applicant: loan.applicant,
    amount: value,
    type,
    method,
    reference: reference ? cleanText(String(reference)).slice(0, 100) : undefined,
    notes: notes ? cleanText(String(notes)).slice(0, 500) : undefined,
    allocations,
    breakdown,
    receivedBy,
    paidAt: now
  });

  await adjustRepaymentScore(loan.applicant, scoreDelta);
  await syncLoanFinancials(loan);
  await createNotification({
    userID: loan.applicant,
    title: "Payment Received",
    message: `We received Rs ${value.toLocaleString()} towards loan ${loan.loanNumber}. Receipt: ${payment.receiptNumber}.`,
    type: "payment_received",
    relatedLoan: loan._id
  });

  return payment;
};

export const reversePayment = async ({ payment, reason, userId }) => {
  if (payment.status === "reversed") throw new AppError("Payment has already been reversed", 400);
  if (payment.type === "settlement") throw new AppError("Settlement payments cannot be reversed", 400);

  const loan = await Loan.findById(payment.loan);
  if (!loan) throw new AppError("Loan not found", 404);
  if (loan.status === "written_off") throw new AppError("Payments on written-off loans cannot be reversed", 400);

  const installments = await Installment.find({ _id: { $in: payment.allocations.map((allocation) => allocation.installment) } });
  const byId = new Map(installments.map((installment) => [installment._id.toString(), installment]));
  const now = new Date();

  for (const allocation of payment.allocations) {
    const installment = byId.get(allocation.installment.toString());
    if (!installment) continue;
    installment.lateFeePaid = round2(Math.max(0, installment.lateFeePaid - allocation.lateFee));
    installment.paidAmount = round2(Math.max(0, installment.paidAmount - allocation.principal - allocation.interest));
    installment.paidBy = undefined;
    applyState(installment, now);
    await installment.save();
  }

  payment.status = "reversed";
  payment.reversedAt = now;
  payment.reversedBy = userId;
  payment.reversalReason = reason;
  await payment.save();

  if (loan.status === "closed") {
    loan.status = "disbursed";
    loan.closedAt = undefined;
  }
  pushHistory(loan, { userId, comment: `Payment ${payment.receiptNumber} reversed: ${reason}` });
  await syncLoanFinancials(loan);

  await createNotification({
    userID: loan.applicant,
    title: "Payment Reversed",
    message: `Payment ${payment.receiptNumber} for loan ${loan.loanNumber} was reversed. Reason: ${reason}`,
    type: "payment_received",
    relatedLoan: loan._id
  });

  return payment;
};
