// ============================================================
// CS361 V2 — PostgreSQL connection pool (Lambda)
// ============================================================
// Issue: #26 — ทำการเรียกข้อมูลสถานประกอบการ
//
// Architecture:
//   Lambda (in VPC) -> RDS Proxy -> RDS PostgreSQL
//   The Lambda never reaches the public internet, so no NAT Gateway is
//   needed. DB_HOST points at the RDS Proxy endpoint, NOT the RDS
//   instance endpoint.
//
// Pooling:
//   RDS Proxy does the real connection pooling ACROSS concurrent Lambda
//   invocations. The pool here exists only so that a single warm
//   execution context reuses one connection instead of opening a new one
//   per invocation — hence the deliberately small `max`.
//
// The Pool lives at module scope (created lazily on first getPool() call)
// so it survives across invocations that share a warm execution context.
// ============================================================

import pg from 'pg';

const DEFAULT_PORT = 5432;
const MAX_CONNECTIONS = 5;

/** @type {import('pg').Pool | null} */
let pool = null;

/**
 * Lazily create and return the module-scope singleton pg.Pool.
 * Reused across warm Lambda invocations.
 *
 * @returns {import('pg').Pool}
 */
export function getPool() {
  if (pool) return pool;

  pool = new pg.Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || DEFAULT_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // RDS Proxy has TLS enforced (see docs/aws-lambda-setup-guide.md) — a
    // plaintext connect attempt gets dropped immediately by the proxy.
    ssl: { rejectUnauthorized: false },
    // Small on purpose — RDS Proxy pools across invocations.
    max: MAX_CONNECTIONS,
    // Fail fast rather than letting API Gateway hit its own 30s timeout.
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });

  // A pool-level 'error' event on an idle client is emitted asynchronously.
  // Without a listener Node treats it as an unhandled 'error' and crashes
  // the execution context, so log it and let pg discard the bad client.
  pool.on('error', (err) => {
    console.error('Unexpected idle client error on pg pool', err);
  });

  return pool;
}

/**
 * Test-only escape hatch: drop the cached pool so the next getPool()
 * rebuilds it (e.g. after swapping env vars or mocks between tests).
 */
export function resetPool() {
  pool = null;
}
