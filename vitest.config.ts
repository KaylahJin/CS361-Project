import { defineConfig } from 'vitest/config';

// Two projects because the suites need different environments: the backend
// handlers are plain .mjs with no DOM, the frontend components need jsdom and
// the jest-dom matchers. `environmentMatchGlobs` would say the same in fewer
// lines but is deprecated and warns on every run.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'backend',
          environment: 'node',
          // Listed one directory at a time on purpose. An 'infra/**' glob also
          // walks infra/lambda/companies/node_modules.
          include: [
            'infra/migrate/**/*.test.mjs',
            'infra/lambda/**/*.test.mjs',
            'infra/terraform/**/*.test.mjs',
          ],
        },
      },
      {
        test: {
          name: 'frontend',
          environment: 'jsdom',
          setupFiles: ['src/test/setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
});
