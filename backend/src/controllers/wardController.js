import asyncHandler from "../utils/asyncHandler.js";
import apiErrorHandler from "../utils/apiErrorHandler.js";
import apiResponseHandler from "../utils/apiResponseHandler.js";
import pool from "../config/db.js";
export const createWard = asyncHandler(async (req, res) => {
  const { ward_name, description, boundary_geojson, official_id } = req.body;
  try {
    if (!ward_name || !boundary_geojson) {
      throw new apiErrorHandler(
        400,
        "Ward Name or boundary is required!"
      );
    }
    const normalizedWardName = ward_name.trim().toLowerCase();
    const normalizedDescription =
      description?.trim().toLowerCase() || null;
    const result = await pool.query(
      `SELECT 
        id,
        ward_name,
        description,
        boundary_geojson,
        official_id,
        created_at,
        updated_at
        FROM wards WHERE ward_name=$1 LIMIT 1`,
      [normalizedWardName],
    );
    if (result.rows.length > 0) {
      throw new apiErrorHandler(
        409,
        "Ward with same name already exists!"
      );
    }

    // Check official only if provided
    if (official_id) {
      const existinOfficialId = await pool.query(
        `SELECT id,
         ward_name
          FROM 
          wards 
          WHERE 
          official_id=$1 LIMIT 1`,
        [official_id],
      );

      if (existinOfficialId.rows.length > 0) {
        throw new apiErrorHandler(
          409,
          "Official_id already exists"
        );
      }

      // Check official user
      const official = await pool.query(
        `SELECT
          id,
          role,
          account_status,
          is_active
         FROM users
         WHERE id=$1
         LIMIT 1`,
        [official_id],
      );

      if (official.rows.length === 0) {
        throw new apiErrorHandler(
          404,
          "Ward official not found"
        );
      }

      if (official.rows[0].role !== "ward_official") {
        throw new apiErrorHandler(
          400,
          "Selected user is not a ward official"
        );
      }

      if (
        !official.rows[0].is_active ||
        official.rows[0].account_status !== "active"
      ) {
        throw new apiErrorHandler(
          400,
          "Selected user account is not active"
        );
      }
    }

    const createWard = await pool.query(
      `INSERT INTO wards(
        ward_name,description, boundary_geojson,official_id
        )
        VALUES($1,$2,$3,$4) 
        RETURNING
        id,
        ward_name,
        description,
        boundary_geojson,
        official_id,
        created_at,
        updated_at`,
      [
        normalizedWardName,
        normalizedDescription,
        boundary_geojson,
        official_id || null,
      ],
    );

    return res
      .status(201)
      .json(
        new apiResponseHandler(
          201,
          "Ward created successfully!",
          createWard.rows[0],
        ),
      );
  } catch (error) {
    console.log("Unable to create Ward", error);

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    // Unique constraint
    if (error.code === "23505") {
      throw new apiErrorHandler(
        409,
        "Ward with same name or official already exists"
      );
    }

    throw new apiErrorHandler(
      500,
      "Internal Server Error"
    );
  }
});


export const deleteWard = asyncHandler(async (req, res) => {
  const { wardId } = req.params;

  try {
    if (!wardId) {
      throw new apiErrorHandler(
        400,
        "Ward ID is required"
      );
    }

    // Check active reports
    const reports = await pool.query(
      `SELECT id
       FROM reports
       WHERE ward_id=$1
       AND deleted_at IS NULL
       LIMIT 1`,
      [wardId],
    );

    if (reports.rows.length > 0) {
      throw new apiErrorHandler(
        409,
        "Cannot delete ward because it has active reports",
      );
    }

    // Find ward
    const result = await pool.query(
      `SELECT
        id,
        ward_name,
        description,
        official_id,
        boundary_geojson,
        created_at,
        updated_at
       FROM wards
       WHERE id = $1
       LIMIT 1`,
      [wardId],
    );

    if (result.rows.length === 0) {
      throw new apiErrorHandler(
        404,
        "No ward found!"
      );
    }

    // Delete ward
    const deleteWard = await pool.query(
      `DELETE FROM wards
       WHERE id = $1
       RETURNING
         id,
         ward_name,
         description,
         official_id,
         boundary_geojson,
         created_at,
         updated_at`,
      [wardId],
    );

    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "Ward deleted successfully!",
          deleteWard.rows[0],
        ),
      );
  } catch (error) {
    console.log("Unable to delete ward:", error);

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    throw new apiErrorHandler(
      500,
      "Internal server Error"
    );
  }
});


