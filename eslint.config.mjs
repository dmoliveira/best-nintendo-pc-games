import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  { ignores: [".next/**", "out/**", "node_modules/**", "coverage/**", "*.tsbuildinfo"] },
  ...nextVitals,
];

export default config;
