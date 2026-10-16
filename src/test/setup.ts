// Setup for the `frontend` vitest project (see vitest.config.ts).
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Registers the @testing-library/jest-dom matchers (toBeInTheDocument,
// toHaveTextContent, ...) on Vitest's expect.
import '@testing-library/jest-dom/vitest';

// Testing Library auto-registers this itself, but only when it can see a
// global `afterEach` — i.e. with vitest `globals: true`, which this repo
// does not use. Without it every render stacks onto the same document and
// the second test in a file fails with "Found multiple elements".
afterEach(() => {
  cleanup();
});
