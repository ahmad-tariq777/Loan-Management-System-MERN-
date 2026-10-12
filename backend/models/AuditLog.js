import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  userID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    trim: true
  },
  resource: {
    type: String,
    trim: true
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  ip: {
    type: String,
    required: true
  },
  userAgent: {
    type: String
  },
  success: {
    type: Boolean,
    default: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userID: 1, timestamp: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
