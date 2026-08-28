"use client";

import { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";
import { LANGUAGES } from "@/lib/i18n";
import { useLanguage } from "@/lib/i18n/context";

interface LanguageSelectorProps {
  currentLang?: string;
  onLanguageChange?: (lang: string) => void;
}

export default function LanguageSelector({ currentLang: propLang, onLanguageChange }: LanguageSelectorProps) {
  const { lang, setLang } = useLanguage();
  const activeLang = propLang || lang;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSelect(newLang: string) {
    setOpen(false);
    setLang(newLang);
    if (onLanguageChange) onLanguageChange(newLang);
  }

  const current = LANGUAGES[activeLang] ?? LANGUAGES.en;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-ink-soft hover:bg-surface hover:text-ink transition-colors"
        aria-label="Select language"
      >
        <Globe size={14} />
        <span className="hidden sm:inline">{current.nativeName}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-line rounded-xl shadow-lg z-50 py-1 max-h-72 overflow-y-auto">
          {Object.entries(LANGUAGES).map(([code, { nativeName, name }]) => (
            <button
              key={code}
              onClick={() => handleSelect(code)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-surface transition-colors text-left"
            >
              <span className="font-medium text-ink">{nativeName}</span>
              <span className="text-xs text-ink-faint ml-2">{name}</span>
              {activeLang === code && <Check size={13} className="text-brand-600 ml-1" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
