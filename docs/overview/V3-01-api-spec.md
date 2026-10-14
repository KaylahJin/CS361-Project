# V3 API Specification

## 1. Existing V2 APIs

| Method | Path | Purpose |
|---|---|---|
| GET | `/coop-plans` | List and filter plans |
| GET | `/coop-plans/{planId}` | Get plan details |

These endpoints exist in the inspected V2 repository. Access rules must be checked for V3.

## 2. Proposed V3 APIs

The following endpoints are proposals and are not confirmed as implemented.

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `/coop-plans` | Student | Create a plan |
| PATCH | `/coop-plans/{planId}` | Plan owner | Edit a plan |
| POST | `/coop-plans/{planId}/submit` | Plan owner | Submit a plan |
| POST | `/coop-plans/{planId}/start-review` | Assigned Advisor | Start reviewing |
| POST | `/coop-plans/{planId}/review` | Assigned Advisor | Approve or reject |

## 3. Request and Response Design

### Create a plan

`POST /coop-plans`

Example request:

```json
{
  "periodId": "PERIOD_ID",
  "positionId": "POSITION_ID"
}
```

The backend identifies the Student from the authenticated account and creates a plan in `PREPARING` status.

Expected success: `201 Created`.

### Edit a plan

`PATCH /coop-plans/{planId}`

The request contains the fields that can be edited. The backend checks plan ownership and whether the current status allows editing.

Expected success: `200 OK`.

### Submit a plan

`POST /coop-plans/{planId}/submit`

The backend validates required information and changes the status from `PREPARING` to `SUBMITTED`.

Expected success: `200 OK`.

### Start review

`POST /coop-plans/{planId}/start-review`

The backend checks the Advisor's assignment and changes the status from `SUBMITTED` to `UNDER_REVIEW`.

Expected success: `200 OK`.

### Review a plan

`POST /coop-plans/{planId}/review`

Example request:

```json
{
  "decision": "REJECTED",
  "comment": "Please update the plan."
}
```

The backend checks the reviewer's permission and current plan status. It records the decision and updates the plan in one transaction.

Expected success: `200 OK`.

## 4. Common Rules and Errors

- Protected endpoints require verified authentication.
- The backend derives the user's identity from the verified token, not a client-supplied reviewer or owner ID.
- Check plan ownership and advisor assignment on every relevant request.
- Validate input and allowed status transitions.
- Prevent conflicting review decisions from being saved concurrently.

Proposed HTTP error codes:

| Code | Meaning |
|---|---|
| 400 | Invalid request |
| 401 | Missing or invalid authentication |
| 403 | Permission denied |
| 404 | Resource not found |
| 409 | Invalid or conflicting status |
| 500 | Internal server error |

## 5. Items to Confirm

- Does review need a separate start-review step?
- Can plans be resubmitted after rejection?
- Are multiple reviewers required?
- What fields and conditions are required to submit a plan?
- Does Admin need additional endpoints?
- Should response formats follow existing repository conventions?

All proposed endpoints require implementation, tests, and authorization checks before use.
