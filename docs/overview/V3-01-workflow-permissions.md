# V3 Workflow and Permissions

## 1. Proposed Roles

| Role | Main responsibility |
|---|---|
| Student | Create, edit, and submit own plan |
| Advisor | Review assigned students' plans |
| Admin | Manage system data or access, if required |

These roles are proposed and must be confirmed with the team.

## 2. Permission Rules

- Student can access and edit only their own plans, subject to the plan status.
- Advisor can review only plans within their assigned responsibility.
- Admin permissions must be defined by the team.
- The backend must check permissions; hiding frontend buttons is not sufficient.

## 3. Proposed Workflow

Existing statuses in V2 are `PREPARING`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, and `REJECTED`.

| Current status | Action | Proposed next status |
|---|---|---|
| PREPARING | Student submits plan | SUBMITTED |
| SUBMITTED | Advisor starts review | UNDER_REVIEW |
| UNDER_REVIEW | Advisor approves | APPROVED |
| UNDER_REVIEW | Advisor rejects | REJECTED |
| REJECTED | Student edits and resubmits | To be confirmed |

## 4. Authorization

- Verify the user's identity before protected actions.
- Identify the user from a verified token, not from an ID supplied by the client.
- Check plan ownership for Student actions.
- Check advisor assignment before allowing review.
- Validate the current status before changing it.
- Prevent conflicting review decisions from being saved concurrently.
- Require a rejection reason if agreed by the team.

## 5. Items to Confirm

- Which roles are required?
- Who reviews a plan, and are there multiple review steps?
- When can a Student edit or resubmit a plan?
- What are the submission requirements and deadlines?
- Must the system keep a history of every review?
- What permissions does Admin need?

All workflow rules above are proposals until confirmed by the team.
