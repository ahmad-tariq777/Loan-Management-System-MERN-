import express from "express";
import {
  broadcast,
  clearRead,
  deleteNotification,
  listNotifications,
  markAllRead,
  markRead
} from "../controllers/notificationController.js";
import { adminMiddleware, authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", listNotifications);
router.post("/broadcast", adminMiddleware, broadcast);
router.patch("/read-all", markAllRead);
router.delete("/read", clearRead);
router.patch("/:id/read", markRead);
router.delete("/:id", deleteNotification);

export default router;
