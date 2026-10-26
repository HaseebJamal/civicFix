import asyncHandler from "../utils/asyncHandler.js";
import pool from "../config/db.js";
export const getSuperAdminDashboard = asyncHandler(async (req, res) => {
  const totalUsersResult = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM users
      WHERE role != 'superadmin'
    `);

  const totalReportsResult = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM reports
      WHERE deleted_at IS NULL
    `);

  const pendingReportsResult = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM reports
      WHERE status = 'pending'
        AND deleted_at IS NULL
    `);

  const inProgressReportsResult = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM reports
      WHERE status = 'in_progress'
        AND deleted_at IS NULL
    `);

  const resolvedReportsResult = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM reports
      WHERE status = 'resolved'
        AND deleted_at IS NULL
    `);

  const verificationResult = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM users
      WHERE account_status = 'pending'
    `);

  const totalWardsResult = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM wards
    `);

  const recentReportsResult = await pool.query(`
      SELECT
        id,
        ward_id,
        user_id,
        category,
        description,
        longitude,
        latitude,
        address,
        status,
        created_at,
        updated_at
      FROM reports
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 5
    `);

  return res.status(200).json({
    success: true,
    message: "SuperAdmin dashboard data fetched successfully",
    data: {
      stats: {
        totalUsers: totalUsersResult.rows[0].total,
        totalReports: totalReportsResult.rows[0].total,
        pendingReports: pendingReportsResult.rows[0].total,
        inProgressReports: inProgressReportsResult.rows[0].total,
        resolvedReports: resolvedReportsResult.rows[0].total,
        verificationRequests: verificationResult.rows[0].total,
        totalWards: totalWardsResult.rows[0].total,
      },

      recentReports: recentReportsResult.rows,
    },
  });
});
