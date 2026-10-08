import asyncHandler from "../utils/asyncHandler.js";
import apiErrorHandler from "../utils/apiErrorHandler.js";
import apiResponseHandler from "../utils/apiResponseHandler.js";
import { findWardLocation } from "../utils/findWardLocation.js";
import { createNotification } from "../utils/notificationGenerator.js";

import pool from "../config/db.js";
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
    const wardId = await findWardLocation(updatedLongitude, updatedLatitude);

    if (!wardId) {
      throw new apiErrorHandler(400, "Your location is outside all wards");
    }
    const createdReport = await pool.query(
      `INSERT INTO reports (
      ward_id,
        user_id,
        category,
        description,
        latitude,
        longitude,
        address
      )
      VALUES ($1, $2, $3, $4, $5, $6,$7)
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
      [
        wardId,
        userId,
        updatedCategory,
        description.trim(),
        updatedLatitude,
        updatedLongitude,
        address?.trim() || null,
      ],
    );

    return res
      .status(201)
      .json(
        new apiResponseHandler(
          201,
          "Report created successfully!",
          createdReport.rows[0],
        ),
      );
      
  } catch (error) {
    console.log("Unable to create report:", error);

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    throw new apiErrorHandler(500, "Internal server error");
  }
});
export const getAllReport = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  try {
    if (!userId) {
      throw new apiErrorHandler(400, "User Id is requied");
    }
    const result = await pool.query(`
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
        updated_at FROM reports WHERE deleted_at is NULL ORDER BY created_at  DESC`);
    if (result.rows.length === 0) {
      throw new apiErrorHandler(404, "No Report found!");
    }
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
  const userId = req.user.id;
  try {
    if (!userId) {
      throw new apiErrorHandler(400, "User Id is required");
    }
    const result = await pool.query(
      `
        SELECT id,
        ward_id,
        user_id,
        category,
        description,
        longitude,
        latitude,address,
        status,
         created_at,
         updated_at FROM reports WHERE user_id=$1
   AND deleted_at IS NULL
   ORDER BY created_at DESC`,
      [userId],
    );
    if (result.rows.length === 0) {
      throw new apiErrorHandler(404, "Currently No reports found");
    }
    return res
      .status(200)
      .json(
        new apiResponseHandler(200, "All my reports are fetched!", result.rows),
      );
  } catch (error) {
    console.log("Unable to fetch my records", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(
      500,
      "Internal error while extracting my reports",
    );
  }
});
export const deleteReportById = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user.id;
  // const { permanent } = req.query;
  const { deletion_reason } = req.body;
  try {
    // console.log("REQ BODY:", req.body);
    // console.log("CONTENT TYPE:", req.headers["content-type"]);
    if (!reportId || !userId) {
      throw new apiErrorHandler(
        400,
        " Deletion reason or Report id or UserId is required!",
      );
    }
    if (!deletion_reason || !deletion_reason.trim()) {
      throw new apiErrorHandler(400, "Deletion reason is required!");
    }
    const updatedReason = deletion_reason.trim();
    // if (permanent === "true") {
    //   await pool.query(`DELETE FROM reports WHERE id=$1`, [reportId]);
    //   return res
    //     .status(200)
    //     .json(new apiResponseHandler(200, "Report is permenently deleted!"));
    // }
    const deletedReport = await pool.query(
      `
    UPDATE reports
    SET
      deleted_at = NOW(),
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
      description,
      status,
      created_at,
      updated_at,
      deleted_at,
      deleted_by,
      deletion_reason
  `,
      [userId, updatedReason, reportId],
    );
    if (deletedReport.rows.length === 0) {
      throw new apiErrorHandler(404, "Report not found or already deleted");
    }
    const softDeletedReport = deletedReport.rows[0];
    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "Report is soft deleted successfully!",
          softDeletedReport,
        ),
      );
  } catch (error) {
    console.error("DELETE REPORT ERROR:", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(
      500,
      "Internal server error while deleting reports",
    );
  }
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
    const updatedReport = await pool.query(
      `UPDATE
       reports
       SET
        ward_id=$1,
        category=$2,
        description=$3,
        longitude=$4,
        latitude=$5,
        address=$6,
        updated_at=NOW()
       WHERE id=$7
       AND deleted_at IS NULL
       RETURNING
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
        updated_at`,
      [
        wardId,
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
  id,
  ward_id,
  user_id,
  category,
  description,
  longitude,
  latitude,
  address,
  status,
  updated_at FROM reports
   WHERE id=$1 AND deleted_at IS NULL
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
    const result = await pool.query(
      `SELECT 
      id,
      user_id,
      ward_id,
      category,
      description,
      longitude,
      latitude,
      address,
      status,
      created_at,
      updated_at
       FROM reports
        WHERE ward_id=$1
         AND deleted_at IS NULL`,
      [wardId],
    );
    if (result.rows.length === 0) {
      throw new apiErrorHandler(404, "No reports found");
    }
    const wardReports = result.rows[0];
    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "Ward Reports are fetch succesfully",
          wardReports,
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
    if (status === undefined) {
      throw new apiErrorHandler(404, "report status is required ");
    }
    // const findedReport = result.rows[0];
    const result = await pool.query(
      `SELECT
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
       FROM reports WHERE id=$1 AND deleted_at IS NULL`,
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
          SELECT id,
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
            WHERE id=$1
             AND deleted_at IS NULL `,
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
