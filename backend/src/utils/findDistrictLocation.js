
import pool from "../config/db.js";

export const findDistrictLocation = async (longitude, latitude) => {
  const result = await pool.query(
    `
    SELECT id
    FROM public.administrative_areas
    WHERE area_level = 'district'
      AND boundary IS NOT NULL
      AND ST_Covers(
        boundary,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)
      )
    ORDER BY id
    LIMIT 2
    `,
    [longitude, latitude],
  );

  if (result.rows.length > 1) {
    throw new Error(
      "The report location matches multiple district boundaries.",
    );
  }

  return result.rows[0]?.id ?? null;
};
