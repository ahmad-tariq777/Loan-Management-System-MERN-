import Applicant from "../models/Applicant.js";
import Loan from "../models/Loan.js";
import { AppError } from "../utils/AppError.js";
import { asString, buildPagination, cleanText, getPagination, parseNumber, pickEnum, searchRegex } from "../utils/helpers.js";
import { generateApplicantID } from "../utils/generateApplicantID.js";
import { createNotification } from "../utils/notificationHelper.js";

const PHONE_PATTERN = /^03[0-9]{9}$/;
const APPLICANT_ID_PATTERN = /^APP-[0-9]+$/;

const findByApplicantId = async (id) => {
  if (!APPLICANT_ID_PATTERN.test(id || "")) throw new AppError("Invalid applicant ID format");
  const applicant = await Applicant.findOne({ applicantID: id });
  if (!applicant) throw new AppError("Applicant not found", 404);
  return applicant;
};

export const registerApplicant = async (req, res) => {
  const userID = req.user.id;
  if (await Applicant.exists({ userID })) throw new AppError("Applicant profile already registered", 409);

  const { cnic, cnicIssueDate, cnicExpiryDate, cnicFront, cnicBack, phone, altPhone, address, city, province, occupation, monthlyIncome, dependents } = req.body;
  if (!cnic || !cnicIssueDate || !cnicExpiryDate || !cnicFront || !cnicBack || !phone || !address) {
    throw new AppError("Required fields missing");
  }
  if (!/^[0-9]{13}$/.test(cnic)) throw new AppError("CNIC must be exactly 13 digits");
  if (!PHONE_PATTERN.test(phone)) throw new AppError("Phone must be a valid Pakistani number (03xxxxxxxxx)");
  if (altPhone && !PHONE_PATTERN.test(altPhone)) throw new AppError("Alternate phone must be a valid Pakistani number");

  const issueDate = new Date(cnicIssueDate);
  const expiryDate = new Date(cnicExpiryDate);
  if (Number.isNaN(issueDate.getTime()) || Number.isNaN(expiryDate.getTime())) throw new AppError("Invalid CNIC dates");
  if (expiryDate <= issueDate) throw new AppError("CNIC expiry date must be after issue date");
  if (expiryDate <= new Date()) throw new AppError("CNIC is expired");
  if (await Applicant.exists({ cnic })) throw new AppError("This CNIC is already registered", 409);

  const applicant = await Applicant.create({
    userID,
    applicantID: await generateApplicantID(),
    cnic,
    cnicIssueDate: issueDate,
    cnicExpiryDate: expiryDate,
    cnicFront: cleanText(cnicFront),
    cnicBack: cleanText(cnicBack),
    phone,
    altPhone: altPhone || undefined,
    address: cleanText(address),
    city: city ? cleanText(city) : undefined,
    province: province ? cleanText(province) : undefined,
    occupation: occupation ? cleanText(occupation) : undefined,
    monthlyIncome: monthlyIncome ? parseNumber(monthlyIncome, "monthlyIncome", { min: 0 }) : 0,
    dependents: dependents ? parseNumber(dependents, "dependents", { min: 0, integer: true }) : 0
  });

  res.status(201).json({ message: "Applicant registered successfully", applicant });
};

export const getMyApplicantProfile = async (req, res) => {
  const applicant = await Applicant.findOne({ userID: req.user.id }).populate("userID", "name email role createdAt");
  if (!applicant) throw new AppError("Applicant profile not found", 404);
  res.json(applicant);
};

export const getApplicantByID = async (req, res) => {
  const applicant = await findByApplicantId(req.params.id);
  await applicant.populate("userID", "name email role createdAt income liabilities repaymentHistoryScore");
  res.json(applicant);
};