export const getAllWards = asyncHandler(async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id,
      ward_name,
      description,
      boundary_geojson
      ,created_at,
      updated_at FROM wards`
    );

    if (result.rows.length === 0) {
      throw new apiErrorHandler(
        404,
        "No Wards are found"
      );
    }

    const wards = result.rows;

    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "All wards are fetched successfully!",
          wards,
        ),
      );
  } catch (error) {
    console.log(
      "Unable to find any wards!",
      error
    );

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    throw new apiErrorHandler(
      500,
      "Internal server error"
    );
  }
});


export const getWardById = asyncHandler(async (req, res) => {
  const { wardId } = req.params;

  try {
    if (!wardId) {
      throw new apiErrorHandler(
        400,
        "Ward Id is required!"
      );
    }

    const result = await pool.query(
      `SELECT
      id,
      ward_name,
      description,
      boundary_geojson,
      created_at,
      updated_at 
      FROM wards 
      WHERE id=$1 
      LIMIT 1`,
      [wardId],
    );

    if (result.rows.length === 0) {
      throw new apiErrorHandler(
        404,
        "No ward is Found"
      );
    }

    const ward = result.rows[0];

    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "ward is fetched successfully!",
          ward
        )
      );

  } catch (error) {
    console.log(
      "Unable to fetch ward by id",
      error
    );

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    throw new apiErrorHandler(
      500,
      "Internal Server Error"
    );
  }
});


export const updateWardById = asyncHandler(async (req, res) => {
  const { wardId } = req.params;

  const {
    ward_name,
    description,
    boundary_geojson,
    official_id,
  } = req.body;

  try {
    if (!wardId) {
      throw new apiErrorHandler(
        400,
        "ward Id is required"
      );
    }

    if (
      ward_name === undefined &&
      description === undefined &&
      boundary_geojson === undefined &&
      official_id === undefined
    ) {
      throw new apiErrorHandler(
        400,
        "At least one field is required"
      );
    }

    // Check ward exists
    const result = await pool.query(
      `SELECT id,
      ward_name,
      description,
      boundary_geojson,
      created_at,
      updated_at 
      FROM wards
      WHERE id=$1
      LIMIT 1`,
      [wardId],
    );

    if (result.rows.length === 0) {
      throw new apiErrorHandler(
        404,
        "Ward not found"
      );
    }

    // Check duplicate ward name
    if (ward_name) {
      const normalizedWardName =
        ward_name.trim().toLowerCase();

      const existingWardName = await pool.query(
        `SELECT id
         FROM wards
         WHERE ward_name=$1
         AND id!=$2
         LIMIT 1`,
        [
          normalizedWardName,
          wardId,
        ],
      );

      if (existingWardName.rows.length > 0) {
        throw new apiErrorHandler(
          409,
          "A ward with this name already exists!"
        );
      }
    }

    // Validate official only if provided
    if (official_id) {
      const official = await pool.query(
        `SELECT
        id,
        role,
        account_status,
        is_active
       FROM users
       WHERE id=$1
       LIMIT 1`,
        [official_id],
      );

      if (official.rows.length === 0) {
        throw new apiErrorHandler(
          404,
          "Ward official not found"
        );
      }

      if (official.rows[0].role !== "ward_official") {
        throw new apiErrorHandler(
          400,
          "Selected user is not a ward official"
        );
      }

      if (
        !official.rows[0].is_active ||
        official.rows[0].account_status !== "active"
      ) {
        throw new apiErrorHandler(
          400,
          "Selected user account is not active"
        );
      }

      // Check whether official is already assigned
      const existingWard = await pool.query(
        `SELECT id,
        ward_name
        FROM wards
        WHERE official_id=$1
        AND id!=$2
        LIMIT 1`,
        [
          official_id,
          wardId,
        ],
      );

      if (existingWard.rows.length > 0) {
        throw new apiErrorHandler(
          409,
          "Ward official is already assigned to another ward"
        );
      }
    }

    const normalizedWardName =
      ward_name?.trim().toLowerCase();

    const normalizedDescription =
      description?.trim().toLowerCase();

    const updatedWard = await pool.query(
      `UPDATE wards
   SET
     ward_name = COALESCE($1, ward_name),
     description = COALESCE($2, description),
     official_id = COALESCE($3, official_id),
     boundary_geojson = COALESCE($4, boundary_geojson),
     updated_at = NOW()
   WHERE id = $5
   RETURNING
     id,
     ward_name,
     description,
     boundary_geojson,
     official_id,
     created_at,
     updated_at`,
      [
        normalizedWardName,
        normalizedDescription,
        official_id,
        boundary_geojson,
        wardId
      ],
    );

    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "Ward updated by ID successfully!",
          updatedWard.rows[0],
        ),
      );

  } catch (error) {
    console.log(
      "Unable to update ward",
      error
    );

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    // PostgreSQL unique constraint
    if (error.code === "23505") {
      throw new apiErrorHandler(
        409,
        "Ward name or official is already assigned"
      );
    }

    throw new apiErrorHandler(
      500,
      "Internal server error"
    );
  }
});


// Assign ward official
export const assignWardOfficial = asyncHandler(async (req, res) => {
  const { wardId } = req.params;
  const { official_id } = req.body;

  try {
    if (!wardId) {
      throw new apiErrorHandler(
        400,
        "Ward ID is required"
      );
    }

    if (!official_id) {
      throw new apiErrorHandler(
        400,
        "Official ID is required"
      );
    }

    // Find ward
    const result = await pool.query(
      `SELECT
        id,
        ward_name,
        description,
        boundary_geojson,
        official_id
       FROM wards
       WHERE id = $1
       LIMIT 1`,
      [wardId],
    );

    if (result.rows.length === 0) {
      throw new apiErrorHandler(
        404,
        "Ward not found"
      );
    }

    const findWard = result.rows[0];

    // If same official is already assigned
    if (findWard.official_id === official_id) {
      throw new apiErrorHandler(
        409,
        "This official is already assigned to this ward"
      );
    }

    // Find official
    const official = await pool.query(
      `SELECT
        id,
        username,
        email,
        phone_number,
        cnic_number,
        address,
        role,
        created_at,
        updated_at,
        is_active,
        account_status
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [official_id],
    );

    if (official.rows.length === 0) {
      throw new apiErrorHandler(
        404,
        "Ward official not found"
      );
    }

    const officialUser = official.rows[0];

    // Check role
    if (officialUser.role !== "ward_official") {
      throw new apiErrorHandler(
        400,
        "Selected user is not a ward official"
      );
    }

    // Check account status
    if (
      !officialUser.is_active ||
      officialUser.account_status !== "active"
    ) {
      throw new apiErrorHandler(
        400,
        "Selected user account is not active"
      );
    }

    // Check whether official is already assigned
    const existingOfficialId = await pool.query(
      `SELECT
        id,
        ward_name
       FROM wards
       WHERE official_id = $1
       LIMIT 1`,
      [official_id],
    );

    if (existingOfficialId.rows.length > 0) {
      throw new apiErrorHandler(
        409,
        "Ward official is already assigned to another ward",
      );
    }

    // Assign official to ward
    const assignedOfficial = await pool.query(
      `UPDATE wards
       SET
         official_id = $1,
         updated_at = NOW()
       WHERE id = $2
       RETURNING
         id,
         ward_name,
         description,
         boundary_geojson,
         official_id,
         created_at,
         updated_at`,
      [official_id, wardId],
    );

    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "Ward official assigned successfully",
          assignedOfficial.rows[0],
        ),
      );

  } catch (error) {
    console.log(
      "Unable to assign official:",
      error
    );

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    // PostgreSQL duplicate/unique constraint
    if (error.code === "23505") {
      throw new apiErrorHandler(
        409,
        "Ward official is already assigned to another ward",
      );
    }

    throw new apiErrorHandler(
      500,
      "Internal server error during assigning official",
    );
  }
});


