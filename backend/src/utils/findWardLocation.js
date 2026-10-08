import pool from "../config/db.js";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";

export const findWardLocation = async (longitude, latitude) => {
  const result = await pool.query(
    `SELECT
      id,
      ward_name,
      boundary_geojson
     FROM wards`,
  );

  //   console.log("FULL DATABASE RESULT:");
  //   console.log(result.rows);
  if (result.rows.length === 0) {
    return null;
  }
  const userPoint = point([Number(longitude), Number(latitude)]);

  for (const ward of result.rows) {
    // console.log("CURRENT WARD OBJECT:");
    // console.log(ward);

    // console.log("Ward ID:", ward.id);
    // console.log("Ward Name:", ward.ward_name);
    // console.log("Boundary:", ward.boundary_geojson);

    const isInside = booleanPointInPolygon(userPoint, ward.boundary_geojson);

    // console.log("Point inside:", isInside);

    if (isInside) {
      return ward.id;
    }
  }

  return null;
};
