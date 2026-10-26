
import { Router } from "express";
import {
  getSettings,
  saveSettings,
} from "../controllers/userSettingController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", authMiddleware, getSettings);
router.put("/", authMiddleware, saveSettings);

export default router;
