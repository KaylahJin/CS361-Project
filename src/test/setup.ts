// Registers the @testing-library/jest-dom matchers (toBeInTheDocument,
// toHaveTextContent, ...) on Vitest's expect. Loaded for every suite via
// setupFiles in vitest.config.ts; harmless for the node-environment
// backend suites, which simply never call those matchers.
import '@testing-library/jest-dom/vitest';
