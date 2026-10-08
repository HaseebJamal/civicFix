import asyncHandler from "../utils/asyncHandler.js";
import apiErrorHandler from "../utils/apiErrorHandler.js";
import apiResponseHandler from "../utils/apiResponseHandler.js";
import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateRefreshToken, generateToken } from "../utils/generateToken.js";
import { generateOtp } from "../utils/generateOtp.js";

export const registerUser = asyncHandler(async (req, res) => {
  const {
    username,
    email,
    password,
    role,
    phone_number,
    address,
    cnic_number,
  } = req.body;

  try {
    if (
      !username ||
      !email ||
      !password ||
      !role ||
      !phone_number ||
      !address ||
      !cnic_number
    ) {
      throw new apiErrorHandler(400, "All fields are required");
    }
    const allowedRoles = ["citizen", "ward_official"];
    if (!allowedRoles.includes(role)) {
      throw new apiErrorHandler(400, "Invalid Role");
    }
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUserName = username.toLowerCase().trim();
    const existingUser = await pool.query(
      `SELECT id
       FROM users
       WHERE email = $1 OR username = $2`,
      [normalizedEmail, normalizedUserName],
    );
    if (existingUser.rows.length > 0) {
      throw new apiErrorHandler(
        409,
        "User with email or username already exists!",
      );
    }
    if (password.length < 8) {
      throw new apiErrorHandler(
        422,
        "Password must contain at least 8 characters",
      );
    }
    const cnicRegex = /^\d{5}-\d{7}-\d$/;
    if (!cnicRegex.test(cnic_number)) {
      throw new apiErrorHandler(422, "Invalid CNIC format");
    }
    const password_hash = await bcrypt.hash(password, 12);
    const accountStatus = role === "ward_official" ? "pending" : "active";
    const result = await pool.query(
      `INSERT INTO users (
        username,
        email,
        password_hash,
        phone_number,
        cnic_number,
        address,
        role,
        account_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        username,
        email,
        role,
        account_status,
        phone_number,
        cnic_number,
        address,
        verification_id,
        is_active`,
      [
        normalizedUserName,
        normalizedEmail,
        password_hash,
        phone_number,
        cnic_number,
        address,
        role,
        accountStatus,
      ],
    );
    const user = result.rows[0];
    if (role === "ward_official") {
      return res.status(201).json(
        new apiResponseHandler(
          201,
          "Your ward official account is awaiting approval.",
          {
            user,
          },
        ),
      );
    }
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    const message =
      role === "ward_official"
        ? "Your ward official account is awaiting approval."
        : "Registration successful!";
    const data = {
      user,
      accessToken,
      refreshToken,
    };
    return res.status(201).json(new apiResponseHandler(201, message, data));
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    if (err instanceof apiErrorHandler) {
      throw err;
    }
    throw new apiErrorHandler(500, "Internal Server Error");
  }
});

