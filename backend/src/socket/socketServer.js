
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

// Read a specific cookie without an additional package.
const getCookie = (cookieHeader, name) => {
  const cookies = (cookieHeader || "").split(";");

  for (const item of cookies) {
    const separatorIndex = item.indexOf("=");

    if (separatorIndex === -1) continue;

    const key = item.slice(0, separatorIndex).trim();
    const value = item.slice(separatorIndex + 1).trim();

    if (key === name) {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }

  return null;
};

let io;

export const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  // Authenticate connections using the existing JWT.
  io.use(async (socket, next) => {
    try {
      const token = getCookie(
        socket.request.headers.cookie,
        "accessToken"
      );

      // Allow unauthenticated visitors to access public map events.
      if (!token) {
        socket.data.user = null;
        return next();
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      const result = await pool.query(
        `SELECT id, role, account_status, is_active
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return next(new Error("Invalid access token"));
      }

      const user = result.rows[0];

      if (
        user.account_status !== "active" ||
        !user.is_active
      ) {
        return next(new Error("Account is not active"));
      }

      socket.data.user = {
        userId: user.id,
        role: user.role,
      };

      next();
    } catch (error) {
      next(new Error("Invalid or expired access token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;

    // Public map updates.
    socket.join("public:map");
    socket.join("public:trending");

    if (user) {
      // Private room for this authenticated user.
      socket.join(`user:${user.userId}`);

      console.log(
        `Socket connected: ${user.userId} (${user.role})`
      );
    } else {
      console.log("Public map visitor connected");
    }

    socket.on("disconnect", (reason) => {
      console.log(
        `Socket disconnected: ${reason}`
      );
    });
  });

  return io;
};

// Use this helper in controllers to emit events.
export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized");
  }

  return io;
};

// Emit after a new report is saved successfully.
// Broadcast a newly created report to public map clients.
export const emitNewReport = (report) => {
  getIO()
    .to("public:map")
    .to("public:trending")
    .emit("NEW_REPORT", report);
};

// Broadcast a report status change.
export const emitReportStatusUpdated = (report) => {
  getIO()
    .to("public:map")
    .to("public:trending")
    .emit("REPORT_STATUS_UPDATED", report);
};

// Tell connected maps to remove a soft-deleted report.
export const emitReportDeleted = (reportId) => {
  getIO()
    .to("public:map")
    .to("public:trending")
    .emit("REPORT_DELETED", { id: reportId });
};