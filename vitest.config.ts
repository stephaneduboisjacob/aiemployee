import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['**/*.test.ts'], exclude: ['**/node_modules/**', '**/.next/**'], testTimeout: 20_000 } });
