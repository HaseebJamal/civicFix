import Router from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { userRoleMiddleware } from "../middlewares/userRoleMiddleware.js";
import { uploadFileMiddleware } from "../middlewares/uploadFileMiddleware.js";
import {
  createReport,
  getAllReport,
  getMyReport,
  deleteReportById,
  updateReportById,
  getReportById,
  getWardReports,
  updateReportStatus,
  getReportStatusHistory,
  assignReportToWard,
} from "../controllers/reportController.js";
import {
  uploadReportImage,
  getReportImageById,
  getReportImages,
  deleteReportImages,
} from "../controllers/reportImageController.js";
const router = Router();
// {{CREATING REPORTS}}
router.post("/", authMiddleware, createReport);
router.get("/", authMiddleware, getAllReport);
router.get("/my", authMiddleware, getMyReport);
router.get("/:reportId", authMiddleware, getReportById);
router.delete(
  "/:reportId",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  deleteReportById,
);
router.patch("/:reportId", authMiddleware, updateReportById);
router.get("/:reportId", authMiddleware, getReportById);
router.get(
  "/ward/:wardId",
  authMiddleware,
  userRoleMiddleware(["ward_official", "superadmin"]),
  getWardReports,
);
router.patch(
  "/:reportId/status",
  authMiddleware,
  userRoleMiddleware(["ward_official", "superadmin"]),
  updateReportStatus,
);
router.patch(
  "/:reportId/assign-ward",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  assignReportToWard,
);
router.get("/:reportId/status-history", authMiddleware, getReportStatusHistory);

// {{Handling Reports Images here}}

router.post(
  "/:reportId/images",
  authMiddleware,
  uploadFileMiddleware.single("image"),
  uploadReportImage,
);
router.get("/:reportId/images", authMiddleware, getReportImages);

router.get("/:reportId/images/:imageId", authMiddleware, getReportImageById);
router.delete(
  "/:reportId/images/:imageId",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  deleteReportImages,
);
// router.get("/:reportId/image", authMiddleware, getReportImage);

export default router;
