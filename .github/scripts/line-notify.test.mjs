import { describe, expect, it, vi } from 'vitest';
import team from './line-notify-team.json';
import { buildDigests, pushAll, sendMode } from './line-notify.mjs';

const NOW = new Date('2026-10-24T02:00:00Z'); // 09:00 in Bangkok
const TEAM = { planner: 'plan', nicknames: { plan: 'แพลน', a: 'เอ', b: 'บี', idle: 'ว่าง' } };
const PR = 'https://github.com/o/r/pull/10';
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600e3).toISOString();
const pull = (o = {}) => ({
  number: 10, author: 'a', draft: false, body: 'Closes #1', branch: 'feat/1-x',
  requested: [{ login: 'b', since: hoursAgo(2) }], reviews: [], checks: [], ...o,
});

function digest({ issues = [], pulls = [], milestoneDue = null }) {
  const messages = buildDigests({ now: NOW, repo: 'o/r', requiredChecks: ['🧪 Unit Tests'], milestoneDue, team: TEAM, issues, pulls });
  return Object.fromEntries(messages.map((m) => [m.to, m.text]));
}

describe('buildDigests', () => {
  it('tells the reviewer the time left and the planner when a review is over 24 hours', () => {
    const result = digest({ pulls: [pull()] });
    expect(result.b).toBe(`รอคุณรีวิว 1 งาน\n1. ${PR} เหลือ 22 ชม.`);
    expect(result.idle).toBeUndefined();
    const late = digest({ pulls: [pull({ requested: [{ login: 'b', since: hoursAgo(30) }] })] });
    expect(late.b).toBe(`รอคุณรีวิว 1 งาน\n1. ${PR} ⚠️ เลยกำหนด 6 ชม.`);
    expect(late.plan).toBe(`ต้องตาม 1 เรื่อง\n1. ${PR} บี ยังไม่รีวิว เลยกำหนด 6 ชม.`);
    expect(digest({ pulls: [pull({ draft: true, requested: [{ login: 'b', since: hoursAgo(30) }] })] })).toEqual({});
  });

  it('tells the author about changes requested until they ask that reviewer again', () => {
    const reviews = [{ user: 'b', state: 'CHANGES_REQUESTED' }];
    expect(digest({ pulls: [pull({ requested: [], reviews })] }).a).toBe(`PR ของคุณต้องจัดการ 1 งาน\n1. ${PR} บี ขอให้แก้`);
    expect(digest({ pulls: [pull({ reviews })] }).a).toBeUndefined();
    expect(digest({ pulls: [pull({ requested: [] })] }).a).toContain(`${PR} ยังไม่ขอ reviewer`);
  });

  it('reports only the newest run of a check that gates the merge', () => {
    const failing = { name: '🧪 Unit Tests', conclusion: 'failure', startedAt: hoursAgo(5) };
    expect(digest({ pulls: [pull({ checks: [failing] })] }).a).toContain(`${PR} check ไม่ผ่าน`);
    const rerun = [failing, { ...failing, conclusion: 'success', startedAt: hoursAgo(1) }];
    expect(digest({ pulls: [pull({ checks: rerun })] }).a).toBeUndefined();
    const notGating = { name: '📣 Notify Assignee', conclusion: 'failure', startedAt: hoursAgo(1) };
    expect(digest({ pulls: [pull({ checks: [notGating] })] }).a).toBeUndefined();
    const standards = { name: 'PR Standards', conclusion: 'failure', startedAt: hoursAgo(1) };
    expect(digest({ pulls: [pull({ checks: [standards] })] }).a).toContain('check ไม่ผ่าน');
  });

  it('chases blocking work without a PR on day 2 and tells the planner after that', () => {
    const issue = { number: 7, assignees: ['a'], labels: ['blocking'] };
    const day2 = digest({ issues: [{ ...issue, assignedAt: '2026-10-23T16:00:00Z' }] }); // 23:00 yesterday
    expect(day2.a).toContain('งาน block คนอื่น 1 งาน\n1. https://github.com/o/r/issues/7 ต้องเปิด draft PR วันนี้');
    expect(day2.plan).toBeUndefined();
    const day3 = digest({ issues: [{ ...issue, assignedAt: '2026-10-22T03:00:00Z' }] });
    expect(day3.a).toContain('issues/7 ⚠️ draft PR เลยกำหนด 1 วัน');
    expect(day3.plan).toBe('ต้องตาม 1 เรื่อง\n1. https://github.com/o/r/issues/7 เอ ⚠️ draft PR เลยกำหนด 1 วัน');
    const draft = pull({ draft: true, body: '', branch: 'feat/7-schema' });
    expect(digest({ issues: [{ ...issue, assignedAt: hoursAgo(99) }], pulls: [draft] }).a).not.toContain('งาน block');
  });

  it('links every open issue with the days left to the milestone', () => {
    const issues = [1, 2, 3, 4, 5, 6].map((n) => ({ number: n, assignees: ['a'], labels: [], assignedAt: NOW }));
    const result = digest({ issues, milestoneDue: '2026-10-28T00:00:00Z' });
    expect(result.a).toMatch(/^งานของคุณ 6 งาน ส่ง 28 ต\.ค\. อีก 4 วัน\n1\. https:\/\/github\.com\/o\/r\/issues\/1\n/);
    expect(result.a).toContain('\n6. https://github.com/o/r/issues/6');
    expect(digest({ issues, milestoneDue: '2026-10-24T00:00:00Z' }).a).toMatch(/^งานของคุณ 6 งาน ส่งวันนี้ 24 ต\.ค\.\n/);
    expect(digest({ issues, milestoneDue: '2026-10-22T00:00:00Z' }).a).toMatch(/^งานของคุณ 6 งาน ⚠️ เลยกำหนดส่ง 2 วัน\n/);
    expect(Object.keys(team.nicknames)).toContain(team.planner); // the real config file
  });
});

describe('sending', () => {
  it('stays a dry run until the secrets and the switch are set', () => {
    const run = (o) => sendMode({ event: 'schedule', dryRun: true, hasSecrets: true, vars: {}, ...o }).send;
    expect(run({ hasSecrets: false, event: 'workflow_dispatch', dryRun: false })).toBe(false);
    expect(run({ event: 'workflow_dispatch' })).toBe(false);
    expect(run({ event: 'workflow_dispatch', dryRun: false })).toBe(true);
    expect(run({})).toBe(false);
    expect(run({ vars: { LINE_NOTIFY_ENABLED: 'true' } })).toBe(true);
  });

  it('pushes to the mapped userId and never echoes it', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    const messages = [{ to: 'a', text: 'hi' }, { to: 'b', text: 'hi' }];
    const results = await pushAll(messages, { token: 't', userIds: { a: 'U123' }, fetchFn });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({ to: 'U123', messages: [{ type: 'text', text: 'hi' }] });
    expect(results.map((r) => r.status)).toEqual(['sent', 'skipped']);
    expect(JSON.stringify(results)).not.toContain('U123');
  });

  it('keeps sending to the others when one push throws', async () => {
    const fetchFn = vi.fn()
      .mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND'))
      .mockResolvedValueOnce({ ok: true });
    const messages = [{ to: 'a', text: 'hi' }, { to: 'b', text: 'hi' }];
    const results = await pushAll(messages, { token: 't', userIds: { a: 'U1', b: 'U2' }, fetchFn });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(results).toEqual([
      { status: 'failed', line: 'a: ส่งไม่สำเร็จ getaddrinfo ENOTFOUND' },
      { status: 'sent', line: 'b: ส่งแล้ว' },
    ]);
  });
});
