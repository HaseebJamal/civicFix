
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pool from "../config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const filePath = path.resolve(
  __dirname,
  "../../data/alternate-boundaries/pakistan-boundaries.geojson"
);

const targets = {
  Gwadar: "ADM3|Balochistan|Makran|Gwadar",
  Lasbela: "ADM3|Balochistan|Kalat|Lasbela",
  Thatta: "ADM3|Sindh|Hyderabad|Thatta",
  "Karachi South": "ADM3|Sindh|Karachi|Karachi South",
  "Karachi west": "ADM3|Sindh|Karachi|Karachi west",
};

async function main() {
  const geojson = JSON.parse(fs.readFileSync(filePath, "utf8"));

  const features = Object.entries(targets).map(([name, sourceCode]) => {
    const matches = geojson.features.filter(
      (feature) => feature.properties?.NAME_3 === name
    );

    if (matches.length !== 1) {
      throw new Error(
        `${name}: expected exactly one matching feature, found ${matches.length}`
      );
    }

    return { name, sourceCode, feature: matches[0] };
  });

  const client = await pool.connect();

  try {
    // Validate all replacement geometries before any database changes.
    for (const { name, feature } of features) {
      const check = await client.query(
        `SELECT
           ST_IsValid(g.geom) AS is_valid,
           ST_IsEmpty(g.geom) AS is_empty,
           ST_Area(g.geom::geography) AS area
         FROM (
           SELECT ST_SetSRID(
             ST_GeomFromGeoJSON($1), 4326
           ) AS geom
         ) g`,
        [JSON.stringify(feature.geometry)]
      );

      const row = check.rows[0];

      if (!row.is_valid || row.is_empty || Number(row.area) <= 0) {
        throw new Error(`${name}: replacement geometry failed validation`);
      }
    }

    await client.query("BEGIN");

    // Create a dedicated backup table for these five original rows.
    await client.query(`
      CREATE TABLE IF NOT EXISTS
        public.administrative_areas_geometry_backup_alt_20261026 AS
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

    for (const { name, sourceCode } of features) {
      const existing = await client.query(
        `SELECT id
         FROM public.administrative_areas
         WHERE source_name = 'PakData/GISData'
           AND source_code = $1
           AND area_level = 'district'
         FOR UPDATE`,
        [sourceCode]
      );

      if (existing.rowCount !== 1) {
        throw new Error(
          `${name}: expected exactly one existing district row, found ${existing.rowCount}`
        );
      }

      await client.query(
        `INSERT INTO public.administrative_areas_geometry_backup_alt_20261026
           (id, name, area_level, source_code,
            boundary_geojson, boundary, updated_at, backup_at)
         SELECT
            id, name, area_level, source_code,
            boundary_geojson, boundary, updated_at, NOW()
         FROM public.administrative_areas
         WHERE id = $1
         ON CONFLICT DO NOTHING`,
        [existing.rows[0].id]
      );
    }

    for (const { name, sourceCode, feature } of features) {
      const result = await client.query(
        `UPDATE public.administrative_areas
         SET
           boundary_geojson = $1::jsonb,
           boundary = ST_Multi(
             ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)
           ),
           updated_at = NOW()
         WHERE source_name = 'PakData/GISData'
           AND source_code = $2
           AND area_level = 'district'`,
        [JSON.stringify(feature.geometry), sourceCode]
      );

      if (result.rowCount !== 1) {
        throw new Error(
          `${name}: expected one updated row, got ${result.rowCount}`
        );
      }
    }

    // Verify the committed candidates before allowing the transaction to finish.
    const verification = await client.query(
      `SELECT name, ST_IsValid(boundary) AS is_valid,
              ST_IsEmpty(boundary) AS is_empty
       FROM public.administrative_areas
       WHERE source_code = ANY($1::text[])
       ORDER BY name`,
      [Object.values(targets)]
    );

    if (
      verification.rowCount !== 5 ||
      verification.rows.some((row) => !row.is_valid || row.is_empty)
    ) {
      throw new Error("Post-update verification failed");
    }

    await client.query("COMMIT");

    console.log("Updated and verified five district boundaries:");
    console.table(verification.rows);
    console.log(
      "Backup table: public.administrative_areas_geometry_backup_alt_20261026"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Boundary replacement failed:", error.message);
  process.exitCode = 1;
});
