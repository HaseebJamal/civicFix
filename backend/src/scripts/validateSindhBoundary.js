
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pool from "../config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const filePath = path.resolve(
  __dirname,
  "../../data/alternate-boundaries/pakistan-provinces.geojson"
);

async function main() {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

  const matches = data.features.filter(
    (feature) =>
      feature.properties?.ADM1_EN?.trim().toLowerCase() === "sindh"
  );

  if (matches.length !== 1) {
    throw new Error(`Expected one Sindh feature, found ${matches.length}`);
  }

  const result = await pool.query(
    `WITH original AS (
       SELECT ST_SetSRID(
         ST_GeomFromGeoJSON($1), 4326
       ) AS geom
     ),
     repaired AS (
       SELECT ST_Multi(
         ST_CollectionExtract(ST_MakeValid(geom), 3)
       ) AS geom
       FROM original
     )
     SELECT
       ST_IsValid(o.geom) AS original_valid,
       ST_IsValidReason(o.geom) AS original_reason,
       ST_Area(o.geom::geography) AS original_area_m2,
       ST_IsValid(r.geom) AS repaired_valid,
       ST_IsEmpty(r.geom) AS repaired_empty,
       ST_GeometryType(r.geom) AS repaired_type,
       ST_Area(r.geom::geography) AS repaired_area_m2,
       ST_NumGeometries(r.geom) AS repaired_polygon_count
     FROM original o CROSS JOIN repaired r`,
    [JSON.stringify(matches[0].geometry)]
  );

  const row = result.rows[0];
  const originalArea = Number(row.original_area_m2);
  const repairedArea = Number(row.repaired_area_m2);

  console.log({
    ...row,
    areaChangePercent:
      originalArea > 0
        ? Number((((repairedArea - originalArea) / originalArea) * 100).toFixed(6))
        : null,
  });
}

main()
  .catch((error) => {
    console.error("Repair preview failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
