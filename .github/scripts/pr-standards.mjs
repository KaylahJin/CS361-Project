// PR standards from docs/working-agreement.md §10 (rules 3, 5 and 6), checked
// by .github/workflows/pr-standards.yml. Pure function so the rules are
// testable without GitHub; the workflow only fetches the data.

export const MAX_LINES = 400;
export const SIZE_EXCEPTION_LABEL = 'size-exception';
export const MIN_APPROVAL_TEXT = 40;

// Generated data, fixtures and binaries: long, but nobody reviews them line by line.
const NOT_COUNTED = [
  /(^|\/)package-lock\.json$/,
  /^docs\/evidence\//,
  /^infra\/migrate\/source\//,
  /^infra\/seed[^/]*\.sql$/,
  /^src\/data\/[^/]+\.json$/,
  /\.(png|jpe?g|gif|webp|mp4|pdf|csv)$/i,
];

const CLOSES = /\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\s+#\d+/i;
// Only these states change whether a reviewer currently approves; a later
// plain comment does not withdraw an approval.
const DECISIONS = new Set(['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED']);

/**
 * @param {{body: string|null, labels: string[],
 *          files: {filename: string, additions: number, deletions: number}[],
 *          reviews: {user: string, state: string, body: string|null}[]}} pr
 *   reviews in the order GitHub returns them (oldest first)
 * @returns {{lines: number, problems: string[]}}
 */
export function checkPullRequest({ body, labels, files, reviews }) {
  const problems = [];

  if (!CLOSES.test(body ?? '')) {
    problems.push('ใส่ "Closes #<เลข issue>" ในคำอธิบาย PR');
  }

  if (labels.length === 0) {
    problems.push('ใส่ label อย่างน้อย 1 อันตามด้านที่แตะ เช่น frontend, backend, database');
  }

  const lines = files
    .filter((f) => !NOT_COUNTED.some((re) => re.test(f.filename)))
    .reduce((sum, f) => sum + f.additions + f.deletions, 0);
  if (lines > MAX_LINES && !labels.includes(SIZE_EXCEPTION_LABEL)) {
    problems.push(
      `PR ยาว ${lines} บรรทัด เกิน ${MAX_LINES} ให้แตก PR ` +
        `หรือใส่ label "${SIZE_EXCEPTION_LABEL}" เมื่อ reviewer เห็นด้วย`,
    );
  }

  const latest = new Map();
  for (const r of reviews) {
    if (DECISIONS.has(r.state)) latest.set(r.user, r);
  }
  for (const [user, r] of latest) {
    if (r.state === 'APPROVED' && (r.body ?? '').trim().length < MIN_APPROVAL_TEXT) {
      problems.push(
        `approve ของ @${user} ยังไม่มีคำอธิบาย ให้แก้ข้อความในรีวิวเป็น 2–3 ประโยคว่างานนี้ทำงานยังไง`,
      );
    }
  }

  return { lines, problems };
}
