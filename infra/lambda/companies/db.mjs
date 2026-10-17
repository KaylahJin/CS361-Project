// PostgreSQL connection pool for the Lambda.
//
// The Lambda sits in the VPC and connects straight to RDS — the RDS Proxy
// that used to sit in between is gone. It never reaches the public internet,
// so there is no NAT Gateway.
//
// The pool lives at module scope and is created on the first getPool() call,
// so a warm execution context reuses its connection instead of opening a new
// one per invocation. Each context keeps its own small pool; nothing pools
// across concurrent invocations now, which is why `max` stays low — a burst of
// cold starts must not exhaust the instance's connection limit.

import pg from 'pg';

const DEFAULT_PORT = 5432;
const MAX_CONNECTIONS = 5;

/** @type {import('pg').Pool | null} */
let pool = null;

export function getPool() {
  if (pool) return pool;

  pool = new pg.Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || DEFAULT_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // RDS requires TLS. rejectUnauthorized stays false because the instance
    // presents the AWS RDS CA, which is not in the Lambda runtime's trust
    // store without bundling the certificate.
    ssl: { rejectUnauthorized: false },
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