export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  console.log("LOGIN BODY:", req.body);

  try {
    if (!email || !password) {
      throw new apiErrorHandler(400, "Email or Password is required");
    }
    const normalizedEmail = email?.toLowerCase().trim();
    const result = await pool.query(
      `SELECT
      id,
      username,
      email,
      password_hash,
      phone_number,
      cnic_number,
      address,
      account_status,
      role,
      verification_id,
      is_active
   FROM users
   WHERE email = $1
   LIMIT 1`,
      [normalizedEmail],
    );
    if (result.rows.length === 0) {
      throw new apiErrorHandler(401, "Invalid  User Credentials!");
    }
    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new apiErrorHandler(403, "Invalid Password!");
    }
    if (user.account_status === "pending") {
      throw new apiErrorHandler(403, "Your account is Pendening!");
    }
    if (user.account_status === "rejected") {
      throw new apiErrorHandler(403, "Your registration account is reject!");
    }
    if (user.account_status === "suspended") {
      throw new apiErrorHandler(403, "Your registration account is suspend!");
    }
    if (!user.is_active) {
      throw new apiErrorHandler(403, "Your account is not active");
    }

    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    const { password_hash, ...saferUser } = user;
    const data = {
      user: saferUser,
      accessToken,
      refreshToken,
    };
    const options = {
      httpOnly: true,
      secure: true,
    };
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(new apiResponseHandler(200, "Login successful", data));
  } catch (error) {
    console.error("Login error:", error);

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    throw new apiErrorHandler(500, "Internal Server Error");
  }
});
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  try {
    // 1. Validate email
    if (!email) {
      throw new apiErrorHandler(400, "Email is required");
    }

    // 2. Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // 3. Find user
    const result = await pool.query(
      `SELECT id, email, account_status,
  is_active
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [normalizedEmail],
    );

    if (result.rows.length === 0) {
      throw new apiErrorHandler(404, "User not found");
    }

    const user = result.rows[0];
    if (!user.is_active) {
      throw new apiErrorHandler(403, "Your account is inactive");
    }

    if (user.account_status === "suspended") {
      throw new apiErrorHandler(403, "Your account has been suspended");
    }

    // 4. Check OTP rate limit
    // Maximum 5 OTPs in 1 hour
    const rateLimitResult = await pool.query(
      `SELECT COUNT(*) AS otp_count
       FROM password_reset_otps
       WHERE user_id = $1
         AND created_at >= NOW() - INTERVAL '1 hour'`,
      [user.id],
    );

    const otpCount = Number(rateLimitResult.rows[0].otp_count);

    if (otpCount >= 5) {
      throw new apiErrorHandler(
        429,
        "OTP request limit exceeded. Please try again later.",
      );
    }

    const otp = generateOtp();

    // 6. Hash OTP
    const hashOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      `UPDATE password_reset_otps
       SET used_at = NOW()
       WHERE user_id = $1
         AND used_at IS NULL`,
      [user.id],
    );

    // 9. Save new OTP
    await pool.query(
      `INSERT INTO password_reset_otps
       (user_id, otp_hash, expires_at, used_at)
       VALUES ($1, $2, $3, null)`,
      [user.id, hashOtp, expiresAt],
    );

    // 10. Temporary testing
    console.log("OTP:", otp);

    // 11. Send response
    return res.status(200).json(
      new apiResponseHandler(200, "OTP sent successfully", {
        email: user.email,
      }),
    );
  } catch (error) {
    console.error("Unable to send OTP:", error);

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    throw new apiErrorHandler(500, "Internal Server Error");
  }
});
export const logoutUser = asyncHandler(async (req, res) => {
  const findUser = req.user;
  try {
    if (!findUser) {
      throw new apiErrorHandler(401, "Unauthorized Request");
    }
    const options = {
      httpOnly: true,
      secure: true,
    };
    return res
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new apiResponseHandler(201, "Loggout Successfully"));
  } catch (error) {
    console.log("Logout failed", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(500, "Internal server error");
  }
});
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  try {
    if (!refreshToken) {
      throw new apiErrorHandler(200, "Refresh token is required");
    }
    const isVaildRefreshToken = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );
    const result = await pool.query(
      `SELECT
    id,
    username,
    password_hash,
    phone_number,
    cnic_number,
    role,
    verification_id
    ,address,
    account_status,
    is_active
     FROM users WHERE id =$1  LIMIT 1
    `,
      [isVaildRefreshToken.userId],
    );
    if (result.rows.length === 0) {
      throw new apiErrorHandler(401, "Invalid Refresh token");
    }
    const user = result.rows[0];
    if (user.account_status == "pending") {
      throw new apiErrorHandler(403, "Your account is pending");
    }
    if (!user.is_active) {
      throw new apiErrorHandler(403, "Your account is not active");
    }
    if (user.account_status === "suspended") {
      throw new apiErrorHandler(403, "Your account is suspended");
    }
    const options = {
      httpOnly: true,
      secure: true,
    };
    const accessToken = generateToken(user);
    return res
      .cookie("accessToken", accessToken, options)
      .json(new apiResponseHandler(200, "Access token refreshed successfully"));
  } catch (error) {
    if (error) {
      console.log("Refresh Token Error", error);
    }
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(500, "Internal Server Error");
  }
});
export const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  console.log("VERIFY OTP BODY:", req.body);
  console.log("EMAIL:", email);
  console.log("OTP:", otp);
  try {
    if (!email || !otp) {
      throw new apiErrorHandler(401, "email or otp is required");
    }
    const normalizedEmail = email.toLowerCase().trim();
    const userResult = await pool.query(
      `SELECT id, email
   FROM users
   WHERE email = $1
   LIMIT 1`,
      [normalizedEmail],
    );

    if (userResult.rows.length === 0) {
      throw new apiErrorHandler(404, "User not found");
    }

    const user = userResult.rows[0];
    const result = await pool.query(
      `SELECT
    id,
    otp_hash,
    expires_at,
    used_at
   FROM password_reset_otps
   WHERE user_id = $1
     AND used_at IS NULL
     AND expires_at > NOW()
   ORDER BY created_at DESC
   LIMIT 1`,
      [user.id],
    );
    if (result.rows.length === 0) {
      throw new apiErrorHandler(401, "Invaild or Expired Otp");
    }
    const getOtp = result.rows[0];
    // const getOtp = result.rows[0];

    console.log("OTP RECORD:", getOtp);
    console.log("OTP HASH:", getOtp.otp_hash);
    const isValidOtp = await bcrypt.compare(otp, getOtp.otp_hash);
    console.log("OTP VALID:", isValidOtp);
    if (!isValidOtp) {
      throw new apiErrorHandler(401, "Invaild or Expired Otp");
    }
    await pool.query(
      `
      UPDATE password_reset_otps
      SET used_at=NOW()
      WHERE id =$1
      `,
      [getOtp.id],
    );
    return res.json(new apiResponseHandler(200, "Otp verified successfully"));
  } catch (error) {
    console.log("Unable to verify Otp", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(500, "Internal Server Error");
  }
});
export const resetPassword = asyncHandler(async (req, res) => {
  const { newPassword, userId } = req.body;
  try {
    if (!newPassword || !userId) {
      throw new apiErrorHandler(401, "password or userId is required");
    }
    const password_hash = await bcrypt.hash(newPassword, 12);
    if (newPassword.length < 8) {
      throw new apiErrorHandler(
        400,
        "Password must at least contains 8 characters!",
      );
    }
    const result = await pool.query(
      `SELECT id FROM users WHERE id=$1 LIMIT 1`,
      [userId],
    );
    if (result.rows.length === 0) {
      throw new apiErrorHandler(401, "User not Found!");
    }
    const user = result.rows[0];
    await pool.query(
      `UPDATE users
   SET password_hash = $1,
       updated_at = NOW()
   WHERE id = $2`,
      [password_hash, userId],
    );
    return res
      .status(200)
      .json(new apiResponseHandler(200, "Password reset successfully"));
  } catch (error) {
    if (error) {
      console.log("Unable to reset password", error);
    }
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(500, "Internal Server Error");
  }
});
export const updatePassword = asyncHandler(async (req, res) => {
    console.log("REQ USER:", req.user);

  const { currentPassword, newPassword } = req.body;
  try {
    if (!currentPassword || !newPassword) {
      throw new apiErrorHandler(
        400,
        "current password or new password is required",
      );
    }
    if (newPassword.length < 8) {
      throw new apiErrorHandler(
        400,
        "New password must contain at least 8 characters",
      );
    }
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT id,password_hash
       FROM users WHERE id=$1`,
      [userId],
    );
    if (result.rows.length === 0) {
      throw apiErrorHandler(400, "User not found");
    }
    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.password_hash,
    );

    if (!isValidPassword) {
      throw new apiErrorHandler(400, "Invalid current password!");
    }
    const password_hash = await bcrypt.hash(newPassword, 12);
    await pool.query(`UPDATE users SET password_hash=$1 WHERE id=$2`, [
      password_hash,
      userId,
    ]);
    return res.json(
      new apiResponseHandler(200, "Password updated successfull!"),
    );
  } catch (error) {
    console.log("Unable to update Password", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(500, "Internal Server Error");
  }
});
