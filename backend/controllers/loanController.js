import Loan from "../models/Loan.js";
import LoanProduct from "../models/LoanProduct.js";
import Applicant from "../models/Applicant.js";
import User from "../models/User.js";
import Installment from "../models/Installment.js";
import { ACTIVE_STATUSES, IN_PROGRESS_STATUSES, LOAN_TYPES } from "../config/loanConfig.js";
import { AppError } from "../utils/AppError.js";
import {
  asString,
  assertObjectId,
  buildPagination,
  cleanText,
  dateRangeFilter,
  formatId,
  getPagination,
  parseNumber,
  pickEnum,
  round2,
  searchRegex
} from "../utils/helpers.js";
import { generateApprovalLetterPDF } from "../utils/pdf/approvalLetter.js";
import { createNotification } from "../utils/notificationHelper.js";
import { nextSequence } from "../utils/sequence.js";
import { buildSchedule, firstDueDateFrom, summarizeSchedule } from "../services/loanCalculator.js";
import {
  assertLoanAccess,
  buildLoanSummary,
  computeEligibility,
  getLoanOrFail,
  getReviewChecklist,
  pushHistory,
  transitionLoan
} from "../services/loanService.js";
import {
  approveLoan,
  cancelLoan,
  disburseLoan,
  getSettlementQuote,
  rejectLoan,
  restructureLoan,
  settleLoan,
  writeOffLoan
} from "../services/lifecycleService.js";

const LOAN_STATUSES = Loan.schema.path("status").enumValues;
const SORT_FIELDS = ["createdAt", "amountRequested", "approvedAmount", "disbursedAt", "remainingBalance"];
const APPLICANT_FIELDS = "name email income liabilities repaymentHistoryScore";

const buildLoanFilter = async (query, base = {}) => {
  const filter = { ...base };
  const status = pickEnum(query.status, LOAN_STATUSES, "status");
  const loanType = pickEnum(query.loanType, LOAN_TYPES, "loanType");
  if (status) filter.status = status;
  if (loanType) filter.loanType = loanType;

  const created = dateRangeFilter(query);
  if (created) filter.createdAt = created;

  const min = asString(query.minAmount);
  const max = asString(query.maxAmount);
  if (min || max) {
    filter.amountRequested = {};
    if (min) filter.amountRequested.$gte = parseNumber(min, "minAmount", { min: 0 });
    if (max) filter.amountRequested.$lte = parseNumber(max, "maxAmount", { min: 0 });
  }

  const officer = asString(query.assignedOfficer);
  if (officer) filter.assignedOfficer = assertObjectId(officer, "assignedOfficer");

  const search = asString(query.q);
  if (search) {
    const regex = searchRegex(search);
    const users = await User.find({ $or: [{ name: regex }, { email: regex }] }).select("_id").limit(100);
    filter.$or = [{ loanNumber: regex }, { loanID: regex }, { applicant: { $in: users.map((user) => user._id) } }];
  }
  return filter;
};

const listLoans = async (req, res, base, { populateApplicant = true, defaultLimit = 20 } = {}) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit });
  const filter = await buildLoanFilter(req.query, base);
  const sortBy = SORT_FIELDS.includes(req.query.sortBy) ? req.query.sortBy : "createdAt";
  const direction = req.query.order === "asc" ? 1 : -1;

  const query = Loan.find(filter).sort({ [sortBy]: direction }).skip(skip).limit(limit).select("-approvalLetter -statusHistory");
  if (populateApplicant) {
    query.populate("applicant", APPLICANT_FIELDS).populate("approvedBy", "name email").populate("assignedOfficer", "name email");
  }
  const [total, loans] = await Promise.all([Loan.countDocuments(filter), query]);
  res.json({ loans, pagination: buildPagination(total, page, limit) });
};

