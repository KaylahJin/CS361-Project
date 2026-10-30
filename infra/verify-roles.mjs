// Runs the permission matrix against the deployed API, one signed-in session
// per role, and prints the result as a role x action x outcome table.
//
//   npm run verify:roles
//
// Reads the API URL and Cognito ids from Terraform outputs and signs in over
// SRP, the same way the frontend does. Accounts and their roles come from
// docs/v3-02-auth.md; the role of each one lives in app_users, seeded by
// infra/seed-app-users.sh.
//
// Expected outcomes come from docs/permission-matrix.md. A row that does not
// match is printed as FAIL and the script exits non-zero.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
} from 'amazon-cognito-identity-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TF_DIR = path.join(__dirname, 'terraform');

const tfOutput = (name) =>
  execFileSync('terraform', ['output', '-raw', name], { cwd: TF_DIR, encoding: 'utf-8' }).trim();

// Each allowlisted Cognito account has its own password. Keep credentials
// out of source control and pass them through environment variables.
const PASSWORD_ENV = {
  STUDENT: 'COOP_STUDENT_PASSWORD',
  ADVISOR: 'COOP_ADVISOR_PASSWORD',
  STAFF: 'COOP_STAFF_PASSWORD',
  ADMIN: 'COOP_ADMIN_PASSWORD',
};

const missingPasswords = Object.values(PASSWORD_ENV).filter((name) => !process.env[name]);
if (missingPasswords.length) {
  console.error('error: missing password environment variables:');
  for (const name of missingPasswords) console.error(`  ${name}`);
  console.error();
  console.error('Set each account password separately, then run npm run verify:roles.');
  process.exit(2);
}

// OWN_PLAN belongs to the student account's own student_id; OTHER_PLAN belongs
// to a student nobody here is linked to or assigned.
const OWN_PLAN = Number(process.env.OWN_PLAN || 1);
const OTHER_PLAN = Number(process.env.OTHER_PLAN || 2);

// OWN_STUDENT is the student_id on student1@'s app_users row, which advisor1@
// is also assigned to (infra/seed-app-users.sh). OTHER_STUDENT is a student
// neither of them is linked to.
const OWN_STUDENT = process.env.OWN_STUDENT || '6600000001';
const OTHER_STUDENT = process.env.OTHER_STUDENT || '6100000001';

// The field groups from docs/permission-matrix.md. A field a role may not read
// has to be ABSENT from the response, not null: a null still ships the field
// name, and the next change to the response shape can refill it.
const IDENTITY_FIELDS = ['student_id', 'first_name', 'last_name', 'curriculum'];
const CONTACT_FIELDS = ['email', 'phone'];
const PERSONAL_FIELDS = ['birth_date'];
const ACADEMIC_FIELDS = ['gpa', 'courses'];

const ROLES = [
  {
    email: 'student1@example.com',
    role: 'STUDENT',
    expect: { list: 200, own: 200, other: 403 },
    students: { list: 403, own: 200, other: 404 },
    fields: {
      present: [...IDENTITY_FIELDS, ...CONTACT_FIELDS, ...PERSONAL_FIELDS, ...ACADEMIC_FIELDS],
      absent: [],
    },
    note: 'own plan and own student record only, no student list (D9)',
  },
  {
    email: 'advisor1@example.com',
    role: 'ADVISOR',
    expect: { list: 200, own: 200, other: 403 },
    students: { list: 200, own: 200, other: 404 },
    fields: {
      present: [...IDENTITY_FIELDS, ...CONTACT_FIELDS, ...ACADEMIC_FIELDS],
      absent: PERSONAL_FIELDS,
    },
    note: 'assigned students only',
  },
  {
    email: 'staff1@example.com',
    role: 'STAFF',
    expect: { list: 200, own: 200, other: 200 },
    students: { list: 200, own: 200, other: 200 },
    fields: {
      present: [...IDENTITY_FIELDS, ...CONTACT_FIELDS, ...ACADEMIC_FIELDS],
      absent: PERSONAL_FIELDS,
    },
    note: 'every plan and every student',
  },
  {
    email: 'admin1@example.com',
    role: 'ADMIN',
    expect: { list: 403, own: 403, other: 403 },
    students: { list: 200, own: 200, other: 200 },
    fields: {
      present: IDENTITY_FIELDS,
      absent: [...CONTACT_FIELDS, ...PERSONAL_FIELDS, ...ACADEMIC_FIELDS],
    },
    note: 'no plans; student identity only, to map an id to a person',
  },
];

function signIn({ userPoolId, clientId, email, password }) {
  const pool = new CognitoUserPool({ UserPoolId: userPoolId, ClientId: clientId });
  const user = new CognitoUser({ Username: email, Pool: pool });
  const details = new AuthenticationDetails({ Username: email, Password: password });

  return new Promise((resolve, reject) => {
    user.authenticateUser(details, {
      onSuccess: (session) => resolve(session.getIdToken().getJwtToken()),
      onFailure: reject,
    });
  });
}

