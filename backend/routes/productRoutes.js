import express from "express";
import { createProduct, getProduct, listProducts, updateProduct } from "../controllers/productController.js";
import { adminMiddleware, authMiddleware } from "../middlewares/authMiddleware.js";
import { auditLog } from "../middlewares/auditMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", listProducts);
router.get("/:id", getProduct);
router.post("/", adminMiddleware, auditLog("PRODUCT_CREATE", "product"), createProduct);
router.put("/:id", adminMiddleware, auditLog("PRODUCT_UPDATE", "product"), updateProduct);

export default router;
