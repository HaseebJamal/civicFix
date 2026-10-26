
import dotenv from "dotenv";
import { createServer } from "http";
import app from "./app.js";
import pool from "./config/db.js";
import { initializeSocket } from "./socket/socketServer.js"
dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await pool.query("SELECT 1");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    console.log("Database Connected Successfully!");

    // Create one HTTP server for Express and Socket.IO.
    const httpServer = createServer(app);

    // Initialize Socket.IO.
    const io = initializeSocket(httpServer);

    // Make Socket.IO accessible to Express controllers.
    app.set("io", io);

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
};

startServer();
