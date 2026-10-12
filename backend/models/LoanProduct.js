import mongoose from "mongoose";
import { LOAN_TYPES } from "../config/loanConfig.js";

const loanProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    loanType: { type: String, enum: LOAN_TYPES, required: true, unique: true },
    description: { type: String, trim: true, maxlength: 500 },
    minAmount: { type: Number, required: true, min: 1 },
    maxAmount: { type: Number, required: true, min: 1 },
    minTenureMonths: { type: Number, required: true, min: 1, max: 120 },
    maxTenureMonths: { type: Number, required: true, min: 1, max: 120 },
    defaultTenureMonths: { type: Number, required: true, min: 1, max: 120 },
    interestRate: { type: Number, default: 0, min: 0, max: 100 },
    processingFeePercent: { type: Number, default: 0, min: 0, max: 25 },
    lateFeePercent: { type: Number, default: 0, min: 0, max: 25 },
    gracePeriodDays: { type: Number, default: 0, min: 0, max: 60 },
    requiresGuarantor: { type: Boolean, default: false },
    guarantorThreshold: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

loanProductSchema.pre("validate", function () {
  if (this.minAmount > this.maxAmount) this.invalidate("minAmount", "minAmount cannot exceed maxAmount");
  if (this.minTenureMonths > this.maxTenureMonths) this.invalidate("minTenureMonths", "minTenureMonths cannot exceed maxTenureMonths");
  if (this.defaultTenureMonths < this.minTenureMonths || this.defaultTenureMonths > this.maxTenureMonths) {
    this.invalidate("defaultTenureMonths", "defaultTenureMonths must lie within the tenure range");
  }
});

export default mongoose.model("LoanProduct", loanProductSchema);
