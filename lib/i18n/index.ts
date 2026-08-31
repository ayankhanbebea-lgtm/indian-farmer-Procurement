import en, { TranslationKeys } from "./translations/en";
import hi from "./translations/hi";

export const LANGUAGES: Record<string, { name: string; nativeName: string }> = {
  en: { name: "English", nativeName: "English" },
  hi: { name: "Hindi", nativeName: "हिंदी" },
};

const translations: Record<string, Partial<Record<TranslationKeys, string>>> = {
  en,
  hi,
};

export function t(lang: string, key: TranslationKeys): string {
  const dict = translations[lang] ?? translations.en;
  return dict[key] ?? (translations.en[key] as string) ?? key;
}

export type { TranslationKeys };
