# Permission Matrix (V3-02.3)

Authoritative role × action reference for V3. **Do not restate these rules
in a new handler** — import `infra/lambda/companies/authorize.mjs`. A second
copy of the rules is a second thing to forget to update.

Underlying requirements: `docs/overview/V3-01-workflow-permissions.md` §1–§2
and `docs/overview/V3-01-data-model.md` §2.

## Roles

| Role | Scope |
|---|---|
| Public (no token) | ประกาศ / เกณฑ์ / ตำแหน่งงาน only. No plan data at all. |
| `STUDENT` | Own plans only. |
| `ADVISOR` | Plans of assigned students only (`advisor_student_assignments`). |
| `STAFF` | All plans in the programme. |
| `ADMIN` | Accounts, roles, assignments. **No plan access on its own.** |

## Implemented in V3-02.3

The two coop-plan read routes, both behind the API Gateway JWT authorizer:

| Role | `GET /coop-plans` (list) | `GET /coop-plans/{planId}` (view) |
|---|---|---|
| no token | **401** (rejected at API Gateway, Lambda never runs) | **401** |
| token, no `app_users` row | **403** | **403** |
| token, `is_active = false` | **403** | **403** |
| `STUDENT` | **200** — rows scoped to own `student_id` | **200** if owner, **403** otherwise |
| `STUDENT`, no linked `student_id` | **403** | **403** |
| `ADVISOR` | **200** — rows scoped to assigned students | **200** if assigned, **403** otherwise |
| `STAFF` | **200** — unscoped | **200** |
| `ADMIN` (no STAFF/ADVISOR row) | **403** | **403** |
| unknown role value | **403** | **403** |

Every row above has a test. `infra/lambda/companies/authorize.test.mjs`
covers the module directly; `listCoopPlans.test.mjs` and
`getCoopPlanById.test.mjs` cover it through the handlers.

### Why 403 for an unmapped or deactivated account

The acceptance criteria on #100 call for it: "บัญชี Cognito ที่ไม่มีข้อมูลผู้ใช้ใน
ฐานข้อมูลหรือยังไม่ได้รับสิทธิ์ ได้ 403". The caller holds a token the authorizer
accepted, so they are authenticated; they simply have no permission yet. That
is what 403 means, and it is also the more useful answer — a new account that
has not been granted a role sees "not authorised" rather than "your login
failed", which would send them back to re-enter a password that was fine.

The trade-off: 403 confirms to whoever holds the token that the account exists
in this system. An earlier revision answered 401 for that reason. Since the
token must already be a valid signed Cognito token for this pool to reach the
Lambda at all, the holder knows the account exists regardless, so little is
given away.

401 is still the answer when there is no usable identity at all. `auth.mjs`
owns that distinction so the two handlers cannot drift apart.

### Why ADMIN is 403

`docs/overview/V3-01-data-model.md` §2: "การเป็น ADMIN เพียงอย่างเดียวไม่ให้สิทธิ์
พิจารณาแผนโดยอัตโนมัติ". An admin manages accounts, roles and assignments; to
see or review a plan they need a `STAFF` or `ADVISOR` row as well.

### Query parameters never widen scope

The role filter is ANDed in alongside the caller's own filters. A student
requesting `?studentId=SOMEONE_ELSE` gets
`p.student_id = 'OWN' AND p.student_id = 'SOMEONE_ELSE'` — an empty result,
never someone else's plans. Per `docs/overview/V3-01-api-spec.md` §7 a
caller-supplied id is a filter, never evidence of identity.

### Advisor assignments are re-checked per request

`assertCanViewPlan` queries `advisor_student_assignments` on every call. No
cache, in the module or in the token: an assignment revoked between two
requests must take effect on the next one.

## Not yet implemented — for V3-04 / V3-05

These rows are the contract those issues implement; the routes do not exist
yet. `authorize.mjs` answers "may this role touch this student's plan at
all" and does **not** replace the per-action status checks below.

| Action | STUDENT | ADVISOR | STAFF | ADMIN |
|---|---|---|---|---|
| `POST /coop-plans` (create) | own only | 403 | 403 | 403 |
| `PATCH /coop-plans/{id}` (edit) | own, only `PREPARING` / `RETURNED` | 403 | 403 | 403 |
| `POST /coop-plans/{id}/submit` | own, from `PREPARING` / `RETURNED` | 403 | 403 | 403 |
| `POST /coop-plans/{id}/review` | 403 | assigned students, only from `SUBMITTED` | any student, only from `SUBMITTED` | 403 |

Additional rules those issues must enforce (from
`docs/overview/V3-01-workflow-permissions.md` §4–§5):

- At most one in-progress plan per student per period (`PREPARING`,
  `SUBMITTED`, `RETURNED` count as in progress).
- `REJECTED` and `RETURNED` require a non-empty comment.
- Review writes the decision, the status change, and the `plan_reviews` row
  in one transaction, conditional on the status still being `SUBMITTED`;
  if another reviewer got there first, answer **409** and overwrite nothing.
