import pool from "../config/db.js";
import asyncHandler from "../utils/asyncHandler.js";
import apiErrorHandler from "../utils/apiErrorHandler.js";
import apiResponseHandler from "../utils/apiResponseHandler.js";
import {createNotification} from "../utils/notificationGenerator.js"
export const createUpvotes = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { reportId } = req.params;

  try {
    console.log("USER ID:", userId);
    console.log("REPORT ID:", reportId);
    if (!userId) {
      throw new apiErrorHandler(401, "User Id is requried");
    }
    if (!reportId) {
      throw new apiErrorHandler(401, "Report Id is requried");
    }
    const reportResult = await pool.query(
      `
    SELECT
      id,
      user_id
    FROM reports
    WHERE id = $1
      AND deleted_at IS NULL
    LIMIT 1
  `,
      [reportId],
    );

    if (reportResult.rows.length === 0) {
      throw new apiErrorHandler(404, "Report not found");
    }

    const report = reportResult.rows[0];
    const result = await pool.query(
      `SELECT 
        id,
        user_id,
        report_id, 
        created_at FROM 
        upvotes
         WHERE 
         user_id=$1
          AND report_id=$2
          
            LIMIT 1`,
      [userId, reportId],
    );
    console.log("EXISTING UPVOTE:", result.rows);
    if (result.rows.length > 0) {
      throw new apiErrorHandler(409, "You already upvoted the report");
    }
    // const alreadyUpvotedReport = result.rows[0];
    const upvoteReport = await pool.query(
      `INSERT INTO upvotes(user_id,report_id)VALUES($1,$2)
      RETURNING id,user_id,report_id,created_at`,
      [userId, reportId],
    );
    if (userId !== report.user_id) {
      await createNotification({
        userId: report.user_id,
        reportId: report.id,
        type: "report_upvoted",
        title: "New upvote",
        message: `${req.user.username} upvoted your report.`,
      });
    }
    return res
      .status(201)
      .json(
        new apiResponseHandler(
          201,
          "Upvoted successfully!",
          upvoteReport.rows[0],
        ),
      );
  } catch (error) {
    console.log("Unable to upvote the report ", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(
      500,
      "Internal Server error occur during upvoting report",
    );
  }
});
export const getUpovtes = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user?.id;
  try {
    if (!userId) {
      throw new apiErrorHandler(401, "User Id is required");
    }
    if (!reportId) {
      throw new apiErrorHandler(404, "Report Id is required");
    }
    const reportResult = await pool.query(
      `
        SELECT id
        FROM reports
        WHERE id = $1
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [reportId],
    );
    if (reportResult.rows.length === 0) {
      throw new apiErrorHandler(404, "No Reports are found");
    }
    const result = await pool.query(
      `
    SELECT
      COUNT(*)::INTEGER AS upvotes,
      BOOL_OR(user_id = $2) AS "hasUpvoted"
    FROM upvotes
    WHERE report_id = $1
  `,
      [reportId, userId],
    );
    const data = {
      hasUpvoted: result.rows[0].hasUpvoted ?? false,
      upvotes: result.rows[0].upvotes,
    };
    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "Report upvotes fetched successfully",
          data,
        ),
      );
  } catch (error) {
    console.log("Unable to get report upvotes:", error);

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    throw new apiErrorHandler(
      500,
      "Internal server error occurred while fetching upvotes",
    );
  }
});
export const deleteUpvotes = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user?.id;
  try {
    if (!userId) {
      throw new apiErrorHandler(401, "User Id is required");
    }
    if (!reportId) {
      throw new apiErrorHandler(404, "Report Id is required");
    }
    const result = await pool.query(
      `SELECT 
      id 
      FROM reports
       WHERE id=$1 
       AND deleted_at Is NULL
       LIMIT 1
       `,
      [reportId],
    );
    if (result.rows.length === 0) {
      throw new apiErrorHandler(404, "No reports are found");
    }
    const deleteUpvotes = await pool.query(
      `
    DELETE FROM upvotes
    WHERE report_id = $1
      AND user_id = $2
    RETURNING
      id,
      user_id,
      report_id,
      created_at
  `,
      [reportId, userId],
    );
    if (deleteUpvotes.rows.length === 0) {
      throw new apiErrorHandler(404, "No upvotes are found");
    }
    const confirmDeleteUpvotes = deleteUpvotes.rows[0];
    return res
      .status(201)
      .json(
        new apiResponseHandler(
          201,
          "Upvotes deleted successfully",
          confirmDeleteUpvotes,
        ),
      );
  } catch (error) {
    console.log("Unable to delete Upvotes", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(
      500,
      "Internal Server error occuring during upvote deletion",
    );
  }
});
