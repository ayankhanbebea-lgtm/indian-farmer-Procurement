import { getDb } from "./db";

export const MAX_ACTIVE_BOOKINGS = 3;

export const ACTIVE_BOOKING_STATUSES = [
  "BOOKED",
  "ARRIVED",
  "VERIFIED",
  "WEIGHING",
  "PROCUREMENT_IN_PROGRESS",
  "PAYMENT_PROCESSING",
] as const;

export const CLEARED_BOOKING_STATUSES = [
  "PROCUREMENT_COMPLETED",
  "PAYMENT_COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export function getFarmerProfileId(userId: string): string | null {
  const db = getDb();
  const row = db.prepare(`SELECT id FROM farmer_profiles WHERE user_id = ?`).get(userId) as
    | { id: string }
    | undefined;
  return row?.id ?? null;
}

export function getFarmerActiveBookingsCount(farmerId: string): number {
  const db = getDb();
  const placeholders = ACTIVE_BOOKING_STATUSES.map(() => "?").join(",");
  const row = db
    .prepare(`SELECT COUNT(*) as count FROM bookings WHERE farmer_id = ? AND status IN (${placeholders})`)
    .get(farmerId, ...ACTIVE_BOOKING_STATUSES) as { count: number };
  return row?.count || 0;
}

