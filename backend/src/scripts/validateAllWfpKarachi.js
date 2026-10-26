
import fs from "fs";
import pool from "../config/db.js";

const filePath = "data/wfp-boundaries/pakistan-districts.geojson";

const targets = [
  { label: "CENTRAL KARACHI", name: "Karachi Central" },
  { label: "EAST KARACHI", name: "Karachi East" },
  { label: "SOUTH KARACHI", name: "Karachi South" },
  { label: "WEST KARACHI", name: "Karachi west" },
  { label: "MALIR KARACHI", name: "Malir" },
  { label: "KORANGI KARACHI", name: "Korangi" },
  { label: "KEAMARI", name: "Keamari" },
];

async function main() {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const client = await pool.connect();

  try {
    const geometries = [];

    for (const target of targets) {
      const matches = data.features.filter(
        (f) => f.properties?.districts === target.label
      );

      if (matches.length !== 1) {
        throw new Error(
          `${target.label}: expected one feature, found ${matches.length}`
        );
      }

      const feature = matches[0];

      const result = await client.query(
        `WITH src AS (
           SELECT ST_SetSRID(
             ST_GeomFromGeoJSON($1),
             4326
           ) AS geom
         )
         SELECT
           ST_IsValid(geom) AS is_valid,
           ST_IsEmpty(geom) AS is_empty,
           ST_IsValidReason(geom) AS validity_reason,
           ST_GeometryType(geom) AS geometry_type,
           ROUND(
             (ST_Area(geom::geography) / 1000000)::numeric,
             2
           ) AS area_km2
         FROM src`,
        [JSON.stringify(feature.geometry)]
      );

      const row = result.rows[0];

      console.log({
        district: target.name,
        sourceLabel: target.label,
        sourceCode: feature.properties.dist_code,
        ...row,
      });

      if (!row.is_valid || row.is_empty || Number(row.area_km2) <= 0) {
        throw new Error(`Invalid source geometry for ${target.name}`);
      }

      geometries.push({
        name: target.name,
        geometry: JSON.stringify(feature.geometry),
      });
    }

    const overlaps = await client.query(
      `WITH source_districts AS (
         SELECT
           v.name,
           ST_SetSRID(ST_GeomFromGeoJSON(v.geojson), 4326) AS geom
         FROM jsonb_to_recordset($1::jsonb)
           AS v(name text, geojson text)
       )
       SELECT
         a.name AS district_a,
         b.name AS district_b,
         ROUND(
           (
             ST_Area(
               ST_Intersection(a.geom, b.geom)::geography
             ) / 1000000
           )::numeric,
           3
         ) AS overlap_km2
       FROM source_districts a
       JOIN source_districts b ON a.name < b.name
       WHERE ST_Intersects(a.geom, b.geom)
         AND ST_Area(
           ST_Intersection(a.geom, b.geom)::geography
         ) > 10000
       ORDER BY overlap_km2 DESC`,
      [JSON.stringify(
        geometries.map((g) => ({
          name: g.name,
          geojson: g.geometry,
        }))
      )]
    );

    console.log("Significant overlaps within the WFP source:");
    console.table(overlaps.rows);
    console.log("Read-only validation completed; no records changed.");
  } catch (error) {
    console.error("Validation failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
