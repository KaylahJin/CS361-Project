// Which API routes must require a token, declared once, away from the
// Terraform that implements it.
//
// A route protected only by someone remembering to add `authorizer_id` to its
// `aws_apigatewayv2_route` block is a route that goes public the first time a
// block is copy-pasted. This file is the statement of intent;
// route-policy.test.mjs reads apigateway.tf and fails when the two disagree.
//
// PRIVATE means the route serves personal data: a plan belongs to one student,
// and the student table is personal data in every column. PUBLIC routes serve
// the content a visitor is meant to read without an account — the programme
// steps, criteria, schedule and the companies and positions on offer. See
// docs/permission-matrix.md for what each role may then see on a private
// route; this file only decides whether a token is required at all.

/** Routes that must carry `authorization_type = "JWT"` and an authorizer. */
export const PRIVATE_ROUTES = [
  'GET /coop-plans',
  'GET /coop-plans/{planId}',
  'POST /coop-plans/{planId}/review',
  'GET /students',
  'GET /students/{studentId}',
  'POST /coop-plans',
  'PATCH /coop-plans/{planId}',
  'POST /coop-plans/{planId}/submit',
];

/** Routes that are public on purpose. */
export const PUBLIC_ROUTES = [
  'GET /companies',
  'GET /companies/{companyId}',
  'GET /positions',
  'GET /positions/{positionId}',
  'GET /coop-info',
  'GET /periods',
];
