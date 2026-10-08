import Router from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  createUpvotes,
  getUpovtes,
  deleteUpvotes,
} from "../controllers/upvoteController.js";
const router = Router();
router.post("/:reportId/upvotes", authMiddleware, createUpvotes);
router.get("/:reportId/upvotes", authMiddleware, getUpovtes);
router.delete("/:reportId/upvotes", authMiddleware, deleteUpvotes);

export default router;
