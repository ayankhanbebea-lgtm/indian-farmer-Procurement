import type { Metadata } from "next";
import Link from "next/link";
import LandingHeader from "@/components/LandingHeader";
import Footer from "@/components/Footer";
import { ChevronLeft, FileCheck, Scale, AlertCircle, ShieldAlert, CheckSquare2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service — KRISHIDHENU",
  description: "Terms and conditions for using KRISHIDHENU digital procurement platform.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen flex flex-col bg-surface">
      <LandingHeader />

      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 w-full flex-1">
        {/* Back Button */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-brand-600 transition-colors group"
          >
            <ChevronLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Homepage</span>
          </Link>
        </div>

        {/* Header Title Section */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold mb-3">
            <Scale size={14} className="text-brand-600" />
            <span>Legal Agreement</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink tracking-tight">
            Terms of Service
          </h1>
        </div>

        {/* Main Content Card */}
        <div className="panel p-6 sm:p-8 space-y-6">
          <div className="space-y-4 text-ink leading-relaxed text-base sm:text-lg">
            <p>
              By using KRISHIDHENU, you agree to provide accurate registration and land/crop information.
            </p>
            <p>
              Slot bookings are subject to procurement centre capacity and may be rescheduled by the centre in case of unforeseen circumstances.
            </p>
            <p>
              KRISHIDHENU is a facilitation platform; final procurement decisions, quality grading, and payment disbursal remain the responsibility of the Department of Consumer Affairs and designated procurement centre officers.
            </p>
            <p>
              Misuse of the platform, including fraudulent registration or false crop declarations, may result in account suspension and reporting to relevant authorities.
            </p>
          </div>

          <div className="border-t border-line/70 pt-6 grid sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-surface-sunken/60 border border-line/40">
              <CheckSquare2 className="text-brand-600 mb-2" size={20} />
              <h3 className="font-semibold text-ink text-sm mb-1">Accurate Declarations</h3>
              <p className="text-xs text-ink-faint">Ensure all crop details and personal data match official records.</p>
            </div>
            <div className="p-4 rounded-lg bg-surface-sunken/60 border border-line/40">
              <AlertCircle className="text-brand-600 mb-2" size={20} />
              <h3 className="font-semibold text-ink text-sm mb-1">Capacity Scheduling</h3>
              <p className="text-xs text-ink-faint">Centre slots depend on real-time daily operational limits.</p>
            </div>
            <div className="p-4 rounded-lg bg-surface-sunken/60 border border-line/40">
              <ShieldAlert className="text-brand-600 mb-2" size={20} />
              <h3 className="font-semibold text-ink text-sm mb-1">Strict Compliance</h3>
              <p className="text-xs text-ink-faint">Fraudulent declarations are subject to regulatory actions.</p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
