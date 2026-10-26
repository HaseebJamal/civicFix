import {Router} from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { userRoleMiddleware } from "../middlewares/userRoleMiddleware.js";
import uploadFile from "../middlewares/uploadFileMiddleware.js";
import {
  getAllUsers,
  getCurrentUser,
  updateCurrentUserAccount,
  deleteUserAccount,
  updateUserById,
  deleteUserById,
  ensureVerifiableOfficial,
} from "../controllers/userController.js";
import apiErrorHandler from "../utils/apiErrorHandler.js";
const router = Router();
router.get("/me", authMiddleware, getCurrentUser);
router.patch(
  "/update",
  authMiddleware,
  uploadFile.fields([
    {
      name: "profileImage",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  updateCurrentUserAccount,
);
router.get(
  "/",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  getAllUsers,
);
router.delete("/delete", authMiddleware, deleteUserAccount);
// router.patch('/:id'authMiddleware,role)
router.patch(
  "/:userId/verification",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  ensureVerifiableOfficial,
  (req, res, next) => {
    const { verification_status, verification_reason } = req.body || {};

    if (!["verified", "rejected"].includes(verification_status)) {
      return next(
        new apiErrorHandler(
          400,
          "Verification status must be verified or rejected.",
        ),
      );
    }

    if (
      verification_status === "rejected" &&
      (typeof verification_reason !== "string" || !verification_reason.trim())
    ) {
      return next(
        new apiErrorHandler(
          400,
          "A reason is required when rejecting an official.",
        ),
      );
    }

    req.body = {
      account_status:
        verification_status === "verified" ? "active" : "rejected",
      is_active: verification_status === "verified",
      rejection_reason:
        typeof verification_reason === "string"
          ? verification_reason.trim()
          : "",
    };
    return updateUserById(req, res, next);
  },
);
router.patch(
  "/:userId/verify",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  ensureVerifiableOfficial,
  (req, res, next) => {
    req.body = { ...req.body, account_status: "active", is_active: true };
    return updateUserById(req, res, next);
  },
);
router.patch(
  "/:userId/block",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  (req, res, next) => {
    req.body = { ...req.body, account_status: "suspended", is_active: false };
    return updateUserById(req, res, next);
  },
);
router.patch(
  "/:userId/unblock",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  (req, res, next) => {
    req.body = { ...req.body, account_status: "active", is_active: true };
    return updateUserById(req, res, next);
  },
);
router.patch(
  "/:userId",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  updateUserById,
);
router.delete(
  "/:userId",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  deleteUserById,
);
export default router;
