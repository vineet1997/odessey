/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-raised": "var(--bg-raised)",
        ink: "var(--ink)",
        "ink-muted": "var(--ink-muted)",
        gold: "var(--gold)",
        "gold-bright": "var(--gold-bright)",
        sea: "var(--sea)",
        "sea-bright": "var(--sea-bright)",
        wine: "var(--wine)",
        "wine-bright": "var(--wine-bright)",
        border: "var(--border)",
      },
      fontFamily: {
        display: ["Cinzel", "serif"],
        body: ['"Source Serif 4"', "serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      spacing: {
        xs: "var(--space-xs)",
        sm: "var(--space-sm)",
        md: "var(--space-md)",
        lg: "var(--space-lg)",
        xl: "var(--space-xl)",
        "2xl": "var(--space-2xl)",
        "3xl": "var(--space-3xl)",
      },
    },
  },
  plugins: [],
};