async function call(api, route, token) {
  const res = await fetch(`${api}${route}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.text();

  let count = null;
  let keys = null;
  let parsed = null;
  try {
    parsed = JSON.parse(body);
    if (Array.isArray(parsed)) {
      count = parsed.length;
      if (parsed.length > 0) keys = Object.keys(parsed[0]);
    } else if (parsed && typeof parsed === 'object') {
      keys = Object.keys(parsed);
    }
  } catch {
    // A non-JSON body only matters when the status is already wrong.
  }

  return { status: res.status, count, keys, body: parsed };
}

async function main() {
  const api = tfOutput('api_url');
  const userPoolId = tfOutput('cognito_user_pool_id');
  const clientId = tfOutput('cognito_user_pool_client_id');

  console.log(`api:           ${api}`);
  console.log(`own plan:      ${OWN_PLAN}`);
  console.log(`other plan:    ${OTHER_PLAN}`);
  console.log(`own student:   ${OWN_STUDENT}`);
  console.log(`other student: ${OTHER_STUDENT}`);
  console.log();

  const rows = [];
  const fieldRows = [];
  let failures = 0;

  for (const account of ROLES) {
    const token = await signIn({ userPoolId, clientId, email: account.email, password: process.env[PASSWORD_ENV[account.role]] });

    const list = await call(api, '/coop-plans', token);
    const own = await call(api, `/coop-plans/${OWN_PLAN}`, token);
    const other = await call(api, `/coop-plans/${OTHER_PLAN}`, token);

    const me = await call(api, '/me', token);
    const studentList = await call(api, '/students', token);
    const ownStudent = await call(api, `/students/${OWN_STUDENT}`, token);
    const otherStudent = await call(api, `/students/${OTHER_STUDENT}`, token);

    const checks = [
      ['GET /me', me, 200],
      ['GET /coop-plans', list, account.expect.list],
      [`GET /coop-plans/${OWN_PLAN} (own)`, own, account.expect.own],
      [`GET /coop-plans/${OTHER_PLAN} (other student)`, other, account.expect.other],
      ['GET /students', studentList, account.students.list],
      [`GET /students/${OWN_STUDENT} (in scope)`, ownStudent, account.students.own],
      [`GET /students/${OTHER_STUDENT} (out of scope)`, otherStudent, account.students.other],
    ];

    // Field scope, checked on whichever student row this role may read.
    const sample = ownStudent.status === 200 ? ownStudent : null;
    if (sample?.keys) {
      const missing = account.fields.present.filter((f) => !sample.keys.includes(f));
      const leaked = account.fields.absent.filter((f) => sample.keys.includes(f));
      const ok = missing.length === 0 && leaked.length === 0;
      if (!ok) failures++;
      fieldRows.push({
        role: account.role,
        detail:
          (leaked.length ? `leaked ${leaked.join(', ')}` : '') +
          (leaked.length && missing.length ? '; ' : '') +
          (missing.length ? `missing ${missing.join(', ')}` : '') ||
          `${sample.keys.length} fields, all permitted`,
        verdict: ok ? 'ok' : 'FAIL',
      });
    } else if (account.students.own === 200) {
      failures++;
      fieldRows.push({
        role: account.role,
        detail: `no row to check field scope against (status ${ownStudent.status})`,
        verdict: 'FAIL',
      });
    }

    // GET /me must report the role this account actually has.
    if (me.body?.role !== account.role) {
      failures++;
      rows.push({
        role: account.role,
        action: 'GET /me role',
        got: String(me.body?.role),
        expected: account.role,
        verdict: 'FAIL',
      });
    }

    for (const [action, result, expected] of checks) {
      const ok = result.status === expected;
      if (!ok) failures++;
      rows.push({
        role: account.role,
        action,
        got: result.status + (result.count === null ? '' : ` (${result.count} rows)`),
        expected,
        verdict: ok ? 'ok' : 'FAIL',
      });
    }
  }

  const width = (key) => Math.max(key.length, ...rows.map((r) => String(r[key]).length));
  const w = { role: width('role'), action: width('action'), got: width('got') };
  const line = (r) =>
    `  ${String(r.role).padEnd(w.role)}  ${String(r.action).padEnd(w.action)}  ` +
    `${String(r.got).padEnd(w.got)}  expected ${String(r.expected).padEnd(4)} ${r.verdict}`;

  console.log(line({ role: 'ROLE', action: 'ACTION', got: 'RESULT', expected: '', verdict: '' }));
  for (const r of rows) console.log(line(r));

  console.log();
  console.log('  FIELD SCOPE on GET /students/{id}');
  for (const r of fieldRows) {
    console.log(`  ${r.role.padEnd(8)}  ${r.detail.padEnd(48)}  ${r.verdict}`);
  }

  console.log();
  for (const account of ROLES) console.log(`  ${account.role.padEnd(8)} ${account.note}`);

  console.log();
  if (failures > 0) {
    console.log(`${failures} check(s) did not match the permission matrix`);
    process.exit(1);
  }
  console.log('every row matches docs/permission-matrix.md');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
