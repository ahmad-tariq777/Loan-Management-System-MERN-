import express from "express";
import {
  applyLoan,
  assignOfficer,
  calculateLoan,
  cancel,
  disburse,
  downloadApprovalLetter,
  evaluateLoanEligibility,
  getAllLoans,
  getLoanById,
  getLoanChecklist,
  getLoanStats,
  getLoanSummary,
  getMyLoans,
  getPendingLoans,
  restructure,
  settle,
  settlementQuote,
  updateLoanStatus,
  writeOff
} from "../controllers/loanController.js";
import { adminMiddleware, authMiddleware, officerMiddleware, roleMiddleware } from "../middlewares/authMiddleware.js";
import { auditLog } from "../middlewares/auditMiddleware.js";

const router = express.Router();

router.get("/calculator", calculateLoan);

router.use(authMiddleware);

router.post("/apply", roleMiddleware(["applicant"]), auditLog("LOAN_APPLY", "loan"), applyLoan);
router.get("/my", getMyLoans);
router.get("/stats", officerMiddleware, getLoanStats);
router.get("/pending", officerMiddleware, getPendingLoans);
router.get("/all", officerMiddleware, getAllLoans);
router.get("/eligibility/:loanId", officerMiddleware, evaluateLoanEligibility);
router.post("/eligibility/:loanId", officerMiddleware, evaluateLoanEligibility);
router.get("/approval-letter/:loanId", downloadApprovalLetter);
router.patch("/status/:loanId", officerMiddleware, auditLog("LOAN_STATUS_UPDATE", "loan"), updateLoanStatus);

router.get("/:loanId", getLoanById);
router.get("/:loanId/summary", getLoanSummary);
router.get("/:loanId/checklist", officerMiddleware, getLoanChecklist);
router.get("/:loanId/settlement-quote", settlementQuote);
router.post("/:loanId/disburse", officerMiddleware, auditLog("LOAN_DISBURSE", "loan"), disburse);
router.post("/:loanId/cancel", auditLog("LOAN_CANCEL", "loan"), cancel);
router.post("/:loanId/settle", officerMiddleware, auditLog("LOAN_SETTLE", "loan"), settle);
router.post("/:loanId/restructure", adminMiddleware, auditLog("LOAN_RESTRUCTURE", "loan"), restructure);
router.post("/:loanId/write-off", adminMiddleware, auditLog("LOAN_WRITE_OFF", "loan"), writeOff);
router.patch("/:loanId/assign", adminMiddleware, auditLog("LOAN_ASSIGN", "loan"), assignOfficer);

export default router;
