
import jwt from "jsonwebtoken";
import asyncHandler from "../utils/asyncHandler.js";
import apiErrorHandler from "../utils/apiErrorHandler.js";
import pool from "../config/db.js";

export const authMiddleware = asyncHandler(async (req, res, next) => {
  const authHeader = req.get("Authorization");

  const token =
    req.cookies?.accessToken ||
    (authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null);

  if (!token) {
    throw new apiErrorHandler(401, "Access token is required");
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new apiErrorHandler(401, "Access token has expired");
    }

    throw new apiErrorHandler(401, "Invalid access token");
  }

  if (!decoded.userId) {
    throw new apiErrorHandler(401, "Invalid access token payload");
  }

  const result = await pool.query(
    `SELECT
      id,
      first_name,
      last_name,
      username,
      email,
      password_hash,
      cnic_number,
      phone_number,
      account_status,
      address,
      profile_image,
      banner_image,
      is_active,
      role,
      verification_id
    FROM users
    WHERE id = $1
    LIMIT 1`,
    [decoded.userId]
  );

  if (result.rows.length === 0) {
    throw new apiErrorHandler(401, "User associated with token not found");
  }

  const user = result.rows[0];

  if (user.account_status !== "active" || !user.is_active) {
    throw new apiErrorHandler(403, "Your account is inactive");
  }

  req.user = user;

  next();
});
