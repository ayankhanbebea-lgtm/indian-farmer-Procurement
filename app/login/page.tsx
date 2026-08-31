"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import {
  ChevronLeft,
  ShieldCheck,
  Phone,
  CheckCircle2,
  User,
  MapPin,
  Globe,
  Terminal,
  Copy,
  Check,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import LanguageSelector from "@/components/LanguageSelector";

const DISTRICTS = [
  "Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer", "Bikaner", "Alwar", "Sikar",
  "Bhilwara", "Churu", "Nagaur", "Pali", "Barmer", "Jalore", "Sirohi",
  "Other"
];

const LANG_OPTIONS = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
];

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [step, setStep] = useState<"phone" | "otp" | "profile">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("Jaipur");
  const [language, setLanguage] = useState("en");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Dev mode OTP display
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [devOtpCopied, setDevOtpCopied] = useState(false);

  const otpInputRef = useRef<HTMLInputElement>(null);
  const isDev = process.env.NODE_ENV !== "production";

  // Timer countdown for resend OTP cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Focus OTP input when transitioning to OTP step
  useEffect(() => {
    if (step === "otp" && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  const cleanPhone = phone.replace(/\D/g, "").slice(-10);

  // Fetch dev OTP after sending in development mode
  async function fetchDevOtp(ph: string) {
    if (!isDev) return;
    try {
      const res = await fetch(`/api/auth/dev-otp?phone=${ph}`);
      if (res.ok) {
        const data = await res.json();
        if (data.otp) setDevOtp(data.otp);
      }
    } catch {
      // best-effort
    }
  }

  // Step 1: Send OTP
  async function handleSendOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError("");
    setDevOtp(null);

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError("Please enter a valid 10-digit Indian mobile number starting with 6-9.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber: cleanPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to send OTP. Please try again.");
        if (data.cooldownSeconds) {
          setResendCooldown(data.cooldownSeconds);
        }
        return;
      }
      setResendCooldown(data.resendAvailableIn || 10);
      setStep("otp");
      setOtp("");
      // Fetch dev OTP for development testing
      await fetchDevOtp(cleanPhone);
    } catch {
      setError("Unable to connect to authentication server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Verify OTP
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleanOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber: cleanPhone, otp: cleanOtp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "That OTP is incorrect. Please check the code and try again.");
        return;
      }

      // If user is brand new, prompt for basic profile details
      if (data.isNewUser) {
        setStep("profile");
        return;
      }

      // Existing user: redirect to role-specific dashboard
      const userRole = data.user?.role;
      const targetPath =
        userRole === "STAFF"
          ? "/staff"
          : userRole === "ADMIN"
          ? "/admin"
          : "/farmer";
      window.location.href = targetPath;
    } catch {
      setError("Unable to verify OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Step 3: Complete Profile (for brand new farmers)
  async function handleCompleteProfile(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (!district.trim()) {
      setError("Please select your district.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobileNumber: cleanPhone,
          name: name.trim(),
          district: district.trim(),
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to create profile. Please try again.");
        return;
      }

      window.location.href = "/farmer";
    } catch {
      setError("Unable to save profile right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function formatPhoneDisplay(p: string) {
    const raw = p.replace(/\D/g, "").slice(-10);
    if (raw.length <= 5) return raw;
    return `${raw.slice(0, 5)} ${raw.slice(5)}`;
  }

  async function copyDevOtp() {
    if (!devOtp) return;
    await navigator.clipboard.writeText(devOtp).catch(() => {});
    setDevOtpCopied(true);
    setTimeout(() => setDevOtpCopied(false), 1500);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-surface py-8">
      <div className="w-full max-w-sm">
        {/* Top Back Navigation & Language Selector */}
        <div className="mb-4 flex items-center justify-between">
          {step === "phone" ? (
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink transition-colors py-1 pr-2 -ml-1 rounded-md"
              aria-label="Back to home"
            >
              <ChevronLeft size={18} />
              <span>{t("back")}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setError("");
                setDevOtp(null);
                setStep("phone");
              }}
              className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink transition-colors py-1 pr-2 -ml-1 rounded-md"
            >
              <ChevronLeft size={18} />
              <span>{t("back")}</span>
            </button>
          )}

          <LanguageSelector />
        </div>

        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex">
            <Logo />
          </Link>
        </div>

        {/* STEP 1: MOBILE NUMBER INPUT */}
        {step === "phone" && (
          <div className="panel p-6 space-y-4 animate-rise-in">
            <div className="text-center">
              <h1 className="font-display font-bold text-xl text-ink">{t("welcomeTitle")}</h1>
              <p className="text-sm text-ink-faint mt-1">{t("enterMobile")}</p>
            </div>

            {error && <p className="text-sm text-error bg-error/5 rounded-lg px-3 py-2">{error}</p>}

            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="label">{t("mobileLabel")}</label>
                <div className="flex rounded-lg border border-line bg-white focus-within:ring-2 focus-within:ring-brand-600/25 focus-within:border-brand-600 overflow-hidden transition-all">
                  <span className="flex items-center px-3.5 bg-surface-sunken border-r border-line text-sm font-semibold text-ink-soft select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoFocus
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    className="w-full px-4 py-3 text-base text-ink font-semibold tnum focus:outline-none bg-transparent"
                    value={cleanPhone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                <p className="text-xs text-ink-faint mt-1.5">{t("enterMobile")}</p>
              </div>

              <button
                type="submit"
                className="btn-primary w-full text-base font-bold !py-3"
                disabled={loading || cleanPhone.length !== 10}
              >
                {loading ? t("sendingOtp") : t("sendOtp")}
              </button>
            </form>

            {/* Demo accounts hint */}
            <div className="pt-3 border-t border-line/60">
              <p className="text-xs text-ink-faint text-center font-medium">{t("quickDemoAccounts")}</p>
              <div className="mt-2 space-y-1.5 text-xs text-ink-soft">
                <div className="grid grid-cols-2 gap-1.5">
                  <button onClick={() => setPhone("9200000001")} className="text-left px-2 py-1 rounded bg-surface/60 hover:bg-surface transition-colors">
                    <span className="font-semibold text-brand-700">Farmer</span> · 9200000001
                  </button>
                  <button onClick={() => setPhone("9000000001")} className="text-left px-2 py-1 rounded bg-surface/60 hover:bg-surface transition-colors">
                    <span className="font-semibold text-brand-700">Admin</span> · 9000000001
                  </button>
                </div>
                <div className="border-t border-line/40 pt-1 text-[11px] text-ink-faint">
                  <p className="font-medium text-ink-soft mb-1">Staff Accounts by Mandi Centre:</p>
                  <div className="grid grid-cols-1 gap-1">
                    <button onClick={() => setPhone("9100000001")} className="text-left px-2 py-0.5 rounded hover:bg-surface transition-colors flex justify-between">
                      <span><strong>Centre 01 (Sitapura)</strong>: Suresh</span>
                      <span className="font-mono text-brand-700">9100000001</span>
                    </button>
                    <button onClick={() => setPhone("9100000002")} className="text-left px-2 py-0.5 rounded hover:bg-surface transition-colors flex justify-between">
                      <span><strong>Centre 02 (Sanganer)</strong>: Anita</span>
                      <span className="font-mono text-brand-700">9100000002</span>
                    </button>
                    <button onClick={() => setPhone("9100000003")} className="text-left px-2 py-0.5 rounded hover:bg-surface transition-colors flex justify-between">
                      <span><strong>Centre 03 (Chaksu)</strong>: Mohit</span>
                      <span className="font-mono text-brand-700">9100000003</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: OTP VERIFICATION */}
        {step === "otp" && (
          <div className="panel p-6 space-y-5 animate-rise-in">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-2">
                <ShieldCheck size={26} />
              </div>
              <h1 className="font-display font-bold text-xl text-ink">{t("otpVerification")}</h1>
              <p className="text-xs text-ink-faint">
                {t("otpSentTo")}{" "}
                <strong className="text-ink font-semibold tnum">+91 {formatPhoneDisplay(cleanPhone)}</strong>
              </p>
            </div>

            {/* Dev mode OTP banner */}
            {isDev && devOtp && (
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-amber-600 shrink-0" />
                  <span className="text-xs text-amber-700 font-medium">{t("devOtp")}:</span>
                  <span className="font-mono font-bold text-sm text-amber-900 tnum">{devOtp}</span>
                </div>
                <button
                  onClick={copyDevOtp}
                  className="text-amber-600 hover:text-amber-800 transition-colors p-1 rounded"
                  title="Copy OTP"
                >
                  {devOtpCopied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            )}

            {error && <p className="text-sm text-error bg-error/5 rounded-lg px-3 py-2 text-center">{error}</p>}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="label text-center">{t("enterOtp")}</label>
                <input
                  ref={otpInputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="• • • • • •"
                  className="w-full rounded-lg border border-line bg-white px-4 py-3.5 text-2xl font-bold tracking-[0.4em] text-center text-ink tnum focus:outline-none focus:ring-2 focus:ring-brand-600/25 focus:border-brand-600"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-primary w-full text-base font-bold !py-3"
                disabled={loading || otp.length !== 6}
              >
                {loading ? t("verifying") : t("verifyLogin")}
              </button>
            </form>

            <div className="text-center pt-1 border-t border-line/60">
              {resendCooldown > 0 ? (
                <p className="text-xs text-ink-faint">
                  {t("resendIn")}{" "}
                  <span className="font-semibold text-ink tnum">00:{String(resendCooldown).padStart(2, "0")}</span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendOtp()}
                  disabled={loading}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline transition-colors"
                >
                  {t("resendOtp")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: COMPLETE PROFILE (FOR NEW FARMERS) */}
        {step === "profile" && (
          <div className="panel p-6 space-y-4 animate-rise-in">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 size={26} />
              </div>
              <p className="text-xs font-bold text-success uppercase tracking-wide">OTP Verified ✓</p>
              <h1 className="font-display font-bold text-xl text-ink">Complete Your Profile</h1>
              <p className="text-xs text-ink-faint">Enter your details to finish setting up your account.</p>
            </div>

            {error && <p className="text-sm text-error bg-error/5 rounded-lg px-3 py-2">{error}</p>}

            <form onSubmit={handleCompleteProfile} className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <div className="relative">
                  <input
                    type="text"
                    className="input pl-10"
                    placeholder="e.g. Ramesh Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" size={16} />
                </div>
              </div>

              <div>
                <label className="label">District</label>
                <div className="relative">
                  <select
                    className="input pl-10 appearance-none"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    required
                  >
                    {DISTRICTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" size={16} />
                </div>
              </div>

              <div>
                <label className="label">Preferred Language</label>
                <div className="grid grid-cols-2 gap-2">
                  {LANG_OPTIONS.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setLanguage(l.code)}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                        language === l.code
                          ? "border-brand-600 bg-brand-50 text-brand-700"
                          : "border-line text-ink-soft bg-white hover:border-brand-300"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary w-full text-base font-bold !py-3 mt-2"
                disabled={loading || !name.trim()}
              >
                {loading ? "Setting Up Account..." : "Continue to Dashboard"}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
