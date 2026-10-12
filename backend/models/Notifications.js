import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  userID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  type: {
    type: String,
    enum: ["loan_status", "payment_due", "payment_received", "payment_overdue", "disbursement", "document_update", "guarantor", "announcement", "system", "account"],
    required: true
  },
  relatedLoan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Loan"
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: Date
}, { timestamps: true });

notificationSchema.index({ userID: 1, read: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
