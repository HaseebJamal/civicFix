import asyncHandler from "../utils/asyncHandler.js";
import apiErrorHandler from "../utils/apiErrorHandler.js";
import apiResponseHandler from "../utils/apiResponseHandler.js";
import pool from "../config/db.js";
import express from "express";
import bcrypt from "bcrypt";
/*getCurrentUserProfile, updateUserProfile,deleteUserAccount,,getAllUsers,
 */
import { sendEmail } from "../utils/sendEmail.js";
import createAuditLog from "../utils/createAuditLog.js";
import { uploadImage } from "../utils/cloudinary.js";
const VERIFIABLE_OFFICIAL_ROLES = new Set([
  "ward_official",
  "official",
  "department_official",
  "department",
]);

export const ensureVerifiableOfficial = asyncHandler(
  async (req, res, next) => {
    const { userId } = req.params;

    if (!userId) {
      throw new apiErrorHandler(400, "User Id is required");
    }

    const result = await pool.query(
      "SELECT role FROM users WHERE id = $1 LIMIT 1",
      [userId],
    );

    if (result.rows.length === 0) {
      throw new apiErrorHandler(404, "User not found");
    }

    if (
      !VERIFIABLE_OFFICIAL_ROLES.has(
        String(result.rows[0].role || "").toLowerCase(),
      )
    ) {
      throw new apiErrorHandler(
        403,
        "Only ward officials and officials can be verified here.",
      );
    }

    next();
  },
);

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

