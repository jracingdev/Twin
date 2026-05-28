import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        twin: {
          bg: "#0a0e17",
          card: "rgba(15, 23, 42, 0.7)",
          cyan: "#22d3ee",
          magenta: "#e879f9",
          muted: "#94a3b8",
        },
      },
      fontFamily: {
        sans: ["system-ui", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(34, 211, 238, 0.15)",
      },
    },
  },
  plugins: [],
};
export default config;