export const calculateLoan = async (req, res) => {
  const amount = parseNumber(req.query.amount, "amount", { min: 1 });
  const months = parseNumber(req.query.months, "months", { min: 1, max: 240, integer: true });
  const loanType = pickEnum(req.query.loanType, LOAN_TYPES, "loanType");
  const product = loanType ? await LoanProduct.findOne({ loanType }) : null;
  const rate = req.query.rate !== undefined ? parseNumber(req.query.rate, "rate", { min: 0, max: 100 }) : product?.interestRate ?? 0;
  const feePercent = product?.processingFeePercent ?? 0;

  const schedule = buildSchedule({ principal: amount, annualRate: rate, months, firstDueDate: firstDueDateFrom(new Date()) });
  const processingFee = round2((amount * feePercent) / 100);
  res.json({
    amount,
    months,
    interestRate: rate,
    processingFee,
    netDisbursement: round2(amount - processingFee),
    ...summarizeSchedule(schedule),
    schedule
  });
};

export const applyLoan = async (req, res) => {
  const { loanType, amountRequested, tenureMonths } = req.body;
  const purpose = cleanText(req.body.purpose);
  if (typeof loanType !== "string" || !amountRequested || !purpose) {
    throw new AppError("loanType, amountRequested, and purpose are required");
  }

  const product = await LoanProduct.findOne({ loanType, isActive: true });
  if (!product) throw new AppError(`Loans of type '${loanType}' are currently unavailable`);

  const amount = parseNumber(amountRequested, "amountRequested", { min: product.minAmount, max: product.maxAmount });
  const tenure =
    tenureMonths === undefined
      ? product.defaultTenureMonths
      : parseNumber(tenureMonths, "tenureMonths", { min: product.minTenureMonths, max: product.maxTenureMonths, integer: true });
  if (purpose.length < 10 || purpose.length > 500) throw new AppError("Purpose must be between 10 and 500 characters");

  const profile = await Applicant.findOne({ userID: req.user.id });
  if (!profile) throw new AppError("Register your applicant profile before applying for a loan", 400);
  if (profile.isBlacklisted) throw new AppError("You are not eligible to apply for loans", 403);

  const [inProgress, defaulted] = await Promise.all([
    Loan.exists({ applicant: req.user.id, status: { $in: IN_PROGRESS_STATUSES } }),
    Loan.exists({ applicant: req.user.id, status: { $in: ["defaulted", "written_off"] } })
  ]);
  if (inProgress) throw new AppError("You already have an active loan application in progress", 409);
  if (defaulted) throw new AppError("You have an outstanding defaulted loan and cannot apply for a new one", 403);

  const loanNumber = formatId("AKH", await nextSequence("loanNumber"), 5);
  const guarantorRequired = product.requiresGuarantor && amount > product.guarantorThreshold;

  const loan = await Loan.create({
    applicant: req.user.id,
    loanNumber,
    loanType,
    product: product._id,
    amountRequested: amount,
    purpose,
    tenureMonths: tenure,
    remainingBalance: amount,
    interestRate: product.interestRate,
    processingFeePercent: product.processingFeePercent,
    lateFeePercent: product.lateFeePercent,
    gracePeriodDays: product.gracePeriodDays,
    guarantorRequired,
    statusHistory: [{ status: "pending", changedBy: req.user.id, comment: "Application submitted" }]
  });

  await createNotification({
    userID: req.user.id,
    title: "Loan Application Submitted",
    message: `Your loan application ${loanNumber} for Rs ${amount.toLocaleString()} has been submitted and is under review.`,
    type: "loan_status",
    relatedLoan: loan._id
  });

  res.status(201).json({
    message: "Loan application submitted successfully",
    loan,
    requirements: { guarantorRequired, documents: ["cnicFront", "cnicBack", "incomeProof"] }
  });
};

export const getMyLoans = (req, res) => listLoans(req, res, { applicant: req.user._id }, { populateApplicant: false, defaultLimit: 10 });

export const getAllLoans = (req, res) => listLoans(req, res);

export const getPendingLoans = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { status: "pending" };
  const [total, loans] = await Promise.all([
    Loan.countDocuments(filter),
    Loan.find(filter).populate("applicant", APPLICANT_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit)
  ]);

  const result = await Promise.all(
    loans.map(async (loan) => {
      const eligibility = await computeEligibility(loan);
      return { ...loan.toObject(), eligibilityScore: eligibility.eligibilityScore, loanLimit: eligibility.loanLimit, eligible: eligibility.eligible, dti: eligibility.dti };
    })
  );
  res.json({ loans: result, pagination: buildPagination(total, page, limit) });
};

