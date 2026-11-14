/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: "#09090b",
        gridmajor: "#18181b",
        gridminor: "#121215",
        electric: "#06b6d4",
        amberwarn: "#f59e0b",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
