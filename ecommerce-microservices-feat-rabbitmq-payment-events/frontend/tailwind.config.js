/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12233f",
        navy: "#122b4a",
        brand: "#2463eb",
        "brand-dark": "#1d4ed8",
        canvas: "#f5f8fc",
        muted: "#6b7b91",
      },
      boxShadow: {
        card: "0 14px 40px rgba(18, 43, 74, 0.07)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
