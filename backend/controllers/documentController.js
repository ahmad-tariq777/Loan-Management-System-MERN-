import Document from "../models/Document.js";
import Loan from "../models/Loan.js";
import StoredFile from "../models/StoredFile.js";
import mongoose from "mongoose";
import { AppError } from "../utils/AppError.js";
import { assertObjectId, buildPagination, cleanText, getPagination, pickEnum } from "../utils/helpers.js";
import { createNotification } from "../utils/notificationHelper.js";
import { assertLoanAccess, getLoanOrFail } from "../services/loanService.js";

const DOCUMENT_FIELDS = ["cnicFront", "cnicBack", "incomeProof"];

const removeFiles = (ids) => {
  const valid = ids.filter((id) => id && mongoose.isValidObjectId(id));
  if (valid.length) return StoredFile.deleteMany({ _id: { $in: valid } }).catch(() => {});
};

export const uploadDocuments = async (req, res) => {
  const loan = await getLoanOrFail(req.body.loanId);
  if (loan.applicant.toString() !== req.user.id) throw new AppError("Access denied: You do not own this loan", 403);
  if (!["pending", "under_review"].includes(loan.status)) {
    throw new AppError("Documents can only be uploaded for pending or under review loans");
  }
  if (DOCUMENT_FIELDS.some((field) => !req.files?.[field])) throw new AppError("cnicFront, cnicBack, and incomeProof files are required");

  const saved = await StoredFile.insertMany(
    DOCUMENT_FIELDS.map((field) => {
      const file = req.files[field][0];
      return { data: file.buffer, contentType: file.mimetype, originalName: file.originalname, size: file.size, owner: req.user.id };
    })
  );
  const references = Object.fromEntries(DOCUMENT_FIELDS.map((field, index) => [field, saved[index]._id.toString()]));

  try {
    const existing = await Document.findOne({ loanId: loan._id });
    if (existing) {
      const previous = DOCUMENT_FIELDS.map((field) => existing[field]);
      Object.assign(existing, references, { verificationStatus: "pending", officerComments: "", verifiedBy: undefined, verifiedAt: undefined });
      await existing.save();
      await removeFiles(previous);
      return res.json({ message: "Documents updated successfully", document: existing });
    }

    const document = await Document.create({ loanId: loan._id, applicantId: req.user.id, ...references, verificationStatus: "pending" });
    res.status(201).json({ message: "Documents uploaded successfully", document });
  } catch (err) {
    await removeFiles(Object.values(references));
    throw err;
  }
};

export const getDocumentsByLoan = async (req, res) => {
  const loan = await getLoanOrFail(req.params.loanId);
  assertLoanAccess(loan, req.user);
  const document = await Document.findOne({ loanId: loan._id }).populate("applicantId", "name email").populate("verifiedBy", "name email");
  if (!document) throw new AppError("No documents found for this loan", 404);
  res.json(document);
};

export const downloadDocumentFile = async (req, res) => {
  assertObjectId(req.params.id, "document ID");
  const field = pickEnum(req.params.type, DOCUMENT_FIELDS, "document type");
  const document = await Document.findById(req.params.id);
  if (!document) throw new AppError("Document not found", 404);
  if (req.user.role === "applicant" && document.applicantId.toString() !== req.user.id) throw new AppError("Access denied", 403);

  const reference = document[field];
  if (!mongoose.isValidObjectId(reference)) throw new AppError("File not found", 404);
  const file = await StoredFile.findById(reference);
  if (!file) throw new AppError("File not found", 404);

  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Length", file.size);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.originalName || field)}"`);
  res.send(file.data);
};

export const verifyDocuments = async (req, res) => {
  assertObjectId(req.params.id, "document ID");
  const verificationStatus = pickEnum(req.body.verificationStatus, ["verified", "rejected"], "verificationStatus");
  if (!verificationStatus) throw new AppError("verificationStatus must be 'verified' or 'rejected'");
  const officerComments = cleanText(req.body.officerComments);
  if (verificationStatus === "rejected" && !officerComments) throw new AppError("Comments are required when rejecting documents");

  const document = await Document.findById(req.params.id);
  if (!document) throw new AppError("Document not found", 404);

  document.verificationStatus = verificationStatus;
  document.officerComments = officerComments;
  document.verifiedBy = req.user.id;
  document.verifiedAt = new Date();
  await document.save();

  const loan = await Loan.findById(document.loanId).select("loanNumber applicant");
  if (loan) {
    await createNotification({
      userID: loan.applicant,
      title: "Document Review",
      message:
        verificationStatus === "verified"
          ? `Your documents for loan ${loan.loanNumber} have been verified.`
          : `Your documents for loan ${loan.loanNumber} were rejected. Reason: ${officerComments}`,
      type: "document_update",
      relatedLoan: loan._id
    });
  }
  res.json({ message: `Documents ${verificationStatus} successfully`, document });
};

const queryDocuments = async (req, res, forcedStatus) => {
  const { page, limit, skip } = getPagination(req.query, { maxLimit: 50 });
  const filter = {};
  const status = forcedStatus || pickEnum(req.query.status, ["pending", "verified", "rejected"], "status");
  if (status) filter.verificationStatus = status;

  const [total, documents] = await Promise.all([
    Document.countDocuments(filter),
    Document.find(filter).populate("applicantId", "name email").populate("loanId", "loanNumber loanType amountRequested").sort({ createdAt: -1 }).skip(skip).limit(limit)
  ]);
  res.json({ documents, pagination: buildPagination(total, page, limit) });
};

export const listDocuments = (req, res) => queryDocuments(req, res);

export const getAllPendingDocuments = (req, res) => queryDocuments(req, res, "pending");
