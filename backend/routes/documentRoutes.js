import express from "express";
import {
  downloadDocumentFile,
  getAllPendingDocuments,
  getDocumentsByLoan,
  listDocuments,
  uploadDocuments,
  verifyDocuments
} from "../controllers/documentController.js";
import { authMiddleware, officerMiddleware } from "../middlewares/authMiddleware.js";
import { handleMulterError, upload } from "../middlewares/uploadMiddleware.js";
import { uploadRateLimiter } from "../middlewares/rateLimiter.js";
import { auditLog } from "../middlewares/auditMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post(
  "/upload",
  uploadRateLimiter,
  upload.fields([
    { name: "cnicFront", maxCount: 1 },
    { name: "cnicBack", maxCount: 1 },
    { name: "incomeProof", maxCount: 1 }
  ]),
  handleMulterError,
  auditLog("DOCUMENT_UPLOAD", "document"),
  uploadDocuments
);
router.get("/", officerMiddleware, listDocuments);
router.get("/pending", officerMiddleware, getAllPendingDocuments);
router.get("/file/:id/:type", downloadDocumentFile);
router.patch("/verify/:id", officerMiddleware, auditLog("DOCUMENT_VERIFY", "document"), verifyDocuments);
router.get("/:loanId", getDocumentsByLoan);

export default router;
