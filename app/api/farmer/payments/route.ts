import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, newId, nowIso } from "@/lib/db";
import { getFarmerProfileId } from "@/lib/farmer";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "FARMER") {
    return NextResponse.json({ error: "Please login as a farmer." }, { status: 401 });
  }

  const farmerId = getFarmerProfileId(session.id);
  if (!farmerId) {
    return NextResponse.json({ payments: [], stats: { totalDisbursed: 0, pendingAmount: 0, count: 0 } });
  }

  const db = getDb();

  // Query ALL completed procurements and linked payment records for this farmer
  const query = `
    SELECT
      b.id as bookingId,
      b.token as token,
      b.status as bookingStatus,
      COALESCE(b.actual_quantity, b.quantity_quintal, 0) as bookingActualQuantity,
      COALESCE(b.deductions, 0) as bookingDeductions,
      b.quality_grade as qualityGrade,
      b.farmer_id as bookingFarmerId,
      b.centre_id as procurementCentreId,
      c.name as crop,
      c.code as cropCode,
      COALESCE(c.msp_rate, 2275) as cropMsp,
      ctr.name as centreName,
      ctr.code as centreCode,
      s.date as slotDate,
      s.start_time as startTime,
      s.end_time as endTime,
      fp.id as farmerId,
      u.name as farmerName,
      fp.farmer_code as farmerCode,
      p.id as paymentId,
      p.final_quantity as paymentFinalQuantity,
      p.rate_per_unit as paymentRatePerUnit,
      p.deductions as paymentDeductions,
      p.final_payable_amount as paymentFinalPayableAmount,
      p.total_amount as paymentTotalAmount,
      COALESCE(p.payment_status, p.status, 'BANK_DETAILS_REQUIRED') as paymentStatus,
      p.account_holder_name as accountHolderName,
      p.bank_name as bankName,
      p.bank_account_last4 as bankAccountLast4,
      p.ifsc_code as ifscCode,
      p.upi_id as upiId,
      p.payment_method as paymentMethod,
      COALESCE(p.transaction_reference, p.transaction_id, p.reference_no) as transactionId,
      COALESCE(p.transaction_reference, p.transaction_id, p.reference_no) as transactionReference,
      p.failure_reason as failureReason,
      p.hold_reason as holdReason,
      p.submitted_at as submittedAt,
      p.processed_at as processedAt,
      p.initiated_at as initiatedAt,
      p.paid_at as paidAt,
      p.created_at as createdAt,
      p.updated_at as updatedAt
    FROM bookings b
    JOIN crops c ON b.crop_id = c.id
    JOIN procurement_centres ctr ON b.centre_id = ctr.id
    JOIN slots s ON b.slot_id = s.id
    JOIN farmer_profiles fp ON b.farmer_id = fp.id
    JOIN users u ON fp.user_id = u.id
    LEFT JOIN payments p ON p.booking_id = b.id
    WHERE (b.farmer_id = ? OR fp.user_id = ? OR p.farmer_id = ?)
      AND (b.status IN ('PROCUREMENT_COMPLETED', 'PAYMENT_PROCESSING', 'PAYMENT_COMPLETED') OR p.id IS NOT NULL)
    ORDER BY COALESCE(p.created_at, b.updated_at, b.created_at) DESC
  `;

  const rows = db.prepare(query).all(farmerId, session.id, farmerId) as any[];

  console.log("[FarmerPayments API]", {
    loggedInFarmerId: farmerId,
    userId: session.id,
    completedProcurementsFound: rows.length,
  });

  const payments: any[] = [];
  let totalDisbursed = 0;
  let pendingAmount = 0;
  let inProcessingAmount = 0;

  for (const row of rows) {
    let paymentId = row.paymentId;
    const finalQuantity = row.paymentFinalQuantity != null ? row.paymentFinalQuantity : (row.bookingActualQuantity || 0);
    const ratePerUnit = row.paymentRatePerUnit != null ? row.paymentRatePerUnit : row.cropMsp;
    const deductions = row.paymentDeductions != null ? row.paymentDeductions : (row.bookingDeductions || 0);
    const finalPayable = row.paymentFinalPayableAmount != null
      ? row.paymentFinalPayableAmount
      : (row.paymentTotalAmount != null ? row.paymentTotalAmount : Math.max(0, Math.round(((finalQuantity * ratePerUnit) - deductions) * 100) / 100));

    // If payment record was not yet created for a completed procurement, auto-create it
    if (!paymentId) {
      paymentId = newId("pay_");
      try {
        db.prepare(`
          INSERT INTO payments (
            id, booking_id, token_number, farmer_id, farmer_name, procurement_centre_id,
            crop, final_quantity, quantity_unit, rate_per_unit, deductions, final_payable_amount,
            total_amount, amount, payment_status, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Quintal', ?, ?, ?, ?, ?, 'BANK_DETAILS_REQUIRED', 'PENDING', ?, ?)
        `).run(
          paymentId,
          row.bookingId,
          row.token,
          farmerId,
          row.farmerName || "Farmer",
          row.procurementCentreId,
          row.crop,
          finalQuantity,
          ratePerUnit,
          deductions,
          finalPayable,
          finalPayable,
          finalPayable,
          nowIso(),
          nowIso()
        );
      } catch (err) {
        console.error("[FarmerPayments Auto-Create Error]", err);
      }
    }

    const paymentItem = {
      id: paymentId,
      bookingId: row.bookingId,
      farmerId: row.farmerId,
      farmerName: row.farmerName,
      procurementCentreId: row.procurementCentreId,
      crop: row.crop,
      finalQuantity,
      quantityUnit: "Quintal",
      ratePerUnit,
      deductions,
      finalPayableAmount: finalPayable,
      totalAmount: finalPayable,
      paymentStatus: row.paymentStatus || "BANK_DETAILS_REQUIRED",
      accountHolderName: row.accountHolderName,
      bankName: row.bankName,
      bankAccountLast4: row.bankAccountLast4,
      ifscCode: row.ifscCode,
      upiId: row.upiId,
      paymentMethod: row.paymentMethod,
      transactionId: row.transactionId,
      transactionReference: row.transactionReference,
      failureReason: row.failureReason,
      holdReason: row.holdReason,
      submittedAt: row.submittedAt,
      processedAt: row.processedAt,
      initiatedAt: row.initiatedAt,
      paidAt: row.paidAt,
      createdAt: row.createdAt || row.slotDate,
      updatedAt: row.updatedAt,
      token: row.token,
      bookingStatus: row.bookingStatus,
      qualityGrade: row.qualityGrade,
      centreName: row.centreName,
      centreCode: row.centreCode,
      farmerCode: row.farmerCode,
      slotDate: row.slotDate,
      startTime: row.startTime,
      endTime: row.endTime,
    };

    payments.push(paymentItem);

    if (paymentItem.paymentStatus === "PAID") {
      totalDisbursed += finalPayable;
    } else if (paymentItem.paymentStatus === "PROCESSING") {
      inProcessingAmount += finalPayable;
    } else {
      pendingAmount += finalPayable;
    }
  }

  return NextResponse.json({
    payments,
    stats: {
      totalDisbursed,
      pendingAmount,
      inProcessingAmount,
      totalCount: payments.length,
      paidCount: payments.filter((p) => p.paymentStatus === "PAID").length,
    },
  });
}