export const removeAssignedOfficial = asyncHandler(async (req, res) => {
  const { wardId } = req.params;

  try {
    if (!wardId) {
      throw new apiErrorHandler(
        400,
        "Ward ID is required"
      );
    }

    const result = await pool.query(
      `SELECT
        id,
        ward_name,
        description,
        boundary_geojson,
        official_id,
        created_at,
        updated_at
       FROM wards
       WHERE id = $1`,
      [wardId],
    );

    if (result.rows.length === 0) {
      throw new apiErrorHandler(
        404,
        "Ward not found"
      );
    }

    if (!result.rows[0].official_id) {
      throw new apiErrorHandler(
        404,
        "No official is assigned to this ward"
      );
    }

    const removeAssignedOfficial = await pool.query(
      `UPDATE wards
       SET
         official_id = NULL,
         updated_at = NOW()
       WHERE id = $1
       RETURNING
         id,
         ward_name,
         description,
         boundary_geojson,
         official_id,
         created_at,
         updated_at`,
      [wardId],
    );

    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "Ward official removed successfully!",
          removeAssignedOfficial.rows[0],
        ),
      );

  } catch (error) {
    console.log(
      "Unable to remove official from ward:",
      error
    );

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    throw new apiErrorHandler(
      500,
      "Server error occurred during removing official from ward",
    );
  }
});


export const getMyWard = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  try {
    if (!userId) {
      throw new apiErrorHandler(
        401,
        "User Id is required"
      );
    }

    const findMyWard = await pool.query(
      `SELECT
       id,
       ward_name,
       description,
       boundary_geojson,
       official_id,
       created_at
       FROM wards WHERE official_id=$1`,
      [userId],
    );

    if (findMyWard.rows.length === 0) {
      throw new apiErrorHandler(
        404,
        "No ward is found"
      );
    }

    const currentMyWard = findMyWard.rows[0];

    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "My ward is fetched successfully!",
          currentMyWard,
        ),
      );

  } catch (error) {
    console.log(
      "Unable to fetch current user ward",
      error
    );

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    throw new apiErrorHandler(
      500,
      "Internal server error"
    );
  }
});
