import pool from "../config/db.js";

export const createNotification = async ({
  userId,
  reportId,
  title,
  type,
  message,
}) => {
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

  return result.rows[0];
};