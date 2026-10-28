import asyncHandler from "../utils/asyncHandler.js";
import apiErrorHandler from "../utils/apiErrorHandler.js";
import apiResponseHandler from "../utils/apiResponseHandler.js";
import {
  findWardLocation,
  getWardBoundaryGeometry,
} from "../utils/findWardLocation.js";
import { findDistrictLocation } from "../utils/findDistrictLocation.js";
import { createNotification } from "../utils/notificationGenerator.js";
import { sendEmail } from "../utils/sendEmail.js";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import createAuditLog from "../utils/createAuditLog.js";
import {
  getIO,
  emitNewReport,
  emitReportStatusUpdated,
  emitReportDeleted,
} from "../socket/socketServer.js";
const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });

const sendReportStatusEmail = async ({ email, category, status, reportId }) => {
  const statusText = {
    in_progress: "In Progress",
    resolved: "Resolved",
  };

  const displayStatus = statusText[status];

  if (!displayStatus) {
    return;
  }

  const isResolved = status === "resolved";

  const subject = isResolved
    ? "Your CivicFix report has been resolved"
    : "Work has started on your CivicFix report";

  const html = `
    <h2>${isResolved ? "Report Resolved" : "Report In Progress"}</h2>

    <p>Hello,</p>

    <p>
      There is an update to your CivicFix report.
    </p>

    <p>
      <strong>Report category:</strong>
      ${escapeHtml(category)}
    </p>

    <p>
      <strong>New status:</strong>
      ${displayStatus}
    </p>

    <p>
      <strong>Report ID:</strong>
      ${escapeHtml(reportId)}
    </p>

    <p>
      ${
        isResolved
          ? "The issue has been marked as resolved. Thank you for helping improve your community."
          : "The relevant ward team has started working on the reported issue."
      }
    </p>

    <p>Regards,<br />CivicFix Team</p>
  `;

  return sendEmail({
    to: email,
    subject,
    html,
  });
};
export const createReport = asyncHandler(async (req, res) => {
  const { category, description, longitude, latitude, address } = req.body;

  const userId = req.user.id;

  try {
    if (
      !category ||
      !description ||
      longitude === undefined ||
      latitude === undefined
    ) {
      throw new apiErrorHandler(400, "All fields are required!");
    }

    if (!userId) {
      throw new apiErrorHandler(401, "UserId is required");
    }

    const updatedLatitude = Number(latitude);
    const updatedLongitude = Number(longitude);

    if (Number.isNaN(updatedLatitude) || Number.isNaN(updatedLongitude)) {
      throw new apiErrorHandler(
        400,
        "Longitude or latitude must be a valid number",
      );
    }

    if (updatedLatitude > 90 || updatedLatitude < -90) {
      throw new apiErrorHandler(400, "Latitude must be between -90 and 90");
    }

    if (updatedLongitude > 180 || updatedLongitude < -180) {
      throw new apiErrorHandler(400, "Longitude must be between -180 and 180");
    }
    const updatedCategory = category.trim().toLowerCase();
    const wardId =
      (await findWardLocation(updatedLongitude, updatedLatitude)) ?? null;
    const districtId = await findDistrictLocation(
      updatedLongitude,
      updatedLatitude,
    );

    if (!districtId) {
      throw new apiErrorHandler(
        400,
        "The report location is outside all known districts.",
      );
    }
    const createdReport = await pool.query(
      `INSERT INTO reports (
      ward_id,
          district_id,

        user_id,
        category,
        description,
        latitude,
        longitude,
        address
      )
      VALUES ($1, $2, $3, $4, $5, $6,$7,$8)
      RETURNING
        id,
        ward_id,
          district_id,

        user_id,
        category,
        description,
        latitude,
        longitude,
        address,
        status,
        created_at`,
      [
        wardId,
        districtId,
        userId,
        updatedCategory,
        description.trim(),
        updatedLatitude,
        updatedLongitude,
        address?.trim() || null,
      ],
    );
    const report = createdReport.rows[0];
    await createAuditLog({
      actor: req.user,
      action: "report_created",
      targetType: "report",
      targetId: report.id,
      targetName: report.category,
      description: `Created report ${report.category}.`,
      metadata: { ward_id: report.ward_id },
      ipAddress: req.ip,
    });

    emitNewReport({
      id: report.id,
      ward_id: report.ward_id,
      district_id: report.district_id,
      category: report.category,
      description: report.description,
      latitude: Number(report.latitude),
      longitude: Number(report.longitude),
      address: report.address,
      status: report.status,
      created_at: report.created_at,
    });

    getIO().to("public:trending").emit("trending:updated", {
      reportId: report.id,
    });
    return res
      .status(201)
      .json(
        new apiResponseHandler(201, "Report created successfully!", report),
      );
  } catch (error) {
    console.log("Unable to create report:", error);

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    throw new apiErrorHandler(500, "Internal server error");
  }
});

