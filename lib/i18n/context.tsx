"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { t, LANGUAGES, TranslationKeys } from "./index";

interface LanguageContextType {
  lang: string;
  setLang: (lang: string) => void;
  t: (key: TranslationKeys) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (key: TranslationKeys) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<string>("en");

  useEffect(() => {
    // Initialise from localStorage or default to "en"
    try {
      const saved = localStorage.getItem("sp_language");
      if (saved && Object.keys(LANGUAGES).includes(saved)) {
        setLangState(saved);
        document.documentElement.lang = saved;
      }
    } catch {}
  }, []);

  const setLang = useCallback((newLang: string) => {
    if (!Object.keys(LANGUAGES).includes(newLang)) return;
    setLangState(newLang);
    try {
      localStorage.setItem("sp_language", newLang);
      document.documentElement.lang = newLang;
    } catch {}

    // Persist to user session on backend (non-blocking)
    fetch("/api/auth/language", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: newLang }),
    }).catch(() => {});
  }, []);

  const translate = useCallback(
    (key: TranslationKeys) => {
      return t(lang, key);
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translate }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      lang: "en",
      setLang: () => {},
      t: (key: TranslationKeys) => t("en", key),
    };
  }
  return context;
}
