import { describe, expect, it } from 'vitest';
import { checkPullRequest, MAX_LINES, SIZE_EXCEPTION_LABEL } from './pr-standards.mjs';

const EXPLAINED = 'รันตาม AC แล้ว ป้ายขึ้นเมื่อเหลือไม่เกิน 3 วัน คำนวณจาก coop_schedules ในฝั่ง API';

function pr(overrides = {}) {
  return {
    body: 'Closes #127',
    labels: ['infrastructure'],
    files: [{ filename: 'src/App.tsx', additions: 10, deletions: 2 }],
    reviews: [],
    ...overrides,
  };
}

describe('checkPullRequest', () => {
  it('passes a PR that meets every standard', () => {
    const result = checkPullRequest(pr({ reviews: [{ user: 'a', state: 'APPROVED', body: EXPLAINED }] }));
    expect(result.problems).toEqual([]);
  });

  it('requires a closing keyword with an issue number', () => {
    expect(checkPullRequest(pr({ body: 'Closes #' })).problems).toHaveLength(1);
    expect(checkPullRequest(pr({ body: null })).problems).toHaveLength(1);
    expect(checkPullRequest(pr({ body: 'fixes #12' })).problems).toEqual([]);
  });

  it('requires at least one label', () => {
    expect(checkPullRequest(pr({ labels: [] })).problems[0]).toMatch(/label/);
  });

  it('counts only reviewable files towards the size limit', () => {
    const files = [
      { filename: 'src/pages/Big.tsx', additions: MAX_LINES, deletions: 1 },
      { filename: 'package-lock.json', additions: 5000, deletions: 0 },
      { filename: 'infra/seed.sql', additions: 900, deletions: 0 },
    ];
    const result = checkPullRequest(pr({ files }));
    expect(result.lines).toBe(MAX_LINES + 1);
    expect(result.problems[0]).toMatch(/401/);
  });

  it('lets an agreed size exception through', () => {
    const files = [{ filename: 'src/pages/Big.tsx', additions: 999, deletions: 0 }];
    const labels = ['frontend', SIZE_EXCEPTION_LABEL];
    expect(checkPullRequest(pr({ files, labels })).problems).toEqual([]);
  });

  it('rejects an approval without an explanation', () => {
    const result = checkPullRequest(pr({ reviews: [{ user: 'b', state: 'APPROVED', body: 'LGTM' }] }));
    expect(result.problems).toEqual([expect.stringContaining('@b')]);
  });

  it('judges each reviewer by their latest decision, ignoring later comments', () => {
    const reviews = [
      { user: 'b', state: 'APPROVED', body: '' },
      { user: 'b', state: 'CHANGES_REQUESTED', body: 'แก้ข้อ 2' },
      { user: 'c', state: 'APPROVED', body: EXPLAINED },
      { user: 'c', state: 'COMMENTED', body: 'ok' },
    ];
    expect(checkPullRequest(pr({ reviews })).problems).toEqual([]);
  });
});