export const getPublicReports = asyncHandler(async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        category,
        description,
        longitude,
        latitude,
        address,
        status,
        created_at
      FROM reports
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `);

    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "Public reports fetched successfully!",
          result.rows,
        ),
      );
  } catch (error) {
    console.error("Unable to fetch public reports:", error);

    throw new apiErrorHandler(
      500,
      error.message || "Something went wrong while fetching public reports",
    );
  }
});

export const getAllReport = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  try {
    if (!userId) {
      throw new apiErrorHandler(401, "User ID is required");
    }

    const { lat, lng, radius, search } = req.query;

    const hasLocationParams =
      lat !== undefined || lng !== undefined || radius !== undefined;
    let locationFilter = "";
    let wardFilter = "";
    const queryParams = [userId];

    if (hasLocationParams) {
      const latitude = Number(lat);
      const longitude = Number(lng);
      const radiusKm = radius === undefined ? 10 : Number(radius);

      if (
        lat === undefined ||
        lng === undefined ||
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180 ||
        !Number.isFinite(radiusKm) ||
        radiusKm <= 0
      ) {
        throw new apiErrorHandler(400, "Invalid location filter");
      }

      queryParams.push(latitude, longitude, radiusKm);
      locationFilter = `
        AND (
          6371 * ACOS(
            LEAST(
              1,
              GREATEST(
                -1,
                COS(RADIANS($2)) * COS(RADIANS(r.latitude)) *
                COS(RADIANS(r.longitude) - RADIANS($3)) +
                SIN(RADIANS($2)) * SIN(RADIANS(r.latitude))
              )
            )
          )
        ) <= $4
      `;
    }
    let searchFilter = "";

    const normalizedSearch = search
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (normalizedSearch) {
      const searchTerm = `%${normalizedSearch}%`;
      const searchParamIndex = queryParams.length + 1;

      queryParams.push(searchTerm);

      searchFilter = `
        AND (
          regexp_replace(
            lower(
              r.category::TEXT || ' ' ||
              CASE lower(r.category::TEXT)
                WHEN 'pothole' THEN 'road pothole'
                WHEN 'streetlight' THEN 'street lights'
                WHEN 'garbage_waste' THEN 'garbage waste'
                WHEN 'water_supply' THEN 'water supply'
                WHEN 'sewerage_drainage' THEN 'sewerage drainage'
                WHEN 'illegal_construction_encroachment'
                  THEN 'illegal construction encroachment'
                WHEN 'traffic_signal' THEN 'traffic signal'
                WHEN 'public_property_damage'
                  THEN 'public property damage'
                ELSE ''
              END
            ),
            '[^[:alnum:]]',
            '',
            'g'
          ) LIKE $${searchParamIndex}
          OR regexp_replace(
            lower(COALESCE(r.description, '')),
            '[^[:alnum:]]',
            '',
            'g'
          ) LIKE $${searchParamIndex}
          OR regexp_replace(
            lower(COALESCE(r.address, '')),
            '[^[:alnum:]]',
            '',
            'g'
          ) LIKE $${searchParamIndex}
        )
      `;
    }

    if (req.user.role === "ward_official") {
      queryParams.push(userId);
      wardFilter = `
        AND r.ward_id = (
          SELECT w.id
          FROM wards w
          WHERE w.official_id = $${queryParams.length}
          LIMIT 1
        )
      `;
    }

    const result = await pool.query(
      `
      SELECT
        r.id,
        r.ward_id,
  r.district_id,

        r.user_id,
        r.category,
        r.description,
        r.longitude,
        r.latitude,
        r.address,
        r.status,
        r.created_at,
        r.updated_at,

        u.username,
        u.first_name,
        u.last_name,
        u.profile_image,
        u.address AS user_address,

        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'image_url', ri.image_url,
                'image_type', ri.image_type
              )
              ORDER BY ri.created_at ASC
            )
            FROM report_images ri
            WHERE ri.report_id = r.id
          ),
          '[]'::json
        ) AS images,

        (
          SELECT COUNT(*)::int
          FROM upvotes uv
          WHERE uv.report_id = r.id
        ) AS upvotes_count,

        EXISTS (
          SELECT 1
          FROM upvotes uv
          WHERE uv.report_id = r.id
            AND uv.user_id = $1
        ) AS has_upvoted,

        (
          SELECT COUNT(*)::int
          FROM comments c
          WHERE c.report_id = r.id
        ) AS comments_count,

        EXISTS (
          SELECT 1
          FROM saved_reports sr
          WHERE sr.report_id = r.id
            AND sr.user_id = $1
        ) AS is_saved
FROM reports r

LEFT JOIN users u
  ON u.id = r.user_id

