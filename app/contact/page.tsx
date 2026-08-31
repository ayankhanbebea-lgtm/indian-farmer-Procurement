import type { Metadata } from "next";
import Link from "next/link";
import LandingHeader from "@/components/LandingHeader";
import Footer from "@/components/Footer";
import { ChevronLeft, Mail, PhoneCall, MapPin, Headphones, Clock, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Us — KRISHIDHENU",
  description: "Get in touch with KRISHIDHENU support team and Department of Consumer Affairs helpline.",
};

export default function ContactPage() {
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
            <Headphones size={14} className="text-brand-600" />
            <span>Reach Out to Us</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink tracking-tight">
            Contact Us
          </h1>
          <p className="text-ink-soft text-base sm:text-lg mt-1 font-medium">
            We are here to assist farmers and procurement centre staff with any queries.
          </p>
        </div>

        {/* Clean Contact Cards Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Email Card */}
          <div className="panel p-6 flex flex-col justify-between hover:border-brand-300 transition-all">
            <div>
              <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center mb-4">
                <Mail size={22} />
              </div>
              <h3 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-1">
                Email
              </h3>
              <a
                href="mailto:support@krishidhenu.demo"
                className="text-base sm:text-lg font-bold text-brand-700 hover:text-brand-800 transition-colors break-all"
              >
                support@krishidhenu.demo
              </a>
            </div>
            <p className="text-xs text-ink-faint mt-4 pt-3 border-t border-line/60">
              Response within 24 hours
            </p>
          </div>

          {/* Helpline Card */}
          <div className="panel p-6 flex flex-col justify-between hover:border-brand-300 transition-all">
            <div>
              <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center mb-4">
                <PhoneCall size={22} />
              </div>
              <h3 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-1">
                Helpline
              </h3>
              <a
                href="tel:18001234567"
                className="text-base sm:text-lg font-bold text-ink hover:text-brand-600 transition-colors tnum"
              >
                1800-123-4567 <span className="text-xs font-semibold text-brand-600 block sm:inline sm:ml-1">(Toll-Free)</span>
              </a>
            </div>
            <p className="text-xs text-ink-faint mt-4 pt-3 border-t border-line/60 flex items-center gap-1.5">
              <Clock size={13} className="text-brand-600" />
              <span>Mon – Sat: 8:00 AM – 8:00 PM</span>
            </p>
          </div>

          {/* Address Card */}
          <div className="panel p-6 flex flex-col justify-between hover:border-brand-300 transition-all">
            <div>
              <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center mb-4">
                <MapPin size={22} />
              </div>
              <h3 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-1">
                Address
              </h3>
              <div className="text-sm font-semibold text-ink leading-relaxed">
                <p>Department of Consumer Affairs</p>
                <p className="text-ink-soft font-normal">Jaipur, Rajasthan, India</p>
              </div>
            </div>
            <p className="text-xs text-ink-faint mt-4 pt-3 border-t border-line/60 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-brand-600" />
              <span>Government Purchase Division</span>
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
