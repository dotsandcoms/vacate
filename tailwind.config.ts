import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Urban Task Force brand — amber skyline mark + charcoal wordmark.
        brand: {
          50: "#fdf3e3",
          100: "#fae4bd",
          200: "#f3c988",
          500: "#eda638",
          600: "#d98d1f",
          700: "#b06f16",
          900: "#7a4b0d",
        },
        ink: {
          900: "#231f1a",
          800: "#332d26",
          700: "#4a4139",
          600: "#6b6058",
        },
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "-apple-system", "Segoe UI", "system-ui", "sans-serif"],
        display: ["var(--font-jakarta)", "-apple-system", "Segoe UI", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // A softer, more considered elevation than Tailwind's default
        // shadow-sm — two very low-opacity layers instead of one flat one.
        panel: "0 1px 1px 0 rgba(15, 23, 42, 0.03), 0 10px 24px -12px rgba(15, 23, 42, 0.12)",
        "panel-lg": "0 2px 4px 0 rgba(15, 23, 42, 0.04), 0 20px 40px -16px rgba(15, 23, 42, 0.16)",
      },
      letterSpacing: {
        tightish: "-0.011em",
      },
    },
  },
  plugins: [],
};
export default config;
