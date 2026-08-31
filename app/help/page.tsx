import type { Metadata } from "next";
import Link from "next/link";
import LandingHeader from "@/components/LandingHeader";
import Footer from "@/components/Footer";
import { ChevronLeft, HelpCircle, ArrowRight, MessageSquareQuote, Calendar, Clock, CreditCard, UserPlus } from "lucide-react";

export const metadata: Metadata = {
  title: "Help & FAQs — KRISHIDHENU",
  description: "Frequently Asked Questions and help guide for KRISHIDHENU digital procurement platform.",
};

const faqs = [
  {
    icon: UserPlus,
    question: "How do I register?",
    answer: "Sign up using your Aadhaar-linked mobile number and select your nearest procurement centre.",
  },
  {
    icon: Calendar,
    question: "How do I book a slot?",
    answer: 'Go to "Book Slot," choose an available date/time based on centre capacity, and confirm.',
  },
  {
    icon: Clock,
    question: "How do I check my queue status?",
    answer: "Your live token number and estimated wait time appear on your dashboard and are sent via SMS.",
  },
  {
    icon: CreditCard,
    question: "When will I get my payment?",
    answer: 'Payment status (initiated/processing/credited) is tracked under "Procurement Status" and updates automatically once DoCA processes it.',
  },
];

export default function HelpPage() {
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
            <HelpCircle size={14} className="text-brand-600" />
            <span>Support &amp; Guidance</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink tracking-tight">
            Help
          </h1>
          <p className="text-ink-soft text-lg mt-1 font-medium">
            Frequently Asked Questions
          </p>
        </div>

        {/* FAQ Cards */}
        <div className="space-y-4 mb-8">
          {faqs.map((faq, index) => {
            const Icon = faq.icon;
            return (
              <div key={index} className="panel p-5 sm:p-6 transition-all hover:border-brand-300">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={20} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-ink text-base sm:text-lg">
                      {faq.question}
                    </h3>
                    <p className="text-ink-soft text-sm sm:text-base leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Need More Help Box */}
        <div className="panel p-6 sm:p-8 bg-brand-50/50 border-brand-200/80 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Need more help?</h2>
            <p className="text-sm text-ink-soft mt-1">Contact us below.</p>
          </div>
          <Link
            href="/contact"
            className="btn-primary !px-5 !py-2.5 text-sm inline-flex items-center gap-2 shrink-0"
          >
            <span>Contact Us</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  );
}
