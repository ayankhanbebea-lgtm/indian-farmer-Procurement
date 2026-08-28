import { getDb } from "./db";

export function getStaffCentre(userId: string): { id: string; name: string; code: string } | null {
  if (!userId) return null;
  const db = getDb();

  // Try matching by user_id
  const row = db
    .prepare(
      `SELECT ctr.id, ctr.name, ctr.code
       FROM centre_staff cs
       JOIN procurement_centres ctr ON cs.centre_id = ctr.id
       WHERE cs.user_id = ?`
    )
    .get(userId) as { id: string; name: string; code: string } | undefined;

  if (row) return row;

  // Fallback: match by phone number if userId happens to be phone
  const rowByPhone = db
    .prepare(
      `SELECT ctr.id, ctr.name, ctr.code
       FROM centre_staff cs
       JOIN users u ON cs.user_id = u.id
       JOIN procurement_centres ctr ON cs.centre_id = ctr.id
       WHERE u.phone = ?`
    )
    .get(userId) as { id: string; name: string; code: string } | undefined;

  return rowByPhone ?? null;
}
