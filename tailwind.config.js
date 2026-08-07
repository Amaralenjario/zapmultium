/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-jakarta)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface2)",
        bd: "var(--bd)",
        line: "var(--line)",
        tx: "var(--tx)",
        tx2: "var(--tx2)",
        tx3: "var(--tx3)",
        hover: "var(--hover)",
        rowhover: "var(--rowhover)",
        accent: "var(--accent)",
        accent2: "var(--accent2)",
        accentsoft: "var(--accentsoft)",
        track: "var(--track)",
        c1: "var(--c1)",
        c2: "var(--c2)",
        c3: "var(--c3)",
        success: "var(--success)",
        "success-soft": "var(--success-soft)",
      },
      borderRadius: {
        card: "16px",
        control: "11px",
      },
      boxShadow: {
        card: "var(--shadow)",
        pop: "var(--shadow2)",
        glow: "var(--glow)",
      },
    },
  },
  plugins: [],
};