LEFT JOIN public.administrative_areas district
  ON district.id = r.district_id
  AND district.area_level = 'district'

      WHERE r.deleted_at IS NULL
        ${locationFilter}
        ${searchFilter}
        ${wardFilter}


      ORDER BY r.created_at DESC
      `,
      queryParams,
    );

    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "All reports fetched successfully!",
          result.rows,
        ),
      );
  } catch (error) {
    console.error("Unable to fetch reports:", error);

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    throw new apiErrorHandler(
      500,
      error.message || "Something went wrong while fetching reports",
    );
  }
});

export const getMyReport = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new apiErrorHandler(401, "Authentication required");
  }

  try {
    const result = await pool.query(
      `
      SELECT
        r.id,
        r.ward_id,
        r.district_id,

        r.user_id,
        u.username,
        u.first_name,
        u.last_name,
        u.profile_image,
        u.address AS user_address,
        r.category,
        r.description,
        r.latitude,
        r.longitude,
        r.address,
        r.status,
        r.created_at,
        r.updated_at,

        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', ri.id,
                'image_url', ri.image_url,
                'image_type', ri.image_type
              )
              ORDER BY ri.created_at DESC
            )
            FROM report_images ri
            WHERE ri.report_id = r.id
          ),
          '[]'::json
        ) AS images,

        (
          SELECT COUNT(*)::int
          FROM upvotes v
          WHERE v.report_id = r.id
        ) AS upvotes_count,

        (
          SELECT COUNT(*)::int
          FROM comments c
          WHERE c.report_id = r.id
        ) AS comments_count,

        EXISTS (
          SELECT 1
          FROM upvotes v
          WHERE v.report_id = r.id
            AND v.user_id = $1
        ) AS has_upvoted

      FROM reports r

LEFT JOIN users u
  ON u.id = r.user_id

LEFT JOIN public.administrative_areas district
  ON district.id = r.district_id
  AND district.area_level = 'district'

      WHERE r.user_id = $1
        AND r.deleted_at IS NULL

      ORDER BY r.created_at DESC
      `,
      [userId],
    );

    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "My reports fetched successfully",
          result.rows,
        ),
      );
  } catch (error) {
    console.error("Unable to fetch my reports:", error);

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    throw new apiErrorHandler(500, "Internal error while fetching reports");
  }
});

export const deleteReportById = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  const { report_title_confirmation, password, deletion_reason } =
    req.body || {};

  let client;

  try {
    // 1. Verify authentication and role.
    if (!userId) {
      throw new apiErrorHandler(401, "Authentication required.");
    }

    if (userRole !== "superadmin") {
      throw new apiErrorHandler(
        403,
        "Only the Super Admin can approve report deletion.",
      );
    }

    const normalizedReportId = String(reportId ?? "").trim();
    const isNumericReportId = /^\d+$/.test(normalizedReportId);
    const isUuidReportId =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        normalizedReportId,
      );

    if (!isNumericReportId && !isUuidReportId) {
      throw new apiErrorHandler(400, "A valid report ID is required.");
    }

    // 2. Validate all required approval fields.
    if (
      typeof report_title_confirmation !== "string" ||
      !report_title_confirmation.trim()
    ) {
      throw new apiErrorHandler(
        400,
        "Exact report category confirmation is required.",
      );
    }

    if (typeof password !== "string" || !password) {
      throw new apiErrorHandler(400, "Your Super Admin password is required.");
    }

    if (typeof deletion_reason !== "string" || !deletion_reason.trim()) {
      throw new apiErrorHandler(400, "Deletion reason is required.");
    }

    client = await pool.connect();
    await client.query("BEGIN");

    // 3. Lock the report row while approval is being checked.
    const reportResult = await client.query(
      `SELECT id, category
       FROM reports
       WHERE id = $1
         AND deleted_at IS NULL
       FOR UPDATE`,
      [normalizedReportId],
    );

    if (reportResult.rowCount === 0) {
      throw new apiErrorHandler(404, "Report not found or already deleted.");
    }

    const report = reportResult.rows[0];

    // 4. Require an exact category match.
    if (report_title_confirmation.trim() !== String(report.category).trim()) {
      throw new apiErrorHandler(400, "The report category does not match.");
    }

    // 5. Load the authenticated admin's password hash.
    // Change password_hash if your users table uses another column name.
    const adminResult = await client.query(
      `SELECT password_hash
       FROM users
       WHERE id = $1`,
      [userId],
    );

    if (adminResult.rowCount === 0 || !adminResult.rows[0].password_hash) {
      throw new apiErrorHandler(
        401,
        "Could not verify your account credentials.",
      );
    }

    // 6. Verify the password using bcrypt.
    const passwordMatches = await bcrypt.compare(
      password,
      adminResult.rows[0].password_hash,
    );

    if (!passwordMatches) {
      throw new apiErrorHandler(403, "Incorrect Super Admin password.");
    }

    // 7. Soft-delete the report; do not permanently delete it.
    const deletedReportResult = await client.query(
      `UPDATE reports
       SET deleted_at = NOW(),
           deleted_by = $1,
           deletion_reason = $2,
           updated_at = NOW()
       WHERE id = $3
         AND deleted_at IS NULL
       RETURNING
         id,
         ward_id,
         user_id,
         category,
         status,
         deleted_at,
         deleted_by,
         deletion_reason`,
      [userId, deletion_reason.trim(), normalizedReportId],
    );

    if (deletedReportResult.rowCount === 0) {
      throw new apiErrorHandler(409, "Report has already been deleted.");
    }

    await client.query("COMMIT");
    emitReportDeleted(deletedReportResult.rows[0].id);

    await createAuditLog({
      actor: req.user,
      action: "report_deleted",
      targetType: "report",
      targetId: report.id,
      targetName: report.category,
      description: `Deleted report ${report.category}.`,
      metadata: { deletion_reason: deletion_reason.trim() },
      ipAddress: req.ip,
    });

    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "Report soft-deleted successfully.",
          deletedReportResult.rows[0],
        ),
      );
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    console.error("DELETE REPORT ERROR:", error);

    throw new apiErrorHandler(
      500,
      "Internal server error while deleting the report.",
    );
  } finally {
    client?.release();
  }
});

export const getDeletedReports = asyncHandler(async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         r.id,
         r.ward_id,
         r.user_id,
         r.category,
         r.description,
         r.latitude,
         r.longitude,
         r.address,
         r.status,
         r.created_at,
         r.deleted_at,
         r.deletion_reason,
         u.username,
         u.first_name,
         u.last_name
       FROM reports r
       LEFT JOIN users u ON u.id::text = r.user_id::text
       WHERE r.deleted_at IS NOT NULL
       ORDER BY r.deleted_at DESC`,
    );

    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "Deleted reports fetched successfully.",
          result.rows,
        ),
      );
  } catch (error) {
    console.error("Unable to fetch deleted reports:", error);
    throw new apiErrorHandler(
      500,
      "Internal server error while fetching deleted reports.",
    );
  }
});

