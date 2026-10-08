import asyncHandler from "../utils/asyncHandler.js";
import apiErrorHandler from "../utils/apiErrorHandler.js";
import apiResponseHandler from "../utils/apiResponseHandler.js";
import { createNotification } from "../utils/notificationGenerator.js";
import pool from "../config/db.js";
export const createComment = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user?.id;
  const { content } = req.body;
  try {
    if (!reportId) {
      throw new apiErrorHandler(400, "Report Id is required");
    }
    if (!userId) {
      throw new apiErrorHandler(401, "User Id is required");
    }
    if (!content || !content.trim()) {
      throw new apiErrorHandler(400, "Comment is required");
    }
    const result = await pool.query(
      `
        SELECT
          id,
            user_id,

          deleted_at
        FROM reports
        WHERE id = $1
        LIMIT 1
      `,
      [reportId],
    );
    if (result.rows.length === 0) {
      throw new apiErrorHandler(404, "Report not found");
    }
    const existingReport = result.rows[0];
    if (existingReport.deleted_at) {
      throw new apiErrorHandler(404, "Report has already been deleted");
    }
    const insertComment = await pool.query(
      `
        INSERT INTO comments
        (
          report_id,
          user_id,
          content
        )
        VALUES
        (
          $1,
          $2,
          $3
        )
        RETURNING
          id,
          report_id,
          user_id,
          content,
          created_at,
          updated_at
      `,
      [reportId, userId, content.trim()],
    );
    if (userId !== existingReport.user_id) {
      await createNotification({
        userId: existingReport.user_id,
        reportId: existingReport.id,
        type: "report_commented",
        title: "New comment",
        message: `${req.user.username} commented on your report.`,
      });
    }
    return res
      .status(201)
      .json(
        new apiResponseHandler(
          201,
          "Comment added successfully",
          insertComment.rows[0],
        ),
      );
  } catch (error) {
    console.log("Unable to add comment on report:", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(
      500,
      "Internal server error occurred while adding comment",
    );
  }
});
export const updateComment = asyncHandler(async (req, res) => {
  const { reportId, commentId } = req.params;
  console.log("REPORT ID", reportId);
  console.log("comment ID", commentId);
  const userId = req.user?.id;
  console.log("USER ID", userId);
  const userRole = req.user?.role;
  console.log("USER role", userRole);

  const { content } = req.body;
  console.log("content", content);

  try {
    if (!userId) {
      throw new apiErrorHandler(401, "User id is required");
    }
    if (!reportId) {
      throw new apiErrorHandler(401, "Report  id is required");
    }

    if (!commentId) {
      throw new apiErrorHandler(400, "Comment id is required");
    }
    if (content === undefined || !content.trim()) {
      throw new apiErrorHandler(400, "Content is required");
    }
    const result = await pool.query(
      `SELECT 
        id,
          report_id,
          user_id,
          content,
          created_at,
          updated_at
           FROM comments
            WHERE id=$1 
            AND 
            report_id=$2 LIMIT 1 `,
      [commentId, reportId],
    );
    console.log("QUERY RESULT:", result.rows[0]);
    if (result.rows.length === 0) {
      throw new apiErrorHandler(404, "No reports are found");
    }
    const findedComment = result.rows[0];
    if (userRole === "citizen") {
      if (findedComment.user_id !== userId) {
        throw new apiErrorHandler(
          403,
          "You have no permission to update comments",
        );
      }
      const findComment = await pool.query(
        `UPDATE 
        comments
         SET
        content=$1,
         updated_at=NOW() WHERE id=$2 AND report_id=$3
         RETURNING 
         id,
         user_id,
         report_id,
         content,
         created_at,
         updated_at
         `,
        [content.trim(), commentId, reportId],
      );
      if (findComment.rows.length === 0) {
        throw new apiErrorHandler(404, "Unable to update comment");
      }
      const updatedComment = findComment.rows[0];
      return res
        .status(200)
        .json(
          new apiResponseHandler(
            200,
            "Comment updated successfully",
            updatedComment,
          ),
        );
    }
    if (userRole === "ward_official") {
      const wardResult = await pool.query(
        `SELECT id FROM wards WHERE official_id=$1 LIMIT 1`,
        [userId],
      );
      if (wardResult.rows.length === 0) {
        throw new apiErrorHandler(403, "Your are not assigned to any ward");
      }
      const reportResult = await pool.query(
        `
          SELECT ward_id
          FROM reports
          WHERE id = $1
          LIMIT 1
        `,
        [reportId],
      );
      const reportWardId = reportResult.rows[0].ward_id;

      const assignedWardId = wardResult.rows[0].id;
      if (reportWardId !== assignedWardId) {
        throw new apiErrorHandler(
          403,
          "You are not allowed to update comments on this report",
        );
      }
      const updatedComment = await pool.query(
        `UPDATE 
        comments
         SET content=$1,
         updated_at=NOW()
          WHERE id=$2 
          AND  report_id=$3 
          RETURNING
           id,
           user_id,
           report_id,
           content,
           created_at,
           updated_at  `,
        [content.trim(), commentId, reportId],
      );
      if (updatedComment.rows.length === 0) {
        throw new apiErrorHandler(404, "no comments are founded");
      }
      const updatedReportComments = updatedComment.rows[0];
      return res
        .status(200)
        .json(
          new apiResponseHandler(
            200,
            "Comment updated successfully",
            updatedReportComments,
          ),
        );
    }
    if (userRole === "superadmin") {
      const updatedComment = await pool.query(
        `
          UPDATE comments
          SET
            content = $1,
            updated_at = NOW()
          WHERE id = $2
            AND report_id = $3
          RETURNING
            id,
            user_id,
            report_id,
            content,
            created_at,
            updated_at
        `,
        [content.trim(), commentId, reportId],
      );

      if (updatedComment.rows.length === 0) {
        throw new apiErrorHandler(404, "Unable to update comment");
      }

      return res
        .status(200)
        .json(
          new apiResponseHandler(
            200,
            "Comment updated successfully",
            updatedComment.rows[0],
          ),
        );
    }
    throw new apiErrorHandler(403, "You are not allowed to update comments");
  } catch (error) {
    console.log("Unable to update comments ", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(
      500,
      "Internal Server error occur during updating comments",
    );
  }
});
