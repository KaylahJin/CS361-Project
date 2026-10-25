import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { SUBMISSION_FAILURE_LABELS, submissionFailureLabel } from './submissionMessages';

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), '../../infra/lambda/companies');

function backendCodes(): string[] {
  return ['eligibility.mjs', 'submissionRules.mjs'].flatMap((file) =>
    [...readFileSync(join(BACKEND, file), 'utf8').matchAll(/code:\s*'([A-Z_]+)'/g)].map((m) => m[1]),
  );
}

describe('submission failure messages', () => {
  const codes = [...new Set(backendCodes())];

  it('finds the 13 codes the backend can send', () => {
    expect(codes).toHaveLength(13);
  });

  it.each(codes)('%s has Thai text', (code) => {
    expect(submissionFailureLabel(code)).toBe(SUBMISSION_FAILURE_LABELS[code]);
    expect(submissionFailureLabel(code)).toMatch(/[ก-๙]/);
  });

  it('has no text for a code the backend never sends', () => {
    expect(Object.keys(SUBMISSION_FAILURE_LABELS).filter((c) => !codes.includes(c))).toEqual([]);
  });

  it('never shows a code name on screen', () => {
    for (const code of codes) {
      expect(submissionFailureLabel(code)).not.toContain(code);
    }
    expect(submissionFailureLabel('NEW_CODE')).not.toContain('NEW_CODE');
  });

  it('a new code without text shows the API message instead of going blank', () => {
    expect(submissionFailureLabel('NEW_CODE', 'Something new.')).toBe('Something new.');
  });

  it('no code and no message shows the generic Thai sentence', () => {
    expect(submissionFailureLabel()).toMatch(/[ก-๙]/);
  });
});
