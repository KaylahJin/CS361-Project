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

// jsdom ships no matchMedia, and Navbar uses one to close its mobile drawer
// when the viewport grows past the desktop breakpoint. Report "does not
// match", which is the desktop-first layout the components render by default.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
