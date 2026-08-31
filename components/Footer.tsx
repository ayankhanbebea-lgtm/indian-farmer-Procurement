import Link from "next/link";
import { Mark } from "@/components/Logo";

export default function Footer() {
  return (
    <footer className="bg-navy text-white/60 mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-10 text-sm">
        <Mark size={22} className="text-white/80 mb-2" />
        <p className="font-semibold text-white">KRISHIDHENU</p>
        <p className="mt-1">Digital queue and procurement management for farmers and procurement centres.</p>
        <div className="mt-5 flex flex-wrap gap-4 text-xs text-white/50">
          <Link href="/about" className="hover:text-white transition-colors">
            About
          </Link>
          <Link href="/help" className="hover:text-white transition-colors">
            Help
          </Link>
          <Link href="/privacy" className="hover:text-white transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-white transition-colors">
            Terms
          </Link>
          <Link href="/contact" className="hover:text-white transition-colors">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}
