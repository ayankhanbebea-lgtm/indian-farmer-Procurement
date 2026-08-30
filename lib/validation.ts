import { z } from "zod";
import { normalizeDateToYMD } from "./format";

export const sendOtpSchema = z.object({
  mobileNumber: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"),
});

export const verifyOtpSchema = z.object({
  mobileNumber: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"),
  otp: z
    .string()
    .regex(/^\d{6}$/, "Please enter a valid 6-digit OTP"),
});

export const completeProfileSchema = z.object({
  mobileNumber: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"),
  name: z.string().min(2, "Please enter your full name"),
  district: z.string().min(2, "Please enter your district"),
  address: z.string().optional(),
  language: z.enum(["en", "hi"]).optional().default("en"),
});

export const createBookingSchema = z.object({
  cropCode: z.string().min(2),
  quantityQuintal: z.coerce.number().positive().max(2000, "Please enter a realistic quantity"),
  centreId: z.string().min(1),
  date: z.string().min(1).transform((val) => normalizeDateToYMD(val)),
  slotId: z.string().min(1),
});


export const staffActionSchema = z.object({
  bookingId: z.string().min(1),
  action: z.enum([
    "CALL_NEXT",
    "MARK_ARRIVED",
    "VERIFY",
    "START_WEIGHING",
    "COMPLETE_PROCUREMENT",
    "START_PAYMENT",
    "COMPLETE_PAYMENT",
    "PAYMENT_FAILED",
    "SKIP",
    "MARK_NO_SHOW",
  ]),
  actualQuantity: z.coerce.number().positive().optional(),
  ratePerUnit: z.coerce.number().positive().optional(),
  qualityGrade: z.string().optional(),
  remarks: z.string().optional(),
  amount: z.coerce.number().positive().optional(),
});

export const adminPaymentActionSchema = z.object({
  paymentId: z.string().min(1),
  action: z.enum([
    "START_PROCESSING",
    "MARK_PAID",
    "MARK_FAILED",
    "PUT_ON_HOLD",
    "RESUME_PAYMENT",
  ]),
  paymentMethod: z.enum(["DBT", "NEFT", "RTGS", "PFMS", "UPI", "Bank Transfer"]).optional(),
  transactionId: z.string().trim().optional(),
  bankAccountLast4: z.string().trim().max(4).optional(),
  upiId: z.string().trim().optional(),
  paidAt: z.string().optional(),
  failureReason: z.string().optional(),
  holdReason: z.string().optional(),
});
