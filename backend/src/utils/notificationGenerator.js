
import pool from "../config/db.js";
import { getIO } from "../socket/socketServer.js";

export const createNotification = async ({
  userId,
  reportId,
  title,
  type,
  message,
}) => {
  console.log("[NOTIFICATION] Creating for user:", userId);

  const settings = await pool.query(
    `SELECT notification
     FROM user_settings
     WHERE user_id = $1`,
    [userId]
  );

  console.log("[NOTIFICATION] Settings:", settings.rows[0]);

  if (settings.rows[0]?.notification === false) {
    console.log("[NOTIFICATION] Disabled in user settings");
    return null;
  }

  const result = await pool.query(
    `INSERT INTO notifications (
      user_id, report_id, title, type, message
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [userId, reportId, title, type, message]
  );

  const notification = result.rows[0];

  console.log("[NOTIFICATION] Saved:", notification.id);

  const io = getIO();
  const room = `user:${userId}`;

  console.log(
    "[NOTIFICATION] Room sockets:",
    io.sockets.adapter.rooms.get(room)?.size ?? 0
  );

  io.to(room).emit("NEW_NOTIFICATION", notification);

  console.log("[NOTIFICATION] Event emitted:", notification.id);

  return notification;
};
