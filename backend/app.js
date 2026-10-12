import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { prepareApp } from "./config/db.js";
import { runDailyJobs } from "./services/schedulerService.js";
import { apiRateLimiter } from "./middlewares/rateLimiter.js";
import { errorHandler, notFound } from "./middlewares/errorHandler.js";

import authRoutes from "./routes/authRoutes.js";
import applicantRoutes from "./routes/applicantRoutes.js";
import loanRoutes from "./routes/loanRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import installmentRoutes from "./routes/installmentRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import guarantorRoutes from "./routes/guarantorRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

dotenv.config();

const app = express();

app.set("trust proxy", true);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

const sanitize = (obj) => {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
    } else if (typeof obj[key] === "object") {
      sanitize(obj[key]);
    }
  }
};

app.use((req, _res, next) => {
  sanitize(req.body);
  sanitize(req.params);
  next();
});

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.get("/api/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

app.use("/api", async (req, res, next) => {
  try {
    await prepareApp();
    next();
  } catch (error) {
    console.error("Database connection error:", error.message);
    res.status(503).json({ message: "Service temporarily unavailable" });
  }
});

app.get("/api/cron/daily", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ message: "Unauthorized" });
  const totals = await runDailyJobs();
  res.json({ message: "Daily jobs complete", totals });
});

app.use("/api", apiRateLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/applicants", applicantRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/installments", installmentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/guarantors", guarantorRoutes);
app.use("/api/products", productRoutes);
app.use("/api/reports", reportRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