export const getLoanById = async (req, res) => {
  const loan = await getLoanOrFail(req.params.loanId);
  assertLoanAccess(loan, req.user);
  await loan.populate([
    { path: "applicant", select: APPLICANT_FIELDS },
    { path: "approvedBy", select: "name email" },
    { path: "assignedOfficer", select: "name email" }
  ]);
  const summary = ACTIVE_STATUSES.includes(loan.status) || loan.status === "closed" ? await buildLoanSummary(loan) : null;
  const loanData = loan.toObject();
  delete loanData.approvalLetter;
  res.json({ ...loanData, summary });
};

export const getLoanSummary = async (req, res) => {
  const loan = await getLoanOrFail(req.params.loanId);
  assertLoanAccess(loan, req.user);
  res.json(await buildLoanSummary(loan));
};

export const getLoanChecklist = async (req, res) => {
  const loan = await getLoanOrFail(req.params.loanId);
  res.json(await getReviewChecklist(loan));
};

export const evaluateLoanEligibility = async (req, res) => {
  const loan = await getLoanOrFail(req.params.loanId);
  if (!["pending", "under_review"].includes(loan.status)) throw new AppError("Loan cannot be evaluated in its current status");

  const eligibility = await computeEligibility(loan);
  loan.eligibilityScore = eligibility.eligibilityScore;
  loan.loanLimit = eligibility.loanLimit;

  if (eligibility.eligible) {
    transitionLoan(loan, "eligible", { userId: req.user.id, comment: "Passed eligibility evaluation" });
  } else {
    pushHistory(loan, { userId: req.user.id, comment: `Eligibility evaluation did not pass: ${eligibility.reasons.join("; ")}` });
  }
  await loan.save();

  await createNotification({
    userID: loan.applicant,
    title: "Eligibility Assessment Complete",
    message: eligibility.eligible
      ? `Your loan ${loan.loanNumber} passed the eligibility assessment with a score of ${eligibility.eligibilityScore}/100.`
      : `Your loan ${loan.loanNumber} has been assessed and is awaiting an officer decision. Score: ${eligibility.eligibilityScore}/100.`,
    type: "loan_status",
    relatedLoan: loan._id
  });
  res.json({ loan, eligibility });
};

export const updateLoanStatus = async (req, res) => {
  const status = pickEnum(req.body.status, ["under_review", "approved", "rejected"], "status");
  if (!status) throw new AppError("Status must be 'under_review', 'approved' or 'rejected'");
  const comments = cleanText(req.body.officerComments);
  const loan = await getLoanOrFail(req.params.loanId);

  if (status === "under_review") {
    transitionLoan(loan, "under_review", { userId: req.user.id, comment: comments });
    if (!loan.assignedOfficer) loan.assignedOfficer = req.user.id;
    await loan.save();
    await createNotification({
      userID: loan.applicant,
      title: "Loan Under Review",
      message: `Your loan application ${loan.loanNumber} is now under review.`,
      type: "loan_status",
      relatedLoan: loan._id
    });
  } else if (status === "approved") {
    const product = await LoanProduct.findById(loan.product);
    await approveLoan({ loan, product, approver: req.user, comments, approvedAmount: req.body.approvedAmount, interestRate: req.body.interestRate });
  } else {
    await rejectLoan({ loan, rejector: req.user, comments });
  }
  res.json({ message: `Loan ${status.replace("_", " ")} successfully`, loan });
};

export const disburse = async (req, res) => {
  const loan = await getLoanOrFail(req.params.loanId);
  const method = pickEnum(req.body.method, ["cash", "bank_transfer", "cheque", "online", "mobile_wallet"], "method") || "cash";
  const reference = req.body.reference ? cleanText(String(req.body.reference)).slice(0, 100) : undefined;
  const { schedule } = await disburseLoan({ loan, method, reference, userId: req.user.id });
  res.json({ message: "Loan disbursed successfully", loan, firstInstallment: schedule[0], installmentCount: schedule.length });
};

export const cancel = async (req, res) => {
  const loan = await getLoanOrFail(req.params.loanId);
  assertLoanAccess(loan, req.user);
  const reason = cleanText(req.body.reason);
  await cancelLoan({ loan, userId: req.user.id, reason: reason || "Cancelled" });
  res.json({ message: "Loan application cancelled", loan });
};

