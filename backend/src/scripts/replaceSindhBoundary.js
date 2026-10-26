
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function replaceSindhBoundary() {
  const client = await pool.connect();

  try {
    const filePath = path.resolve(
      __dirname,
      "../../data/alternate-boundaries/pakistan-provinces.geojson"
    );

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

   const feature = data.features.find(
  (item) =>
    String(item.properties?.ADM1_EN ?? "")
      .trim()
      .toLowerCase() === "sindh"
);

    if (!feature?.geometry) {
      throw new Error("Sindh geometry was not found in the alternate file.");
    }

    await client.query("BEGIN");

    const preview = await client.query(
      `WITH source AS (
         SELECT ST_SetSRID(
           ST_GeomFromGeoJSON($1), 4326
         ) AS geom
       ),
       repaired AS (
         SELECT ST_Multi(
           ST_CollectionExtract(ST_MakeValid(geom), 3)
         ) AS geom
         FROM source
       )
       SELECT
         ST_IsValid(geom) AS is_valid,
         ST_IsEmpty(geom) AS is_empty,
         ST_GeometryType(geom) AS geometry_type,
         ST_Area(geom::geography) AS area_m2
       FROM repaired`,
      [JSON.stringify(feature.geometry)]
    );

    const check = preview.rows[0];

    if (
      !check.is_valid ||
      check.is_empty ||
      check.geometry_type !== "ST_MultiPolygon" ||
      Number(check.area_m2) <= 0
    ) {
      throw new Error(
        `Repaired Sindh geometry failed validation: ${JSON.stringify(check)}`
      );
    }

    const backupTable =
      "public.administrative_areas_geometry_backup_alt_20261026";
    const target = await client.query(
      `SELECT id
       FROM public.administrative_areas
       WHERE area_level = 'province'
         AND LOWER(name) = 'sindh'
       FOR UPDATE`
    );

    if (target.rowCount !== 1) {
      throw new Error(
        `Expected exactly one Sindh province row; found ${target.rowCount}.`
      );
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${backupTable} AS
      SELECT
        id,
        name,
        area_level,
        source_code,
        boundary_geojson,
        boundary,
        updated_at,
        NOW() AS backup_at
      FROM public.administrative_areas
      WHERE FALSE
    `);

    await client.query(
      `INSERT INTO ${backupTable} (
         id,
         name,
         area_level,
         source_code,
         boundary_geojson,
         boundary,
         updated_at,
         backup_at
       )
       SELECT
         id,
         name,
         area_level,
         source_code,
         boundary_geojson,
         boundary,
         updated_at,
         NOW()
       FROM public.administrative_areas
       WHERE id = $1
       ON CONFLICT DO NOTHING`,
      [target.rows[0].id]
    );

    const updated = await client.query(
      `WITH source AS (
         SELECT ST_SetSRID(
           ST_GeomFromGeoJSON($1), 4326
         ) AS geom
       ),
       repaired AS (
         SELECT ST_Multi(
           ST_CollectionExtract(ST_MakeValid(geom), 3)
         ) AS geom
         FROM source
       )
       UPDATE public.administrative_areas a
       SET boundary = r.geom,
           boundary_geojson = ST_AsGeoJSON(r.geom)::jsonb,
           updated_at = NOW()
       FROM repaired r
       WHERE a.area_level = 'province'
         AND LOWER(a.name) = 'sindh'
       RETURNING a.id, a.name,
                 ST_IsValid(a.boundary) AS is_valid,
                 ST_IsEmpty(a.boundary) AS is_empty`,
      [JSON.stringify(feature.geometry)]
    );

    if (updated.rowCount !== 1) {
      throw new Error(
        `Expected exactly one Sindh province row; updated ${updated.rowCount}.`
      );
    }

    if (!updated.rows[0].is_valid || updated.rows[0].is_empty) {
      throw new Error("Updated Sindh boundary failed final validation.");
    }

    await client.query("COMMIT");

    console.log("Sindh boundary updated successfully:");
    console.log(updated.rows[0]);
    console.log("Backup table:", backupTable);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Sindh boundary replacement failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

replaceSindhBoundary();
