import asyncHandler from "../utils/asyncHandler.js";
import apiResponseHandler from "../utils/apiResponseHandler.js";
import pool from "../config/db.js";

export const getAuditLogs = asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT
      id,
      actor_id,
      actor_name,
      actor_role,
      action,
      target_type,
      target_id,
      target_name,
      description,
      metadata,
      ip_address,
      created_at
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT 500
  `);

  return res.status(200).json(
    new apiResponseHandler(
      200,
      "Audit logs fetched successfully",
      result.rows
    )
  );
});