export const assignOfficer = async (req, res) => {
  const loan = await getLoanOrFail(req.params.loanId);
  const officer = await User.findOne({ _id: assertObjectId(req.body.officerId, "officer ID"), role: { $in: ["officer", "admin"] }, isActive: true });
  if (!officer) throw new AppError("Active officer not found", 404);
  loan.assignedOfficer = officer._id;
  pushHistory(loan, { userId: req.user.id, comment: `Assigned to ${officer.name}` });
  await loan.save();
  res.json({ message: "Officer assigned", loan });
};

export const settlementQuote = async (req, res) => {
  const loan = await getLoanOrFail(req.params.loanId);
  assertLoanAccess(loan, req.user);
  const quote = await getSettlementQuote(loan);
  res.json({ loanNumber: loan.loanNumber, amount: quote.amount, interestRebate: quote.interestRebate, outstandingInstallments: quote.outstandingInstallments });
};

export const settle = async (req, res) => {
  const loan = await getLoanOrFail(req.params.loanId);
  const method = pickEnum(req.body.method, ["cash", "bank_transfer", "cheque", "online", "mobile_wallet"], "method") || "cash";
  const payment = await settleLoan({ loan, amount: req.body.amount, method, reference: req.body.reference, userId: req.user.id });
  res.status(201).json({ message: "Loan settled successfully", payment, loanStatus: (await getLoanOrFail(loan.id)).status });
};

export const restructure = async (req, res) => {
  const loan = await getLoanOrFail(req.params.loanId);
  const reason = cleanText(req.body.reason);
  if (!reason) throw new AppError("A reason is required to restructure a loan");
  const result = await restructureLoan({
    loan,
    tenureMonths: req.body.tenureMonths,
    interestRate: req.body.interestRate,
    waiveLateFees: req.body.waiveLateFees === true,
    userId: req.user.id,
    reason
  });
  res.json({ message: "Loan restructured successfully", loan: result.loan, rolledPrincipal: result.rolledPrincipal, newInstallments: result.installments.length });
};

export const writeOff = async (req, res) => {
  const loan = await getLoanOrFail(req.params.loanId);
  await writeOffLoan({ loan, userId: req.user.id, reason: cleanText(req.body.reason) });
  res.json({ message: "Loan written off", loan });
};

export const downloadApprovalLetter = async (req, res) => {
  const loan = await getLoanOrFail(req.params.loanId);
  assertLoanAccess(loan, req.user);
  if (!loan.approvalLetter) throw new AppError("Approval letter not generated yet");

  const applicant = await User.findById(loan.applicant).select("name");
  const pdf = await generateApprovalLetterPDF(loan, applicant?.name || "Applicant");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${loan.loanID}_ApprovalLetter.pdf"`);
  res.send(pdf);
};

export const getLoanStats = async (req, res) => {
  const [byStatus, byType, totals, overdue] = await Promise.all([
    Loan.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 }, totalRequested: { $sum: "$amountRequested" }, totalApproved: { $sum: { $ifNull: ["$approvedAmount", 0] } }, avgRequested: { $avg: "$amountRequested" } } }
    ]),
    Loan.aggregate([{ $group: { _id: "$loanType", count: { $sum: 1 }, totalRequested: { $sum: "$amountRequested" } } }]),
    Loan.aggregate([
      { $match: { status: { $in: ACTIVE_STATUSES } } },
      { $group: { _id: null, loans: { $sum: 1 }, outstanding: { $sum: "$remainingBalance" }, disbursed: { $sum: "$approvedAmount" } } }
    ]),
    Installment.countDocuments({ status: { $in: ["pending", "partial", "overdue"] }, dueDate: { $lt: new Date() } })
  ]);

  res.json({
    byStatus,
    byType,
    totalLoans: byStatus.reduce((sum, row) => sum + row.count, 0),
    totalApprovedAmount: byStatus.filter((row) => ["approved", "disbursed", "closed", "defaulted"].includes(row._id)).reduce((sum, row) => sum + row.totalApproved, 0),
    activePortfolio: totals[0] || { loans: 0, outstanding: 0, disbursed: 0 },
    overdueInstallments: overdue
  });
};
