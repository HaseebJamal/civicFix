import pg from "pg";
import dotenv from "dotenv";
dotenv.config();
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URI,
});
pool.on("error", (error) => {
  console.log("Database is unable to connect ", error);
  process.exit(1);
});
export default pool;
