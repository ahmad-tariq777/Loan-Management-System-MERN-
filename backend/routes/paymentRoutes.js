import express from "express";
import {
  createPayment,
  downloadReceipt,
  downloadStatement,
  getAllPayments,
  getMyPayments,
  getPaymentById,
  reverse
} from "../controllers/paymentController.js";
import { adminMiddleware, authMiddleware, officerMiddleware } from "../middlewares/authMiddleware.js";
import { auditLog } from "../middlewares/auditMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/", officerMiddleware, auditLog("PAYMENT_CREATE", "payment"), createPayment);
router.get("/", officerMiddleware, getAllPayments);
router.get("/my", getMyPayments);
router.get("/statement/:loanId", downloadStatement);
router.get("/:id", getPaymentById);
router.get("/:id/receipt", downloadReceipt);
router.post("/:id/reverse", adminMiddleware, auditLog("PAYMENT_REVERSE", "payment"), reverse);

export default router;
