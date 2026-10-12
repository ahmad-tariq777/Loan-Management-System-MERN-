import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan",
      required: true,
      index: true
    },
    applicantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
    incomeProof: {
      type: String,
      required: true
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true
    },
    officerComments: {
      type: String,
      maxlength: 1000,
      trim: true
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    verifiedAt: Date
  },
  { timestamps: true }
);

export default mongoose.model("Document", documentSchema);
