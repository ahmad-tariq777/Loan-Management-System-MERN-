import Payment from "../models/Payment.js";
import Installment from "../models/Installment.js";
import User from "../models/User.js";
import { PAYMENT_METHODS } from "../config/loanConfig.js";
import { AppError } from "../utils/AppError.js";
import { assertObjectId, buildPagination, cleanText, dateRangeFilter, getPagination, pickEnum, searchRegex, asString } from "../utils/helpers.js";
import { streamReceipt } from "../utils/pdf/receipt.js";
import { streamStatement } from "../utils/pdf/statement.js";
import { assertLoanAccess, buildLoanSummary, getLoanOrFail } from "../services/loanService.js";
import { recordPayment, reversePayment } from "../services/paymentService.js";

const getPaymentOrFail = async (id) => {
  assertObjectId(id, "payment ID");
  const payment = await Payment.findById(id);
  if (!payment) throw new AppError("Payment not found", 404);
  return payment;
};

const assertPaymentAccess = (payment, user) => {
  if (user.role === "applicant" && payment.applicant.toString() !== user.id) throw new AppError("Access denied", 403);
};

export const createPayment = async (req, res) => {
  const loan = await getLoanOrFail(req.body.loanId);
  const payment = await recordPayment({
    loan,
    amount: req.body.amount,
    method: req.body.method,
    reference: req.body.reference,
    notes: req.body.notes,
    receivedBy: req.user.id,
    installmentId: req.body.installmentId
  });
  res.status(201).json({ message: "Payment recorded successfully", payment, remainingBalance: (await getLoanOrFail(loan.id)).remainingBalance });
};

const listPayments = async (req, res, base) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { ...base };
  const method = pickEnum(req.query.method, PAYMENT_METHODS, "method");
  const status = pickEnum(req.query.status, ["completed", "reversed"], "status");
  if (method) filter.method = method;
  if (status) filter.status = status;
  if (req.query.loanId) filter.loan = assertObjectId(req.query.loanId, "loanId");
  if (req.query.applicantId && !base.applicant) filter.applicant = assertObjectId(req.query.applicantId, "applicantId");
  const range = dateRangeFilter(req.query);
  if (range) filter.paidAt = range;

  const search = asString(req.query.q);
  if (search) {
    const regex = searchRegex(search);
    filter.$or = [{ receiptNumber: regex }, { reference: regex }];
  }

  const [total, payments, totals] = await Promise.all([
    Payment.countDocuments(filter),
    Payment.find(filter)
      .populate("loan", "loanNumber loanType")
      .populate("applicant", "name email")
      .populate("receivedBy", "name")
      .sort({ paidAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.aggregate([{ $match: { ...filter, status: "completed" } }, { $group: { _id: null, amount: { $sum: "$amount" } } }])
  ]);

  res.json({ payments, totalCollected: totals[0]?.amount || 0, pagination: buildPagination(total, page, limit) });
};

export const getAllPayments = (req, res) => listPayments(req, res, {});

export const getMyPayments = (req, res) => listPayments(req, res, { applicant: req.user._id });

export const getPaymentById = async (req, res) => {
  const payment = await getPaymentOrFail(req.params.id);
  assertPaymentAccess(payment, req.user);
  await payment.populate([
    { path: "loan", select: "loanNumber loanType" },
    { path: "applicant", select: "name email" },
    { path: "receivedBy", select: "name" }
  ]);
  res.json(payment);
};

export const downloadReceipt = async (req, res) => {
  const payment = await getPaymentOrFail(req.params.id);
  assertPaymentAccess(payment, req.user);
  const [loan, applicant, receiver] = await Promise.all([
    getLoanOrFail(payment.loan.toString()),
    User.findById(payment.applicant).select("name"),
    User.findById(payment.receivedBy).select("name")
  ]);
  streamReceipt(res, { payment, loan, applicantName: applicant?.name || "-", receiverName: receiver?.name || "-" });
};

export const downloadStatement = async (req, res) => {
  const loan = await getLoanOrFail(req.params.loanId);
  assertLoanAccess(loan, req.user);
  if (!loan.disbursedAt) throw new AppError("A statement is only available for disbursed loans");

  const [installments, payments, applicant, summary] = await Promise.all([
    Installment.find({ loan: loan._id, status: { $ne: "restructured" } }).sort({ installmentNumber: 1 }),
    Payment.find({ loan: loan._id }).sort({ paidAt: 1 }),
    User.findById(loan.applicant).select("name"),
    buildLoanSummary(loan)
  ]);
  streamStatement(res, { loan, applicantName: applicant?.name || "-", installments, payments, summary });
};

export const reverse = async (req, res) => {
  const payment = await getPaymentOrFail(req.params.id);
  const reason = cleanText(req.body.reason);
  if (!reason) throw new AppError("A reason is required to reverse a payment");
  await reversePayment({ payment, reason, userId: req.user.id });
  res.json({ message: "Payment reversed", payment });
};
