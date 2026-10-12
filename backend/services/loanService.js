import Loan from "../models/Loan.js";
import Installment from "../models/Installment.js";
import User from "../models/User.js";
import Applicant from "../models/Applicant.js";
import Document from "../models/Document.js";
import Guarantor from "../models/Guarantor.js";
import LoanProduct from "../models/LoanProduct.js";
import { ACTIVE_STATUSES, POLICY, STATUS_TRANSITIONS } from "../config/loanConfig.js";
import { AppError } from "../utils/AppError.js";
import { EPSILON, assertObjectId, round2 } from "../utils/helpers.js";
import { evaluateEligibility } from "../utils/eligibilityEngine.js";
import { createNotification } from "../utils/notificationHelper.js";
import { baseOutstanding, daysOverdue, isSettled, lateFeeOutstanding, totalOutstanding } from "./installmentService.js";
import { maxPrincipalForEmi } from "./loanCalculator.js";

export const getLoanOrFail = async (loanId) => {
  assertObjectId(loanId, "loan ID");
  const loan = await Loan.findById(loanId);
  if (!loan) throw new AppError("Loan not found", 404);
  return loan;
};

export const ownerIdOf = (loan) => (loan.applicant?._id || loan.applicant).toString();

export const assertLoanAccess = (loan, user) => {
  if (user.role === "applicant" && ownerIdOf(loan) !== user.id) throw new AppError("Access denied", 403);
};

export const pushHistory = (loan, { status, userId, comment }) => {
  loan.statusHistory.push({ status: status || loan.status, changedBy: userId, comment: comment || undefined, changedAt: new Date() });
};

export const transitionLoan = (loan, status, { userId, comment } = {}) => {
  const allowed = STATUS_TRANSITIONS[loan.status] || [];
  if (!allowed.includes(status)) throw new AppError(`Loan cannot move from '${loan.status}' to '${status}'`, 400);
  loan.status = status;
  pushHistory(loan, { status, userId, comment });
};

export const adjustRepaymentScore = async (userId, delta) => {
  if (!delta) return;
  await User.updateOne({ _id: userId }, [
    { $set: { repaymentHistoryScore: { $min: [100, { $max: [0, { $add: ["$repaymentHistoryScore", delta] }] }] } } }
  ]);
};

export const syncLoanFinancials = async (loan) => {
  const installments = await Installment.find({ loan: loan._id });
  const live = installments.filter((installment) => installment.status !== "restructured");
  const now = new Date();

  loan.remainingBalance = round2(live.reduce((sum, installment) => sum + baseOutstanding(installment), 0));
  loan.totalPayable = round2(live.reduce((sum, installment) => sum + installment.amount, 0));
  loan.totalInterest = round2(live.reduce((sum, installment) => sum + installment.interest, 0));

  const fullySettled = live.length > 0 && live.every((installment) => totalOutstanding(installment) <= EPSILON);

  if (fullySettled && ACTIVE_STATUSES.includes(loan.status)) {
    transitionLoan(loan, "closed", { comment: "All installments settled" });
    loan.closedAt = now;
    await adjustRepaymentScore(loan.applicant, POLICY.closureScoreBonus);
    await createNotification({
      userID: loan.applicant,
      title: "Loan Fully Repaid",
      message: `Your loan ${loan.loanNumber} has been fully repaid and closed. Thank you!`,
      type: "loan_status",
      relatedLoan: loan._id
    });
  } else if (loan.status === "defaulted") {
    const stillDefaulted = live.some(
      (installment) => !isSettled(installment) && daysOverdue(installment, now) > POLICY.defaultAfterDaysOverdue
    );
    if (!stillDefaulted) transitionLoan(loan, "disbursed", { comment: "Overdue installments cleared" });
  }

  await loan.save();
  return loan;
};

