
import pool from "../config/db.js";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";

export const getWardBoundaryGeometry = (boundary) => {
  let parsedBoundary = boundary;

  if (typeof parsedBoundary === "string") {
    try {
      parsedBoundary = JSON.parse(parsedBoundary);
    } catch {
      return null;
    }
  }

  // Support GeoJSON Feature and raw Polygon/MultiPolygon.
  if (parsedBoundary?.type === "Feature") {
    parsedBoundary = parsedBoundary.geometry;
  }

  if (
    !parsedBoundary ||
    !["Polygon", "MultiPolygon"].includes(parsedBoundary.type) ||
    !Array.isArray(parsedBoundary.coordinates)
  ) {
    return null;
  }

  return parsedBoundary;
};

export const findWardLocation = async (longitude, latitude) => {
  const lng = Number(longitude);
  const lat = Number(latitude);

  if (
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    lng < -180 ||
    lng > 180 ||
    lat < -90 ||
    lat > 90
  ) {
    return null;
  }

  const result = await pool.query(`
    SELECT id, ward_name, boundary_geojson
    FROM wards
  `);

  if (result.rows.length === 0) {
    return null;
  }

  const userPoint = point([lng, lat]);
  const matchingWards = [];

  for (const ward of result.rows) {
    const boundary = getWardBoundaryGeometry(ward.boundary_geojson);

    if (!boundary) {
      console.warn(
        "Skipping invalid ward boundary:",
        ward.id,
        ward.ward_name,
      );
      continue;
    }

    try {
      if (booleanPointInPolygon(userPoint, boundary)) {
        matchingWards.push({
          id: ward.id,
          ward_name: ward.ward_name,
        });
      }
    } catch (error) {
      console.error(
        "Invalid polygon for ward:",
        ward.id,
        ward.ward_name,
        error.message,
      );
    }
  }

  // Log overlapping boundaries for diagnosis.
  if (matchingWards.length > 1) {
    console.warn(
      "Report location matches multiple wards:",
      matchingWards,
    );
  }

  // Do not silently choose the first ward if boundaries overlap.
  if (matchingWards.length !== 1) {
    return null;
  }

  return matchingWards[0].id;
};
