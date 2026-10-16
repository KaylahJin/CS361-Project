// Setup for the `frontend` vitest project (see vitest.config.ts).
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

import '@testing-library/jest-dom/vitest';

// Testing Library only registers this cleanup itself when vitest runs with
// `globals: true`, which this repo does not. Without it each render stacks
// onto the same document and the second test in a file fails.
afterEach(() => {
  cleanup();
});
