import express from "express";
import {
  createOfficer,
  getAllOfficers,
  getAuditLogs,
  getDashboardStats,
  getUserDetail,
  listUsers,
  resetOfficerPassword,
  runSchedulerNow,
  toggleUserStatus,
  updateOfficer,
  updateUserFinancials
} from "../controllers/adminController.js";
import { adminMiddleware, authMiddleware } from "../middlewares/authMiddleware.js";
import { auditLog } from "../middlewares/auditMiddleware.js";

const router = express.Router();

router.use(authMiddleware, adminMiddleware);

router.get("/dashboard", getDashboardStats);
router.post("/officers", auditLog("OFFICER_CREATE", "user"), createOfficer);
router.get("/officers", getAllOfficers);
router.patch("/officers/:userId", auditLog("OFFICER_UPDATE", "user"), updateOfficer);
router.post("/officers/:userId/reset-password", auditLog("OFFICER_PASSWORD_RESET", "user"), resetOfficerPassword);
router.get("/users", listUsers);
router.get("/users/:userId", getUserDetail);
router.patch("/users/:userId/status", auditLog("USER_STATUS_CHANGE", "user"), toggleUserStatus);
router.patch("/users/:userId/financials", auditLog("USER_FINANCIALS_UPDATE", "user"), updateUserFinancials);
router.get("/audit-logs", getAuditLogs);
router.post("/scheduler/run", runSchedulerNow);

export default router;