const sendWardOfficialStatusEmail = async ({
  user,
  status,
  rejectionReason,
}) => {
  const username = escapeHtml(user.username || "there");

  let subject;
  let message;

  if (status === "active") {
    subject = "Your CivicFix account has been approved";

    message = `
      <h2>Account Approved</h2>
      <p>Hello ${username},</p>
      <p>Your CivicFix Ward Official account has been approved.</p>
      <p>You can now sign in to CivicFix using your account credentials.</p>
      <p>Thank you for supporting your community.</p>
      <p>Regards,<br />CivicFix Team</p>
    `;
  } else if (status === "rejected") {
    subject = "Update regarding your CivicFix account";

    const reason = rejectionReason
      ? `<p><strong>Reason:</strong> ${escapeHtml(rejectionReason)}</p>`
      : "";

    message = `
      <h2>Account Registration Update</h2>
      <p>Hello ${username},</p>
      <p>Unfortunately, your CivicFix Ward Official registration has been rejected.</p>
      ${reason}
      <p>Please contact the CivicFix administration if you need further clarification.</p>
      <p>Regards,<br />CivicFix Team</p>
    `;
  } else {
    return;
  }

  await sendEmail({
    to: user.email,
    subject,
    html: message,
  });
};
export const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  try {
    if (!userId) {
      throw new apiErrorHandler(400, "User Id is required");
    }
    const result = await pool.query(
      `SELECT id ,
      first_name,
      last_name,
      username,
      phone_number,
      cnic_number,
      role,
      is_active,
      account_status,
      address,
      email,
      verification_id,
      profile_image,
      banner_image,
      created_at,
      updated_at
      FROM users WHERE id=$1 LIMIT 1`,
      [userId],
    );
    if (result.rows.length === 0) {
      throw new apiErrorHandler(400, "User not found!");
    }
    const user = result.rows[0];
    return res.json(
      new apiResponseHandler(200, "User founded successfully", user),
    );
  } catch (error) {
    console.log("Unable to find current user", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(500, "Internal Server Error");
  }
});
export const updateCurrentUserAccount = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const {
    first_name,
    last_name,
    username,
    email,
    phone_number,
    cnic_number,
    address,
    password,
    profile_image,
    banner_image,
  } = req.body;

  try {
    if (!userId) {
      throw new apiErrorHandler(400, "User Id is required");
    }

    // Get current user
    const result = await pool.query(
      `
      SELECT
        id,
        first_name,
        last_name,
        username,
        email,
        phone_number,
        cnic_number,
        address,
        password_hash,
        profile_image,
        banner_image
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new apiErrorHandler(404, "User not found");
    }

    const user = result.rows[0];

    // ==========================================
    // UPDATE VALUES
    // ==========================================

    const updatedFirstName =
      first_name !== undefined
        ? first_name.trim()
        : user.first_name;

    const updatedLastName =
      last_name !== undefined
        ? last_name.trim()
        : user.last_name;

    const updatedUsername =
      username !== undefined
        ? username.trim()
        : user.username;

    const updatedEmail =
      email !== undefined
        ? email.toLowerCase().trim()
        : user.email;

    const updatedPhoneNumber =
      phone_number !== undefined
        ? phone_number.trim()
        : user.phone_number;

    const updatedCnicNumber =
      cnic_number !== undefined
        ? cnic_number.trim()
        : user.cnic_number;

    const updatedAddress =
      address !== undefined
        ? address.trim()
        : user.address;

    
const profileImageFile = req.files?.profileImage?.[0];
const coverImageFile = req.files?.coverImage?.[0];

let updatedProfileImage =
  profile_image !== undefined
    ? profile_image
    : user.profile_image;

let updatedBannerImage =
  banner_image !== undefined
    ? banner_image
    : user.banner_image;

if (profileImageFile) {
  const uploadedProfile = await uploadImage(
    profileImageFile.buffer,
    "civifix/profiles"
  );

  updatedProfileImage = uploadedProfile.secure_url;
}

if (coverImageFile) {
  const uploadedCover = await uploadImage(
    coverImageFile.buffer,
    "civifix/covers"
  );

  updatedBannerImage = uploadedCover.secure_url;
}


    // ==========================================
    // PASSWORD
    // ==========================================

    let updatedPasswordHash = user.password_hash;

    if (password && password.trim()) {
      updatedPasswordHash = await bcrypt.hash(
        password.trim(),
        12
      );
    }

    // ==========================================
    // UPDATE DATABASE
    // ==========================================

    const updateUserAccount = await pool.query(
      `
      UPDATE users
      SET
        first_name = $1,
        last_name = $2,
        username = $3,
        email = $4,
        phone_number = $5,
        cnic_number = $6,
        address = $7,
        profile_image = $8,
        banner_image = $9,
        password_hash = $10,
        updated_at = NOW()
      WHERE id = $11

      RETURNING
        id,
        first_name,
        last_name,
        username,
        email,
        phone_number,
        cnic_number,
        address,
        profile_image,
        banner_image,
        role,
        account_status,
        verification_id,
        is_active,
        created_at,
        updated_at
      `,
      [
        updatedFirstName,
        updatedLastName,
        updatedUsername,
        updatedEmail,
        updatedPhoneNumber,
        updatedCnicNumber,
        updatedAddress,
        updatedProfileImage,
        updatedBannerImage,
        updatedPasswordHash,
        userId,
      ]
    );

    return res.status(200).json(
      new apiResponseHandler(
        200,
        "User account updated successfully",
        updateUserAccount.rows[0]
      )
    );
  } catch (error) {
    console.error(
      "Unable to update current user account:",
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

export const getAllUsers = asyncHandler(async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id,
      first_name,
      last_name,
      username,
      email,
      role,
     approved_at,
     approved_by,
     rejection_reason,
      is_active,
      account_status,
      created_at,
      updated_at FROM users 
      ORDER BY  created_at DESC`,
    );
    if (result.rows === 0) {
      throw new apiErrorHandler(400, "No users found!");
    }
    const user = result.rows;
    return res.json(new apiResponseHandler(200, "All users are fecthed", user));
  } catch (error) {
    console.log(400, "Unable to find users", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(500, "Internal Server Error");
  }
});
export const deleteUserAccount = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  try {
    if (!userId) {
      throw new apiErrorHandler(400, "User Id is required");
    }
    const result = await pool.query(
      `UPDATE users SET 
      is_active=false,
     account_status = 'suspended',
       updated_at=NOW() 
       WHERE id=$1
       RETURNING id`,
      [userId],
    );
    if (result.rows.length === 0) {
      throw new apiErrorHandler(400, "User is not found");
    }
    return res.json(
      new apiResponseHandler(200, "Account deleted successfully"),
    );
  } catch (error) {
    console.log("Unable to delete account", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(500, "Internal Server Error");
  }
});
// for superadmin
// getusersbyId,
export const getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  try {
    if (!userId) {
      throw new apiErrorHandler(400, "User Id is required");
    }
    const result = await pool.query(
      `SELECT id,
      first_name,
      last_name,
         username,
         email,
         phone_number,
         cnic_number,
         address,
         role,
        verification_id,
        approved_at,
        approved_by,
        rejection_reason,
        is_active,
        account_status,
        created_at,
        updated_at 
         FROM users WHERE id=$1 LIMIT 1`,
      [userId],
    );
    if (result.rows.length === 0) {
      throw new apiErrorHandler(400, "User not found");
    }
    const user = result.rows[0];
    return res.json(new apiResponseHandler(200, "User found by id", user));
  } catch (error) {
    console.log("Unable to find User by Id", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(500, "Internal Server Error");
  }
});
// updateuserbyid,deleteuserbyid
export const updateUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const {
    first_name,
    last_name,
    username,
    email,
    phone_number,
    cnic_number,
    address,
    verification_id,
    role,
    account_status,
    is_active,
    rejection_reason,
  } = req.body;
  try {
    if (!userId) {
      throw new apiErrorHandler(400, "User Id is required");
    }

    const hasUpdateField =
      first_name !== undefined ||
      last_name !== undefined ||
      username !== undefined ||
      email !== undefined ||
      phone_number !== undefined ||
      cnic_number !== undefined ||
      address !== undefined ||
      verification_id !== undefined ||
      role !== undefined ||
      account_status !== undefined ||
      is_active !== undefined ||
      rejection_reason !== undefined;

    if (!hasUpdateField) {
      throw new apiErrorHandler(
        400,
        "At least one field is required to update",
      );
    }
    const result = await pool.query(
      `
  SELECT id
  ,
  first_name,
  last_name,
  username,
  email,
  password_hash,
  phone_number,
  cnic_number,
  address,
  role,
  is_active,
  account_status,
  verification_id,
  created_at,
  rejection_reason FROM users WHERE id=$1 LIMIT 1

  `,
      [userId],
    );
    if (result.rows.length === 0) {
      throw new apiErrorHandler(400, "User not Found");
    }
    const user = result.rows[0];
    const updatedUserName = username
      ? username.trim().toLowerCase()
      : user.username;

    const updatedFirstName = first_name
      ? first_name.trim().toLowerCase()
      : user.first_name;
    const updatedLastName = last_name
      ? last_name.trim().toLowerCase()
      : user.last_name;

    const updatedEmail = email ? email.trim().toLowerCase() : user.email;
    const updatedPhoneNumber = phone_number
      ? phone_number.trim()
      : user.phone_number;
    const updatedCnicNumber = cnic_number
      ? cnic_number.trim()
      : user.cnic_number;
    const updatedAddress = address ? address.trim() : user.address;
    const updatedVerificationId = verification_id
      ? verification_id.trim()
      : user.verification_id;
    const updatedRole = role ? role.trim() : user.role;
    const updatedAccountStatus = account_status
      ? account_status.trim()
      : user.account_status;
    const updatedIsActive =
      is_active !== undefined ? is_active : user.is_active;

    const updatedRejectionReason =
      rejection_reason !== undefined
        ? rejection_reason.trim()
        : user.rejection_reason;

    const updatedUser = await pool.query(
      `UPDATE users
   SET
   first_name=$1,
   last_name=$2,
     username = $3,
     email = $4,
     phone_number = $5,
     cnic_number = $6,
     address = $7,
     role = $8,
     verification_id = $9,
     account_status = $10,
     is_active = $11,
     rejection_reason = $12,
     updated_at = NOW()
     WHERE id = $13
   RETURNING
     id,
     first_name,
     last_name,
     username,
     email,
     phone_number,
     cnic_number,
     address,
     role,
     verification_id,
     account_status,
     is_active,
     rejection_reason,
     created_at,
     updated_at`,
      [
        updatedFirstName,
        updatedLastName,
        updatedUserName,
        updatedEmail,
        updatedPhoneNumber,
        updatedCnicNumber,
        updatedAddress,
        updatedRole,
        updatedVerificationId,
        updatedAccountStatus,
        updatedIsActive,
        updatedRejectionReason,
        userId,
      ],
    );
    if (req.user?.role === "superadmin") {
      const isOfficial = [
        "ward_official",
        "official",
        "department_official",
        "department",
      ].includes(String(user.role).toLowerCase());
      let action = "user_updated";

      if (user.account_status !== updatedAccountStatus) {
        if (isOfficial && updatedAccountStatus === "active") {
          action = "official_verified";
        } else if (isOfficial && updatedAccountStatus === "rejected") {
          action = "official_rejected";
        } else if (updatedAccountStatus === "suspended") {
          action = "user_blocked";
        }
      } else if (user.is_active !== updatedIsActive) {
        action = updatedIsActive ? "user_unblocked" : "user_blocked";
      }

      await createAuditLog({
        actor: req.user,
        action,
        targetType: "user",
        targetId: user.id,
        targetName: user.username,
        description: `Superadmin updated ${user.username}'s account.`,
        metadata: {
          role: user.role,
          account_status: updatedAccountStatus,
          is_active: updatedIsActive,
        },
        ipAddress: req.ip,
      });
    }
    // Send an email only when a pending Ward Official's
    // account transitions to approved or rejected.
    const isWardOfficial = user.role === "ward_official";

    const wasPending = user.account_status === "pending";

    const statusChangedToFinalState = ["active", "rejected"].includes(
      updatedAccountStatus,
    );

    if (isWardOfficial && wasPending && statusChangedToFinalState) {
      try {
        await sendWardOfficialStatusEmail({
          user: updatedUser.rows[0],
          status: updatedAccountStatus,
          rejectionReason: updatedRejectionReason,
        });
      } catch (emailError) {
        console.error(
          "Failed to send Ward Official status email:",
          emailError.message,
        );
      }
    }
    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "User is updated successfully!",
          updatedUser.rows[0],
        ),
      );
  } catch (error) {
    console.log("Unable to update the user", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }

    throw new apiErrorHandler(500, "Internal server Error!");
  }
});

