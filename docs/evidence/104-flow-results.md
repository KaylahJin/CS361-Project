# V3-06.1 full-process test results (#104)

Each core flow was exercised against the deployed site
(`http://coop-portal-coop-web-067504979088.s3-website-...`), which calls the real
API Gateway → Lambda → RDS → Cognito stack. Screenshots captured on the running
system; one test account per role (`student1@`, `advisor1@`, `staff1@`,
`admin1@example.com`). Captions mirror the ones posted on issue #104.

| # | Flow | Result | Evidence |
|---|---|---|---|
| 1 | Login for all 4 roles (student, advisor, staff, admin) | PASS | `104-01-login-student.jpg` … `104-04-login-admin.jpg` |
| 2 | Draft → edit → save → submit a coop plan | PASS | `104-05-plan-flow-a.jpg` … `104-08-plan-flow-d.jpg` |
| 3 | Review: approve / reject / return with comment | PASS (reviewer path) | `104-09-review-flow-a.jpg`, `104-10-review-flow-b.jpg` |
| 4 | No-permission case — a user cannot read data outside their scope | PASS (refused) | `104-11-no-permission-denied.jpg` |
| 5 | Token expiry → automatic sign-out | PASS | `104-13-token-expiry-logout.jpg` |

## Known issue (non-blocker)

- The student-facing plan view shows the decision **status** ("อนุมัติแล้ว" etc.)
  but does **not** expose approve / reject / return-to-student buttons on the
  staff/advisor side of that particular screen — only the status is rendered.
  Evidence: `104-12-knownissue-no-review-buttons.jpg`. Recorded as a known issue,
  not a blocker: the review decision path itself works (flow 3), this is a
  missing control on one view. The reviewer dashboard and its action workflow are
  covered by tests in `106-01-review-plan-tests.txt`.

## Verdict

Core process — Login → create → submit → review → view result → resubmit —
runs end to end against the deployed system for every role, and the
no-permission and token-expiry cases behave correctly. No blocker to hand-off;
one known issue logged above. Load/connection readiness is covered by #105
([`../direct-rds-connection-assessment.md`](../direct-rds-connection-assessment.md)).