export const restoreReportById = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const normalizedReportId = String(reportId ?? "").trim();
  const isNumericReportId = /^\d+$/.test(normalizedReportId);
  const isUuidReportId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      normalizedReportId,
    );

  if (!isNumericReportId && !isUuidReportId) {
    throw new apiErrorHandler(400, "A valid report ID is required.");
  }

  const restoredResult = await pool.query(
    `UPDATE reports
     SET deleted_at = NULL,
         deleted_by = NULL,
         deletion_reason = NULL,
         updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NOT NULL
     RETURNING
       id,
       ward_id,
       user_id,
       category,
       description,
       latitude,
       longitude,
       address,
       status,
       created_at`,
    [normalizedReportId],
  );

  if (restoredResult.rowCount === 0) {
    throw new apiErrorHandler(404, "Deleted report not found.");
  }

  const report = restoredResult.rows[0];

  await createAuditLog({
    actor: req.user,
    action: "report_restored",
    targetType: "report",
    targetId: report.id,
    targetName: report.category,
    description: `Restored report ${report.category}.`,
    ipAddress: req.ip,
  });

  emitNewReport({
    ...report,
    latitude: Number(report.latitude),
    longitude: Number(report.longitude),
  });

  return res
    .status(200)
    .json(new apiResponseHandler(200, "Report restored successfully.", report));
});

