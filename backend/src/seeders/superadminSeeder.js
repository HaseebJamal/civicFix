
import bcrypt from "bcryptjs";
import pool from "../config/db.js";

const superAdminUserName = "superAdmin";
const superAdminEmail = "superadmin@local.test";
const password = "ChangeThisPassword123!";

const superadminSeeder = async () => {
  try {
    // Check whether the SuperAdmin already exists
    const result = await pool.query(
      `SELECT id
       FROM users
       WHERE email = $1 OR username = $2
       LIMIT 1`,
      [superAdminEmail, superAdminUserName]
    );

    if (result.rows.length > 0) {
      console.log("SuperAdmin already exists.");
      return;
    }
const cnic = process.env.SUPERADMIN_CNIC;

if (!cnic) {
  throw new Error(
    "SUPERADMIN_CNIC is missing from the backend .env file"
  );
}
    // Hash password before saving it
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create SuperAdmin
    const createSuperAdmin = await pool.query(
      `INSERT INTO users (
        username,
        email,
        password_hash,
        first_name,
        last_name,
        role,
        account_status,
        cnic_number,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
      RETURNING
        id,
        username,
        email,
        first_name,
        last_name,
        role,
        account_status,
        is_active,
        created_at`,
      [
        superAdminUserName,
        superAdminEmail,
        hashedPassword,
        "Super",
        "Admin",
        "superadmin",
        "active",
        cnic,
      ]
    );

    console.log("SuperAdmin created successfully:");
   
  } catch (error) {
    console.error("SUPERADMIN SEED ERROR:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

superadminSeeder();
