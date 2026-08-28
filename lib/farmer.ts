import { getDb } from "./db";

export function getFarmerProfileId(userId: string): string | null {
  const db = getDb();
  const row = db.prepare(`SELECT id FROM farmer_profiles WHERE user_id = ?`).get(userId) as
    | { id: string }
    | undefined;
  return row?.id ?? null;
}
