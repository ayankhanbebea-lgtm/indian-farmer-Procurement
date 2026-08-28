import { getDb } from "../lib/db";
import { getFarmerProfileId } from "../lib/farmer";
import { farmersAhead, estimateWaitMinutes, currentlyServingToken } from "../lib/services";

const db = getDb();
const rameshUser = db.prepare(`SELECT id, phone, name, role FROM users WHERE phone = '9200000001'`).get() as any;
console.log("Ramesh user:", rameshUser);

const farmerId = getFarmerProfileId(rameshUser.id);
console.log("Farmer profile ID:", farmerId);

const booking = db
  .prepare(
    `SELECT b.id, b.token, b.status, b.quantity_quintal as quantityQuintal,
            c.name as cropName, ctr.id as centreId, ctr.name as centreName,
            s.date, s.start_time as startTime, s.end_time as endTime,
            q.position
     FROM bookings b
     JOIN crops c ON b.crop_id = c.id
     JOIN procurement_centres ctr ON b.centre_id = ctr.id
     JOIN slots s ON b.slot_id = s.id
     LEFT JOIN queue_entries q ON q.booking_id = b.id
     WHERE b.farmer_id = ? AND b.status NOT IN ('PROCUREMENT_COMPLETED','PAYMENT_PROCESSING','PAYMENT_COMPLETED','CANCELLED','NO_SHOW')
     ORDER BY b.created_at DESC LIMIT 1`
  )
  .get(farmerId) as any;

console.log("Booking found:", booking);
if (booking) {
  const ahead = booking.position != null ? farmersAhead(booking.centreId, booking.date, booking.position) : 0;
  const waitMins = estimateWaitMinutes(booking.centreId, ahead);
  const serving = currentlyServingToken(booking.centreId, booking.date);
  console.log("ahead:", ahead, "waitMins:", waitMins, "serving:", serving);
}
