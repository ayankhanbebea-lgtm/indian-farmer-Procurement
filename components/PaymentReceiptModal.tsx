"use client";

import { useRef } from "react";
import { formatCurrency, formatDate, amountToWords } from "@/lib/format";
import { CheckCircle2, Download, Printer, ShieldCheck, Wheat, Building2, UserCheck, X } from "lucide-react";

type PaymentReceiptProps = {
  payment: {
    id: string;
    token: string;
    farmerName: string;
    farmerCode?: string;
    farmerPhone?: string;
    centreName: string;
    centreCode?: string;
    crop: string;
    qualityGrade?: string;
    finalQuantity: number;
    quantityUnit?: string;
    ratePerUnit: number;
    totalAmount: number;
    paymentMethod?: string;
    transactionId?: string;
    referenceNo?: string;
    paidAt?: string;
    createdAt?: string;
    bankAccountLast4?: string;
    upiId?: string;
  };
  onClose: () => void;
};

export default function PaymentReceiptModal({ payment, onClose }: PaymentReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const txnId = payment.transactionId || payment.referenceNo || `TXN-${payment.token}`;
  const method = payment.paymentMethod || "DBT (Direct Benefit Transfer)";
  const quantity = payment.finalQuantity || 0;
  const unit = payment.quantityUnit || "Quintal";
  const rate = payment.ratePerUnit || 0;
  const amount = payment.totalAmount || 0;
  const dateStr = payment.paidAt ? formatDate(payment.paidAt) : formatDate(payment.createdAt);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-rise-in overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-line overflow-hidden my-auto print:shadow-none print:border-none print:max-w-full">
        {/* Modal Header (Hidden during print) */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-brand-900 text-white border-b border-brand-800 print:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-400" />
            <span className="font-display font-bold text-sm">Official Procurement Payment Receipt</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-sm font-bold p-1 rounded hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        {/* Printable Receipt Paper */}
        <div ref={receiptRef} className="p-6 space-y-5 bg-white text-ink print:p-6 print:space-y-4">
          {/* Government / Mandi Official Header */}
          <div className="text-center pb-4 border-b-2 border-brand-700/40 space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-800 text-[11px] font-bold tracking-wide uppercase">
              <Building2 size={12} />
              <span>Department of Agriculture & Farmer Welfare</span>
            </div>
            <h1 className="font-display font-black text-lg text-ink tracking-tight uppercase">
              Smart Procurement Mandi Receipt
            </h1>
            <p className="text-[11px] text-ink-faint">
              Government of Rajasthan · Direct Benefit Transfer (DBT) Portal
            </p>
          </div>

          {/* Paid Stamp & Token Banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/80 border border-emerald-300">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Digital Token No.</span>
              <p className="font-mono font-black text-xl text-emerald-950">{payment.token}</p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-xs font-black bg-emerald-600 text-white px-2.5 py-1 rounded-md shadow-xs">
                <CheckCircle2 size={14} /> STATUS: PAID
              </span>
              <p className="text-[10px] text-emerald-800 font-mono mt-0.5">{dateStr}</p>
            </div>
          </div>

          {/* 2-Column Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-surface-sunken p-3.5 rounded-xl border border-line">
            <div>
              <span className="text-[10px] text-ink-faint block uppercase font-bold">Farmer Name</span>
              <span className="font-bold text-ink text-sm block">{payment.farmerName}</span>
              {payment.farmerCode && (
                <span className="text-[10px] font-mono text-ink-faint block">{payment.farmerCode}</span>
              )}
            </div>
            <div>
              <span className="text-[10px] text-ink-faint block uppercase font-bold">Procurement Centre</span>
              <span className="font-semibold text-ink text-xs block">{payment.centreName}</span>
              {payment.centreCode && (
                <span className="text-[10px] font-mono text-brand-700 block font-bold">{payment.centreCode}</span>
              )}
            </div>
          </div>

          {/* Crop & Procurement Breakdown Table */}
          <div className="border border-line rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-surface text-ink-faint border-b border-line">
                <tr className="text-left font-semibold">
                  <th className="py-2.5 px-3">Crop / Description</th>
                  <th className="py-2.5 px-3 text-right">Weighed Qty</th>
                  <th className="py-2.5 px-3 text-right">Rate / Unit</th>
                  <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr>
                  <td className="py-3 px-3">
                    <span className="font-bold text-ink block">{payment.crop}</span>
                    <span className="text-[10px] text-ink-faint">
                      Quality Grade: {payment.qualityGrade || "Grade A (FAQ)"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-ink">
                    {quantity} {unit}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-ink-soft">
                    {formatCurrency(rate)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-ink text-sm">
                    {formatCurrency(amount)}
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-surface-sunken border-t border-line font-bold">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 text-right uppercase text-[11px] text-ink-soft">
                    Total Amount Disbursed:
                  </td>
                  <td className="py-2.5 px-3 text-right font-display font-black text-base text-emerald-700">
                    {formatCurrency(amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Amount in Words */}
          <div className="p-2.5 rounded-lg bg-surface border border-line text-xs">
            <span className="text-[10px] text-ink-faint block uppercase font-bold">Amount in Words</span>
            <span className="font-semibold text-ink text-xs italic">{amountToWords(amount)}</span>
          </div>

          {/* Banking / Transaction Details */}
          <div className="p-3.5 rounded-xl bg-surface-sunken border border-line text-xs space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-ink-faint">Payment Mode:</span>
              <span className="font-bold text-ink">{method}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-faint">Transaction Ref / UTR:</span>
              <span className="font-mono font-bold text-emerald-800 bg-white px-1.5 py-0.5 rounded border border-line">
                {txnId}
              </span>
            </div>
            {payment.bankAccountLast4 && (
              <div className="flex justify-between items-center">
                <span className="text-ink-faint">Bank Account:</span>
                <span className="font-mono font-semibold text-ink">•••• {payment.bankAccountLast4}</span>
              </div>
            )}
            {payment.upiId && (
              <div className="flex justify-between items-center">
                <span className="text-ink-faint">UPI ID:</span>
                <span className="font-mono font-semibold text-ink">{payment.upiId}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-ink-faint">Settlement Timestamp:</span>
              <span className="font-mono text-ink text-[11px]">
                {payment.paidAt ? new Date(payment.paidAt).toLocaleString("en-IN") : dateStr}
              </span>
            </div>
          </div>

          {/* Footer & Seal */}
          <div className="pt-3 border-t border-dashed border-line text-center space-y-1 text-[10px] text-ink-faint">
            <p className="font-semibold text-ink-soft">
              Computer Generated Authentic Mandi Procurement Payment Receipt
            </p>
            <p>Direct Mandi DBT System · No physical signature required</p>
          </div>
        </div>

        {/* Action Buttons Footer (Hidden during print) */}
        <div className="px-6 py-4 bg-surface border-t border-line flex items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost !py-2 !px-4 text-xs font-semibold"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="btn-primary !py-2 !px-5 text-xs font-bold inline-flex items-center gap-2 shadow-sm"
          >
            <Printer size={15} />
            <span>Print / Save Receipt PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
