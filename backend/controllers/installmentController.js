import Installment from "../models/Installment.js";
import Loan from "../models/Loan.js";
import Applicant from "../models/Applicant.js";
import { SETTLED_INSTALLMENT_STATES } from "../config/loanConfig.js";
import { AppError } from "../utils/AppError.js";
import { assertObjectId, buildPagination, cleanText, getPagination, parseNumber, pickEnum, round2 } from "../utils/helpers.js";
import { sendCsv, toCsv } from "../utils/csv.js";
import { createNotification } from "../utils/notificationHelper.js";
import { baseOutstanding, daysOverdue, lateFeeOutstanding, totalOutstanding } from "../services/installmentService.js";
import { assertLoanAccess, getLoanOrFail, syncLoanFinancials } from "../services/loanService.js";
import { recordPayment } from "../services/paymentService.js";

const INSTALLMENT_STATUSES = ["pending", "partial", "paid", "overdue", "restructured"];

const present = (installment, now = new Date()) => {
  const data = installment.toObject ? installment.toObject() : installment;
  return {
    ...data,
    baseOutstanding: baseOutstanding(installment),
    lateFeeOutstanding: lateFeeOutstanding(installment),
    totalOutstanding: totalOutstanding(installment),
    daysOverdue: SETTLED_INSTALLMENT_STATES.includes(installment.status) ? 0 : daysOverdue(installment, now)
  };
};

export const getMyInstallments = async (req, res) => {
  const loans = await Loan.find({ applicant: req.user.id }).select("_id");
  if (!loans.length) return res.json({ installments: [] });

  const filter = { loan: { $in: loans.map((loan) => loan._id) }, status: { $ne: "restructured" } };
  const status = pickEnum(req.query.status, INSTALLMENT_STATUSES, "status");
  if (status) filter.status = status;

  const installments = await Installment.find(filter).populate("loan", "loanNumber loanType status").sort({ dueDate: 1 });
  res.json({ installments: installments.map((installment) => present(installment)) });
};

export const getUpcomingInstallments = async (req, res) => {
  const days = parseNumber(req.query.days ?? 30, "days", { min: 1, max: 365, integer: true });
  const limit = new Date(Date.now() + days * 86400000);
  const loans = await Loan.find({ applicant: req.user.id, status: { $in: ["disbursed", "defaulted"] } }).select("_id");

  const installments = await Installment.find({
    loan: { $in: loans.map((loan) => loan._id) },
    status: { $nin: SETTLED_INSTALLMENT_STATES },
    dueDate: { $lte: limit }
  })
    .populate("loan", "loanNumber loanType")
    .sort({ dueDate: 1 });

  const items = installments.map((installment) => present(installment));
  res.json({ count: items.length, totalDue: round2(items.reduce((sum, item) => sum + item.totalOutstanding, 0)), installments: items });
};

export const getLoanInstallments = async (req, res) => {
  const loan = await getLoanOrFail(req.params.loanId);
  assertLoanAccess(loan, req.user);

  const installments = await Installment.find({ loan: loan._id }).sort({ installmentNumber: 1 });
  const live = installments.filter((installment) => installment.status !== "restructured");
  const items = installments.map((installment) => present(installment));
  res.json({
    installments: items,
    summary: {
      total: live.length,
      paid: live.filter((installment) => installment.status === "paid").length,
      overdue: live.filter((installment) => installment.status === "overdue").length,
      remaining: live.filter((installment) => installment.status !== "paid").length,
      outstandingBalance: round2(live.reduce((sum, installment) => sum + baseOutstanding(installment), 0)),
      outstandingLateFees: round2(live.reduce((sum, installment) => sum + lateFeeOutstanding(installment), 0))
    }
  });
};

