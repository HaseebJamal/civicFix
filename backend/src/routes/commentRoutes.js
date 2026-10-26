import Router from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { userRoleMiddleware } from "../middlewares/userRoleMiddleware.js";
// import { uploadFileMiddleware } from "../middlewares/uploadFileMiddleware.js";
import { createComment,updateComment,getComments } from "../controllers/commentController.js";
const router = Router();
router.post("/:reportId/comments", authMiddleware, createComment);
router.patch("/:reportId/comments/:commentId", authMiddleware, updateComment);
router.get("/:reportId/comments", authMiddleware, getComments);

export default router;
