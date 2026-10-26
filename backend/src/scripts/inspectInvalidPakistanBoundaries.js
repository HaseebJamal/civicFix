
import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve("data/pakistan-boundaries");

const files = [
  "PAK_adm0.json",
  "PAK_adm1.json",
  "PAK_adm2.json",
  "PAK_adm3.json",
];

const targets = new Set([
  "gwadar",
  "karachi south",
  "karachi west",
  "lasbela",
  "thatta",
  "kalat",
  "karachi",
  "sindh",
]);

function inspectRings(geometry) {
  const malformedRings = [];

  if (!geometry) {
    return {
      geometryType: null,
      malformedRings: ["Missing geometry"],
    };
  }

  function checkPolygon(rings, polygonIndex = 0) {
    if (!Array.isArray(rings)) {
      malformedRings.push(`Polygon ${polygonIndex}: invalid rings array`);
      return;
    }

    rings.forEach((ring, ringIndex) => {
      if (!Array.isArray(ring) || ring.length < 4) {
        malformedRings.push(
          `Polygon ${polygonIndex}, ring ${ringIndex}: ${
            Array.isArray(ring) ? ring.length : 0
          } positions (expected at least 4)`
        );
        return;
      }

      const first = ring[0];
      const last = ring[ring.length - 1];

      if (
        !Array.isArray(first) ||
        !Array.isArray(last) ||
        first[0] !== last[0] ||
        first[1] !== last[1]
      ) {
        malformedRings.push(
          `Polygon ${polygonIndex}, ring ${ringIndex}: ring is not closed`
        );
      }
    });
  }

  if (geometry.type === "Polygon") {
    checkPolygon(geometry.coordinates);
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates?.forEach((rings, index) =>
      checkPolygon(rings, index)
    );
  } else {
    // Other geometry types are reported but not treated as polygon rings.
    return {
      geometryType: geometry.type,
      malformedRings,
    };
  }

  return {
    geometryType: geometry.type,
    malformedRings,
  };
}

for (const file of files) {
  const filePath = path.join(dataDir, file);

  if (!fs.existsSync(filePath)) {
    console.log(`\nFILE NOT FOUND: ${file}`);
    continue;
  }

  const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const features = json.features ?? [];

  console.log(`\n========== ${file} (${features.length} features) ==========`);

  let matchedCount = 0;

  for (const feature of features) {
    const properties = feature.properties ?? {};
    const values = Object.values(properties)
      .filter((value) => typeof value === "string")
      .map((value) => value.trim());

    const matchedNames = values.filter((value) =>
      targets.has(value.toLowerCase())
    );

    if (matchedNames.length === 0) continue;

    matchedCount++;

    const geometryResult = inspectRings(feature.geometry);

    console.log(
      JSON.stringify(
        {
          matchedNames,
          properties,
          ...geometryResult,
        },
        null,
        2
      )
    );
  }

  if (matchedCount === 0) {
    console.log("No exact target-name matches found in this file.");
  }
}