export const payInstallment = async (req, res) => {
  assertObjectId(req.params.id, "installment ID");
  const installment = await Installment.findById(req.params.id);
  if (!installment) throw new AppError("Installment not found", 404);
  if (installment.status === "paid") throw new AppError("Installment already paid");
  if (installment.status === "restructured") throw new AppError("Installment was restructured and cannot be paid");

  const loan = await Loan.findById(installment.loan);
  const amount = req.body.amount ?? totalOutstanding(installment);
  const payment = await recordPayment({
    loan,
    amount,
    method: req.body.method,
    reference: req.body.reference,
    notes: req.body.notes,
    receivedBy: req.user.id,
    installmentId: installment.id
  });

  const updated = await Installment.findById(installment.id);
  res.json({ message: "Payment recorded", installment: present(updated), payment, remainingBalance: (await Loan.findById(loan.id)).remainingBalance });
};

export const getOverdueInstallments = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const minDays = parseNumber(req.query.minDays ?? 1, "minDays", { min: 0, integer: true });
  const cutoff = new Date(Date.now() - minDays * 86400000);
  const filter = { status: { $nin: SETTLED_INSTALLMENT_STATES }, dueDate: { $lt: cutoff } };

  const [total, installments] = await Promise.all([
    Installment.countDocuments(filter),
    Installment.find(filter)
      .populate("loan", "loanNumber loanType status assignedOfficer")
      .populate("applicant", "name email")
      .sort({ dueDate: 1 })
      .skip(skip)
      .limit(limit)
  ]);

  const profiles = await Applicant.find({ userID: { $in: installments.map((installment) => installment.applicant?._id) } }).select("userID phone altPhone");
  const phones = new Map(profiles.map((profile) => [profile.userID.toString(), { phone: profile.phone, altPhone: profile.altPhone }]));

  const items = installments.map((installment) => ({
    ...present(installment),
    contact: phones.get(installment.applicant?._id?.toString()) || null
  }));
  res.json({ count: total, installments: items, pagination: buildPagination(total, page, limit) });
};

export const waiveLateFee = async (req, res) => {
  assertObjectId(req.params.id, "installment ID");
  const reason = cleanText(req.body.reason);
  if (!reason) throw new AppError("A reason is required to waive a late fee");

  const installment = await Installment.findById(req.params.id);
  if (!installment) throw new AppError("Installment not found", 404);
  if (lateFeeOutstanding(installment) <= 0) throw new AppError("This installment has no outstanding late fee");

  const waived = lateFeeOutstanding(installment);
  installment.lateFee = installment.lateFeePaid;
  installment.lateFeeWaived = true;
  installment.lateFeeWaivedBy = req.user.id;
  installment.lateFeeWaiverReason = reason;
  await installment.save();

  const loan = await Loan.findById(installment.loan);
  await syncLoanFinancials(loan);
  await createNotification({
    userID: installment.applicant,
    title: "Late Fee Waived",
    message: `A late fee of Rs ${waived.toLocaleString()} on installment #${installment.installmentNumber} of loan ${loan.loanNumber} has been waived.`,
    type: "payment_received",
    relatedLoan: loan._id
  });
  res.json({ message: "Late fee waived", waivedAmount: waived, installment: present(installment) });
};

export const exportSchedule = async (req, res) => {
  const loan = await getLoanOrFail(req.params.loanId);
  assertLoanAccess(loan, req.user);
  const installments = await Installment.find({ loan: loan._id, status: { $ne: "restructured" } }).sort({ installmentNumber: 1 });

  const csv = toCsv(installments, [
    { label: "Installment", value: (row) => row.installmentNumber },
    { label: "Due Date", value: (row) => row.dueDate.toISOString().slice(0, 10) },
    { label: "Amount", value: (row) => row.amount },
    { label: "Principal", value: (row) => row.principal },
    { label: "Interest", value: (row) => row.interest },
    { label: "Paid", value: (row) => row.paidAmount },
    { label: "Late Fee", value: (row) => row.lateFee },
    { label: "Status", value: (row) => row.status }
  ]);
  sendCsv(res, `${loan.loanNumber}_schedule.csv`, csv);
};
