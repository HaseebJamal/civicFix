import bcrypt from "bcryptjs";
import pool from "../config/db.js";
const superAdminUserName = "superAdmin";
const password = "qwerty";
const superAdminEmail = "superadmin@local.test";
const superadminSeeder = async () => {
  try {
    const result = await pool.query(
      `SELECT id
       FROM users
       WHERE email = $1 OR username = $2
       LIMIT 1`,
      [superAdminEmail, superAdminUserName],
    );

    if (result.rows.length > 0) {
      console.log("SuperAdmin already exists");
      return;
    }
    const superAdminPassword = await bcrypt.hash(password, 12);
    const createSuperAdmin = await pool.query(
      `INSERT INTO users (
        username,
        email,
        password_hash,
        role,
        account_status,
        cnic_number,
        is_active
      )
      VALUES (
        $1,
        $2,
        $3,
        'superadmin',
        'active',
        $4,
        TRUE
      )
      RETURNING
        id,
        username,
        email,
        role,
        account_status,
        cnic_number,
        is_active,
        created_at`,
      [
        superAdminUserName,
        superAdminEmail,
        superAdminPassword,
        "35202-1234567-1",
      ],
    );
    console.log("SuperAdmin created successfully:");
    console.log(createSuperAdmin.rows[0]);
    console.log("\nSuperAdmin Login:");
    console.log("Email:", superAdminEmail);
    console.log("Password:", password);
  } catch (error) {
    console.error("SUPERADMIN SEED ERROR:", error);
  } finally {
    await pool.end();
  }
};

superadminSeeder();
