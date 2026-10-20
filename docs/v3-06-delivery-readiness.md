# V3-06 delivery readiness (#101)

Tracks the two sub-issues that must pass before the V3 prototype is handed off.
Closes when both are reviewed and accepted.

## V3-06.1 — full-process test (#104, CLOSED)

Every core flow exercised against the deployed stack for all four roles:
Login → create → submit → review → view result → resubmit, plus the
no-permission and token-expiry cases. All pass; one non-blocking known issue
recorded (missing approve/reject/return buttons on one student-facing view).

- Results + screenshots: [`evidence/104-flow-results.md`](evidence/104-flow-results.md)
- Review-path unit/integration tests: [`evidence/106-01-review-plan-tests.txt`](evidence/106-01-review-plan-tests.txt)

## V3-06.2 — direct RDS connection assessment (#105)

Direct Lambda → RDS connection (no RDS Proxy) load-tested at 1/10/20/50
concurrent reads against the live API.

- **0% error rate** through 50 concurrent; no throttles, no 5xx, no timeouts.
- RDS `DatabaseConnections` peaked **38 of ~112** (~34% of the ceiling).
- Latency (2–5 s) is cold-start / per-container connect, not DB contention.
- **Verdict:** direct connection supports the expected prototype load with
  headroom; no proxy needed at this scale.
- Write-up: [`direct-rds-connection-assessment.md`](direct-rds-connection-assessment.md)
- Measurements: [`evidence/105-01-direct-rds-loadtest.txt`](evidence/105-01-direct-rds-loadtest.txt)
- CloudWatch console shots: `evidence/105-02…04-*.jpg`

## Acceptance checklist (#101)

- [x] Core process tested end to end for all roles, incl. no-permission (#104)
- [x] No blocker remaining before hand-off (one known issue logged, non-blocker)
- [x] Direct RDS connection supports the expected load, with measured numbers (#105)
- [ ] Both sub-issues reviewed and accepted → then close #101

## Status

- #104 — CLOSED (evidence consolidated here).
- #105 — evidence complete; ready for reviewer sign-off, then close.
- #101 — closes once #105 is signed off.
