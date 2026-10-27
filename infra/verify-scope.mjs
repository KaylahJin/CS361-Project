// Proves that a student_id supplied by the caller is never used as identity.
//
//   COOP_STUDENT_PASSWORD='...' COOP_STAFF_PASSWORD='...' npm run verify:scope
//
// Acceptance criteria on #100: "ส่ง student_id ของผู้อื่นมาใน Body/Query แล้วระบบ
// ไม่นำไปใช้ระบุตัวตน". Identity comes from the verified `sub` claim only; a
// student_id in the query string is caller-supplied data and may act as a
// filter that narrows the caller's own rows, never as a claim about who they
// are. listCoopPlans.test.mjs covers this at the unit level — this script
// proves it against the deployed API, which is what the issue asks for.
//
// Reads the API URL and Cognito ids from Terraform outputs and signs in over
// SRP, the same way the frontend does.

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

const STUDENT_PASSWORD =
  process.env.COOP_STUDENT_PASSWORD || process.argv[2];
const STAFF_PASSWORD =
  process.env.COOP_STAFF_PASSWORD || process.argv[3];

if (!STUDENT_PASSWORD || !STAFF_PASSWORD) {
  console.error('error: both student and staff passwords are required.\n');
  console.error(
    '  COOP_STUDENT_PASSWORD=... COOP_STAFF_PASSWORD=... npm run verify:scope',
  );
  console.error(
    '  node infra/verify-scope.mjs <student-password> <staff-password>\n',
  );
  process.exit(2);
}

const STUDENT_EMAIL = 'student1@example.com';
const STAFF_EMAIL = 'staff1@example.com';

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

  let rows = null;
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) rows = parsed;
  } catch {
    // A non-JSON body only matters when the status is already wrong.
  }

  return { status: res.status, rows };
}

/** The distinct student_ids visible in a response, for reporting. */
const idsIn = (rows) => (rows ? [...new Set(rows.map((r) => r.student_id))].sort() : []);

async function main() {
  const api = tfOutput('api_url');
  const userPoolId = tfOutput('cognito_user_pool_id');
  const clientId = tfOutput('cognito_user_pool_client_id');

  console.log(`api: ${api}`);
  console.log();

  // Staff see every plan, so their list is how we find a student_id that does
  // not belong to student1 without hardcoding one that seed data may change.
  const staffToken = await signIn({
    userPoolId,
    clientId,
    email: STAFF_EMAIL,
    password: STAFF_PASSWORD,
  });
  const staffList = await call(api, '/coop-plans', staffToken);

  const studentToken = await signIn({
    userPoolId,
    clientId,
    email: STUDENT_EMAIL,
    password: STUDENT_PASSWORD,
  });
  const ownList = await call(api, '/coop-plans', studentToken);

  const ownIds = idsIn(ownList.rows);
  const allIds = idsIn(staffList.rows);
  const otherId = allIds.find((id) => !ownIds.includes(id));

  if (!otherId) {
    console.error('error: could not find a student_id that does not belong to the student account.');
    console.error(`staff sees: ${allIds.join(', ') || '(none)'}`);
    process.exit(1);
  }

  console.log(`signed in as:        ${STUDENT_EMAIL}`);
  console.log(`own student_id:      ${ownIds.join(', ')}`);
  console.log(`another student_id:  ${otherId}  (found via ${STAFF_EMAIL}, who sees all)`);
  console.log(`staff sees in total: ${allIds.length} distinct student_ids, ${staffList.rows?.length ?? 0} plans`);
  console.log();

  // Two spoof attempts, because there are two ways a caller might try it.
  //
  // `studentId` is the filter the API really accepts. The role filter is
  // ANDed in alongside it, so a student asking for someone else's id gets
  // `p.student_id = 'OWN' AND p.student_id = 'OTHER'` — a contradiction, so
  // zero rows. The filter can narrow the caller's own scope, never widen it.
  //
  // `student_id` is not a parameter this API reads at all. It is ignored, and
  // the caller still gets exactly their own rows. Worth checking separately:
  // an unknown parameter must be inert, not a silent passthrough.
  const spoofFilter = await call(
    api,
    `/coop-plans?studentId=${encodeURIComponent(otherId)}`,
    studentToken,
  );
  const spoofFilterIds = idsIn(spoofFilter.rows);

  const spoofUnknown = await call(
    api,
    `/coop-plans?student_id=${encodeURIComponent(otherId)}`,
    studentToken,
  );
  const spoofUnknownIds = idsIn(spoofUnknown.rows);

  const leaked = [...spoofFilterIds, ...spoofUnknownIds].includes(otherId);

  const checks = [
    {
      what: 'GET /coop-plans (no params)',
      detail: `${ownList.status}, ${ownList.rows?.length ?? 0} plans, student_ids: ${ownIds.join(', ')}`,
      pass: ownList.status === 200 && ownIds.length === 1 && ownIds[0] !== otherId,
      expected: "200, only the caller's own student_id",
    },
    {
      what: `GET /coop-plans?studentId=${otherId}`,
      detail: `${spoofFilter.status}, ${spoofFilter.rows?.length ?? 0} plans, student_ids: ${spoofFilterIds.join(', ') || '(none)'}`,
      pass: spoofFilter.status === 200 && spoofFilterIds.length === 0,
      expected: '200 with zero rows: ANDed with the role filter, so it narrows and contradicts',
    },
    {
      what: `GET /coop-plans?student_id=${otherId}`,
      detail: `${spoofUnknown.status}, ${spoofUnknown.rows?.length ?? 0} plans, student_ids: ${spoofUnknownIds.join(', ') || '(none)'}`,
      pass:
        spoofUnknown.status === 200 &&
        spoofUnknownIds.length === 1 &&
        spoofUnknownIds[0] === ownIds[0],
      expected: "200 with the caller's own rows: an unknown parameter is inert",
    },
    {
      what: "the other student's id never appears in any response to the student",
      detail: leaked ? `LEAKED ${otherId}` : `${otherId} absent from both responses`,
      pass: !leaked,
      expected: 'absent',
    },
  ];

  const width = Math.max(...checks.map((c) => c.what.length));
  let failures = 0;

  for (const c of checks) {
    if (!c.pass) failures++;
    console.log(`  ${c.pass ? 'ok  ' : 'FAIL'}  ${c.what.padEnd(width)}  ${c.detail}`);
    console.log(`        ${' '.repeat(width)}  expected: ${c.expected}`);
  }

  console.log();
  if (failures) {
    console.error(`${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log('identity comes from the token only; a caller-supplied student_id cannot widen scope');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
