# Role demos

Four screen recordings of the deployed site, one per role, all taken on
2026-10-17 against the real API Gateway, Lambda, RDS and Cognito pool. MP4,
no watermark. Each one signs in, shows บัญชีของฉัน to name the account, then
walks the same two pages: นักศึกษา (`GET /students`) and แผนสหกิจ
(`GET /coop-plans`), with a scroll where the list runs to 10 rows.

The point of watching them in order is that the page never changes. The same
React component renders every frame; what differs is the rows the database
returns and the columns the SELECT asked for.

| File | Account | Students | Plans |
|---|---|---|---|
| `role-demo-1-student.mp4` | `student1@example.com` | 1 คน — own row only | 1 รายการ — own plan |
| `role-demo-2-advisor.mp4` | `advisor1@example.com` | 1 คน — the assigned student | 1 รายการ — that student's plan |
| `role-demo-3-staff.mp4` | `staff1@example.com` | 10 คน — everyone | 10 รายการ — every plan |
| `role-demo-4-admin.mp4` | `admin1@example.com` | 10 คน — identity fields only | **0 รายการ, refused (403)** |

## What to watch for

**Row scope** — student `6600000001` appears in three of the four recordings
for three different reasons: the student matches their own `student_id`, the
advisor matches a row in `advisor_student_assignments`, and staff has no
filter at all. Advisor and student happen to see one row each here only
because the seed assigns advisor1 exactly one student.

**Field scope, same student, same panel**

| Role | วันเกิด | GPAX | อีเมล / โทรศัพท์ | รายวิชา |
|---|---|---|---|---|
| STUDENT (own row) | 2004-06-30 | 2.90 | shown | 8 |
| ADVISOR | `-` | 2.90 | shown | 8 |
| STAFF | `-` | 2.90 | shown | 8 |
| ADMIN | `-` | `-` | `-` | 0 |

A `-` means the field is **absent from the response**, not null: the column is
left out of the SELECT before the query runs, and `student_courses` is not
joined at all for ADMIN. The admin panel rendering at all is the second half
of that change — the web app's types mark those fields optional, so every read
has to handle their absence instead of throwing on `gpa.toFixed(2)`.

**Admin and plans** — the last recording ends on แผนสหกิจ answering with
**"บัญชีนี้ไม่มีสิทธิ์เข้าถึงแผนสหกิจ"** and no retry button, confirmed 403 on a
second load. Being ADMIN grants account and role management, not plan access:
`docs/overview/V3-01-data-model.md` §2. It is the rule most likely to be
questioned in review, which is why it is on film.

## Caveats, so nobody misreads a frame

- Student `6100000006` (จีจี สายลม) shows `-` for GPAX in the **staff**
  recording. That is a NULL `gpa` in the seed data, not field scope. In the
  admin recording every row shows `-`, which is field scope.
- An earlier take of the admin recording showed "ไม่สามารถโหลดข้อมูลได้ / Failed
  to fetch coop plans:" on แผนสหกิจ — the API client's own message, which read
  as a network fault rather than a permission answer. Fixed in
  `fix(V3-02.4): say why the coop-plan list is empty`; the recording above is
  from after that fix.

## Making a new one

`mcp__claude-in-chrome__gif_creator` only exports GIF. Convert to MP4 with the
ffmpeg already on PATH:

```bash
ffmpeg -y -i downloaded.gif -movflags +faststart -pix_fmt yuv420p \
  -vf "fps=2,scale=1280:-2:flags=lanczos,pad=ceil(iw/2)*2:ceil(ih/2)*2" \
  -c:v libx264 -preset slow -crf 20 role-demo-N-role.mp4
```

Export options: `showWatermark: false`, `showProgressBar: false`,
`showClickIndicators`/`showActionLabels: true`. No zoom frames — plain
full-page screenshots only, one per meaningful state change.
