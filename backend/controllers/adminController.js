import bcrypt from "bcryptjs";
import validator from "validator";
import User from "../models/User.js";
import Loan from "../models/Loan.js";
import Applicant from "../models/Applicant.js";
import AuditLog from "../models/AuditLog.js";
import Document from "../models/Document.js";
import Installment from "../models/Installment.js";
import Payment from "../models/Payment.js";
import { ACTIVE_STATUSES } from "../config/loanConfig.js";
import { AppError } from "../utils/AppError.js";
import { asString, assertObjectId, buildPagination, cleanText, dateRangeFilter, getPagination, parseNumber, pickEnum, round2, searchRegex } from "../utils/helpers.js";
import { generateOfficerEmail, generateSecurePassword } from "../utils/passwordGenerator.js";
import { runDailyJobs } from "../services/schedulerService.js";

const SAFE_USER_FIELDS = "-password -refreshTokens";

const findUserOrFail = async (userId) => {
  assertObjectId(userId, "user ID");
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found", 404);
  return user;
};

export const createOfficer = async (req, res) => {
  const name = cleanText(req.body.name);
  if (!name) throw new AppError("Name is required");
  if (name.length < 2 || name.length > 100) throw new AppError("Name must be between 2 and 100 characters");

  let email;
  if (req.body.email) {
    email = String(req.body.email).trim().toLowerCase();
    if (!validator.isEmail(email)) throw new AppError("Invalid email address");
    if (await User.exists({ email })) throw new AppError("A user with this email already exists", 409);
  } else {
    do {
      email = generateOfficerEmail(name);
    } while (await User.exists({ email }));
  }

  const password = generateSecurePassword();
  const officer = await User.create({ name, email, password: await bcrypt.hash(password, 12), role: "officer", loginAttempts: 0, isLocked: false, isActive: true });

  res.status(201).json({
    message: "Officer created successfully",
    officer: { id: officer._id, name: officer.name, email, role: "officer" },
    credentials: { email, password }
  });
};

export const getAllOfficers = async (req, res) => {
  const officers = await User.find({ role: "officer" }).select(SAFE_USER_FIELDS).sort({ createdAt: -1 });
  const stats = await Loan.aggregate([
    { $match: { assignedOfficer: { $in: officers.map((officer) => officer._id) } } },
    { $group: { _id: "$assignedOfficer", assignedLoans: { $sum: 1 } } }
  ]);
  const counts = new Map(stats.map((row) => [row._id.toString(), row.assignedLoans]));
  res.json(officers.map((officer) => ({ ...officer.toObject(), assignedLoans: counts.get(officer.id) || 0 })));
};

export const listUsers = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  const role = pickEnum(req.query.role, ["applicant", "officer", "admin"], "role");
  if (role) filter.role = role;
  if (req.query.isActive === "true" || req.query.isActive === "false") filter.isActive = req.query.isActive === "true";
  if (req.query.isLocked === "true") filter.isLocked = true;
  const search = asString(req.query.q);
  if (search) {
    const regex = searchRegex(search);
    filter.$or = [{ name: regex }, { email: regex }];
  }

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).select(SAFE_USER_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit)
  ]);
  res.json({ users, pagination: buildPagination(total, page, limit) });
};

export const getUserDetail = async (req, res) => {
  const user = await findUserOrFail(req.params.userId);
  const [profile, loans] = await Promise.all([
    Applicant.findOne({ userID: user._id }),
    Loan.find({ applicant: user._id }).select("loanNumber loanType status amountRequested approvedAmount remainingBalance createdAt").sort({ createdAt: -1 })
  ]);
  const safeUser = user.toObject();
  delete safeUser.password;
  delete safeUser.refreshTokens;
  res.json({ user: safeUser, applicantProfile: profile, loans });
};

export const updateOfficer = async (req, res) => {
  const officer = await findUserOrFail(req.params.userId);
  if (officer.role !== "officer") throw new AppError("Only officer accounts can be edited here");

  if (req.body.name !== undefined) {
    const name = cleanText(req.body.name);
    if (name.length < 2 || name.length > 100) throw new AppError("Name must be between 2 and 100 characters");
    officer.name = name;
  }
  if (req.body.email !== undefined) {
    const email = String(req.body.email).trim().toLowerCase();
    if (!validator.isEmail(email)) throw new AppError("Invalid email address");
    if (await User.exists({ email, _id: { $ne: officer._id } })) throw new AppError("A user with this email already exists", 409);
    officer.email = email;
  }
  await officer.save();
  res.json({ message: "Officer updated", officer: { id: officer.id, name: officer.name, email: officer.email } });
};

