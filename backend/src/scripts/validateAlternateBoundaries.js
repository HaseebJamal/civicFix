
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.resolve(
  __dirname,
  "../../data/alternate-boundaries/pakistan-boundaries.geojson"
);

const targets = new Set([
  "Gwadar",
  "Lasbela",
  "Thatta",
  "Karachi South",
  "Karachi west",
]);

async function main() {
  const geojson = JSON.parse(fs.readFileSync(filePath, "utf8"));

  const features = geojson.features.filter((feature) =>
    targets.has(feature.properties?.NAME_3)
  );

  if (features.length !== targets.size) {
    throw new Error(
      `Expected ${targets.size} district features, found ${features.length}`
    );
  }

  console.log("PostGIS validation results:\n");

  for (const feature of features) {
    const { NAME_1: province, NAME_2: division, NAME_3: district } =
      feature.properties;

    const result = await pool.query(
      `SELECT
         ST_GeometryType(g.geom) AS geometry_type,
         ST_IsValid(g.geom) AS is_valid,
         ST_IsValidReason(g.geom) AS validity_reason,
         ST_IsEmpty(g.geom) AS is_empty,
         ST_Area(g.geom::geography) AS area_square_meters
       FROM (
         SELECT ST_SetSRID(
           ST_GeomFromGeoJSON($1),
           4326
         ) AS geom
       ) AS g`,
      [JSON.stringify(feature.geometry)]
    );

    console.log({
      district,
      division,
      province,
      ...result.rows[0],
    });
  }
}

main()
  .catch((error) => {
    console.error("Validation failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
