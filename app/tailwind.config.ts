import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-display)"], // Space Grotesk
        mono: ["var(--font-body)"],    // Geist Mono
      },
    },
  },

  plugins: [],
};

export default config;