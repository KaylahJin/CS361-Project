// Checks the whole auth path against the deployed stack:
//
//   npm run verify:auth [email] [password]
//
// Reads the API URL and Cognito ids from Terraform outputs, then signs in
// over SRP with the same library the frontend uses. The AWS CLI cannot stand
// in here: the app client does not enable USER_PASSWORD_AUTH, so there is no
// way to trade a password for a token outside this flow.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
} from 'amazon-cognito-identity-js';

import {
  PRIVATE_ROUTES as PRIVATE_ROUTES_DECLARED,
  PUBLIC_ROUTES as PUBLIC_ROUTES_DECLARED,
} from './terraform/route-policy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TF_DIR = path.join(__dirname, 'terraform');

const tfOutput = (name) =>
  execFileSync('terraform', ['output', '-raw', name], { cwd: TF_DIR, encoding: 'utf-8' }).trim();

const DEFAULT_EMAIL = 'student1@example.com';

// A confirmed Cognito account deliberately left out of app_users, so the
// "authenticated but not authorised" path has something to test against.
const UNMAPPED_EMAIL = process.env.COOP_UNMAPPED_EMAIL || 'nobody1@example.com';

// Each Cognito test account has a distinct password. An optional CLI password
// applies only to the primary account, never to the unmapped account.
const PASSWORD_ENV_BY_EMAIL = {
  'student1@example.com': 'COOP_STUDENT_PASSWORD',
  'advisor1@example.com': 'COOP_ADVISOR_PASSWORD',
  'staff1@example.com': 'COOP_STAFF_PASSWORD',
  'admin1@example.com': 'COOP_ADMIN_PASSWORD',
};

function readPassword(email) {
  const password = process.argv[3] || process.env[PASSWORD_ENV_BY_EMAIL[email]];
  if (password) return password;

  const envName = PASSWORD_ENV_BY_EMAIL[email];
  console.error(`error: no password supplied for ${email}.`);
  if (envName) console.error(`Set ${envName}, or pass the password as the third argument.`);
  else console.error('Pass the account password as the third argument.');
  process.exit(2);
}

// Both lists come from infra/terraform/route-policy.mjs, the same declaration
// apigateway.tf is checked against, so this script cannot be left testing a
// route set the API no longer has. Path parameters are filled with ids that
// exist in the seeded data.
const SAMPLE_IDS = {
  '{planId}': process.env.OWN_PLAN || '1',
  '{studentId}': process.env.OWN_STUDENT || '6600000001',
  '{companyId}': process.env.SAMPLE_COMPANY || 'C01',
  '{positionId}': process.env.SAMPLE_POSITION || 'POS001',
};

const toPath = (routeKey) =>
  routeKey
    .replace(/^[A-Z]+\s+/, '')
    .replace(/\{[a-zA-Z]+\}/g, (match) => SAMPLE_IDS[match] ?? match);

// Must stay readable with no token at all.
const PUBLIC_ROUTES = PUBLIC_ROUTES_DECLARED.map(toPath);

// Behind the JWT authorizer.
const PROTECTED_ROUTES = PRIVATE_ROUTES_DECLARED.map(toPath);

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

const status = async (api, route, token) =>
  (
    await fetch(`${api}${route}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  ).status;

async function main() {
  const email = process.argv[2] || DEFAULT_EMAIL;
  const password = readPassword(email);

  if (!process.env.COOP_UNMAPPED_PASSWORD) {
    console.error('error: set COOP_UNMAPPED_PASSWORD to the distinct password for the unmapped account.');
    process.exit(2);
  }

  const api = tfOutput('api_url');
  const userPoolId = tfOutput('cognito_user_pool_id');
  const clientId = tfOutput('cognito_user_pool_client_id');

  let failures = 0;
  const check = (label, actual, expected) => {
    const ok = actual === expected;
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}: ${actual} (expected ${expected})`);
  };

  console.log(`api:  ${api}`);
  console.log(`pool: ${userPoolId}`);
  console.log();

  console.log('public routes, no token');
  for (const route of PUBLIC_ROUTES) {
    check(`GET ${route}`, await status(api, route), 200);
  }
  console.log();

  console.log('protected routes, no token');
  for (const route of PROTECTED_ROUTES) {
    check(`GET ${route}`, await status(api, route), 401);
  }
  console.log();

  console.log('protected routes, forged token');
  for (const route of PROTECTED_ROUTES) {
    check(`GET ${route}`, await status(api, route, 'not.a.real.token'), 401);
  }
  console.log();

  console.log(`SRP sign-in as ${email}`);
  const idToken = await signIn({ userPoolId, clientId, email, password });
  const claims = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString());
  console.log(`  ok    token acquired (${idToken.length} chars)`);
  check('aud equals the SPA client id', claims.aud, clientId);
  check('email claim', claims.email, email);
  console.log(`  sub:  ${claims.sub}`);

  // There is no honest way to script "an expired token": one cannot be minted
  // without Cognito's signing key, and a hand-made one is rejected at the
  // signature check above rather than on `exp`, so it would prove nothing new.
  // What can be shown is that every token carries a finite, short lifetime and
  // that the authorizer is the thing enforcing it. The browser side of the same
  // rule is captured in docs/evidence/99-09.
  const lifetimeMin = Math.round((claims.exp - claims.iat) / 60);
  console.log(`  iat:  ${new Date(claims.iat * 1000).toISOString()}`);
  console.log(`  exp:  ${new Date(claims.exp * 1000).toISOString()}  (${lifetimeMin} minutes)`);
  check('token lifetime is finite and <= 60 minutes', lifetimeMin > 0 && lifetimeMin <= 60, true);
  console.log('  note  an expired token fails the same authorizer check as the forged one above,');
  console.log('        on `exp` instead of signature; see docs/v3-02-auth.md.');
  console.log();

  console.log('protected routes, real token');
  for (const route of PROTECTED_ROUTES) {
    const code = await status(api, route, idToken);
    // Not a pass/fail check, because the right answer depends on how far the
    // app_users table has got: 500 while the table does not exist, 401 once it
    // does but this account has no row, 200 once it has one.
    console.log(`  info  GET ${route}: ${code} (500 while app_users is absent; 403 once it exists but this sub is unmapped; 200 when mapped)`);
  }
  console.log();

  // A Cognito account that is real and confirmed but has no app_users row.
  // The token is valid, so the caller is authenticated and simply has no
  // permission yet: 403, not 401. Acceptance criteria on #100.
  console.log(`unmapped account: SRP sign-in as ${UNMAPPED_EMAIL}`);
  try {
    const unmappedToken = await signIn({
      userPoolId,
      clientId,
      email: UNMAPPED_EMAIL,
      password: process.env.COOP_UNMAPPED_PASSWORD,
    });
    console.log('  ok    token acquired, so the account itself is valid');
    for (const route of PROTECTED_ROUTES) {
      check(`GET ${route}`, await status(api, route, unmappedToken), 403);
    }
  } catch (err) {
    if (err?.code === 'UserNotFoundException' || /User does not exist/i.test(err?.message ?? '')) {
      console.log(`  skip  ${UNMAPPED_EMAIL} does not exist in this pool.`);
      console.log('        Create it to cover this case; see docs/v3-02-auth.md.');
    } else {
      throw err;
    }
  }
  console.log();

  if (failures > 0) {
    console.log(`${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log('all checks passed');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
