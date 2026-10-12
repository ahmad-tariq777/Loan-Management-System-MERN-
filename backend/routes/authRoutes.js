import express from "express";
import {
  register,
  login,
  logout,
  refreshTokenHandler,
  getMe,
  changePassword,
} from "../controllers/authController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { loginRateLimiter, registerRateLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

router.post("/register", registerRateLimiter, register);
router.post("/login", loginRateLimiter, login);
router.post("/refresh", refreshTokenHandler);
router.post("/logout", logout);
router.get("/me", authMiddleware, getMe);
router.put("/change-password", authMiddleware, changePassword);

export default router;