export const getAllApplicants = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { maxLimit: 50 });
  const filter = {};
  const verification = pickEnum(req.query.verificationStatus, ["pending", "verified", "rejected"], "verificationStatus");
  if (verification) filter.verificationStatus = verification;
  if (req.query.blacklisted === "true") filter.isBlacklisted = true;
  const city = asString(req.query.city);
  if (city) filter.city = searchRegex(city);

  const search = asString(req.query.q);
  if (search) {
    const regex = searchRegex(search);
    filter.$or = [{ applicantID: regex }, { cnic: regex }, { phone: regex }, { occupation: regex }];
  }

  const [total, applicants] = await Promise.all([
    Applicant.countDocuments(filter),
    Applicant.find(filter).populate("userID", "name email createdAt").sort({ createdAt: -1 }).skip(skip).limit(limit)
  ]);
  res.json({ applicants, pagination: buildPagination(total, page, limit) });
};

export const updateApplicant = async (req, res) => {
  const applicant = await findByApplicantId(req.params.id);
  if (req.user.role === "applicant" && applicant.userID.toString() !== req.user.id) throw new AppError("Access denied", 403);

  const updates = {};
  for (const field of ["phone", "altPhone", "address", "city", "province", "occupation"]) {
    if (req.body[field] === undefined) continue;
    if ((field === "phone" || field === "altPhone") && req.body[field] && !PHONE_PATTERN.test(req.body[field])) {
      throw new AppError(`Invalid ${field === "phone" ? "phone" : "alternate phone"} format`);
    }
    updates[field] = cleanText(String(req.body[field]));
  }
  if (req.body.monthlyIncome !== undefined) updates.monthlyIncome = parseNumber(req.body.monthlyIncome, "monthlyIncome", { min: 0 });
  if (req.body.dependents !== undefined) updates.dependents = parseNumber(req.body.dependents, "dependents", { min: 0, integer: true });

  Object.assign(applicant, updates);
  await applicant.save();
  res.json({ message: "Profile updated successfully", applicant });
};

export const verifyApplicant = async (req, res) => {
  const applicant = await findByApplicantId(req.params.id);
  const status = pickEnum(req.body.status, ["verified", "rejected"], "status");
  if (!status) throw new AppError("status must be 'verified' or 'rejected'");
  const remarks = cleanText(req.body.remarks);
  if (status === "rejected" && !remarks) throw new AppError("Remarks are required when rejecting a profile");

  applicant.verificationStatus = status;
  applicant.verificationRemarks = remarks;
  applicant.verifiedBy = req.user.id;
  applicant.verifiedAt = new Date();
  await applicant.save();

  await createNotification({
    userID: applicant.userID,
    title: "Profile Verification",
    message: status === "verified" ? "Your applicant profile has been verified." : `Your applicant profile was rejected. Reason: ${remarks}`,
    type: "account"
  });
  res.json({ message: `Applicant ${status}`, applicant });
};

export const setBlacklist = async (req, res) => {
  const applicant = await findByApplicantId(req.params.id);
  if (typeof req.body.blacklisted !== "boolean") throw new AppError("blacklisted must be a boolean");
  const reason = cleanText(req.body.reason);
  if (req.body.blacklisted && !reason) throw new AppError("A reason is required to blacklist an applicant");

  applicant.isBlacklisted = req.body.blacklisted;
  applicant.blacklistReason = req.body.blacklisted ? reason : undefined;
  await applicant.save();
  res.json({ message: req.body.blacklisted ? "Applicant blacklisted" : "Applicant removed from blacklist", applicant });
};

export const getApplicantLoans = async (req, res) => {
  const applicant = await findByApplicantId(req.params.id);
  const loans = await Loan.find({ applicant: applicant.userID }).select("-approvalLetter -statusHistory").sort({ createdAt: -1 });

  const active = loans.filter((loan) => ["disbursed", "defaulted"].includes(loan.status));
  res.json({
    applicantID: applicant.applicantID,
    loans,
    summary: {
      totalLoans: loans.length,
      activeLoans: active.length,
      closedLoans: loans.filter((loan) => loan.status === "closed").length,
      defaultedLoans: loans.filter((loan) => ["defaulted", "written_off"].includes(loan.status)).length,
      outstandingBalance: active.reduce((sum, loan) => sum + loan.remainingBalance, 0)
    }
  });
};
