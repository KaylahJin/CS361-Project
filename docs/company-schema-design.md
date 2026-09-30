# Company Schema — Issue #24

`companies` table, defined in `infra/schema.sql`. Sample data: `infra/seed.sql` (81 real companies).

## Fields

| Field | Type | Required? | Used for |
|---|---|---|---|
| `company_id` | text (e.g. `C01`) | **Yes — PK** | Unique ID, links to `positions` table later |
| `name` | text | Yes | Display + **Search** |
| `province` | text | Yes | Display + **Filter** |
| `location` | text | Yes | Display (full address) |
| `short_name` | text | No | Display (from V1 data) |
| `description` | text | No | Reserved, not filled yet |
| `logo_filename` | text | No | Display (from V1 data) |
| `url` | text | No | Display (company website link) |
| `created_at` | timestamp | auto | Internal only |

## Search & Filter

- **Search box** → `name` (trigram index, handles partial/fuzzy match)
- **Province dropdown** → `province` (regular index, exact match)

Nothing else is searchable/filterable in V2 scope.

## Why fields beyond V2.md's ERD

V2.md's diagram lists just `company_id, name, province, location, description`. Added `short_name`, `logo_filename`, `url` because the existing Employers page (V1) already displays those per company — dropping them would break that page. V2.md itself says exact physical fields get finalized here, not in the diagram.

## Sample data

`infra/seed.sql` — 81 real companies from the official 2568 registry. 2 of them (`C19`, `C88`) are brand new, so their `short_name`/`logo_filename`/`url` are empty — expected, not a bug.
