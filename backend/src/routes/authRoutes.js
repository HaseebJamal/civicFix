import Router from "express";
import {
  forgotPassword,
  logoutUser,
  loginUser,
  registerUser,
  refreshAccessToken,
  verifyOtp,
  resetPassword,
  updatePassword,
} from "../controllers/authController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  forgotPasswordRateLimiter,
  loginRateLimiter,
  registerRateLimiter,
} from "../middlewares/rateLimitMiddleware.js";
const router = Router();

// authControllers
router.post("/register", registerRateLimiter, registerUser);
router.post("/login", loginRateLimiter, loginUser);
router.post("/forgot-password", forgotPasswordRateLimiter, forgotPassword);
router.post("/logout", authMiddleware, logoutUser);
router.post("/refreshtoken", refreshAccessToken);
router.post("/verifyotp", verifyOtp);
router.post("/resetpassword", resetPassword);
router.patch("/updatepassword", authMiddleware, updatePassword);

export default router;
