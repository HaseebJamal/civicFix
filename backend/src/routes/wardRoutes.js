import Router from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { userRoleMiddleware } from "../middlewares/userRoleMiddleware.js";

import {
  createWard,
  deleteWard,
  getAllWards,
  getWardById,
  updateWardById,
  assignWardOfficial,
  removeAssignedOfficial,
  getMyWard,
} from "../controllers/wardController.js";

const router = Router();

// ============================================================
// SUPERADMIN ROUTES
// ============================================================

// Create ward
router.post(
  "/",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  createWard,
);

// Get all wards
router.get(
  "/",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  getAllWards,
);

router.get(
  "/my-ward",
  authMiddleware,
  userRoleMiddleware(["ward_official"]),
  getMyWard,
);
router.patch(
  "/:wardId/official",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  assignWardOfficial,
);
router.delete(
  "/:wardId/official",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  removeAssignedOfficial,
);

router.get(
  "/:wardId",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  getWardById,
);

// Update ward
router.patch(
  "/:wardId",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  updateWardById,
);

// Delete ward
router.delete(
  "/:wardId",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  deleteWard,
);

export default router;