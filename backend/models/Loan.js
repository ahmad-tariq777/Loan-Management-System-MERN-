import mongoose from "mongoose";
import { LOAN_TYPES, PAYMENT_METHODS } from "../config/loanConfig.js";

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    comment: { type: String, maxlength: 1000 },
    changedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const loanSchema = new mongoose.Schema(
  {
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    loanNumber: { type: String, unique: true, required: true },
    loanID: { type: String, unique: true, sparse: true },
    loanType: { type: String, required: true, enum: LOAN_TYPES },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "LoanProduct" },
    amountRequested: { type: Number, required: true, min: [1, "Amount must be positive"] },
    purpose: { type: String, required: true, maxlength: 500, trim: true },
    status: {
      type: String,
      enum: ["pending", "under_review", "eligible", "approved", "rejected", "disbursed", "closed", "defaulted", "written_off", "cancelled"],
      default: "pending",
      index: true
    },
    statusHistory: { type: [statusHistorySchema], default: [] },
    eligibilityScore: { type: Number, min: 0, max: 100 },
    loanLimit: { type: Number, min: 0 },
    guarantorRequired: { type: Boolean, default: false },
    assignedOfficer: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    officerComments: { type: String, maxlength: 1000, trim: true },
    approvalLetter: String,
    approvedAmount: { type: Number, min: 0 },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    rejectedAt: Date,
    cancelledAt: Date,
    tenureMonths: { type: Number, default: 12, min: 1, max: 240 },
    interestRate: { type: Number, default: 0, min: 0 },
    processingFeePercent: { type: Number, default: 0, min: 0 },
    processingFee: { type: Number, default: 0, min: 0 },
    lateFeePercent: { type: Number, default: 0, min: 0 },
    gracePeriodDays: { type: Number, default: 0, min: 0 },
    monthlyInstallment: { type: Number, default: 0, min: 0 },
    totalInterest: { type: Number, default: 0, min: 0 },
    totalPayable: { type: Number, default: 0, min: 0 },
    remainingBalance: { type: Number, default: 0, min: 0 },
    disbursedAt: Date,
    disbursedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    disbursementMethod: { type: String, enum: PAYMENT_METHODS },
    disbursementReference: { type: String, trim: true, maxlength: 100 },
    netDisbursed: { type: Number, min: 0 },
    closedAt: Date,
    writtenOffAt: Date,
    restructureCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

loanSchema.index({ applicant: 1, status: 1 });
loanSchema.index({ createdAt: -1 });
loanSchema.index({ disbursedAt: -1 });

export default mongoose.model("Loan", loanSchema);
