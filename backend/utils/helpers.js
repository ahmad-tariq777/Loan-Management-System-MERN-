import mongoose from "mongoose";
import xss from "xss";
import { AppError } from "./AppError.js";

export const EPSILON = 0.005;

export const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const formatId = (prefix, number, width) => `${prefix}-${String(number).padStart(width, "0")}`;

export const assertObjectId = (id, label = "ID") => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError(`Invalid ${label}`, 400);
  return id;
};

export const cleanText = (value) => (typeof value === "string" ? xss(value.trim()) : "");

export const asString = (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

export const parseNumber = (value, label, { min = -Infinity, max = Infinity, integer = false } = {}) => {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  const invalid =
    value === "" || !Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed));
  if (invalid) {
    const range = [Number.isFinite(min) ? `>= ${min}` : null, Number.isFinite(max) ? `<= ${max}` : null].filter(Boolean).join(" and ");
    throw new AppError(`${label} must be ${integer ? "a whole number" : "a number"}${range ? ` ${range}` : ""}`, 400);
  }
  return parsed;
};

export const parseDate = (value, label) => {
  const parsed = new Date(value);
  if (typeof value !== "string" || Number.isNaN(parsed.getTime())) throw new AppError(`${label} is not a valid date`, 400);
  return parsed;
};

export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const searchRegex = (value) => new RegExp(escapeRegex(value), "i");

export const getPagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

export const buildPagination = (total, page, limit) => ({ total, page, limit, pages: Math.ceil(total / limit) });

export const dateRangeFilter = (query, fromKey = "dateFrom", toKey = "dateTo") => {
  const from = asString(query[fromKey]);
  const to = asString(query[toKey]);
  if (!from && !to) return undefined;
  const range = {};
  if (from) range.$gte = parseDate(from, fromKey);
  if (to) {
    const end = parseDate(to, toKey);
    end.setUTCHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return range;
};

export const pickEnum = (value, allowed, label) => {
  const text = asString(value);
  if (text === undefined) return undefined;
  if (!allowed.includes(text)) throw new AppError(`Invalid ${label}. Allowed: ${allowed.join(", ")}`, 400);
  return text;
};

export const sumBy = (items, selector) => round2(items.reduce((total, item) => total + selector(item), 0));
