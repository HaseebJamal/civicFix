import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import authRouter from "./routes/authRoutes.js";
import userRouter from "./routes/usersRoutes.js";
import wardRouter from "./routes/wardRoutes.js";
import reportRouter from "./routes/reportRoutes.js";
import commentRouter from "./routes/commentRoutes.js";
import upvotedRouter from "./routes/upvoteRoutes.js";
import superadminRouter from "./routes/superadminRoutes.js";
import notificationRouter from "./routes/notificationRoutes.js";
import errorMiddleware from "./middlewares/errorHandlerMiddleware.js";
import auditLogRoutes from "./routes/auditLogRoutes.js";
import siteSettingRouter from "./routes/siteSettingRoutes.js";

import cors from "cors";
import cookieParser from "cookie-parser";
import userSettingRouter from "./routes/userSettingRoutes.js";
dotenv.config();
const app = express();
const publicDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public",
);
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(publicDirectory, "uploads")));

app.get("/", (req, res) => {
  res.json({
    message: "CivicFix API is running",
  });
});
app.use("/api/v1/users", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/wards", wardRouter);
app.use("/api/v1/reports", reportRouter);
app.use("/api/v1/reports", commentRouter);
app.use("/api/v1/reports", upvotedRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/users/settings", userSettingRouter);
app.use("/api/v1/superadmin", superadminRouter);
app.use("/api/v1/audit-logs", auditLogRoutes);
app.use("/api/v1/site-settings", siteSettingRouter);
app.use(errorMiddleware);
export default app;
