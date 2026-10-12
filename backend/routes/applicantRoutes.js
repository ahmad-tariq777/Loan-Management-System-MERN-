import express from "express";
import {
  getAllApplicants,
  getApplicantByID,
  getApplicantLoans,
  getMyApplicantProfile,
  registerApplicant,
  setBlacklist,
  updateApplicant,
  verifyApplicant
} from "../controllers/applicantController.js";
import { adminMiddleware, authMiddleware, officerMiddleware, roleMiddleware } from "../middlewares/authMiddleware.js";
import { auditLog } from "../middlewares/auditMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/register", roleMiddleware(["applicant"]), registerApplicant);
router.get("/me", getMyApplicantProfile);
router.get("/all", officerMiddleware, getAllApplicants);
router.get("/:id", officerMiddleware, getApplicantByID);
router.get("/:id/loans", officerMiddleware, getApplicantLoans);
router.patch("/:id/verification", officerMiddleware, auditLog("APPLICANT_VERIFY", "applicant"), verifyApplicant);
router.patch("/:id/blacklist", adminMiddleware, auditLog("APPLICANT_BLACKLIST", "applicant"), setBlacklist);
router.patch("/:id", updateApplicant);

export default router;
