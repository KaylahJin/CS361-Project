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

Any other value in `app_users.role` is refused with **403** everywhere. The
course brief lists a fifth role, ผู้ประสานงานสถานประกอบการ, which the `CHECK`
constraint does not accept yet; when it is added it starts with no access and
has to be granted it here, rather than inheriting any by accident.

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
see or review a plan, that account's `app_users.role` must be changed to
`STAFF` or `ADVISOR`. `app_users` holds exactly one role per `cognito_sub`
(primary key) — there is no second row and no dual-role state, so "ADMIN
plus reviewer access" means switching the role, not adding one.

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

## Which code a refusal gets

Two refusals mean different things, and the choice is made by the kind of
identifier the route is keyed on — not by the route, and not by whatever was
convenient in the handler:

- An identifier that is **itself personal data** — `student_id` is issued to a
  real person, is enumerable, and names them — answers **404** when the row is
  outside the caller's scope. Confirming that a student id exists is itself a
  disclosure, so "not found" and "not yours" must be indistinguishable.
- An identifier that is an **internal surrogate** — `plan_id` is a sequence
  number that means nothing outside this system — answers **403**. Nothing is
  given away by admitting the row exists, and 403 is the more useful answer.

`V3-01-api-spec.md` §8 allows both codes and does not cover `/students`, so
this is the rule that decides it. The asymmetry between the two route families
is deliberate; see "Why the plan routes answer 403" below.

One case is neither: when the caller's scope **cannot be computed at all** the
answer is **403**, never 404. A `STUDENT` whose `app_users` row has no
`student_id` is a broken account link, and 404 would disguise a configuration
fault as a missing student.

## Student data routes (V3-02.4)

`GET /students` and `GET /students/{studentId}`, both behind the API Gateway
JWT authorizer. These began as public V2 endpoints (#34, #35) and served every
field to anyone; V3 requires access control over them.

### Row layer

| Role | `GET /students` (list) | `GET /students/{studentId}` |
|---|---|---|
| no token | **401** (rejected at API Gateway, Lambda never runs) | **401** |
| token, no `app_users` row | **403** | **403** |
| token, `is_active = false` | **403** | **403** |
| `STUDENT` | **200** — own row only | **200** own row, **404** any other |
| `STUDENT`, no linked `student_id` | **403** | **403** |
| `ADVISOR` | **200** — assigned students only | **200** if assigned, **404** otherwise |
| `STAFF` | **200** — every student | **200** |
| `ADMIN` | **200** — every student, identity fields only | **200**, identity fields only |
| unknown role value | **403** | **403** |
| id does not exist | — | **404** |

Scope lives in the `WHERE` clause, never in an `if` after the read. Zero rows
is the single path for both "no such student" and "not yours", so the two
cannot drift apart and an out-of-scope row never leaves the database.

### Field layer

| Group | Fields |
|---|---|
| identity | `student_id`, `first_name`, `last_name`, `curriculum` |
| contact | `email`, `phone` |
| personal | `birth_date` |
| academic | `gpa`, `courses[]` |

| Role | identity | contact | personal | academic |
|---|---|---|---|---|
| `STUDENT` (own row) | ✓ | ✓ | ✓ | ✓ |
| `ADVISOR` | ✓ | ✓ | ✗ | ✓ |
| `STAFF` | ✓ | ✓ | ✗ | ✓ |
| `ADMIN` | ✓ | ✗ | ✗ | ✗ |

A field the caller may not see is **absent from the response**, not null. The
column list is built from the role before the query runs, and
`student_courses` is not joined at all when the role has no academic rights —
the data is never fetched, so it cannot be leaked by a later change to the
serializer. Tests assert the key is missing (`not.toHaveProperty('gpa')`), not
that it is null.

`src/types/student.ts` marks the role-dependent fields optional, so every use
site in the web app must handle their absence and `tsc` catches the ones that
do not. Rendering `student.courses.length` against a response that omits
`courses` is a blank page for an admin, and the type is what prevents it.

### Why `ADMIN` reads student identity but no plans

`V3-01-data-model.md` §2 gives `ADMIN` accounts, roles and access. Setting
`app_users.student_id` means resolving a student id to a person, which needs
`student_id` and a name and nothing more. That is the whole grant: no contact
details, no GPA, no courses, and still no plan access.

### Why `birth_date` stops at the student's own row

Nothing in V3 reads it — not a filter, not a test, not a verify script, only
the detail panel. A field with no consumer is a field with no justification,
so only the student sees their own.

### Why the plan routes answer 403 and the student routes answer 404

`plan_id` is a surrogate key; `student_id` identifies a person. The rule at
the top of this file decides it. Changing the coop-plan routes to 404 for
symmetry would gain no privacy — the ids are sequential and meaningless — and
would invalidate the evidence already posted on #103.

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
