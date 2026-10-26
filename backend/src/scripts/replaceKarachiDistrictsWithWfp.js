
import fs from "fs";
import pool from "../config/db.js";

const filePath = "data/wfp-boundaries/pakistan-districts.geojson";

const sourceName = "WFP_ArcGIS_pak_bnd_adm3district_aha_usda";
const backupTable =
  "public.administrative_areas_geometry_backup_wfp_karachi_20261026";

const targets = [
  { label: "CENTRAL KARACHI", name: "Karachi Central", code: 702 },
  { label: "EAST KARACHI", name: "Karachi East", code: 704 },
  { label: "SOUTH KARACHI", name: "Karachi South", code: 721 },
  { label: "WEST KARACHI", name: "Karachi west", code: 729 },
  { label: "MALIR KARACHI", name: "Malir", code: 714 },
  { label: "KORANGI KARACHI", name: "Korangi", code: 712 },
  { label: "KEAMARI", name: "Keamari", code: 730 },
];

async function main() {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const client = await pool.connect();

  try {
    const sourceFeatures = targets.map((target) => {
      const matches = data.features.filter(
        (feature) =>
          feature.properties?.districts === target.label &&
          Number(feature.properties?.dist_code) === target.code
      );

      if (matches.length !== 1) {
        throw new Error(
          `${target.label}: expected one source feature, found ${matches.length}`
        );
      }

      const feature = matches[0];

      if (
        !["Polygon", "MultiPolygon"].includes(feature.geometry?.type)
      ) {
        throw new Error(`Unexpected geometry type for ${target.name}`);
      }

      return { ...target, geometry: feature.geometry };
    });

    await client.query("BEGIN");

    // Find the existing Karachi division.
    const divisionResult = await client.query(
      `SELECT id
       FROM public.administrative_areas
       WHERE area_level = 'division'
         AND source_code = 'ADM2|Sindh|Karachi'
       FOR UPDATE`
    );

    if (divisionResult.rowCount !== 1) {
      throw new Error(
        `Expected one Karachi division; found ${divisionResult.rowCount}`
      );
    }

    const divisionId = divisionResult.rows[0].id;

    // Lock and verify the seven existing district records.
    const existingResult = await client.query(
      `SELECT id, name, parent_id
       FROM public.administrative_areas
       WHERE area_level = 'district'
         AND parent_id = $1
       FOR UPDATE`,
      [divisionId]
    );

    if (existingResult.rowCount !== 7) {
      throw new Error(
        `Expected exactly seven Karachi districts; found ${existingResult.rowCount}`
      );
    }

    const existingByName = new Map(
      existingResult.rows.map((row) => [row.name, row])
    );

    for (const target of targets) {
      if (!existingByName.has(target.name)) {
        throw new Error(`Existing district not found: ${target.name}`);
      }
    }

    // Do not overwrite another administrative area's source identity.
    const sourceCodes = targets.map((target) => `WFP|PK|${target.code}`);

    const conflictResult = await client.query(
      `SELECT name, source_name, source_code
       FROM public.administrative_areas
       WHERE source_name = $1
         AND source_code = ANY($2::text[])
         AND NOT (
           area_level = 'district'
           AND parent_id = $3
         )`,
      [sourceName, sourceCodes, divisionId]
    );

    if (conflictResult.rowCount > 0) {
      throw new Error(
        `WFP source-code conflicts detected: ${JSON.stringify(conflictResult.rows)}`
      );
    }

    // Create a separate backup table for the exact pre-update state.
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${backupTable} AS
      SELECT
        id, name, area_level, source_name, source_code,
        parent_id, boundary_geojson, boundary, updated_at,
        NOW() AS backup_at
      FROM public.administrative_areas
      WHERE false
    `);

    // Refuse to overwrite a prior snapshot from this script.
    const backupCount = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM ${backupTable}
       WHERE id = ANY($1::uuid[])`,
      [existingResult.rows.map((row) => row.id)]
    );

    if (backupCount.rows[0].count > 0) {
      throw new Error(
        "A WFP Karachi backup already exists for one or more districts. " +
        "Inspect the backup table before rerunning; no boundaries were changed."
      );
    }

    await client.query(
      `INSERT INTO ${backupTable} (
         id, name, area_level, source_name, source_code,
         parent_id, boundary_geojson, boundary, updated_at, backup_at
       )
       SELECT
         id, name, area_level, source_name, source_code,
         parent_id, boundary_geojson, boundary, updated_at, NOW()
       FROM public.administrative_areas
       WHERE id = ANY($1::uuid[])`,
      [existingResult.rows.map((row) => row.id)]
    );

    // Replace geometries and source metadata; preserve IDs and parent links.
    for (const target of sourceFeatures) {
      const existing = existingByName.get(target.name);

      const result = await client.query(
        `WITH source AS (
           SELECT ST_SetSRID(
             ST_GeomFromGeoJSON($1),
             4326
           ) AS geom
         )
         UPDATE public.administrative_areas AS area
         SET
           boundary = ST_Multi(source.geom),
           boundary_geojson = $2::jsonb,
           source_name = $3,
           source_code = $4,
           updated_at = NOW()
         FROM source
         WHERE area.id = $5
           AND ST_IsValid(source.geom)
           AND NOT ST_IsEmpty(source.geom)
         RETURNING
           area.id,
           area.name,
           area.source_name,
           area.source_code,
           ST_IsValid(area.boundary) AS is_valid,
           ST_IsEmpty(area.boundary) AS is_empty,
           ST_GeometryType(area.boundary) AS geometry_type`,
        [
          JSON.stringify(target.geometry),
          JSON.stringify(target.geometry),
          sourceName,
          `WFP|PK|${target.code}`,
          existing.id,
        ]
      );

      if (result.rowCount !== 1) {
        throw new Error(`Boundary update failed for ${target.name}`);
      }

      const row = result.rows[0];

      if (!row.is_valid || row.is_empty) {
        throw new Error(`Updated boundary failed validation: ${target.name}`);
      }

      console.log(row);
    }

    await client.query("COMMIT");
    console.log(`All seven Karachi districts updated. Backup: ${backupTable}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Karachi boundary replacement rolled back:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