export const buildLoanSummary = async (loan) => {
  const installments = await Installment.find({ loan: loan._id }).sort({ installmentNumber: 1 });
  const live = installments.filter((installment) => installment.status !== "restructured");
  const now = new Date();
  const unsettled = live.filter((installment) => !isSettled(installment));
  const overdue = unsettled.filter((installment) => new Date(installment.dueDate) < now);
  const nextDue = unsettled.find((installment) => new Date(installment.dueDate) >= now) || unsettled[0] || null;
  const totalPaid = round2(live.reduce((sum, installment) => sum + installment.paidAmount + installment.lateFeePaid, 0));

  return {
    totalInstallments: live.length,
    paidInstallments: live.filter((installment) => installment.status === "paid").length,
    overdueInstallments: overdue.length,
    overdueAmount: round2(overdue.reduce((sum, installment) => sum + totalOutstanding(installment), 0)),
    outstandingBalance: round2(live.reduce((sum, installment) => sum + baseOutstanding(installment), 0)),
    outstandingLateFees: round2(live.reduce((sum, installment) => sum + lateFeeOutstanding(installment), 0)),
    totalPaid,
    progressPercent: loan.totalPayable > 0 ? round2((totalPaid / loan.totalPayable) * 100) : 0,
    nextDue: nextDue
      ? { installmentNumber: nextDue.installmentNumber, dueDate: nextDue.dueDate, amountDue: totalOutstanding(nextDue) }
      : null
  };
};

export const computeEligibility = async (loan) => {
  const [user, profile, product, obligations, defaultedLoans, closedLoans] = await Promise.all([
    User.findById(loan.applicant).select("income liabilities repaymentHistoryScore"),
    Applicant.findOne({ userID: loan.applicant }).select("monthlyIncome"),
    LoanProduct.findOne({ loanType: loan.loanType }),
    Loan.aggregate([
      { $match: { applicant: loan.applicant, status: { $in: ACTIVE_STATUSES }, _id: { $ne: loan._id } } },
      { $group: { _id: null, total: { $sum: "$monthlyInstallment" } } }
    ]),
    Loan.countDocuments({ applicant: loan.applicant, status: { $in: ["defaulted", "written_off"] } }),
    Loan.countDocuments({ applicant: loan.applicant, status: "closed" })
  ]);
  if (!user) throw new AppError("Applicant account not found", 404);

  const income = user.income > 0 ? user.income : profile?.monthlyIncome || 0;
  const repaymentHistoryScore = user.repaymentHistoryScore || 0;
  const result = evaluateEligibility(
    { income, liabilities: user.liabilities, repaymentHistoryScore },
    {
      monthlyObligations: obligations[0]?.total || 0,
      defaultedLoans,
      hasRepaymentHistory: repaymentHistoryScore > 0 || closedLoans > 0
    }
  );
  const rate = loan.interestRate ?? product?.interestRate ?? 0;
  const affordableLimit = Math.floor(maxPrincipalForEmi(result.maxMonthlyInstallment, rate, loan.tenureMonths) / 1000) * 1000;
  const loanLimit = Math.min(result.loanLimit, affordableLimit, product?.maxAmount ?? Infinity);

  const reasons = [...result.reasons];
  let eligible = result.eligible;
  if (eligible && product && loanLimit < product.minAmount) {
    eligible = false;
    reasons.push("Monthly income does not support the minimum loan amount for this product");
  }

  return {
    ...result,
    income,
    eligible,
    reasons,
    loanLimit: eligible ? Math.min(loanLimit, loan.amountRequested) : 0,
    maxEligibleAmount: eligible ? loanLimit : 0
  };
};

export const getReviewChecklist = async (loan) => {
  const [applicant, document, guarantors] = await Promise.all([
    Applicant.findOne({ userID: loan.applicant }),
    Document.findOne({ loanId: loan._id }),
    Guarantor.find({ loan: loan._id })
  ]);

  const items = {
    applicantProfileExists: Boolean(applicant),
    applicantVerified: applicant?.verificationStatus === "verified",
    applicantNotBlacklisted: Boolean(applicant) && !applicant.isBlacklisted,
    documentsVerified: document?.verificationStatus === "verified",
    guarantorVerified: !loan.guarantorRequired || guarantors.some((guarantor) => guarantor.status === "verified")
  };

  const labels = {
    applicantProfileExists: "Applicant profile must be registered",
    applicantVerified: "Applicant profile must be verified",
    applicantNotBlacklisted: "Applicant must not be blacklisted",
    documentsVerified: "Loan documents must be verified",
    guarantorVerified: "At least one guarantor must be verified"
  };

  const missing = Object.entries(items).filter(([, passed]) => !passed).map(([key]) => labels[key]);
  return { items, ready: missing.length === 0, missing };
};
