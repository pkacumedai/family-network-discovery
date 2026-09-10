import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
export default defineConfig([...nextVitals, ...nextTs,
  globalIgnores(['.next/**', 'coverage/**', 'next-env.d.ts']),
  { files: ['src/domain/**/*.ts', 'src/components/**/*.{ts,tsx}'], rules: {
    'no-restricted-imports': ['error', { patterns: ['@/server/*', '**/server/**', 'drizzle-orm', 'drizzle-orm/*', 'pg'] }]
  }}
]);
