import Loan from "../models/Loan.js";
import Payment from "../models/Payment.js";
import Installment from "../models/Installment.js";
import { ACTIVE_STATUSES, LOAN_TYPES } from "../config/loanConfig.js";
import { dateRangeFilter, pickEnum, round2 } from "../utils/helpers.js";
import { sendCsv, toCsv } from "../utils/csv.js";

const MS_PER_DAY = 86400000;

const periodFormat = (query) => (query.groupBy === "day" ? "%Y-%m-%d" : "%Y-%m");

export const getAgingReport = async (now = new Date()) => {
  const rows = await Installment.aggregate([
    { $match: { status: { $nin: ["paid", "restructured"] }, dueDate: { $lt: now } } },
    { $lookup: { from: "loans", localField: "loan", foreignField: "_id", as: "loanDoc" } },
    { $unwind: "$loanDoc" },
    { $match: { "loanDoc.status": { $in: ACTIVE_STATUSES } } },
    {
      $project: {
        loan: 1,
        outstanding: { $subtract: ["$amount", "$paidAmount"] },
        days: { $floor: { $divide: [{ $subtract: [now, "$dueDate"] }, MS_PER_DAY] } }
      }
    },
    {
      $group: {
        _id: {
          $switch: {
            branches: [
              { case: { $lte: ["$days", 30] }, then: "1-30" },
              { case: { $lte: ["$days", 60] }, then: "31-60" },
              { case: { $lte: ["$days", 90] }, then: "61-90" }
            ],
            default: "90+"
          }
        },
        installments: { $sum: 1 },
        amount: { $sum: "$outstanding" },
        loans: { $addToSet: "$loan" }
      }
    },
    { $project: { bucket: "$_id", _id: 0, installments: 1, amount: { $round: ["$amount", 2] }, loans: { $size: "$loans" } } }
  ]);

  const order = ["1-30", "31-60", "61-90", "90+"];
  return order.map((bucket) => rows.find((row) => row.bucket === bucket) || { bucket, installments: 0, amount: 0, loans: 0 });
};

export const portfolioReport = async (req, res) => {
  const now = new Date();
  const [disbursed, active, collected, statuses, aging, due] = await Promise.all([
    Loan.aggregate([
      { $match: { disbursedAt: { $exists: true } } },
      { $group: { _id: null, loans: { $sum: 1 }, amount: { $sum: "$approvedAmount" }, net: { $sum: "$netDisbursed" }, fees: { $sum: "$processingFee" } } }
    ]),
    Loan.aggregate([
      { $match: { status: { $in: ACTIVE_STATUSES } } },
      { $group: { _id: null, loans: { $sum: 1 }, outstanding: { $sum: "$remainingBalance" } } }
    ]),
    Payment.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, payments: { $sum: 1 }, amount: { $sum: "$amount" }, principal: { $sum: "$breakdown.principal" }, interest: { $sum: "$breakdown.interest" }, lateFees: { $sum: "$breakdown.lateFee" } } }
    ]),
    Loan.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    getAgingReport(now),
    Installment.aggregate([
      { $match: { status: { $ne: "restructured" }, dueDate: { $lt: now } } },
      { $group: { _id: null, due: { $sum: "$amount" }, paid: { $sum: "$paidAmount" } } }
    ])
  ]);

  const outstanding = active[0]?.outstanding || 0;
  const atRisk = aging.reduce((sum, bucket) => sum + bucket.amount, 0);
  const dueToDate = due[0]?.due || 0;

  res.json({
    generatedAt: now,
    disbursed: disbursed[0] || { loans: 0, amount: 0, net: 0, fees: 0 },
    activePortfolio: active[0] || { loans: 0, outstanding: 0 },
    collections: collected[0] || { payments: 0, amount: 0, principal: 0, interest: 0, lateFees: 0 },
    statusBreakdown: statuses.map((row) => ({ status: row._id, count: row.count })),
    portfolioAtRisk: { amount: round2(atRisk), ratioPercent: outstanding > 0 ? round2((atRisk / outstanding) * 100) : 0, aging },
    collectionRatePercent: dueToDate > 0 ? round2(((due[0]?.paid || 0) / dueToDate) * 100) : 100
  });
};

export const agingReport = async (req, res) => {
  res.json({ generatedAt: new Date(), buckets: await getAgingReport() });
};

export const collectionsReport = async (req, res) => {
  const match = { status: "completed" };
  const range = dateRangeFilter(req.query);
  if (range) match.paidAt = range;

  const rows = await Payment.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: periodFormat(req.query), date: "$paidAt" } },
        payments: { $sum: 1 },
        amount: { $sum: "$amount" },
        principal: { $sum: "$breakdown.principal" },
        interest: { $sum: "$breakdown.interest" },
        lateFees: { $sum: "$breakdown.lateFee" }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const byMethod = await Payment.aggregate([
    { $match: match },
    { $group: { _id: "$method", payments: { $sum: 1 }, amount: { $sum: "$amount" } } }
  ]);

  res.json({
    periods: rows.map((row) => ({ period: row._id, ...row, _id: undefined })),
    byMethod: byMethod.map((row) => ({ method: row._id, payments: row.payments, amount: row.amount })),
    total: round2(rows.reduce((sum, row) => sum + row.amount, 0))
  });
};

