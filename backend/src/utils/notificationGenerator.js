
import pool from "../config/db.js";
import { getIO } from "../socket/socketServer.js";

export const createNotification = async ({
  userId,
  reportId,
  title,
  type,
  message,
}) => {
  const settings = await pool.query(
    `SELECT notification
     FROM user_settings
     WHERE user_id = $1`,
    [userId]
  );

  if (settings.rows[0]?.notification === false) {
    return null;
  }

  const result = await pool.query(
    `
      INSERT INTO notifications (
        user_id,
        report_id,
        title,
        type,
        message
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        user_id,
        report_id,
        title,
        type,
        message,
        is_read,
        created_at
    `,
    [userId, reportId, title, type, message]
  );

  const notification = result.rows[0];

  // Send the saved notification only to its intended user.
  getIO()
    .to(`user:${userId}`)
    .emit("NEW_NOTIFICATION", notification);

  console.log("Real-time notification emitted:", {
    userId,
    notificationId: notification.id,
  });

  return notification;
};
