import { pool } from '../db/pool.js';

export async function writeAuditLog(actorType, actorId, action, targetId, details = {}) {
  await pool.query(
    `INSERT INTO audit_logs (actor_type, actor_id, action, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [actorType, actorId, action, targetId, details]
  );
}

