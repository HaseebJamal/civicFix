
import { Router } from "express";
import {
  getPublicSiteSettings,
  getSiteSettings,
  updateSiteSettings,
  uploadSiteAsset,
  getWhatsAppNumber,
  updateWhatsAppNumber,
} from "../controllers/siteSettingController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { userRoleMiddleware } from "../middlewares/userRoleMiddleware.js";
import multer from "multer";
import apiErrorHandler from "../utils/apiErrorHandler.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowedTypes = new Set([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
      "image/x-icon",
      "image/vnd.microsoft.icon",
    ]);
    const isSvgFile = file.originalname.toLowerCase().endsWith(".svg");
    if (!allowedTypes.has(file.mimetype) && !isSvgFile) {
      callback(
        new apiErrorHandler(
          400,
          "Choose a PNG, JPEG, WEBP, SVG, or ICO file.",
        ),
      );
      return;
    }
    callback(null, true);
  },
});

router.get("/public", getPublicSiteSettings);
router.get(
  "/",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  getSiteSettings,
);
router.put(
  "/",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  updateSiteSettings,
);
router.post(
  "/assets",
  authMiddleware,
  userRoleMiddleware(["superadmin"]),
  (req, res, next) => {
    upload.single("file")(req, res, (error) => {
      if (error) {
        next(
          new apiErrorHandler(
            400,
            error.code === "LIMIT_FILE_SIZE"
              ? "Image files must be 5 MB or smaller."
              : error.message,
          ),
        );
        return;
      }
      next();
    });
  },
  uploadSiteAsset,
);

// Public: floating WhatsApp button reads this number
router.get("/whatsapp", getWhatsAppNumber);

// Authenticated SuperAdmin: update the number
router.put("/whatsapp", authMiddleware, updateWhatsAppNumber);

export default router;
