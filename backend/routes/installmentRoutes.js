import express from "express";
import {
  exportSchedule,
  getLoanInstallments,
  getMyInstallments,
  getOverdueInstallments,
  getUpcomingInstallments,
  payInstallment,
  waiveLateFee
} from "../controllers/installmentController.js";
import { adminMiddleware, authMiddleware, officerMiddleware } from "../middlewares/authMiddleware.js";
import { auditLog } from "../middlewares/auditMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/my", getMyInstallments);
router.get("/upcoming", getUpcomingInstallments);
router.get("/overdue/all", officerMiddleware, getOverdueInstallments);
router.get("/export/:loanId", exportSchedule);
router.put("/pay/:id", officerMiddleware, auditLog("INSTALLMENT_PAY", "installment"), payInstallment);
router.patch("/:id/waive-late-fee", adminMiddleware, auditLog("LATE_FEE_WAIVE", "installment"), waiveLateFee);
router.get("/:loanId", getLoanInstallments);

export default router;