export const deleteUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { permanent } = req.query;
  try {
    if (!userId) {
      throw new apiErrorHandler(400, "User Id is required");
    }
    const result = await pool.query(
      `SELECT id,
      first_name,
      last_name,
      username,
        email,
        role,
        account_status,
        is_active
        FROM users WHERE id=$1`,
      [userId],
    );
    if (result.rows.length === 0) {
      throw new apiErrorHandler(400, "User Not Found");
    }
    const user = result.rows[0];
    if (user.role === "superadmin") {
      throw new apiErrorHandler(401, "Superadmin can't be Removed");
    }
    if (permanent === "true") {
      await pool.query(`DELETE FROM users WHERE id=$1`, [userId]);
      await createAuditLog({
        actor: req.user,
        action: "user_permanently_deleted",
        targetType: "user",
        targetId: user.id,
        targetName: user.username,
        description: `Superadmin permanently deleted ${user.username}'s account.`,
        metadata: { role: user.role },
        ipAddress: req.ip,
      });
      return res
        .status(200)
        .json(new apiResponseHandler(200, "User Account permenently deleted!"));
    }

    const deletedUser = await pool.query(
      `UPDATE users
   SET
     is_active = false,
     account_status = 'suspended',
     updated_at = NOW()
   WHERE id = $1
   RETURNING
     id,
     first_name,last_name,
     username,
     email,
     role,
     account_status,
     is_active,
     updated_at`,
      [userId],
    );
    await createAuditLog({
      actor: req.user,
      action: "user_blocked",
      targetType: "user",
      targetId: user.id,
      targetName: user.username,
      description: `Superadmin suspended ${user.username}'s account.`,
      metadata: { role: user.role },
      ipAddress: req.ip,
    });
    return res
      .status(200)
      .json(
        new apiResponseHandler(
          200,
          "User account soft deleted successfully! ",
          deletedUser.rows[0],
        ),
      );
  } catch (error) {
    console.log("Unable to delete user Account by Id", error);
    if (error instanceof apiErrorHandler) {
      throw error;
    }
    throw new apiErrorHandler(500, "Internal Server Error");
  }
});
