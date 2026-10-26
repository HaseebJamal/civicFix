import { Router } from "express";
import { getAuditLogs } from "../controllers/auditLogController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import apiErrorHandler from "../utils/apiErrorHandler.js";

const router = Router();

const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== "superadmin") {
    return next(
      new apiErrorHandler(403, "Only Super Admin can access audit logs")
    );
  }

  next();
};

router.get("/", authMiddleware, requireSuperAdmin, getAuditLogs);

export default router;