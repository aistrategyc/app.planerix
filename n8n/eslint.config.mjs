import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Temporary relaxation for analytics-heavy surfaces while we migrate to parsed DTOs.
    files: [
      "src/app/analytics/**/*.{ts,tsx}",
      "src/app/attribution/**/*.{ts,tsx}",
      "src/components/analytics/**/*.{ts,tsx}",
      "src/lib/api/analytics*.ts",
      "src/lib/api/attribution*.ts",
      "src/hooks/useAnalytics*.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
];

export default eslintConfig;
