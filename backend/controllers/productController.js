import LoanProduct from "../models/LoanProduct.js";
import { LOAN_TYPES } from "../config/loanConfig.js";
import { AppError } from "../utils/AppError.js";
import { assertObjectId, cleanText, parseNumber } from "../utils/helpers.js";

const NUMBER_FIELDS = {
  minAmount: { min: 1 },
  maxAmount: { min: 1 },
  minTenureMonths: { min: 1, max: 120, integer: true },
  maxTenureMonths: { min: 1, max: 120, integer: true },
  defaultTenureMonths: { min: 1, max: 120, integer: true },
  interestRate: { min: 0, max: 100 },
  processingFeePercent: { min: 0, max: 25 },
  lateFeePercent: { min: 0, max: 25 },
  gracePeriodDays: { min: 0, max: 60, integer: true },
  guarantorThreshold: { min: 0 }
};

const readPayload = (body) => {
  const data = {};
  if (body.name !== undefined) data.name = cleanText(body.name);
  if (body.description !== undefined) data.description = cleanText(body.description);
  for (const [field, rules] of Object.entries(NUMBER_FIELDS)) {
    if (body[field] !== undefined) data[field] = parseNumber(body[field], field, rules);
  }
  for (const field of ["requiresGuarantor", "isActive"]) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== "boolean") throw new AppError(`${field} must be a boolean`);
      data[field] = body[field];
    }
  }
  return data;
};

export const listProducts = async (req, res) => {
  const filter = req.user.role === "applicant" ? { isActive: true } : {};
  const products = await LoanProduct.find(filter).sort({ loanType: 1 });
  res.json({ products });
};

export const getProduct = async (req, res) => {
  assertObjectId(req.params.id, "product ID");
  const product = await LoanProduct.findById(req.params.id);
  if (!product || (req.user.role === "applicant" && !product.isActive)) throw new AppError("Product not found", 404);
  res.json(product);
};

export const createProduct = async (req, res) => {
  if (!LOAN_TYPES.includes(req.body.loanType)) throw new AppError(`loanType must be one of: ${LOAN_TYPES.join(", ")}`);
  const exists = await LoanProduct.exists({ loanType: req.body.loanType });
  if (exists) throw new AppError("A product for this loan type already exists", 409);
  const product = await LoanProduct.create({ ...readPayload(req.body), loanType: req.body.loanType, updatedBy: req.user.id });
  res.status(201).json({ message: "Loan product created", product });
};

export const updateProduct = async (req, res) => {
  assertObjectId(req.params.id, "product ID");
  const product = await LoanProduct.findById(req.params.id);
  if (!product) throw new AppError("Product not found", 404);
  Object.assign(product, readPayload(req.body), { updatedBy: req.user.id });
  await product.save();
  res.json({ message: "Loan product updated. New terms apply to future applications only.", product });
};
