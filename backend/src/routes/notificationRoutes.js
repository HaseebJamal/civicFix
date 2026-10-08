import Router from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  getNotification,
  markAllNotificationAsRead,
  markNotificationAsRead,
} from "../controllers/notificationController.js";
const router = Router();
router.get("/",authMiddleware, getNotification);
router.patch("/read-all", authMiddleware, markAllNotificationAsRead);

router.patch("/:notificationId/read", authMiddleware, markNotificationAsRead);
export default router;
