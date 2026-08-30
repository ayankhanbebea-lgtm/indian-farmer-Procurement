"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { Building2, CheckCircle2, ShieldCheck, Wheat, X, AlertCircle, Lock } from "lucide-react";

type BankDetailsModalProps = {
  payment: {
    id: string;
    bookingId: string;
    token: string;
    crop: string;
    finalQuantity: number;
    quantityUnit?: string;
    ratePerUnit: number;
    deductions?: number;
    finalPayableAmount: number;
    farmerName?: string;
  };
  onClose: () => void;
  onSuccess: () => void;
};

export default function FarmerBankDetailsModal({ payment, onClose, onSuccess }: BankDetailsModalProps) {
  const [accountHolderName, setAccountHolderName] = useState(payment.farmerName || "");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [upiId, setUpiId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payable = payment.finalPayableAmount || 0;
  const deductions = payment.deductions || 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = accountHolderName.trim();
    const bank = bankName.trim();
    const acc = accountNumber.trim();
    const confirmAcc = confirmAccountNumber.trim();
    const ifsc = ifscCode.trim().toUpperCase();
    const upi = upiId.trim();

    if (!name) {
      setError("Please enter the account holder name.");
      return;
    }
    if (!bank) {
      setError("Please enter your bank name.");
      return;
    }
    if (!acc || acc.length < 3) {
      setError("Please enter an account number (min 3 digits).");
      return;
    }
    if (!ifsc) {
      setError("Please enter an IFSC code.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/farmer/payments/submit-bank-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: payment.bookingId,
          paymentId: payment.id,
          accountHolderName: name,
          bankName: bank,
          accountNumber: acc,
          confirmAccountNumber: confirmAcc,
          ifscCode: ifsc,
          upiId: upi || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit bank details.");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to submit bank details. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-rise-in overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-line overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-brand-900 text-white border-b border-brand-800">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-400" />
            <span className="font-display font-bold text-sm">Direct Benefit Transfer (DBT) Bank Details</span>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs text-ink">
          {/* Associated Procurement Summary */}
          <div className="p-3 rounded-xl bg-surface-sunken border border-line space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-ink-faint uppercase font-bold tracking-wider">Token Number</span>
                <p className="font-mono font-bold text-sm text-ink">{payment.token}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-ink-faint uppercase font-bold tracking-wider">Crop & Quantity</span>
                <p className="font-semibold text-xs text-ink">
                  {payment.crop} · {payment.finalQuantity} {payment.quantityUnit || "Quintal"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line/60">
              <div>
                <span className="text-[10px] text-ink-faint block">Rate / Quintal</span>
                <span className="font-mono font-semibold text-ink">{formatCurrency(payment.ratePerUnit)}</span>
              </div>
              {deductions > 0 && (
                <div>
                  <span className="text-[10px] text-ink-faint block">Deductions</span>
                  <span className="font-mono font-semibold text-rose-700">-{formatCurrency(deductions)}</span>
                </div>
              )}
            </div>

            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <span className="font-bold text-emerald-950 uppercase text-[11px] tracking-wide">
                Final Payable Amount:
              </span>
              <span className="font-display font-black text-emerald-800 text-lg">
                {formatCurrency(payable)}
              </span>
            </div>
          </div>

          {/* Security Notice */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-[11px] text-sky-900">
            <Lock size={14} className="text-sky-700 shrink-0" />
            <span>
              Your bank details will be encrypted and used exclusively for direct procurement payment disbursement by the Mandi Admin.
            </span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Bank Form Inputs */}
          <div className="space-y-3">
            <div>
              <label className="label text-xs font-bold">Account Holder Name (As per Passbook) *</label>
              <input
                type="text"
                required
                className="input text-xs font-semibold"
                placeholder="e.g. Ramesh Kumar"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
              />
            </div>

            <div>
              <label className="label text-xs font-bold">Bank Name *</label>
              <input
                type="text"
                required
                className="input text-xs font-semibold"
                placeholder="e.g. State Bank of India, Punjab National Bank, Bank of Baroda"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs font-bold">Account Number *</label>
                <input
                  type="text"
                  required
                  className="input text-xs font-mono font-bold"
                  placeholder="e.g. 123456"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="label text-xs font-bold">Confirm Account Number (Demo)</label>
                <input
                  type="text"
                  className="input text-xs font-mono font-bold"
                  placeholder="Re-enter or dummy number"
                  value={confirmAccountNumber}
                  onChange={(e) => setConfirmAccountNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs font-bold">IFSC Code *</label>
                <input
                  type="text"
                  required
                  className="input text-xs font-mono font-bold uppercase tracking-wider"
                  placeholder="e.g. SBIN0001234 or 812"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label className="label text-xs font-bold">UPI ID (Optional)</label>
                <input
                  type="text"
                  className="input text-xs font-mono"
                  placeholder="e.g. name@upi"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-ghost !py-2 !px-4 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary !py-2.5 !px-5 text-xs font-bold inline-flex items-center gap-2 shadow-sm"
            >
              <CheckCircle2 size={15} />
              <span>{loading ? "Submitting..." : "Submit Bank Details for Payment"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
