// LINE reminders for docs/working-agreement.md §10.1 (rules 4, 5 and 7), sent by
// .github/workflows/line-notify.yml to each teammate's chat with the team bot.
// Pure functions so the rules are testable; the workflow only fetches the data.
// Messages read like a short chat: a count, then one link per line with its deadline.

export const REVIEW_HOURS = 24;
export const BLOCKING_LABEL = 'blocking';
// Not in the protect-main ruleset, but rule 6 still keeps the PR from merging.
export const ALSO_GATING = ['PR Standards'];

const HOUR = 3600e3;
const FAILED = new Set(['failure', 'timed_out', 'action_required']);
const DECISIONS = new Set(['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED']);
const LINE_API = 'https://api.line.me/v2/bot';

const dayNumber = (t) => Math.floor((new Date(t).getTime() + 7 * HOUR) / (24 * HOUR)); // Bangkok date

function section(title, items) {
  if (items.length === 0) return null;
  return [title.replace('{n}', items.length), ...items.map((item, i) => `${i + 1}. ${item}`)].join('\n');
}

function prProblems(pr, gating, nick) {
  const problems = [];
  const latest = new Map();
  for (const r of pr.reviews) if (DECISIONS.has(r.state)) latest.set(r.user, r.state);
  // A reviewer asked again is back in `requested`, so the next move is theirs.
  const waiting = new Set(pr.requested.map((r) => r.login));
  const changes = [...latest].filter(([u, s]) => s === 'CHANGES_REQUESTED' && !waiting.has(u));
  if (changes.length) problems.push(`${changes.map(([u]) => nick(u)).join(', ')} ขอให้แก้`);

  // A re-run adds a run with the same name; only the newest counts.
  const newest = new Map();
  const byStart = [...pr.checks].sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''));
  for (const c of byStart) newest.set(c.name, c);
  if ([...newest.values()].some((c) => gating.has(c.name) && FAILED.has(c.conclusion))) problems.push('check ไม่ผ่าน');
  if (pr.requested.length === 0 && pr.reviews.length === 0) problems.push('ยังไม่ขอ reviewer');
  return problems;
}

const linksIssue = (pr, n) =>
  new RegExp(`\\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\\s+#${n}\\b`, 'i').test(pr.body ?? '') ||
  new RegExp(`(^|/)${n}-`).test(pr.branch);

/**
 * @param {{now: Date, repo: string, requiredChecks: string[], milestoneDue: string|null,
 *          team: {planner: string, nicknames: Record<string, string>},
 *          issues: {number, assignees: string[], labels: string[], assignedAt: string}[],
 *          pulls: {number, author, draft, body, branch, requested: {login, since}[],
 *                  reviews: {user, state}[], checks: {name, conclusion, startedAt}[]}[]}} data
 *   issues: the milestone's open issues; pulls: every open PR. Closed work is not
 *   passed in, so it drops out of the next digest by itself.
 * @returns {{to: string, text: string}[]} one message per teammate who has something to do
 */
