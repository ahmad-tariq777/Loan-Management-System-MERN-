import { AppError } from "../utils/AppError.js";

export const notFound = (req, res, next) => next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  let status = err.status || err.statusCode || 500;
  let message = err.message;

  if (err.name === "ValidationError" && err.errors) {
    status = 400;
    message = Object.values(err.errors).map((item) => item.message).join(", ");
  } else if (err.name === "CastError") {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    message = `Duplicate value for ${Object.keys(err.keyValue || {}).join(", ") || "unique field"}`;
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Malformed JSON body";
  } else if (err.type === "entity.too.large") {
    status = 413;
    message = "Request body too large";
  }

  if (status >= 500) {
    console.error("Unhandled error:", err);
    if (process.env.NODE_ENV === "production") message = "Internal server error";
  }

  res.status(status).json({ message, ...(err.details ? { details: err.details } : {}) });
};
