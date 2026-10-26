import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { userRoleMiddleware } from "../middlewares/userRoleMiddleware.js";
import { getSuperAdminDashboard } from "../controllers/superAdminController.js";

const router = Router();

router.get(
  "/dashboard",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  getSuperAdminDashboard,
);

export default router;