export const disbursementsReport = async (req, res) => {
  const match = { disbursedAt: { $exists: true } };
  const range = dateRangeFilter(req.query);
  if (range) match.disbursedAt = { ...range, $exists: true };

  const rows = await Loan.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: periodFormat(req.query), date: "$disbursedAt" } },
        loans: { $sum: 1 },
        amount: { $sum: "$approvedAmount" },
        netDisbursed: { $sum: "$netDisbursed" },
        processingFees: { $sum: "$processingFee" }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  res.json({ periods: rows.map((row) => ({ period: row._id, ...row, _id: undefined })) });
};

export const loanTypeReport = async (req, res) => {
  const rows = await Loan.aggregate([
    {
      $group: {
        _id: "$loanType",
        applications: { $sum: 1 },
        approved: { $sum: { $cond: [{ $in: ["$status", ["approved", "disbursed", "closed", "defaulted", "written_off"]] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
        defaulted: { $sum: { $cond: [{ $in: ["$status", ["defaulted", "written_off"]] }, 1, 0] } },
        requestedAmount: { $sum: "$amountRequested" },
        approvedAmount: { $sum: { $ifNull: ["$approvedAmount", 0] } }
      }
    }
  ]);

  const types = LOAN_TYPES.map((type) => {
    const row = rows.find((item) => item._id === type) || {};
    const decided = (row.approved || 0) + (row.rejected || 0);
    return {
      loanType: type,
      applications: row.applications || 0,
      approved: row.approved || 0,
      rejected: row.rejected || 0,
      defaulted: row.defaulted || 0,
      requestedAmount: row.requestedAmount || 0,
      approvedAmount: row.approvedAmount || 0,
      approvalRatePercent: decided > 0 ? round2((row.approved / decided) * 100) : 0
    };
  });
  res.json({ types });
};

export const officerReport = async (req, res) => {
  const rows = await Loan.aggregate([
    { $match: { approvedBy: { $exists: true } } },
    {
      $group: {
        _id: "$approvedBy",
        decisions: { $sum: 1 },
        approved: { $sum: { $cond: [{ $ne: ["$status", "rejected"] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
        approvedAmount: { $sum: { $ifNull: ["$approvedAmount", 0] } }
      }
    },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "officer" } },
    { $unwind: "$officer" },
    { $project: { _id: 0, officerId: "$_id", name: "$officer.name", email: "$officer.email", decisions: 1, approved: 1, rejected: 1, approvedAmount: 1 } },
    { $sort: { decisions: -1 } }
  ]);

  const collections = await Payment.aggregate([
    { $match: { status: "completed" } },
    { $group: { _id: "$receivedBy", payments: { $sum: 1 }, amount: { $sum: "$amount" } } }
  ]);
  const collected = new Map(collections.map((row) => [row._id.toString(), row]));

  res.json({
    officers: rows.map((row) => ({
      ...row,
      paymentsReceived: collected.get(row.officerId.toString())?.payments || 0,
      amountCollected: collected.get(row.officerId.toString())?.amount || 0
    }))
  });
};

export const exportLoans = async (req, res) => {
  const filter = {};
  const status = pickEnum(req.query.status, Loan.schema.path("status").enumValues, "status");
  if (status) filter.status = status;
  const range = dateRangeFilter(req.query);
  if (range) filter.createdAt = range;

  const loans = await Loan.find(filter).populate("applicant", "name email").sort({ createdAt: -1 }).limit(5000);
  const csv = toCsv(loans, [
    { label: "Loan Number", value: (loan) => loan.loanNumber },
    { label: "Loan ID", value: (loan) => loan.loanID },
    { label: "Applicant", value: (loan) => loan.applicant?.name },
    { label: "Email", value: (loan) => loan.applicant?.email },
    { label: "Type", value: (loan) => loan.loanType },
    { label: "Status", value: (loan) => loan.status },
    { label: "Requested", value: (loan) => loan.amountRequested },
    { label: "Approved", value: (loan) => loan.approvedAmount },
    { label: "Tenure (months)", value: (loan) => loan.tenureMonths },
    { label: "Interest Rate", value: (loan) => loan.interestRate },
    { label: "Remaining Balance", value: (loan) => loan.remainingBalance },
    { label: "Applied On", value: (loan) => loan.createdAt },
    { label: "Disbursed On", value: (loan) => loan.disbursedAt }
  ]);
  sendCsv(res, "loans.csv", csv);
};

export const exportPayments = async (req, res) => {
  const filter = {};
  const range = dateRangeFilter(req.query);
  if (range) filter.paidAt = range;

  const payments = await Payment.find(filter).populate("loan", "loanNumber").populate("applicant", "name").sort({ paidAt: -1 }).limit(5000);
  const csv = toCsv(payments, [
    { label: "Receipt", value: (payment) => payment.receiptNumber },
    { label: "Loan Number", value: (payment) => payment.loan?.loanNumber },
    { label: "Applicant", value: (payment) => payment.applicant?.name },
    { label: "Amount", value: (payment) => payment.amount },
    { label: "Principal", value: (payment) => payment.breakdown?.principal },
    { label: "Interest", value: (payment) => payment.breakdown?.interest },
    { label: "Late Fee", value: (payment) => payment.breakdown?.lateFee },
    { label: "Method", value: (payment) => payment.method },
    { label: "Reference", value: (payment) => payment.reference },
    { label: "Status", value: (payment) => payment.status },
    { label: "Paid At", value: (payment) => payment.paidAt }
  ]);
  sendCsv(res, "payments.csv", csv);
};