export function buildDigests({ now, repo, requiredChecks, milestoneDue, team, issues, pulls }) {
  const nick = (login) => team.nicknames[login] ?? login;
  const prLink = (n) => `https://github.com/${repo}/pull/${n}`;
  const issueLink = (n) => `https://github.com/${repo}/issues/${n}`;
  const gating = new Set([...requiredChecks, ...ALSO_GATING]);
  const todo = new Map(Object.keys(team.nicknames).map((p) => [p, { reviews: [], prs: [], blocking: [], issues: [] }]));
  const alerts = [];

  for (const pr of pulls.filter((p) => !p.draft)) {
    for (const r of pr.requested) {
      const left = new Date(r.since).getTime() + REVIEW_HOURS * HOUR - now;
      if (left > 0) {
        todo.get(r.login)?.reviews.push(`${prLink(pr.number)} เหลือ ${Math.ceil(left / HOUR)} ชม.`);
        continue;
      }
      const late = `เลยกำหนด ${Math.floor(-left / HOUR) || 'ไม่ถึง 1'} ชม.`;
      todo.get(r.login)?.reviews.push(`${prLink(pr.number)} ⚠️ ${late}`);
      alerts.push(`${prLink(pr.number)} ${nick(r.login)} ยังไม่รีวิว ${late}`);
    }
    const problems = prProblems(pr, gating, nick);
    if (problems.length) todo.get(pr.author)?.prs.push(`${prLink(pr.number)} ${problems.join(', ')}`);
  }

  for (const issue of issues) {
    for (const a of issue.assignees) todo.get(a)?.issues.push(issueLink(issue.number));
    if (!issue.labels.includes(BLOCKING_LABEL) || pulls.some((pr) => linksIssue(pr, issue.number))) continue;
    if (issue.assignees.length === 0) {
      alerts.push(`${issueLink(issue.number)} งาน block ยังไม่มีคนรับ`);
      continue;
    }
    const late = dayNumber(now) - dayNumber(issue.assignedAt) - 1; // draft PR is due on day 2
    if (late < 0) continue;
    const note = late === 0 ? 'ต้องเปิด draft PR วันนี้' : `⚠️ draft PR เลยกำหนด ${late} วัน`;
    for (const a of issue.assignees) todo.get(a)?.blocking.push(`${issueLink(issue.number)} ${note}`);
    if (late > 0) alerts.push(`${issueLink(issue.number)} ${issue.assignees.map(nick).join(', ')} ${note}`);
  }

  let due = '';
  if (milestoneDue) {
    const days = dayNumber(milestoneDue) - dayNumber(now);
    const date = new Date(milestoneDue).toLocaleDateString('th-TH', { timeZone: 'UTC', day: 'numeric', month: 'short' });
    due = days > 0 ? ` ส่ง ${date} อีก ${days} วัน` : days === 0 ? ` ส่งวันนี้ ${date}` : ` ⚠️ เลยกำหนดส่ง ${-days} วัน`;
  }

  const messages = [];
  for (const [login, t] of todo) {
    const text = [
      section('รอคุณรีวิว {n} งาน', t.reviews),
      section('PR ของคุณต้องจัดการ {n} งาน', t.prs),
      section('งาน block คนอื่น {n} งาน', t.blocking),
      section(`งานของคุณ {n} งาน${due}`, t.issues),
      login === team.planner && section('ต้องตาม {n} เรื่อง', alerts),
    ].filter(Boolean).join('\n\n');
    if (text) messages.push({ to: login, text });
  }
  return messages;
}

/** Anything but send: true is a dry run, so nothing reaches LINE until the team switches it on. */
export function sendMode({ event, dryRun, hasSecrets, vars }) {
  if (!hasSecrets) return { send: false, reason: 'ยังไม่มี secret LINE_CHANNEL_ACCESS_TOKEN / LINE_USER_IDS' };
  if (event === 'workflow_dispatch') return dryRun ? { send: false, reason: 'สั่ง dry_run' } : { send: true };
  return vars.LINE_NOTIFY_ENABLED === 'true' ? { send: true } : { send: false, reason: 'repo variable LINE_NOTIFY_ENABLED ยังไม่เป็น true' };
}

/** @returns {Promise<{status: 'sent'|'skipped'|'failed', line: string}[]>} never contains a userId */
export async function pushAll(messages, { token, userIds, fetchFn = fetch }) {
  const results = [];
  for (const { to, text } of messages) {
    if (!userIds[to]) {
      results.push({ status: 'skipped', line: `${to}: ยังไม่มี userId ใน LINE_USER_IDS` });
      continue;
    }
    const res = await fetchFn(`${LINE_API}/message/push`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: userIds[to], messages: [{ type: 'text', text }] }),
    });
    const failure = res.ok ? null : `${res.status} ${await res.text()}`;
    results.push(failure ? { status: 'failed', line: `${to}: ส่งไม่สำเร็จ ${failure}` } : { status: 'sent', line: `${to}: ส่งแล้ว` });
  }
  return results;
}
