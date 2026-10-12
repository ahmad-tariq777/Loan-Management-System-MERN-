import mongoose from "mongoose";
import { PAYMENT_METHODS } from "../config/loanConfig.js";

const allocationSchema = new mongoose.Schema(
  {
    installment: { type: mongoose.Schema.Types.ObjectId, ref: "Installment", required: true },
    installmentNumber: Number,
    principal: { type: Number, default: 0 },
    interest: { type: Number, default: 0 },
    lateFee: { type: Number, default: 0 },
    amount: { type: Number, default: 0 }
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    receiptNumber: { type: String, required: true, unique: true },
    loan: { type: mongoose.Schema.Types.ObjectId, ref: "Loan", required: true, index: true },
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    type: { type: String, enum: ["installment", "settlement"], default: "installment" },
    method: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    reference: { type: String, trim: true, maxlength: 100 },
    notes: { type: String, trim: true, maxlength: 500 },
    allocations: { type: [allocationSchema], default: [] },
    breakdown: {
      principal: { type: Number, default: 0 },
      interest: { type: Number, default: 0 },
      lateFee: { type: Number, default: 0 }
    },
    status: { type: String, enum: ["completed", "reversed"], default: "completed", index: true },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    paidAt: { type: Date, default: Date.now, index: true },
    reversedAt: Date,
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reversalReason: { type: String, maxlength: 500 }
  },
  { timestamps: true }
);

paymentSchema.index({ loan: 1, paidAt: -1 });

export default mongoose.model("Payment", paymentSchema);
