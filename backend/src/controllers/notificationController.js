import pool from "../config/db.js";
import asyncHandler from "../utils/asyncHandler.js";
import apiErrorHandler from "../utils/apiErrorHandler.js";
import apiResponseHandler from "../utils/apiResponseHandler.js";

export const getNotification = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new apiErrorHandler(401, "User ID is required");
  }

  const result = await pool.query(
    `
      SELECT
        id,
        user_id,
        report_id,
        type,
        title,
        message,
        is_read,
        created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );

  return res.status(200).json(
    new apiResponseHandler(
      200,
      "Notifications fetched successfully",
      result.rows
    )
  );
});

export const markNotificationAsRead = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { notificationId } = req.params;
  try {
    if (!userId) {
      throw new apiErrorHandler(401, "User Id is required");
    }
    if (!notificationId) {
      throw new apiErrorHandler(401, "Notification Id is required");
    }
    const result = await pool.query(
      `UPDATE 
      notifications 
      SET is_read=TRUE
       WHERE id=$1
        AND user_id=$2 
      RETURNING 
      id,
      user_id,
      report_id,
      type,
      title,
      message,
      is_read,
      created_at`,
      [notificationId, userId],
    );
    if (result.rows.length === 0) {
      throw new apiErrorHandler(404, "No notification found");
    }
    const markedNotification = result.rows[0];
    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "Notification marked as read successfully",
          markedNotification,
        ),
      );
  } catch (error) {
    console.log("Unable to mark notification as read", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(
      500,
      "Internal Server Error occur during mark as read ",
    );
  }
});
export const markAllNotificationAsRead = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  try {
    if (!userId) {
      throw new apiErrorHandler(401, "User Id is required");
    }
    const result = await pool.query(
      `UPDATE 
        notifications
         SET is_read=TRUE 
         WHERE user_id=$1
         AND is_read=FALSE
         RETURNING
         id,
         user_id,
         report_id,
         type,
         title,
         message,
         created_at`,
      [userId],
    );
    if (result.rows.length === 0) {
      throw new apiErrorHandler(404, "No unread notifications found");
    }

    return res.status(200).json(
      new apiResponseHandler(
        200,
        "Successfully marked all notifications as read",
        {
          markedCount: result.rows.length,
          notifications: result.rows,
        },
      ),
    );
  } catch (error) {
    console.log("Unable to mark all notifications as read:", error);

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    throw new apiErrorHandler(
      500,
      "Internal server error occurred while marking all notifications as read",
    );
  }
});
