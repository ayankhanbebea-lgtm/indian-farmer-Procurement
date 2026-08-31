/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EEF5F0",
          100: "#E4F0E9",
          300: "#8FBBA3",
          500: "#3D7A5C",
          600: "#1F5C43",
          700: "#194C38",
          800: "#143A2B",
          900: "#0F2A20",
        },
        ink: {
          DEFAULT: "#16211C",
          soft: "#4B594F",
          faint: "#7C897E",
        },
        navy: {
          DEFAULT: "#1B2430",
          700: "#243040",
          800: "#161E28",
        },
        grain: {
          DEFAULT: "#C2790A",
          light: "#F3DFB8",
          soft: "#FBF1DE",
        },
        surface: {
          DEFAULT: "#FAF7F1",
          card: "#FFFFFF",
          sunken: "#F2EEE3",
        },
        line: "#E6E0D2",
        success: "#2F7D52",
        error: "#B3423A",
      },
      fontFamily: {
        display: ["var(--font-display)", "Manrope", "sans-serif"],
        sans: ["var(--font-body)", "Inter", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        DEFAULT: "12px",
        lg: "16px",
        xl: "20px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(22,33,28,0.04), 0 4px 16px rgba(22,33,28,0.06)",
        raised: "0 2px 4px rgba(22,33,28,0.06), 0 12px 32px rgba(22,33,28,0.10)",
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.35 },
        },
        riseIn: {
          from: { opacity: 0, transform: "translateY(6px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        cloudDrift: {
          "0%": { transform: "translateX(-8%)" },
          "50%": { transform: "translateX(8%)" },
          "100%": { transform: "translateX(-8%)" },
        },
        sunGlow: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.35" },
          "50%": { transform: "scale(1.08)", opacity: "0.48" },
        },
      },
      animation: {
        "pulse-dot": "pulseDot 1.6s ease-in-out infinite",
        "rise-in": "riseIn 0.28s ease-out",
        "cloud-drift": "cloudDrift 45s linear infinite",
        "cloud-drift-reverse": "cloudDrift 65s linear infinite reverse",
        "sun-glow": "sunGlow 8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
