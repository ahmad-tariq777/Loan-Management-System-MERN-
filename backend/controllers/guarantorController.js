import Guarantor from "../models/Guarantor.js";
import { AppError } from "../utils/AppError.js";
import { assertObjectId, cleanText, parseNumber } from "../utils/helpers.js";
import { createNotification } from "../utils/notificationHelper.js";
import { assertLoanAccess, getLoanOrFail } from "../services/loanService.js";

const EDITABLE_STATUSES = ["pending", "under_review", "eligible"];
const TEXT_FIELDS = ["name", "address", "relationship", "occupation"];

const getGuarantorOrFail = async (id) => {
  assertObjectId(id, "guarantor ID");
  const guarantor = await Guarantor.findById(id);
  if (!guarantor) throw new AppError("Guarantor not found", 404);
  return guarantor;
};

const assertEditable = (loan, user) => {
  assertLoanAccess(loan, user);
  if (user.role === "applicant" && !EDITABLE_STATUSES.includes(loan.status)) {
    throw new AppError("Guarantors can only be changed while the application is in progress");
  }
};

const readPayload = (body) => {
  const data = {};
  for (const field of TEXT_FIELDS) if (body[field] !== undefined) data[field] = cleanText(body[field]);
  if (body.cnic !== undefined) data.cnic = String(body.cnic);
  if (body.phone !== undefined) data.phone = String(body.phone);
  if (body.monthlyIncome !== undefined) data.monthlyIncome = parseNumber(body.monthlyIncome, "monthlyIncome", { min: 0 });
  return data;
};

export const addGuarantor = async (req, res) => {
  const loan = await getLoanOrFail(req.params.loanId);
  assertEditable(loan, req.user);

  const count = await Guarantor.countDocuments({ loan: loan._id });
  if (count >= 3) throw new AppError("A loan can have at most 3 guarantors");

  const guarantor = await Guarantor.create({ ...readPayload(req.body), loan: loan._id });
  res.status(201).json({ message: "Guarantor added", guarantor });
};

export const getLoanGuarantors = async (req, res) => {
  const loan = await getLoanOrFail(req.params.loanId);
  assertLoanAccess(loan, req.user);
  const guarantors = await Guarantor.find({ loan: loan._id }).sort({ createdAt: 1 });
  res.json({ guarantorRequired: loan.guarantorRequired, guarantors });
};

export const updateGuarantor = async (req, res) => {
  const guarantor = await getGuarantorOrFail(req.params.id);
  const loan = await getLoanOrFail(guarantor.loan.toString());
  assertEditable(loan, req.user);

  Object.assign(guarantor, readPayload(req.body));
  guarantor.status = "pending";
  guarantor.verifiedBy = undefined;
  guarantor.verifiedAt = undefined;
  await guarantor.save();
  res.json({ message: "Guarantor updated", guarantor });
};

export const verifyGuarantor = async (req, res) => {
  const guarantor = await getGuarantorOrFail(req.params.id);
  const status = req.body.status;
  if (!["verified", "rejected"].includes(status)) throw new AppError("status must be 'verified' or 'rejected'");
  const remarks = cleanText(req.body.remarks);
  if (status === "rejected" && !remarks) throw new AppError("Remarks are required when rejecting a guarantor");

  guarantor.status = status;
  guarantor.remarks = remarks;
  guarantor.verifiedBy = req.user.id;
  guarantor.verifiedAt = new Date();
  await guarantor.save();

  const loan = await getLoanOrFail(guarantor.loan.toString());
  await createNotification({
    userID: loan.applicant,
    title: "Guarantor Update",
    message: `Guarantor ${guarantor.name} for loan ${loan.loanNumber} was ${status}.`,
    type: "guarantor",
    relatedLoan: loan._id
  });
  res.json({ message: `Guarantor ${status}`, guarantor });
};

export const removeGuarantor = async (req, res) => {
  const guarantor = await getGuarantorOrFail(req.params.id);
  const loan = await getLoanOrFail(guarantor.loan.toString());
  assertEditable(loan, req.user);
  await guarantor.deleteOne();
  res.json({ message: "Guarantor removed" });
};
