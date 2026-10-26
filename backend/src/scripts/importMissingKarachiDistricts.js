
import fs from "fs";
import pool from "../config/db.js";

const filePath = "data/wfp-boundaries/pakistan-districts.geojson";
const sourceName = "WFP_ArcGIS_pak_bnd_adm3district_aha_usda";

const targets = [
  { label: "KORANGI KARACHI", name: "Korangi", code: "712" },
  { label: "KEAMARI", name: "Keamari", code: "730" },
];

async function main() {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const divisionResult = await client.query(
      `SELECT id
       FROM public.administrative_areas
       WHERE area_level = 'division'
         AND source_code = 'ADM2|Sindh|Karachi'
       FOR UPDATE`
    );

    if (divisionResult.rowCount !== 1) {
      throw new Error("Could not identify exactly one Karachi division.");
    }

    const divisionId = divisionResult.rows[0].id;

    for (const target of targets) {
      const features = data.features.filter(
        (f) => f.properties?.districts === target.label
      );

      if (features.length !== 1) {
        throw new Error(
          `Expected one ${target.label} feature; found ${features.length}.`
        );
      }

      const feature = features[0];

      if (
        !feature.geometry ||
        !["Polygon", "MultiPolygon"].includes(feature.geometry.type)
      ) {
        throw new Error(`Invalid geometry type for ${target.name}.`);
      }

      const sourceCode = `WFP|PK|${target.code}`;

      const existing = await client.query(
        `SELECT id, name, source_name, source_code
         FROM public.administrative_areas
         WHERE (parent_id = $1
                AND area_level = 'district'
                AND LOWER(name) = LOWER($2))
            OR (source_name = $3 AND source_code = $4)`,
        [divisionId, target.name, sourceName, sourceCode]
      );

      if (existing.rowCount > 0) {
        throw new Error(
          `${target.name} already exists. No duplicate will be inserted.`
        );
      }

      const inserted = await client.query(
        `WITH source AS (
           SELECT ST_SetSRID(
             ST_GeomFromGeoJSON($1),
             4326
           ) AS geom
         )
         INSERT INTO public.administrative_areas (
           name,
           area_level,
           parent_id,
           source_name,
           source_code,
           boundary_geojson,
           boundary,
           created_at,
           updated_at
         )
         SELECT
           $2,
           'district',
           $3,
           $4,
           $5,
           $6::jsonb,
           source.geom,
           NOW(),
           NOW()
         FROM source
         WHERE ST_IsValid(source.geom)
           AND NOT ST_IsEmpty(source.geom)
         RETURNING
           id,
           name,
           area_level,
           parent_id,
           source_name,
           source_code,
           ST_IsValid(boundary) AS is_valid,
           ST_IsEmpty(boundary) AS is_empty`,
        [
          JSON.stringify(feature.geometry),
          target.name,
          divisionId,
          sourceName,
          sourceCode,
          JSON.stringify(feature.geometry),
        ]
      );

      if (inserted.rowCount !== 1) {
        throw new Error(
          `The geometry for ${target.name} failed validation.`
        );
      }

      console.log("Inserted district:", inserted.rows[0]);
    }

    await client.query("COMMIT");
    console.log("Both missing Karachi districts imported successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("District import failed; transaction rolled back:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