export const updateReportById = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const { category, description, longitude, latitude, address } = req.body;
  try {
    // console.log("REQ.USER:", req.user);
    // console.log("USER ID:", userId);
    // console.log("USER ROLE:", userRole);
    if (!userId) {
      throw new apiErrorHandler(401, "User Id is required!");
    }
    if (!userRole) {
      throw new apiErrorHandler(403, "User role is required!");
    }
    if (!reportId) {
      throw new apiErrorHandler(400, "Report Id is required!");
    }
    if (
      !category ||
      !description ||
      longitude === undefined ||
      latitude === undefined
    ) {
      throw new apiErrorHandler(400, "All fields are required!");
    }
    const updatedCategory = category.trim().toLowerCase();
    const updatedDescription = description.trim();
    const updatedLongitude = Number(longitude);
    const updatedLatitude = Number(latitude);
    if (Number.isNaN(updatedLatitude) || Number.isNaN(updatedLongitude)) {
      throw new apiErrorHandler(
        400,
        "Longitude or latitude must be a valid number",
      );
    }
    if (updatedLatitude > 90 || updatedLatitude < -90) {
      throw new apiErrorHandler(400, "Latitude must be between -90 and 90");
    }
    if (updatedLongitude > 180 || updatedLongitude < -180) {
      throw new apiErrorHandler(400, "Longitude must be between -180 and 180");
    }
    const result = await pool.query(
      `SELECT
        id,
        ward_id,
            district_id,

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
       WHERE id=$1
       AND deleted_at IS NULL
       LIMIT 1`,
      [reportId],
    );
    if (result.rows.length === 0) {
      throw new apiErrorHandler(404, "Report not found");
    }
    const report = result.rows[0];
    if (userRole === "citizen") {
      if (report.user_id !== userId) {
        throw new apiErrorHandler(403, "You can only update your own report");
      }
    }
    if (userRole === "ward_official") {
      const wardResult = await pool.query(
        `SELECT
          id
         FROM wards
         WHERE official_id=$1
         LIMIT 1`,
        [userId],
      );

      if (wardResult.rows.length === 0) {
        throw new apiErrorHandler(403, "You are not assigned to any ward");
      }

      const officialWardId = wardResult.rows[0].id;

      if (report.ward_id !== officialWardId) {
        throw new apiErrorHandler(
          403,
          "You can only update reports from your assigned ward",
        );
      }
    }
    if (
      userRole !== "citizen" &&
      userRole !== "ward_official" &&
      userRole !== "superadmin"
    ) {
      throw new apiErrorHandler(
        403,
        "You do not have permission to update this report",
      );
    }
    const wardId = await findWardLocation(updatedLongitude, updatedLatitude);

    if (!wardId) {
      throw new apiErrorHandler(
        400,
        "The updated location is outside all wards",
      );
    }

    const districtId = await findDistrictLocation(
      updatedLongitude,
      updatedLatitude,
    );

    if (!districtId) {
      throw new apiErrorHandler(
        400,
        "The updated location is outside all known districts",
      );
    }

    const updatedReport = await pool.query(
      `UPDATE reports
   SET
     ward_id = $1,
     district_id = $2,
     category = $3,
     description = $4,
     longitude = $5,
     latitude = $6,
     address = $7,
     updated_at = NOW()
   WHERE id = $8
     AND deleted_at IS NULL
   RETURNING
     id,
     ward_id,
     district_id,
     user_id,
     category,
     description,
     longitude,
     latitude,
     address,
     status,
     created_at,
     updated_at`,
      [
        wardId,
        districtId,
        updatedCategory,
        updatedDescription,
        updatedLongitude,
        updatedLatitude,
        address?.trim() || null,
        reportId,
      ],
    );

    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "Report updated successfully!",
          updatedReport.rows[0],
        ),
      );
  } catch (error) {
    console.log("Unable to update report by Id error", error);

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    throw new apiErrorHandler(
      500,
      "Internal Server Error while updating Report by Id",
    );
  }
});
export const getReportById = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  try {
    if (!reportId) {
      throw new apiErrorHandler(400, "Report id is required");
    }

    if (!userId) {
      throw new apiErrorHandler(401, "Unauthorized request");
    }
    const result = await pool.query(
      `SELECT
        r.id,
        r.ward_id,
        r.district_id,

        r.user_id,
        r.category,
        r.description,
        r.longitude,
        r.latitude,
        r.address,
        r.status,
        r.created_at,
        r.updated_at,
        u.first_name,
        u.last_name,
        u.username,
        u.email,
        COALESCE(
          NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
          NULLIF(BTRIM(u.username), ''),
          NULLIF(BTRIM(u.email), ''),
          'Citizen'
        ) AS citizen_name,
        json_build_object(
          'id', u.id,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'username', u.username,
          'email', u.email,
          'full_name', COALESCE(
            NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
            NULLIF(BTRIM(u.username), ''),
            NULLIF(BTRIM(u.email), ''),
            'Citizen'
          )
        ) AS citizen,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', ri.id,
                'image_url', ri.image_url,
                'image_type', ri.image_type
              )
              ORDER BY ri.created_at ASC
            )
            FROM report_images ri
            WHERE ri.report_id = r.id
          ),
          '[]'::json
        ) AS images
     FROM reports r

LEFT JOIN users u
  ON u.id::text = r.user_id::text

LEFT JOIN public.administrative_areas district
  ON district.id = r.district_id
  AND district.area_level = 'district'

WHERE r.id = $1
  AND r.deleted_at IS NULL
LIMIT 1`,
      [reportId],
    );
    if (result.rows.length === 0) {
      throw new apiErrorHandler(404, "No reports found");
    }
    const findedReport = result.rows[0];
    if (userRole === "citizen") {
      if (findedReport.user_id !== userId) {
        throw new apiErrorHandler(
          403,
          "You do not have permission to view this report",
          // findedReport,
        );
      }
      return res
        .status(200)
        .json(new apiResponseHandler(200, "Your report is", findedReport));
    }
    if (userRole === "superadmin") {
      return res
        .status(200)
        .json(
          new apiResponseHandler(
            200,
            "Report fetched successfully!",
            findedReport,
          ),
        );
    }
    if (userRole === "ward_official") {
      const wardResult = await pool.query(
        `SELECT id
     FROM wards
     WHERE official_id=$1
     LIMIT 1`,
        [userId],
      );

      if (wardResult.rows.length === 0) {
        throw new apiErrorHandler(403, "You are not assigned to any ward");
      }

      const wardOfficialWardId = wardResult.rows[0].id;

      if (findedReport.ward_id !== wardOfficialWardId) {
        console.log("REPORT WARD ID:", findedReport.ward_id);
        console.log("OFFICIAL WARD ID:", wardOfficialWardId);
        throw new apiErrorHandler(
          403,
          "You do not have permission to view this report",
        );
      }

      return res
        .status(200)
        .json(
          new apiResponseHandler(
            200,
            "Report fetched successfully!",
            findedReport,
          ),
        );
    }
    throw new apiErrorHandler(
      403,
      "You do not have permission to view this report",
    );
  } catch (error) {
    console.log("Unable to fetch reports by Id error", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(
      500,
      "Internal server occur while fetching reports",
    );
  }
});
export const getWardReports = asyncHandler(async (req, res) => {
  const { wardId } = req.params;
  try {
    if (!wardId) {
      throw new apiErrorHandler(400, "Ward Id is required ");
    }
    if (req.user.role !== "superadmin") {
      const wardResult = await pool.query(
        `SELECT id 
        FROM
         wards
          WHERE id=$1 
          AND 
          official_id=$2`,
        [wardId, req.user.id],
      );
      if (wardResult.rows.length === 0) {
        throw new apiErrorHandler(403, "You are not assigned to this ward");
      }
    }
    const result = await pool.query(
      `SELECT 
        r.id,
        r.user_id,
        
        r.ward_id,
        r.district_id,
district.name AS district_name,

        r.category,
        r.description,
        r.longitude,
        r.latitude,
        r.address,
        r.status,
        r.created_at,
        r.updated_at,
        u.username,
        u.first_name,
        u.last_name,
        u.email,
        COALESCE(
          NULLIF(
            BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)),
            ''
          ),
          NULLIF(BTRIM(u.username), ''),
          NULLIF(BTRIM(u.email), ''),
          'Citizen'
        ) AS citizen_name,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', ri.id,
                'image_url', ri.image_url,
                'image_type', ri.image_type
              )
              ORDER BY ri.created_at ASC
            )
            FROM report_images ri
            WHERE ri.report_id = r.id
          ),
          '[]'::json
        ) AS images
       FROM reports r

LEFT JOIN users u
  ON u.id = r.user_id

LEFT JOIN public.administrative_areas district
  ON district.id = r.district_id
  AND district.area_level = 'district'

WHERE r.ward_id = $1
  AND r.deleted_at IS NULL

ORDER BY r.created_at DESC`,
      [wardId],
    );
    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "Ward Reports are fetch succesfully",
          result.rows,
        ),
      );
  } catch (error) {
    console.log("Unable to fetch wards reports error:", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(
      500,
      "Internal Server Error ocurr while fetching wards reports",
    );
  }
});

