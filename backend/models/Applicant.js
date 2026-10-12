import mongoose from "mongoose";

const applicantSchema = new mongoose.Schema(
  {
    userID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },
    applicantID: {
      type: String,
      unique: true,
      index: true
    },
    cnic: {
      type: String,
      required: true,
      unique: true,
      match: [/^[0-9]{13}$/, "CNIC must be 13 digits"]
    },
    cnicIssueDate: {
      type: Date,
      required: true
    },
    cnicExpiryDate: {
      type: Date,
      required: true
    },
    cnicFront: {
      type: String,
      required: true
    },
    cnicBack: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true,
      match: [/^03[0-9]{9}$/, "Invalid Pakistani phone number format"]
    },
    altPhone: {
      type: String,
      match: [/^03[0-9]{9}$/, "Invalid Pakistani phone number format"]
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    city: {
      type: String,
      trim: true
    },
    province: {
      type: String,
      trim: true
    },
    occupation: {
      type: String,
      trim: true
    },
    monthlyIncome: {
      type: Number,
      min: 0,
      default: 0
    },
    dependents: {
      type: Number,
      min: 0,
      default: 0
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true
    },
    verificationRemarks: {
      type: String,
      trim: true,
      maxlength: 500
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    verifiedAt: Date,
    isBlacklisted: {
      type: Boolean,
      default: false,
      index: true
    },
    blacklistReason: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  { timestamps: true }
);

export default mongoose.model("Applicant", applicantSchema);
