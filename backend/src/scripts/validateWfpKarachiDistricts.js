
import fs from "fs";
import pool from "../config/db.js";

const filePath = "data/wfp-boundaries/pakistan-districts.geojson";

async function main() {
  const client = await pool.connect();

  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    const targets = [
      { sourceName: "KORANGI KARACHI", dbName: "Korangi" },
      { sourceName: "KEAMARI", dbName: "Keamari" },
    ];

    const divisionResult = await client.query(
      `SELECT id, name
       FROM public.administrative_areas
       WHERE area_level = 'division'
         AND source_code = 'ADM2|Sindh|Karachi'`
    );

    if (divisionResult.rowCount !== 1) {
      throw new Error(
        `Expected exactly one Karachi division; found ${divisionResult.rowCount}`
      );
    }

    const division = divisionResult.rows[0];

    for (const target of targets) {
      const matches = data.features.filter(
        (feature) =>
          feature.properties?.districts === target.sourceName
      );

      if (matches.length !== 1) {
        throw new Error(
          `Expected one source feature for ${target.sourceName}; found ${matches.length}`
        );
      }

      const feature = matches[0];

      if (
        !feature.geometry ||
        !["Polygon", "MultiPolygon"].includes(feature.geometry.type)
      ) {
        throw new Error(`Unsupported geometry for ${target.dbName}`);
      }

      const result = await client.query(
        `SELECT
           ST_GeometryType(g.geom) AS geometry_type,
           ST_IsValid(g.geom) AS is_valid,
           ST_IsValidReason(g.geom) AS validity_reason,
           ST_IsEmpty(g.geom) AS is_empty,
           ROUND(
             (ST_Area(g.geom::geography) / 1000000)::numeric,
             2
           ) AS area_km2
         FROM (
           SELECT ST_SetSRID(
             ST_GeomFromGeoJSON($1),
             4326
           ) AS geom
         ) g`,
        [JSON.stringify(feature.geometry)]
      );

      const existing = await client.query(
        `SELECT id, name, source_code
         FROM public.administrative_areas
         WHERE area_level = 'district'
           AND parent_id = $1
           AND LOWER(name) = LOWER($2)`,
        [division.id, target.dbName]
      );

      console.log({
        district: target.dbName,
        sourceLabel: feature.properties.districts,
        sourceCode: feature.properties.dist_code,
        parentDivision: division.name,
        existingChildMatches: existing.rows,
        ...result.rows[0],
      });
    }

    console.log("Read-only validation completed. No records were changed.");
  } catch (error) {
    console.error("Validation failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
