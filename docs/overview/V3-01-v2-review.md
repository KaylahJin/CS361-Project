# V2 Architecture Review

## 1. Existing Architecture

V2 uses the following components:

- Frontend: React and TypeScript
- API: Amazon API Gateway HTTP API and AWS Lambda (Node.js)
- Database: Amazon RDS PostgreSQL with RDS Proxy
- Infrastructure: Terraform
- Main data includes students, companies, positions, periods, and coop plans.

## 2. Existing Coop Plan Features

The repository contains these read APIs:

- `GET /coop-plans`: list and filter coop plans
- `GET /coop-plans/{planId}`: get a plan by ID

The `coop_plans` table already stores plan status, reviewer name, review time, and review comment. Existing statuses are `PREPARING`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, and `REJECTED`.

## 3. Reuse and Changes for V3

- Frontend: reuse the existing React structure and add plan submission and review screens.
- API and Lambda: reuse the existing structure and propose endpoints for creating, updating, submitting, and reviewing plans.
- Database: reuse existing student and coop plan data; confirm whether additional user and review tables are needed.
- Authentication: design user authentication and backend authorization for V3.
- Workflow: define who can submit and review plans, and which status changes are allowed.

## 4. Findings and Items to Confirm

- The inspected repository contains read APIs, but no plan submission or review routes were found.
- Cognito authentication was not found in the inspected Terraform files.
- The current schema stores `reviewer_name`; the proposed design needs a way to identify reviewers.
- The team must confirm roles, review steps, submission rules, and resubmission after rejection.
- These findings describe inspected repository files, not verified live AWS configuration.

## 5. Conclusion

V3 can reuse the main V2 architecture. Plan management, authentication, authorization, and workflow rules need further design before implementation.
