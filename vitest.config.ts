import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['infra/migrate/**/*.test.mjs', 'infra/lambda/**/*.test.mjs'],
  },
});
