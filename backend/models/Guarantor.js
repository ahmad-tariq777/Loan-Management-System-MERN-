import mongoose from "mongoose";

const guarantorSchema = new mongoose.Schema(
  {
    loan: { type: mongoose.Schema.Types.ObjectId, ref: "Loan", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    cnic: { type: String, required: true, match: [/^[0-9]{13}$/, "CNIC must be 13 digits"] },
    phone: { type: String, required: true, match: [/^03[0-9]{9}$/, "Invalid Pakistani phone number format"] },
    address: { type: String, required: true, trim: true, maxlength: 500 },
    relationship: { type: String, required: true, trim: true, maxlength: 50 },
    occupation: { type: String, trim: true, maxlength: 100 },
    monthlyIncome: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ["pending", "verified", "rejected"], default: "pending", index: true },
    remarks: { type: String, trim: true, maxlength: 500 },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    verifiedAt: Date
  },
  { timestamps: true }
);

guarantorSchema.index({ loan: 1, cnic: 1 }, { unique: true });

export default mongoose.model("Guarantor", guarantorSchema);
