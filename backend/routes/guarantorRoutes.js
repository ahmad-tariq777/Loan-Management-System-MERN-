import express from "express";
import { addGuarantor, getLoanGuarantors, removeGuarantor, updateGuarantor, verifyGuarantor } from "../controllers/guarantorController.js";
import { authMiddleware, officerMiddleware } from "../middlewares/authMiddleware.js";
import { auditLog } from "../middlewares/auditMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/loan/:loanId", addGuarantor);
router.get("/loan/:loanId", getLoanGuarantors);
router.patch("/:id/verify", officerMiddleware, auditLog("GUARANTOR_VERIFY", "guarantor"), verifyGuarantor);
router.patch("/:id", updateGuarantor);
router.delete("/:id", removeGuarantor);

export default router;
