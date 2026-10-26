
import asyncHandler from "../utils/asyncHandler.js";
import apiErrorHandler from "../utils/apiErrorHandler.js";
import apiResponseHandler from "../utils/apiResponseHandler.js";
import pool from "../config/db.js";
export const getSettings = asyncHandler(async (req, res) => {
  const userId = req.user?.id ?? req.user?.user_id ?? req.user?.userId;

  if (!userId) {
    throw new apiErrorHandler(401, "Authentication required.");
  }

  await pool.query(
    `INSERT INTO user_settings (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  const result = await pool.query(
    `SELECT notification, email_notification,
            location_access, nearby_issues, dark_theme,
            updated_at
     FROM user_settings
     WHERE user_id = $1`,
    [userId]
  );

  return res.status(200).json(
    new apiResponseHandler(
      200,
      "Settings fetched successfully.",
      result.rows[0]
    )
  );
});

export const saveSettings = asyncHandler(async (req, res) => {
  const userId = req.user?.id ?? req.user?.user_id ?? req.user?.userId;

  if (!userId) {
    throw new apiErrorHandler(401, "Authentication required.");
  }

  const {
    notification,
    email_notification,
    location_access,
    nearby_issues,
    dark_theme,
  } = req.body;

  const settings = {
    notification,
    email_notification,
    location_access,
    nearby_issues,
    dark_theme,
  };

  for (const [key, value] of Object.entries(settings)) {
    if (typeof value !== "boolean") {
      throw new apiErrorHandler(
        400,
        `${key} must be true or false.`
      );
    }
  }

  const result = await pool.query(
    `INSERT INTO user_settings (
       user_id, notification, email_notification,
       location_access, nearby_issues, dark_theme, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET
       notification = EXCLUDED.notification,
       email_notification = EXCLUDED.email_notification,
       location_access = EXCLUDED.location_access,
       nearby_issues = EXCLUDED.nearby_issues,
       dark_theme = EXCLUDED.dark_theme,
       updated_at = NOW()
     RETURNING notification, email_notification,
               location_access, nearby_issues,
               dark_theme, updated_at`,
    [
      userId,
      notification,
      email_notification,
      location_access,
      nearby_issues,
      dark_theme,
    ]
  );

  return res.status(200).json(
    new apiResponseHandler(
      200,
      "Settings saved successfully.",
      result.rows[0]
    )
  );
});
