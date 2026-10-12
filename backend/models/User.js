import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
      minlength: [8, "Password must be at least 8 characters"],
    },
    role: {
      type: String,
      enum: ["applicant", "officer", "admin"],
      default: "applicant",
    },
    income: {
      type: Number,
      default: 0,
      min: 0,
    },
    liabilities: {
      type: Number,
      default: 0,
      min: 0,
    },
    repaymentHistoryScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    refreshTokens: {
      type: [String],
      select: false,
      default: [],
    },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });

export default mongoose.model("User", userSchema);