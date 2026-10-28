import asyncHandler from "../utils/asyncHandler.js";
import apiErrorHandler from "../utils/apiErrorHandler.js";
import apiResponseHandler from "../utils/apiResponseHandler.js";
import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateRefreshToken, generateToken } from "../utils/generateToken.js";
import { generateOtp } from "../utils/generateOtp.js";
import { createHash, randomBytes } from "node:crypto";
import { sendEmail } from "../utils/sendEmail.js";

export const registerUser = asyncHandler(async (req, res) => {
  const {
    first_name,
    last_name,
    username,
    email,
    password,
    role,
    phone_number,
    address,
    cnic_number,
  } = req.body;

  try {
    const registrationSetting = await pool.query(
      `SELECT setting_value
       FROM site_settings
       WHERE setting_key = $1
       LIMIT 1`,
      ["allow_registration"],
    );

    if (registrationSetting.rows[0]?.setting_value === "false") {
      throw new apiErrorHandler(
        403,
        "New registrations are currently disabled.",
      );
    }

    if (
      !first_name ||
      !last_name ||
      !username ||
      !email ||
      !password ||
      !role ||
      !cnic_number
    ) {
      console.log("First Name",first_name)
      console.log("First Name",last_name)
      console.log("user Name",username)
      console.log("email",email)
      console.log("passwrod",password)
      console.log("role",role)
      console.log("Cnic Number",cnic_number)
      throw new apiErrorHandler(400, "All fields are required");
    }
    const allowedRoles = ["citizen", "ward_official"];
    if (!allowedRoles.includes(role)) {
      throw new apiErrorHandler(400, "Invalid Role");
    }
    const normalizedFirstName = first_name.toLowerCase().trim();
    const normalizedLastName = last_name.toLowerCase().trim();
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
      first_name,
      last_name,  
      username,
        email,
        password_hash,
        phone_number,
        cnic_number,
        address,
        role,
        account_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8,$9,$10)
      RETURNING
        id,
        first_name,
        last_name,
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
        normalizedFirstName,
        normalizedLastName,
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

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

return res
  .status(201)
  .cookie("accessToken", accessToken, cookieOptions)
  .cookie("refreshToken", refreshToken, cookieOptions)
  .json(
    new apiResponseHandler(201, "Registration successful!", {
      user,
      accessToken,
      refreshToken,
    })
  );
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
  // console.log("LOGIN BODY:", req.body);

  try {
    if (!email || !password) {
      throw new apiErrorHandler(400, "Email or Password is required");
    }
    const normalizedEmail = email?.toLowerCase().trim();
    const result = await pool.query(
      `SELECT
      id,
      first_name,
      last_name,
      username,
      email,
      password_hash,
      phone_number,
      cnic_number,
      address,
      profile_image,
      banner_image,
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
    if (typeof email !== "string" || !email.trim()) {
      throw new apiErrorHandler(400, "Email is required");
    }

    // 2. Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // 3. Find user
    const result = await pool.query(
      `SELECT id,
       email, 
       account_status,
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

    // 4. Maximum 5 OTP requests per hour
    const rateLimitResult = await pool.query(
      `SELECT COUNT(*) AS otp_count
       FROM password_reset_otps
       WHERE user_id = $1
         AND created_at >= NOW() - INTERVAL '1 hour'`,
      [user.id],
    );

    const otpCount = Number(rateLimitResult.rows[0].otp_count);
    // console.log("FORGOT PASSWORD RATE LIMIT:", {
    //   email: user.email,
    //   userId: user.id,
    //   otpCount,
    // });
    if (otpCount >= 5) {
      throw new apiErrorHandler(
        429,
        "OTP request limit exceeded. Please try again later.",
      );
    }

    // 5. Generate OTP
    const otp = generateOtp();

    // 6. Hash OTP and set 10-minute expiry
    const hashOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // 7. Invalidate previous unused OTPs
    await pool.query(
      `UPDATE password_reset_otps
       SET used_at = NOW()
       WHERE user_id = $1
         AND used_at IS NULL`,
      [user.id],
    );

    // 8. Save new OTP hash
    const insertResult = await pool.query(
      `INSERT INTO password_reset_otps
       (user_id, otp_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [user.id, hashOtp, expiresAt],
    );

    const otpRecordId = insertResult.rows[0].id;

    // 9. Send OTP through Resend
    try {
      await sendEmail({
        to: user.email,
        subject: "CivicFix - Password Reset OTP",
        text: `Your CivicFix password reset OTP is ${otp}.
It expires in 10 minutes. If you did not request this, ignore this email.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto;">
            <h2>CivicFix Password Reset</h2>
            <p>Use this one-time password to reset your password:</p>
            <p style="font-size: 30px; font-weight: bold; letter-spacing: 6px;">
              ${otp}
            </p>
            <p>This code expires in 10 minutes.</p>
            <p>If you did not request this, you can ignore this email.</p>
          </div>
        `,
      });
      const resetSessionToken = jwt.sign(
        {
          userId: user.id,
          otpRecordId,
        },
        process.env.PASSWORD_RESET_TOKEN_SECRET,
        { expiresIn: "10m" },
      );

      res.cookie("passwordResetSession", resetSessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 10 * 60 * 1000,
        path: "/",
      });
    } catch (emailError) {
      console.error("Resend email error:", emailError);

      // Invalidate OTP if sending fails
      await pool.query(
        `UPDATE password_reset_otps
         SET used_at = NOW()
         WHERE id = $1
           AND used_at IS NULL`,
        [otpRecordId],
      );

      throw new apiErrorHandler(
        502,
        "Unable to send password reset email. Please try again later.",
      );
    }

    // 10. Return success only after Resend accepts the request
    return res.status(200).json(
      new apiResponseHandler(200, "OTP sent successfully", {
        email: user.email,
      }),
    );
  } catch (error) {
    if (error instanceof apiErrorHandler) {
      throw error;
    }

    console.error("Unable to process password reset request:", error);

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
    id,first_name,last_name,
    username,
    password_hash,
    phone_number,
    cnic_number,
    role,
    verification_id
    ,address,
    profile_image,
banner_image,
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
  const { otp } = req.body;
  const resetSession = req.cookies?.passwordResetSession;

  if (typeof otp !== "string" || !otp.trim() || !resetSession) {
    throw new apiErrorHandler(400, "OTP is required");
  }

  let session;

  try {
    session = jwt.verify(resetSession, process.env.PASSWORD_RESET_TOKEN_SECRET);
  } catch {
    throw new apiErrorHandler(
      400,
      "OTP session expired. Please request a new OTP.",
    );
  }

  const otpResult = await pool.query(
    `SELECT id, user_id, otp_hash, attempts
     FROM password_reset_otps
     WHERE id = $1
       AND user_id = $2
       AND used_at IS NULL
       AND expires_at > NOW()
       AND attempts < 5
     LIMIT 1`,
    [session.otpRecordId, session.userId],
  );

  if (otpResult.rows.length === 0) {
    throw new apiErrorHandler(400, "Invalid or expired OTP");
  }

  const otpRecord = otpResult.rows[0];

  const isValidOtp = await bcrypt.compare(otp.trim(), otpRecord.otp_hash);

  if (!isValidOtp) {
    await pool.query(
      `UPDATE password_reset_otps
       SET attempts = attempts + 1
       WHERE id = $1
         AND used_at IS NULL
         AND attempts < 5`,
      [otpRecord.id],
    );

    throw new apiErrorHandler(400, "Invalid or expired OTP");
  }

  const resetToken = randomBytes(32).toString("hex");

  const resetTokenHash = createHash("sha256").update(resetToken).digest("hex");

  const updateResult = await pool.query(
    `UPDATE password_reset_otps
     SET used_at = NOW(),
         reset_token_hash = $1,
         reset_token_expires_at = NOW() + INTERVAL '10 minutes'
     WHERE id = $2
       AND user_id = $3
       AND used_at IS NULL
       AND expires_at > NOW()
       AND attempts < 5
     RETURNING id`,
    [resetTokenHash, otpRecord.id, session.userId],
  );

  if (updateResult.rows.length === 0) {
    throw new apiErrorHandler(400, "Invalid or expired OTP");
  }

  res.clearCookie("passwordResetSession", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });

  return res.status(200).json(
    new apiResponseHandler(200, "OTP verified successfully", {
      resetToken,
      expiresIn: 600,
    }),
  );
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    throw new apiErrorHandler(400, "Reset token and new password are required");
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    throw new apiErrorHandler(
      400,
      "Password must contain at least 8 characters",
    );
  }

  if (typeof resetToken !== "string" || !/^[a-f0-9]{64}$/i.test(resetToken)) {
    throw new apiErrorHandler(400, "Invalid or expired reset token");
  }

  const resetTokenHash = createHash("sha256").update(resetToken).digest("hex");

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tokenResult = await client.query(
      `SELECT id, user_id
       FROM password_reset_otps
       WHERE reset_token_hash = $1
         AND reset_token_expires_at > NOW()
       FOR UPDATE`,
      [resetTokenHash],
    );

    if (tokenResult.rows.length === 0) {
      throw new apiErrorHandler(400, "Invalid or expired reset token");
    }

    const resetRecord = tokenResult.rows[0];

    const updateResult = await client.query(
      `UPDATE users
       SET password_hash = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [passwordHash, resetRecord.user_id],
    );

    if (updateResult.rows.length === 0) {
      throw new apiErrorHandler(404, "User not found");
    }

    // Invalidate the reset token so it cannot be reused.
    await client.query(
      `UPDATE password_reset_otps
       SET reset_token_hash = NULL,
           reset_token_expires_at = NULL
       WHERE id = $1`,
      [resetRecord.id],
    );

    // Invalidate other outstanding OTP/reset-token records for this user.
    await client.query(
      `UPDATE password_reset_otps
       SET used_at = COALESCE(used_at, NOW()),
           reset_token_hash = NULL,
           reset_token_expires_at = NULL
       WHERE user_id = $1`,
      [resetRecord.user_id],
    );

    await client.query("COMMIT");

    return res
      .status(200)
      .json(new apiResponseHandler(200, "Password reset successfully"));
  } catch (error) {
    await client.query("ROLLBACK");

    if (error instanceof apiErrorHandler) {
      throw error;
    }

    console.error("Unable to reset password:", error);
    throw new apiErrorHandler(500, "Internal Server Error");
  } finally {
    client.release();
  }
});

export const updatePassword = asyncHandler(async (req, res) => {
  // console.log("REQ USER:", req.user);

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
