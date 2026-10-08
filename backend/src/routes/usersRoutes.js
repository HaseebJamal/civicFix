import Router from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {userRoleMiddleware} from "../middlewares/userRoleMiddleware.js"
import {
  getAllUsers,
  getCurrentUser,
  updateCurrentUserAccount,
  deleteUserAccount,
  updateUserById,
  deleteUserById
} from "../controllers/userController.js";
const router = Router();
router.get("/me", authMiddleware, getCurrentUser);
router.patch("/update", authMiddleware, updateCurrentUserAccount);
router.get("/", authMiddleware, getAllUsers);
router.delete("/delete", authMiddleware, deleteUserAccount);
// router.patch('/:id'authMiddleware,role)
router.patch(
  "/:userId",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  updateUserById
);
router.delete(
  "/:userId",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  deleteUserById
);
export default router;