export const resetOfficerPassword = async (req, res) => {
  const officer = await User.findById(assertObjectId(req.params.userId, "user ID")).select("+refreshTokens");
  if (!officer) throw new AppError("User not found", 404);
  if (officer.role !== "officer") throw new AppError("Only officer passwords can be reset here");

  const password = generateSecurePassword();
  officer.password = await bcrypt.hash(password, 12);
  officer.refreshTokens = [];
  officer.loginAttempts = 0;
  officer.isLocked = false;
  officer.lockedAt = null;
  await officer.save();
  res.json({ message: "Password reset. All active sessions were revoked.", credentials: { email: officer.email, password } });
};

export const toggleUserStatus = async (req, res) => {
  const action = pickEnum(req.body.action, ["activate", "deactivate", "unlock"], "action");
  if (!action) throw new AppError("Invalid action. Use: activate, deactivate, unlock");
  const user = await findUserOrFail(req.params.userId);
  if (user.id === req.user.id) throw new AppError("You cannot modify your own account status");

  if (action === "activate") user.isActive = true;
  if (action === "deactivate") user.isActive = false;
  if (action === "unlock") {
    user.isLocked = false;
    user.loginAttempts = 0;
    user.lockedAt = null;
  }
  await user.save();

  const past = { activate: "activated", deactivate: "deactivated", unlock: "unlocked" }[action];
  res.json({ message: `User ${past} successfully`, user: { id: user.id, name: user.name, isActive: user.isActive, isLocked: user.isLocked } });
};

export const getAuditLogs = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 50 });
  const filter = {};
  if (req.query.userId) filter.userID = assertObjectId(req.query.userId, "userId");
  const action = asString(req.query.action);
  if (action) filter.action = action;
  if (req.query.success === "true" || req.query.success === "false") filter.success = req.query.success === "true";
  const range = dateRangeFilter(req.query);
  if (range) filter.timestamp = range;

  const [total, logs] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter).populate("userID", "name email role").sort({ timestamp: -1 }).skip(skip).limit(limit)
  ]);
  res.json({ logs, pagination: buildPagination(total, page, limit) });
};

export const getDashboardStats = async (req, res) => {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const [usersByRole, totalLoans, loansByStatus, recentLoans, portfolio, collectedThisMonth, overdueInstallments, pendingDocuments, newApplications, awaitingDisbursement] = await Promise.all([
    User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
    Loan.countDocuments(),
    Loan.aggregate([{ $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: "$amountRequested" } } }]),
    Loan.find().populate("applicant", "name").sort({ createdAt: -1 }).limit(5).select("loanNumber status amountRequested createdAt applicant"),
    Loan.aggregate([
      { $match: { status: { $in: ACTIVE_STATUSES } } },
      { $group: { _id: null, loans: { $sum: 1 }, outstanding: { $sum: "$remainingBalance" } } }
    ]),
    Payment.aggregate([
      { $match: { status: "completed", paidAt: { $gte: monthStart } } },
      { $group: { _id: null, amount: { $sum: "$amount" }, payments: { $sum: 1 } } }
    ]),
    Installment.countDocuments({ status: { $in: ["pending", "partial", "overdue"] }, dueDate: { $lt: now } }),
    Document.countDocuments({ verificationStatus: "pending" }),
    Loan.countDocuments({ createdAt: { $gte: weekAgo } }),
    Loan.countDocuments({ status: "approved" })
  ]);

  res.json({
    totalUsers: usersByRole.reduce((sum, row) => sum + row.count, 0),
    usersByRole: usersByRole.map((row) => ({ role: row._id, count: row.count })),
    totalLoans,
    loansByStatus,
    recentLoans,
    activePortfolio: portfolio[0] || { loans: 0, outstanding: 0 },
    collectedThisMonth: collectedThisMonth[0] || { amount: 0, payments: 0 },
    overdueInstallments,
    pendingDocuments,
    newApplicationsThisWeek: newApplications,
    awaitingDisbursement
  });
};

export const updateUserFinancials = async (req, res) => {
  const { income, liabilities, repaymentHistoryScore } = req.body;
  const updates = {};
  if (income !== undefined) updates.income = parseNumber(income, "income", { min: 0 });
  if (liabilities !== undefined) updates.liabilities = parseNumber(liabilities, "liabilities", { min: 0 });
  if (repaymentHistoryScore !== undefined) updates.repaymentHistoryScore = round2(parseNumber(repaymentHistoryScore, "repaymentHistoryScore", { min: 0, max: 100 }));
  if (!Object.keys(updates).length) throw new AppError("Provide at least one of income, liabilities, repaymentHistoryScore");

  const user = await User.findByIdAndUpdate(assertObjectId(req.params.userId, "user ID"), updates, { new: true, runValidators: true }).select(SAFE_USER_FIELDS);
  if (!user) throw new AppError("User not found", 404);
  res.json({ message: "Financial profile updated", user });
};

export const runSchedulerNow = async (req, res) => {
  const totals = await runDailyJobs();
  res.json({ message: "Scheduler run complete", totals });
};
