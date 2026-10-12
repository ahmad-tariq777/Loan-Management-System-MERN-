import express from "express";
import {
  agingReport,
  collectionsReport,
  disbursementsReport,
  exportLoans,
  exportPayments,
  loanTypeReport,
  officerReport,
  portfolioReport
} from "../controllers/reportController.js";
import { adminMiddleware, authMiddleware, officerMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware, officerMiddleware);

router.get("/portfolio", portfolioReport);
router.get("/aging", agingReport);
router.get("/collections", collectionsReport);
router.get("/disbursements", disbursementsReport);
router.get("/loan-types", loanTypeReport);
router.get("/officers", adminMiddleware, officerReport);
router.get("/export/loans", exportLoans);
router.get("/export/payments", exportPayments);

export default router;
