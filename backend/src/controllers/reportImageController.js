import asyncHandler from "../utils/asyncHandler.js";
import apiErrorHandler from "../utils/apiErrorHandler.js";
import apiResponseHandler from "../utils/apiResponseHandler.js";
import pool from "../config/db.js";
import { uploadImage } from "../utils/cloudinary.js";
export const uploadReportImage = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user?.id;
  const { image_type } = req.body;

  console.log("FILE:", req.file);

  try {
    if (!image_type) {
      throw new apiErrorHandler(400, "Image Type is required");
    }

    if (!reportId) {
      throw new apiErrorHandler(400, "Report ID is required");
    }

    if (!userId) {
      throw new apiErrorHandler(401, "User ID is required");
    }

    if (!req.file) {
      throw new apiErrorHandler(400, "Image is required");
    }

    // const imageUrl = `/uploads/reports/${req.file.filename}`;
    

    const existingReport = await pool.query(
      `
        SELECT id
        FROM reports
        WHERE id = $1
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [reportId],
    );

    if (existingReport.rows.length === 0) {
      throw new apiErrorHandler(404, "No report found");
    }
const uploadedImage = await uploadImage(req.file.buffer, "civifix/reports");

    const imageUrl = uploadedImage.secure_url;
    console.log("IMAGE URL:", imageUrl);
    const insertImageIntoReport = await pool.query(
      `
        INSERT INTO report_images
        (
          report_id,
          image_type,
          uploaded_by,
          image_url
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          report_id,
          image_url,
          image_type,
          uploaded_by,
          created_at
      `,
      [reportId, image_type, userId, imageUrl],
    );

    return res
      .status(201)
      .json(
        new apiResponseHandler(
          201,
          "Image inserted successfully",
          insertImageIntoReport.rows[0],
        ),
      );
  } catch (error) {
    console.log("Unable to insert image into report:", error);

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    throw new apiErrorHandler(
      500,
      "Internal server error occurred while inserting image into report",
    );
  }
});
export const getReportImageById = asyncHandler(async (req, res) => {
  const { reportId, imageId } = req.params;
  console.log("REPORT ID:", reportId);
  console.log("IMAGE ID:", imageId);
  // const userId = req.user.id;
  try {
    if (!reportId) {
      throw new apiErrorHandler(400, "Report Id is required");
    }
    if (!imageId) {
      throw new apiErrorHandler(400, "image id is required");
    }
    // if (!userId) {
    //   throw new apiErrorHandler() * (401, "User Id is required");
    // }
    const result = await pool.query(
      `SELECT
         id,
         report_id,
         image_url,
         image_type,uploaded_by,
         created_at
          FROM
           report_images
            WHERE id=$1
             AND report_id=$2
              
              LIMIT 1`,
      [imageId, reportId],
    );
    console.log("QUERY RESULT:", result.rows);
    if (result.rows.length === 0) {
      throw new apiErrorHandler(404, "No image found");
    }
    const imageFounded = result.rows[0];
    return res
      .status(200)
      .json(
        new apiResponseHandler(200, "Image fetched successfully", imageFounded),
      );
  } catch (error) {
    console.log("Unable to fetch Images ", error);
    //     console.log("FULL ERROR:", error);
    //   console.log("ERROR MESSAGE:", error.message);
    //   console.log("ERROR CODE:", error.code);

    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(
      500,
      "Internal Server error occuring extracting images",
    );
  }
});

export const getReportImages = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user.id;
  try {
    if (!reportId) {
      throw new apiErrorHandler(400, "Report id is required!");
    }
    if (!userId) {
      throw new apiErrorHandler(401, "User Id is required");
    }
    const result = await pool.query(
      `SELECT
       id,
      report_id,
      image_url,
      image_type,
      uploaded_by,
      created_at 
      FROM report_images
      WHERE report_id=$1
      `,
      [reportId],
    );
    // user_id,
    if (result.rows.length === 0) {
      throw new apiErrorHandler(404, "No Reports found");
    }
    // const existingReportImage = result.rows[0];
    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "All images fetched successfully!",
          result.rows,
        ),
      );
  } catch (error) {
    console.log("Unable to fetch Images ", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(
      500,
      "Internal Server occur during fetching images",
    );
  }
});
export const deleteReportImages = asyncHandler(async (req, res) => {
  const { reportId, imageId } = req.params;
  console.log("PARAMS:", req.params);
  const userId = req.user?.id;
  const userRole = req.user?.role;
  console.log("USER ID:", userId);
  console.log("USER ROLE:", userRole);
  try {
    if (!reportId) {
      throw new apiErrorHandler(400, "Report Id is required");
    }
    if (!imageId) {
      throw new apiErrorHandler(400, "Image Id is required");
    }
    if (!userId) {
      throw new apiErrorHandler(401, "User Id is required");
    }
    if (!userRole) {
      throw new apiErrorHandler(401, "User role is required");
    }
    const reportResult = await pool.query(
      `
        SELECT
          id,
          user_id,
          ward_id,
          deleted_at
        FROM reports
        WHERE id = $1
        LIMIT 1
      `,
      [reportId],
    );
    if (reportResult.rows.length === 0) {
      throw new apiErrorHandler(404, "Report not found");
    }
    const existingReport = reportResult.rows[0];
    if (existingReport.deleted_at) {
      throw new apiErrorHandler(404, "Report has already been deleted");
    }
    if (userRole === "citizen") {
      if (existingReport.user_id !== userId) {
        throw new apiErrorHandler(
          403,
          "You are not authorized to delete this image",
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

      const assignedWardId = wardResult.rows[0].id;

      if (assignedWardId !== existingReport.ward_id) {
        throw new apiErrorHandler(
          403,
          "You are not authorized to delete this image",
        );
      }
    }
    if (!["citizen", "ward_official", "superadmin"].includes(userRole)) {
      throw new apiErrorHandler(
        403,
        "You are not authorized to perform this action",
      );
    }
    const imageResult = await pool.query(
      `
        SELECT
          id,
          report_id,
          image_url,
          image_type,
          uploaded_by,
          created_at
        FROM report_images
        WHERE id = $1
          AND report_id = $2
        LIMIT 1
      `,
      [imageId, reportId],
    );
    if (imageResult.rows.length === 0) {
      throw new apiErrorHandler(404, "Image not found");
    }
    // const existingImage = imageResult.rows[0];
    const deletedImage = await pool.query(
      `
        DELETE FROM report_images
        WHERE id = $1
          AND report_id = $2
        RETURNING
          id,
          report_id,
          image_url,
          image_type,
          uploaded_by,
          created_at
      `,
      [imageId, reportId],
    );
    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "Report image deleted successfully",
          deletedImage.rows[0],
        ),
      );
  } catch (error) {
    console.log("Unable to delete report image:", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(
      500,
      "Internal server error while deleting image",
    );
  }
});
