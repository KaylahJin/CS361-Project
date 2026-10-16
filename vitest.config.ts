import { defineConfig } from 'vitest/config';

// Two suites with genuinely different needs, so they are two projects
// rather than one config with per-glob overrides:
//
//   backend  — the Lambda and migrate handlers. Plain .mjs, no DOM, and
//              deliberately no setupFiles: jest-dom's matchers are dead
//              weight there.
//   frontend — React components under src/. Needs jsdom and the jest-dom
//              matchers.
//
// `environmentMatchGlobs` would express the same split in fewer lines but
// is deprecated as of Vitest 3.2 and prints a warning on every run.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'backend',
          environment: 'node',
          include: ['infra/migrate/**/*.test.mjs', 'infra/lambda/**/*.test.mjs'],
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