export const updateReportStatus = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const { status } = req.body;
  try {
    if (!reportId) {
      throw new apiErrorHandler(404, "Report id is required");
    }
    if (typeof status !== "string" || !status.trim()) {
      throw new apiErrorHandler(400, "A report status is required.");
    }
    const reportResult = await pool.query(
      `SELECT id, ward_id, district_id
   FROM reports
   WHERE id = $1
     AND deleted_at IS NULL`,
      [reportId],
    );
    if (reportResult.rows.length === 0) {
      throw new apiErrorHandler(404, "No report found");
    }
    const report = reportResult.rows[0];

    if (req.user.role !== "superadmin") {
      const wardResult = await pool.query(
        `SELECT id
     FROM wards
     WHERE id = $1
       AND official_id = $2`,
        [report.ward_id, req.user.id],
      );

      if (wardResult.rows.length === 0) {
        throw new apiErrorHandler(
          403,
          "You are not authorized to update reports in this ward",
        );
      }
    }

    // Is check ke baad tumhari existing status-update
    // aur status-history logic chalegi.
    const result = await pool.query(
      `
  SELECT
    r.id,
    r.ward_id,
    r.district_id,
    district.name AS district_name,
    r.user_id,
    r.category,
    r.description,
    r.longitude,
    r.latitude,
    r.address,
    r.status,
    r.created_at,
    r.updated_at
  FROM public.reports r
  LEFT JOIN public.administrative_areas district
    ON district.id = r.district_id
    AND district.area_level = 'district'
  WHERE r.id = $1
    AND r.deleted_at IS NULL
  `,
      [reportId],
    );
    if (result.rows.length === 0) {
      throw new apiErrorHandler(404, "No reports found");
    }
    const findedReport = result.rows[0];
    const currentStatus = findedReport.status;
    const newStatus = status.toLowerCase();
    const allowedTransitions = {
      pending: ["in_progress"],
      in_progress: ["resolved"],
      resolved: [],
    };
    if (!allowedTransitions[currentStatus].includes(newStatus)) {
      throw new apiErrorHandler(
        400,
        `Cannot change report status from ${currentStatus} to ${newStatus}`,
      );
    }
    const updatedReportStatus = await pool.query(
      `UPDATE 
      reports 
      SET status=$1,
       updated_at = NOW()
        WHERE id=$2 
        AND deleted_at IS NULL
        RETURNING
        id,
        ward_id,
        user_id,
        district_id,
        category,
        description,
        longitude,
        latitude,
        address,
        status,
        created_at,
        updated_at`,
      [newStatus, reportId],
    );
    const statusHistory = await pool.query(
      `
    INSERT INTO report_status_history
    (
      report_id,
      old_status,
      new_status,
      changed_by
    )
    VALUES ($1, $2, $3, $4)
    RETURNING
      id,
      report_id,
      old_status,
      new_status,
      changed_by,
      created_at
  `,
      [reportId, currentStatus, newStatus, req.user.id],
    );
    const updatedReport = updatedReportStatus.rows[0];

    emitReportStatusUpdated({
      id: updatedReport.id,
      ward_id: updatedReport.ward_id,
      district_id: updatedReport.district_id,

      category: updatedReport.category,
      description: updatedReport.description,
      latitude: Number(updatedReport.latitude),
      longitude: Number(updatedReport.longitude),
      address: updatedReport.address,
      status: updatedReport.status,
      created_at: updatedReport.created_at,
      updated_at: updatedReport.updated_at,
    });
    await createAuditLog({
      actor: req.user,
      action: "report_status_changed",
      targetType: "report",
      targetId: findedReport.id,
      targetName: findedReport.category,
      description: `Changed report status from ${currentStatus} to ${newStatus}.`,
      metadata: { old_status: currentStatus, new_status: newStatus },
      ipAddress: req.ip,
    });
    if (findedReport.user_id !== req.user.id) {
      if (newStatus === "resolved") {
        await createNotification({
          userId: findedReport.user_id,
          reportId: findedReport.id,
          type: "report_resolved",
          title: "Report resolved",
          message: "Your report has been resolved.",
        });
      } else {
        const statusText = {
          pending: "Pending",
          in_progress: "In Progress",
          resolved: "Resolved",
        };

        await createNotification({
          userId: findedReport.user_id,
          reportId: findedReport.id,
          type: "report_status_changed",
          title: "Report status updated",
          message: `Your report status has been changed to ${statusText[newStatus]}.`,
        });
      }
    }
    // Send an email to the citizen when the report status changes.
    if (["in_progress", "resolved"].includes(newStatus)) {
      try {
        const emailPreferenceResult = await pool.query(
          `SELECT setting_value
           FROM site_settings
           WHERE setting_key = $1
           LIMIT 1`,
          ["email_notifications"],
        );

        if (emailPreferenceResult.rows[0]?.setting_value === "false") {
          console.info(
            "Report status email skipped: site email notifications are disabled.",
          );
        } else {
          const citizenResult = await pool.query(
            `SELECT email
             FROM users
             WHERE id = $1
               AND is_active = TRUE`,
            [findedReport.user_id],
          );

          if (citizenResult.rows.length > 0) {
            await sendReportStatusEmail({
              email: citizenResult.rows[0].email,
              category: findedReport.category,
              status: newStatus,
              reportId: findedReport.id,
            });
          } else {
            console.warn(
              "Report status email skipped: citizen not found or inactive.",
            );
          }
        }
      } catch (emailError) {
        console.error(
          "Failed to send report status email:",
          emailError.message,
        );
      }
    }
    return res.json(
      new apiResponseHandler(200, "Status updated successfully", {
        report: updatedReportStatus.rows[0],
        history: statusHistory.rows[0],
      }),
    );
  } catch (error) {
    console.log("Unable to Update status of the report error:", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(
      500,
      "Internal server error occur while updating status",
    );
  }
});
export const getReportStatusHistory = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  try {
    if (!reportId) {
      throw new apiErrorHandler(400, "report id is required");
    }
    if (!userId) {
      throw new apiErrorHandler(401, "Unauthorized Request");
    }

    const result = await pool.query(
      `
  SELECT
    r.id,
    r.ward_id,
    r.user_id,
    r.district_id,
    district.name AS district_name,
    r.category,
    r.description,
    r.longitude,
    r.latitude,
    r.address,
    r.status,
    r.created_at,
    r.updated_at
  FROM reports r
  LEFT JOIN public.administrative_areas district
    ON district.id = r.district_id
    AND district.area_level = 'district'
  WHERE r.id = $1
    AND r.deleted_at IS NULL
  `,
      [reportId],
    );

    if (result.rows.length === 0) {
      throw new apiErrorHandler(404, "No reports are found");
    }
    const currentReport = result.rows[0];
    // Citizen
    if (userRole === "citizen") {
      if (currentReport.user_id !== userId) {
        throw new apiErrorHandler(
          403,
          "You are not allowed to view this report history",
        );
      }
    }
    if (userRole === "ward_official") {
      const wardResult = await pool.query(
        `
          SELECT id
          FROM wards
          WHERE official_id = $1
          LIMIT 1
        `,
        [userId],
      );
      if (wardResult.rows.length === 0) {
        throw new apiErrorHandler(403, "You are not assigned to any ward");
      }
      const wardId = wardResult.rows[0].id;
      if (currentReport.ward_id !== wardId) {
        throw new apiErrorHandler(
          403,
          "You are not allowed to view this report history",
        );
      }
    }
    const statusHistory = await pool.query(
      `
        SELECT
          id,
          report_id,
          old_status,
          new_status,
          changed_by,
          created_at
        FROM report_status_history
        WHERE report_id = $1
        ORDER BY created_at ASC
      `,
      [reportId],
    );

    if (statusHistory.rows.length === 0) {
      throw new apiErrorHandler(404, "No status history found");
    }

    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "Status history fetched successfully!",
          statusHistory.rows,
        ),
      );
  } catch (error) {
    if (error instanceof apiErrorHandler) {
      throw error;
    }

    throw new apiErrorHandler(
      500,
      "Internal server error while fetching status history",
    );
  }
});

