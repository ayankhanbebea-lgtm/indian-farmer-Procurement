import Link from "next/link";
import LandingHeader from "@/components/LandingHeader";
import { Mark } from "@/components/Logo";
import { CalendarCheck, ListOrdered, Wallet, ClipboardCheck, MapPin, LayoutGrid, Landmark } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col bg-surface">
      <LandingHeader />


      {/* Hero */}
      <section className="relative overflow-hidden bg-navy text-white">
        <svg className="absolute -right-16 -top-20 text-white/[0.05]" width="480" height="480" viewBox="0 0 480 480" fill="none">
          <path d="M120 420 C180 300 210 180 300 60" stroke="currentColor" strokeWidth="26" strokeLinecap="round" />
          <path d="M180 380 C230 280 260 180 330 90" stroke="currentColor" strokeWidth="20" strokeLinecap="round" />
        </svg>
        <div className="relative max-w-5xl mx-auto px-4 pt-16 pb-20 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight">Smart Procurement</h1>
          <p className="mt-3 text-lg text-white/70 font-medium">Less waiting. Better planning. Transparent procurement.</p>
          <p className="mt-4 max-w-xl mx-auto text-white/60">
            Helping farmers schedule procurement visits, track their queue, and stay informed about procurement and
            payment status.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login" className="btn-primary !bg-white !text-navy hover:!bg-white/90">
              Book a Procurement Slot
            </Link>
            <Link href="/login" className="btn border border-white/25 !text-white hover:!bg-white/5">
              Check Booking Status
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 py-16 w-full">
        <h2 className="font-display text-2xl font-bold text-center text-ink mb-2">How it works</h2>
        <p className="text-center text-ink-faint text-sm mb-10">Four steps from booking to payment.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: CalendarCheck, title: "Book", desc: "Choose centre and time." },
            { icon: ListOrdered, title: "Get Token", desc: "Receive your digital queue token." },
            { icon: MapPin, title: "Track", desc: "Monitor queue and estimated waiting time." },
            { icon: Wallet, title: "Complete", desc: "Track procurement and payment status." },
          ].map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="relative panel p-5">
              <span className="text-xs font-bold text-brand-300 tnum">{String(i + 1).padStart(2, "0")}</span>
              <Icon className="text-brand-600 mt-2 mb-3" size={22} />
              <p className="font-semibold text-ink text-sm">{title}</p>
              <p className="text-xs text-ink-faint mt-1">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Audiences */}
      <section className="bg-surface-card border-y border-line">
        <div className="max-w-5xl mx-auto px-4 py-16 grid md:grid-cols-3 gap-6">
          <div>
            <ClipboardCheck className="text-brand-600 mb-3" size={22} />
            <h3 className="font-display font-bold text-ink mb-1.5">For Farmers</h3>
            <p className="text-sm text-ink-faint leading-relaxed">
              Book a procurement slot, get a digital token, and see your live queue position and estimated waiting
              time — no repeated phone calls or long waits at the gate.
            </p>
          </div>
          <div>
            <LayoutGrid className="text-brand-600 mb-3" size={22} />
            <h3 className="font-display font-bold text-ink mb-1.5">For Procurement Centres</h3>
            <p className="text-sm text-ink-faint leading-relaxed">
              Manage today's queue, verify and weigh crops, and update procurement and payment status from one
              screen.
            </p>
          </div>
          <div>
            <Landmark className="text-brand-600 mb-3" size={22} />
            <h3 className="font-display font-bold text-ink mb-1.5">For Administrators</h3>
            <p className="text-sm text-ink-faint leading-relaxed">
              Monitor every centre, spot congestion early, and track procurement and payment statistics across
              districts.
            </p>
          </div>
        </div>
      </section>

      <footer className="bg-navy text-white/60 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-10 text-sm">
          <Mark size={22} className="text-white/80 mb-2" />
          <p className="font-semibold text-white">Smart Procurement</p>
          <p className="mt-1">Digital queue and procurement management for farmers and procurement centres.</p>
          <div className="mt-5 flex gap-4 text-xs text-white/50">
            <span>About</span>
            <span>Help</span>
            <span>Privacy</span>
            <span>Terms</span>
            <span>Contact</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
