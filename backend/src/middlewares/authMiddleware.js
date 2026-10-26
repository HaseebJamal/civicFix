import jwt from "jsonwebtoken";
import asyncHandler from "../utils/asyncHandler.js";
import apiErrorHandler from "../utils/apiErrorHandler.js";
import pool from "../config/db.js";

export const authMiddleware = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  // console.log("COOKIES:", req.cookies);
  // console.log("AUTH HEADER:", req.header("Authorization"));
  // console.log("TOKEN:", token);
  try {
    if (!token) {
      throw new apiErrorHandler(401, "Unauthorized request");
    }

    const isValidToken = jwt.verify(token, process.env.JWT_SECRET);
    // console.log("VALID TOKEN:", isValidToken);
    const result = await pool.query(
      `SELECT
        id,
        first_name,last_name,
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
      [isValidToken.userId],
    );
    // console.log("DB USER:", result.rows);

    if (result.rows.length === 0) {
      throw new apiErrorHandler(401, "Invalid access token");
    }

    const user = result.rows[0];

    if (user.account_status !== "active") {
      throw new apiErrorHandler(403, "Your account status is not active");
    }

    if (!user.is_active) {
      throw new apiErrorHandler(403, "Your account is inactive");
    }

    req.user = user;

    next();
  } catch (err) {
    console.error("AUTH MIDDLEWARE ERROR:", err);

    if (err instanceof apiErrorHandler) {
      throw err;
    }

    throw new apiErrorHandler(401, "Invalid or expired access token");
  }
});