export const assignReportToWard = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const { ward_id } = req.body;

  // Only Superadmin can manually assign reports.
  if (req.user?.role !== "superadmin") {
    throw new apiErrorHandler(
      403,
      "Only Superadmin can assign reports to wards",
    );
  }

  if (!reportId) {
    throw new apiErrorHandler(400, "Report ID is required");
  }

  const reportResult = await pool.query(
    `SELECT
  id,
  ward_id,
  district_id,
  latitude,
  longitude,
  category
FROM reports
WHERE id = $1
  AND deleted_at IS NULL`,
    [reportId],
  );

  if (reportResult.rows.length === 0) {
    throw new apiErrorHandler(404, "Report not found");
  }

  const report = reportResult.rows[0];

  if (ward_id == null || ward_id === "") {
    const updatedReport = await pool.query(
      `UPDATE reports
   SET ward_id = NULL,
       updated_at = NOW()
   WHERE id = $1
     AND deleted_at IS NULL
   RETURNING
     id,
     ward_id,
     district_id,
     user_id,
     category,
     description,
     latitude,
     longitude,
     address,
     status,
     updated_at`,
      [reportId],
    );

    await createAuditLog({
      actor: req.user,
      action: "report_unassigned_from_ward",
      targetType: "report",
      targetId: report.id,
      targetName: report.category,
      description: `Removed the ward assignment from report ${report.category}.`,
      ipAddress: req.ip,
    });

    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "Report unassigned successfully",
          updatedReport.rows[0],
        ),
      );
  }

  // Find the selected ward's boundary.
  const wardResult = await pool.query(
    `SELECT id, ward_name, boundary_geojson
     FROM wards
     WHERE id = $1`,
    [ward_id],
  );

  if (wardResult.rows.length === 0) {
    throw new apiErrorHandler(404, "Selected ward not found");
  }

  const ward = wardResult.rows[0];
  const boundary = getWardBoundaryGeometry(ward.boundary_geojson);

  if (!boundary || !["Polygon", "MultiPolygon"].includes(boundary.type)) {
    throw new apiErrorHandler(
      500,
      "Selected ward has an invalid boundary geometry",
    );
  }

  const latitude = Number(report.latitude);
  const longitude = Number(report.longitude);
  if (
    report.latitude == null ||
    report.longitude == null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new apiErrorHandler(
      400,
      "This report does not have valid location coordinates and cannot be assigned to a ward",
    );
  }

  // Verify that the report's coordinates fall inside this ward.
  const reportPoint = point([longitude, latitude]);
  const isInsideWard = booleanPointInPolygon(reportPoint, boundary);

  if (!isInsideWard) {
    throw new apiErrorHandler(
      400,
      "The selected ward does not cover this report's location",
    );
  }

  // Assign the report to the selected ward.
  const updatedReport = await pool.query(
    `UPDATE reports
     SET ward_id = $1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING id, ward_id, user_id, category, description,
               latitude, longitude, address, status, updated_at`,
    [ward.id, reportId],
  );

  await createAuditLog({
    actor: req.user,
    action: "report_assigned_to_ward",
    targetType: "report",
    targetId: updatedReport.rows[0].id,
    targetName: updatedReport.rows[0].category,
    description: `Assigned report ${updatedReport.rows[0].category} to ward ${ward.ward_name}.`,
    metadata: { ward_id: ward.id, ward_name: ward.ward_name },
    ipAddress: req.ip,
  });

  return res
    .status(200)
    .json(
      new apiResponseHandler(
        200,
        "Report assigned to ward successfully",
        updatedReport.rows[0],
      ),
    );
});
export const getTrendingReports = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  try {
    if (!userId) {
      throw new apiErrorHandler(401, "User Id is required");
    }
    const result = await pool.query(
      `
      SELECT
        r.id,
        r.ward_id,
        r.user_id,
        r.district_id,
district.name AS district_name,
        r.category,
        r.description,
        r.longitude,
        r.latitude,
        r.address,
        r.status,
        r.created_at,
        r.updated_at,

        u.username,
        u.first_name,
        u.last_name,
        u.profile_image,
        u.address AS user_address,

        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'image_url', ri.image_url,
                'image_type', ri.image_type
              )
              ORDER BY ri.created_at ASC
            )
            FROM report_images ri
            WHERE ri.report_id = r.id
          ),
          '[]'::json
        ) AS images,

        (
          SELECT COUNT(*)::INTEGER
          FROM upvotes uv
          WHERE uv.report_id = r.id
        ) AS upvotes_count,

        EXISTS (
          SELECT 1
          FROM upvotes uv
          WHERE uv.report_id = r.id
            AND uv.user_id = $1
        ) AS has_upvoted,

        (
          SELECT COUNT(*)::INTEGER
          FROM comments c
          WHERE c.report_id = r.id
        ) AS comments_count,

        (
          (
            SELECT COUNT(*)
            FROM upvotes uv
            WHERE uv.report_id = r.id
          ) * 3
          +
          (
            SELECT COUNT(*)
            FROM comments c
            WHERE c.report_id = r.id
          ) * 2
          +
          CASE
            WHEN r.updated_at >= NOW() - INTERVAL '24 hours'
              THEN 10
            WHEN r.updated_at >= NOW() - INTERVAL '3 days'
              THEN 5
            WHEN r.updated_at >= NOW() - INTERVAL '7 days'
              THEN 2
            ELSE 0
          END
        )::INTEGER AS trending_score

      FROM reports r

LEFT JOIN users u
  ON u.id = r.user_id

LEFT JOIN public.administrative_areas district
  ON district.id = r.district_id
  AND district.area_level = 'district'

WHERE r.deleted_at IS NULL

      ORDER BY
        trending_score DESC,
        r.updated_at DESC

      LIMIT 20`,
      [userId],
    );
    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "Trending reports fetched successfully!",
          result.rows,
        ),
      );
  } catch (error) {
    console.error("Unable to fetch trending reports:", error);

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    throw new apiErrorHandler(
      500,
      "Internal server error occurred while fetching trending reports",
    );
  }
});
