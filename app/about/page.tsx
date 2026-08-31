import type { Metadata } from "next";
import Link from "next/link";
import LandingHeader from "@/components/LandingHeader";
import Footer from "@/components/Footer";
import { ChevronLeft, Building2, Users, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "About KRISHIDHENU — Digital Procurement Platform",
  description: "Learn about KRISHIDHENU, a digital procurement and queue management platform for farmers.",
};

export default function AboutPage() {
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
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink tracking-tight">
            About KRISHIDHENU
          </h1>
        </div>

        {/* Main Content Card */}
        <div className="panel p-6 sm:p-8 space-y-6">
          <div className="space-y-4 text-ink leading-relaxed text-base sm:text-lg">
            <p>
              KRISHIDHENU is a digital procurement platform built for farmers to register, book procurement slots, and track real-time queue status at government purchase centres.
            </p>
            <p className="text-ink-soft text-base">
              Developed as a solution under the Smart India Hackathon 2026 for the Ministry of Consumer Affairs, Food &amp; Public Distribution (Department of Consumer Affairs), KRISHIDHENU eliminates long waiting times and uncertainty around procurement and payment status by giving farmers a transparent, self-service digital interface — accessible via web, app, and SMS.
            </p>
          </div>

          <div className="border-t border-line/70 pt-6 grid sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-surface-sunken/60 border border-line/40">
              <Users className="text-brand-600 mb-2" size={20} />
              <h3 className="font-semibold text-ink text-sm mb-1">Farmer First</h3>
              <p className="text-xs text-ink-faint">Direct slot booking, live token tracking, and SMS alerts.</p>
            </div>
            <div className="p-4 rounded-lg bg-surface-sunken/60 border border-line/40">
              <Building2 className="text-brand-600 mb-2" size={20} />
              <h3 className="font-semibold text-ink text-sm mb-1">DoCA Alignment</h3>
              <p className="text-xs text-ink-faint">Integrated with procurement centres and PFMS payment flows.</p>
            </div>
            <div className="p-4 rounded-lg bg-surface-sunken/60 border border-line/40">
              <CheckCircle2 className="text-brand-600 mb-2" size={20} />
              <h3 className="font-semibold text-ink text-sm mb-1">Full Transparency</h3>
              <p className="text-xs text-ink-faint">Clear weighbridge records, quality grading, and MSP updates.</p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
