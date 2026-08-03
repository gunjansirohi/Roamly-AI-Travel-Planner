/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      boxShadow: {
        destination: "0 20px 50px rgba(10, 31, 28, 0.22)",
      },
    },
  },
  plugins: [],
};
