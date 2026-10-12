import LoanProduct from "../models/LoanProduct.js";
import { DEFAULT_PRODUCTS } from "../config/loanConfig.js";

export const seedLoanProducts = async () => {
  const existing = await LoanProduct.find().select("loanType");
  const present = new Set(existing.map((product) => product.loanType));
  const missing = DEFAULT_PRODUCTS.filter((product) => !present.has(product.loanType));
  if (missing.length) await LoanProduct.insertMany(missing);
};
