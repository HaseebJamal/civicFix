import pool from "../config/db.js";

const createAuditLog = async ({
  actor,
  action,
  targetType = null,
  targetId = null,
  targetName = null,
  description = null,
  metadata = {},
  ipAddress = null,
}) => {
  const actorName =
    [actor?.first_name, actor?.last_name].filter(Boolean).join(" ") ||
    actor?.username ||
    "System";

  const query = `
    INSERT INTO audit_logs (
      actor_id,
      actor_name,
      actor_role,
      action,
      target_type,
      target_id,
      target_name,
      description,
      metadata,
      ip_address
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
    RETURNING id
  `;

  const values = [
    actor?.id == null ? null : String(actor.id),
    actorName,
    actor?.role || null,
    action,
    targetType,
    targetId == null ? null : String(targetId),
    targetName,
    description,
    JSON.stringify(metadata),
    ipAddress,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
};

export default createAuditLog;