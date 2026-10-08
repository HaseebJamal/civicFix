import express from "express";
import dotenv from "dotenv";
import authRouter from "./routes/authRoutes.js";
import userRouter from "./routes/usersRoutes.js";
import wardRouter from "./routes/wardRoutes.js";
import reportRouter from "./routes/reportRoutes.js";
import commentRouter from "./routes/commentRoutes.js";
import upvotedRouter from "./routes/upvoteRoutes.js";
import notificationRouter from "./routes/notificationRoutes.js";
import errorMiddleware from "./middlewares/errorHandlerMiddleware.js";
import cookieParser from "cookie-parser";
dotenv.config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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
app.use(errorMiddleware);
export default app;
