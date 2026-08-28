import en, { TranslationKeys } from "./translations/en";
import hi from "./translations/hi";
import mr from "./translations/mr";
import bn from "./translations/bn";
import gu from "./translations/gu";
import pa from "./translations/pa";
import ta from "./translations/ta";
import te from "./translations/te";
import kn from "./translations/kn";
import ml from "./translations/ml";
import or_ from "./translations/or";
import as_ from "./translations/as";

export const LANGUAGES: Record<string, { name: string; nativeName: string }> = {
  en: { name: "English", nativeName: "English" },
  hi: { name: "Hindi", nativeName: "हिन्दी" },
  mr: { name: "Marathi", nativeName: "मराठी" },
  bn: { name: "Bengali", nativeName: "বাংলা" },
  gu: { name: "Gujarati", nativeName: "ગુજરાતી" },
  pa: { name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  ta: { name: "Tamil", nativeName: "தமிழ்" },
  te: { name: "Telugu", nativeName: "తెలుగు" },
  kn: { name: "Kannada", nativeName: "ಕನ್ನಡ" },
  ml: { name: "Malayalam", nativeName: "മലയാളം" },
  or: { name: "Odia", nativeName: "ଓଡ଼ିଆ" },
  as: { name: "Assamese", nativeName: "অসমীয়া" },
};

const translations: Record<string, Partial<Record<TranslationKeys, string>>> = {
  en,
  hi,
  mr,
  bn,
  gu,
  pa,
  ta,
  te,
  kn,
  ml,
  or: or_,
  as: as_,
};

export function t(lang: string, key: TranslationKeys): string {
  const dict = translations[lang] ?? translations.en;
  return dict[key] ?? (translations.en[key] as string) ?? key;
}

export type { TranslationKeys };
