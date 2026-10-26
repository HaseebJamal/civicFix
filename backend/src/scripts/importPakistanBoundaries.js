
import fs from "node:fs/promises";
import path from "node:path";
import pool from "../config/db.js";

const SOURCE = "PakData/GISData";
const DATA_DIR = path.resolve(
  process.cwd(),
  "data",
  "pakistan-boundaries"
);

const FILES = {
  provinces: "PAK_adm1.json",
  divisions: "PAK_adm2.json",
  districts: "PAK_adm3.json",
};

const readFeatures = async (filename) => {
  const filePath = path.join(DATA_DIR, filename);
  const contents = await fs.readFile(filePath, "utf8");
  const geojson = JSON.parse(contents);

  if (
    geojson.type !== "FeatureCollection" ||
    !Array.isArray(geojson.features)
  ) {
    throw new Error(`${filename} is not a valid GeoJSON FeatureCollection`);
  }

  return geojson.features;
};

const requiredName = (value, field, filename) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing ${field} in ${filename}`);
  }

  return value.trim();
};

const upsertArea = async (
  client,
  { name, level, sourceCode, parentCode, geometry }
) => {
  let parentId = null;

  if (parentCode) {
    const parentResult = await client.query(
      `SELECT id
       FROM public.administrative_areas
       WHERE source_name = $1
         AND source_code = $2`,
      [SOURCE, parentCode]
    );

    if (parentResult.rows.length !== 1) {
      throw new Error(
        `Parent area not found or ambiguous: ${parentCode}`
      );
    }

    parentId = parentResult.rows[0].id;
  }

  const result = await client.query(
    `INSERT INTO public.administrative_areas (
       name,
       area_level,
       parent_id,
       source_name,
       source_code,
       boundary_geojson,
       boundary
     )
     VALUES (
       $1, $2, $3, $4, $5, $6::jsonb,
       ST_SetSRID(
         ST_GeomFromGeoJSON($6),
         4326
       )
     )
     ON CONFLICT (source_name, source_code)
       WHERE source_code IS NOT NULL
     DO UPDATE SET
       name = EXCLUDED.name,
       area_level = EXCLUDED.area_level,
       parent_id = EXCLUDED.parent_id,
       boundary_geojson = EXCLUDED.boundary_geojson,
       boundary = EXCLUDED.boundary,
       updated_at = NOW()
     RETURNING id`,
    [
      name,
      level,
      parentId,
      SOURCE,
      sourceCode,
      JSON.stringify(geometry),
    ]
  );

  return result.rows[0].id;
};

const importBoundaries = async () => {
  // Validate files before modifying the database.
  const provinces = await readFeatures(FILES.provinces);
  const divisions = await readFeatures(FILES.divisions);
  const districts = await readFeatures(FILES.districts);

  if (
    !provinces.length ||
    !divisions.length ||
    !districts.length
  ) {
    throw new Error("One or more GeoJSON files contain no features.");
  }

  const client = await pool.connect();

  try {
    // Keep imports repeatable using a stable source identity.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
        administrative_areas_source_identity_idx
      ON public.administrative_areas (source_name, source_code)
      WHERE source_code IS NOT NULL
    `);

    await client.query("BEGIN");

    let provinceCount = 0;
    let divisionCount = 0;
    let districtCount = 0;

    // ADM1: provinces and territories.
    for (const feature of provinces) {
      const props = feature.properties ?? {};
      const name = requiredName(
        props.NAME_1,
        "NAME_1",
        FILES.provinces
      );

      if (!feature.geometry) {
        throw new Error(`Missing geometry for ${name}`);
      }

      const level = /islamabad/i.test(name)
        ? "capital_territory"
        : "province";

      await upsertArea(client, {
        name,
        level,
        sourceCode: `ADM1|${name}`,
        parentCode: null,
        geometry: feature.geometry,
      });

      provinceCount++;
    }

    // ADM2: divisions, parented to their province.
    for (const feature of divisions) {
      const props = feature.properties ?? {};
      const province = requiredName(
        props.NAME_1,
        "NAME_1",
        FILES.divisions
      );
      const name = requiredName(
        props.NAME_2,
        "NAME_2",
        FILES.divisions
      );

      if (!feature.geometry) {
        throw new Error(`Missing geometry for ${name}`);
      }

      await upsertArea(client, {
        name,
        level: "division",
        sourceCode: `ADM2|${province}|${name}`,
        parentCode: `ADM1|${province}`,
        geometry: feature.geometry,
      });

      divisionCount++;
    }

    // ADM3: districts, parented to their division.
    for (const feature of districts) {
      const props = feature.properties ?? {};
      const province = requiredName(
        props.NAME_1,
        "NAME_1",
        FILES.districts
      );
      const division = requiredName(
        props.NAME_2,
        "NAME_2",
        FILES.districts
      );
      const name = requiredName(
        props.NAME_3,
        "NAME_3",
        FILES.districts
      );

      if (!feature.geometry) {
        throw new Error(`Missing geometry for ${name}`);
      }

      await upsertArea(client, {
        name,
        level: "district",
        sourceCode: `ADM3|${province}|${division}|${name}`,
        parentCode: `ADM2|${province}|${division}`,
        geometry: feature.geometry,
      });

      districtCount++;
    }

    await client.query("COMMIT");

    console.log("Boundary import completed successfully.");
    console.log({ provinceCount, divisionCount, districtCount });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

importBoundaries().catch((error) => {
  console.error("Boundary import failed:", error.message);
  process.exitCode = 1;
});
