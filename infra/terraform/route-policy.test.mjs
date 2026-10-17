// Guard: apigateway.tf must match route-policy.mjs.
//
// The rules themselves are tested in authorize.test.mjs and the handler
// suites. None of that runs if API Gateway never asks for a token, and
// forgetting `authorizer_id` on a new route block is silent — the route simply
// answers 200 to the whole internet. This test is the thing that is not
// silent.
//
// It reads the Terraform as text rather than running `terraform plan`: the
// check has to run in CI and on a laptop with no AWS credentials.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PRIVATE_ROUTES, PUBLIC_ROUTES } from './route-policy.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TF = readFileSync(join(HERE, 'apigateway.tf'), 'utf8');

/**
 * Every `aws_apigatewayv2_route` block, as `{ routeKey, hasAuthorizer }`.
 *
 * Deliberately strict: a block whose `route_key` cannot be read is a parse
 * failure, not a route to skip. Whitespace between the key and `=` varies
 * because Terraform aligns `=` within a block, so the pattern allows any.
 */
function parseRoutes(tf) {
  const blocks = tf.split(/resource\s+"aws_apigatewayv2_route"/).slice(1);

  return blocks.map((block) => {
    const body = block.split(/\n}/)[0];
    const routeKey = body.match(/route_key\s*=\s*"([^"]+)"/)?.[1];

    if (!routeKey) {
      throw new Error(
        `an aws_apigatewayv2_route block in apigateway.tf has no readable route_key:\n${body}`,
      );
    }

    return {
      routeKey,
      hasAuthorizer:
        /authorizer_id\s*=/.test(body) && /authorization_type\s*=\s*"JWT"/.test(body),
    };
  });
}

const routes = parseRoutes(TF);
const keyOf = (r) => r.routeKey;

describe('apigateway.tf route parsing', () => {
  // Without this, a formatting change that breaks the regex turns every
  // assertion below into a vacuous pass over an empty list.
  it('finds route blocks at all', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('finds every route the policy declares', () => {
    const declared = [...PRIVATE_ROUTES, ...PUBLIC_ROUTES].sort();
    expect(routes.map(keyOf).sort()).toEqual(declared);
  });
});

describe('routes that must require a token', () => {
  for (const routeKey of PRIVATE_ROUTES) {
    it(`${routeKey} is behind the JWT authorizer`, () => {
      const route = routes.find((r) => r.routeKey === routeKey);
      expect(route, `${routeKey} is missing from apigateway.tf`).toBeDefined();
      expect(route.hasAuthorizer).toBe(true);
    });
  }
});

describe('routes that are public on purpose', () => {
  for (const routeKey of PUBLIC_ROUTES) {
    it(`${routeKey} stays open`, () => {
      const route = routes.find((r) => r.routeKey === routeKey);
      expect(route, `${routeKey} is missing from apigateway.tf`).toBeDefined();
      expect(route.hasAuthorizer).toBe(false);
    });
  }
});
