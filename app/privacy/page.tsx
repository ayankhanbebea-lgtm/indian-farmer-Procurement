import type { Metadata } from "next";
import Link from "next/link";
import LandingHeader from "@/components/LandingHeader";
import Footer from "@/components/Footer";
import { ChevronLeft, ShieldCheck, Lock, EyeOff, FileText, KeyRound } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — KRISHIDHENU",
  description: "Privacy Policy and data protection guidelines for KRISHIDHENU digital procurement platform.",
};

export default function PrivacyPage() {
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
            <ShieldCheck size={14} className="text-brand-600" />
            <span>Data Security &amp; Trust</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink tracking-tight">
            Privacy Policy
          </h1>
        </div>

        {/* Main Content Card */}
        <div className="panel p-6 sm:p-8 space-y-6">
          <div className="space-y-4 text-ink leading-relaxed text-base sm:text-lg">
            <p>
              KRISHIDHENU collects the following information to facilitate procurement services: your name, Aadhaar-linked mobile number, land/crop declaration details, and bank account information for MSP payment processing.
            </p>
            <p>
              This data is used solely to enable slot booking, queue management, and payment tracking, and is shared only with authorized Department of Consumer Affairs (DoCA) systems for procurement and PFMS payment verification.
            </p>
            <p>
              Your data is not sold or shared with third parties for commercial purposes.
            </p>
            <p>
              Aadhaar and bank details are encrypted in transit and at rest.
            </p>
            <p>
              You may request access to, correction of, or deletion of your data by contacting support, subject to statutory record-keeping requirements under applicable government procurement regulations.
            </p>
          </div>

          <div className="border-t border-line/70 pt-6 grid sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-surface-sunken/60 border border-line/40">
              <Lock className="text-brand-600 mb-2" size={20} />
              <h3 className="font-semibold text-ink text-sm mb-1">Encrypted &amp; Secure</h3>
              <p className="text-xs text-ink-faint">End-to-end data encryption in transit and at rest.</p>
            </div>
            <div className="p-4 rounded-lg bg-surface-sunken/60 border border-line/40">
              <EyeOff className="text-brand-600 mb-2" size={20} />
              <h3 className="font-semibold text-ink text-sm mb-1">Zero Commercial Sharing</h3>
              <p className="text-xs text-ink-faint">Data is never sold or provided to unauthorized entities.</p>
            </div>
            <div className="p-4 rounded-lg bg-surface-sunken/60 border border-line/40">
              <KeyRound className="text-brand-600 mb-2" size={20} />
              <h3 className="font-semibold text-ink text-sm mb-1">Government Verified</h3>
              <p className="text-xs text-ink-faint">Shared strictly for official DoCA &amp; PFMS processing.</p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
