#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform"

for cmd in psql terraform aws node; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "error: '$cmd' not found on PATH" >&2
    exit 1
  }
done

: "${COOP_APPROVED_STUDENT_SUB:?Set approved student Cognito sub}"
: "${COOP_APPROVED_ADVISOR_SUB:?Set approved advisor Cognito sub}"
: "${COOP_APPROVED_STAFF_SUB:?Set approved staff Cognito sub}"
: "${COOP_APPROVED_ADMIN_SUB:?Set approved admin Cognito sub}"
# COM-1 is optional until #149 gives COMMITTEE something to do, so stacks
# seeded before #147 keep working without a fifth Cognito account.
COMMITTEE_SUB="${COOP_APPROVED_COMMITTEE_SUB:-}"
APPROVED_SUBS=("$COOP_APPROVED_STUDENT_SUB" "$COOP_APPROVED_ADVISOR_SUB" "$COOP_APPROVED_STAFF_SUB" "$COOP_APPROVED_ADMIN_SUB")
[ -n "$COMMITTEE_SUB" ] && APPROVED_SUBS+=("$COMMITTEE_SUB")
EXPECTED="${#APPROVED_SUBS[@]}"

if [ "$(printf '%s\n' "${APPROVED_SUBS[@]}" | sort -u | wc -l | tr -d ' ')" != "$EXPECTED" ]; then
  echo "error: approved subs must be $EXPECTED distinct values." >&2
  exit 1
fi

cd "$TF_DIR"
for key in cognito_user_pool_id rds_endpoint db_name db_username; do
  terraform output -raw "$key" >/dev/null || {
    echo "error: Terraform output '$key' unavailable; database unchanged." >&2
    exit 1
  }
done

POOL_ID="$(terraform output -raw cognito_user_pool_id)"
PGHOST="$(terraform output -raw rds_endpoint)"
PGDATABASE="$(terraform output -raw db_name)"
PGUSER="$(terraform output -raw db_username)"
[ -n "$POOL_ID" ] || { echo "error: empty Cognito pool ID." >&2; exit 1; }

if [ -z "${PGPASSWORD:-}" ]; then
  printf 'DB password for %s@%s: ' "$PGUSER" "$PGHOST" >&2
  read -rs PGPASSWORD
  printf '\n' >&2
fi
export PGPASSWORD PGCLIENTENCODING=UTF8
STUDENT_ID="${SEED_STUDENT_ID:-6600000001}"

psql_var() {
  local sql="$1"; shift
  psql -X -h "$PGHOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" \
    -v ON_ERROR_STOP=1 "$@" <<< "$sql"
}

if [ "$(psql_var "SELECT to_regclass('public.app_users') IS NOT NULL;" -tA)" != t ]; then
  echo "error: app_users missing; run npm run db:load first." >&2
  exit 1
fi
if [ "$(psql_var "SELECT EXISTS (SELECT 1 FROM students WHERE student_id=:'id');" -v id="$STUDENT_ID" -tA)" != t ]; then
  echo "error: student $STUDENT_ID missing." >&2
  exit 1
fi

# Resolve every approved immutable sub value before making any DB changes.
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
aws cognito-idp list-users --user-pool-id "$POOL_ID" --output json |
  COOP_APPROVED_STUDENT_SUB="$COOP_APPROVED_STUDENT_SUB" \
  COOP_APPROVED_ADVISOR_SUB="$COOP_APPROVED_ADVISOR_SUB" \
  COOP_APPROVED_STAFF_SUB="$COOP_APPROVED_STAFF_SUB" \
  COOP_APPROVED_ADMIN_SUB="$COOP_APPROVED_ADMIN_SUB" \
  COOP_APPROVED_COMMITTEE_SUB="$COMMITTEE_SUB" \
  node -e '
    let raw="";
    process.stdin.on("data", c => raw += c);
    process.stdin.on("end", () => {
      const wanted=[
        [process.env.COOP_APPROVED_STUDENT_SUB,"STUDENT"],
        [process.env.COOP_APPROVED_ADVISOR_SUB,"ADVISOR"],
        [process.env.COOP_APPROVED_STAFF_SUB,"STAFF"],
        [process.env.COOP_APPROVED_ADMIN_SUB,"ADMIN"]
      ];
      if (process.env.COOP_APPROVED_COMMITTEE_SUB) {
        wanted.push([process.env.COOP_APPROVED_COMMITTEE_SUB,"COMMITTEE"]);
      }
      const users=JSON.parse(raw).Users ?? [];
      const rows=[];
      for (const [sub,role] of wanted) {
        const u=users.find(x=>x.Attributes?.some(a=>a.Name==="sub" && a.Value===sub));
        const email=u?.Attributes?.find(a=>a.Name==="email")?.Value?.trim().toLowerCase();
        if (!u || !email) {
          console.error(`error: approved ${role} sub missing from this pool or has no email.`);
          process.exitCode=1; return;
        }
        rows.push({sub,email,role});
      }
      if (new Set(rows.map(x=>x.email)).size!==rows.length) {
        console.error("error: duplicate email attributes among approved users.");
        process.exitCode=1; return;
      }
      rows.forEach(x=>console.log(JSON.stringify(x)));
    });
  ' > "$TMP"

[ "$(wc -l < "$TMP" | tr -d ' ')" = "$EXPECTED" ] || {
  echo "error: $EXPECTED approved users were not validated; database unchanged." >&2
  exit 1
}

STUDENT_SUB="$COOP_APPROVED_STUDENT_SUB"
ADVISOR_SUB="$COOP_APPROVED_ADVISOR_SUB"
STAFF_SUB="$COOP_APPROVED_STAFF_SUB"
ADMIN_SUB="$COOP_APPROVED_ADMIN_SUB"

while IFS= read -r account; do
  SUB="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).sub)' "$account")"
  EMAIL="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).email)' "$account")"
  ROLE="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).role)' "$account")"

  if [ "$ROLE" = STUDENT ]; then
    LINK_SQL=":'student_id'"
    LINK_ARGS=(-v student_id="$STUDENT_ID")
  else
    LINK_SQL=NULL
    LINK_ARGS=()
  fi

  # Rekey a legacy row only after the new sub has been explicitly approved.
  # The migration below cascades this change to assignments and review history.
  psql_var "
    BEGIN;
    UPDATE app_users SET cognito_sub=:'sub'
    WHERE lower(email)=lower(:'email') AND cognito_sub <> :'sub'
      AND cognito_sub NOT IN (:'student_sub',:'advisor_sub',:'staff_sub',:'admin_sub',:'committee_sub');

    INSERT INTO app_users(cognito_sub,email,role,student_id,is_active)
    VALUES (:'sub',:'email',:'role',$LINK_SQL,TRUE)
    ON CONFLICT(cognito_sub) DO UPDATE SET
      email=EXCLUDED.email, role=EXCLUDED.role,
      student_id=EXCLUDED.student_id, is_active=TRUE;
    COMMIT;
  " -v sub="$SUB" -v email="$EMAIL" -v role="$ROLE" \
    -v student_sub="$STUDENT_SUB" -v advisor_sub="$ADVISOR_SUB" \
    -v staff_sub="$STAFF_SUB" -v admin_sub="$ADMIN_SUB" \
    -v committee_sub="$COMMITTEE_SUB" "${LINK_ARGS[@]}" >/dev/null

  if [ "$ROLE" = ADVISOR ]; then
    psql_var "
      INSERT INTO advisor_student_assignments(advisor_sub,student_id)
      VALUES (:'sub',:'student_id') ON CONFLICT DO NOTHING;
    " -v sub="$SUB" -v student_id="$STUDENT_ID" >/dev/null
  fi
  echo "upserted approved role: $ROLE"
done < "$TMP"

# Deactivate by immutable identity, never by mutable email.
psql_var "
  UPDATE app_users SET is_active=FALSE
  WHERE cognito_sub NOT IN (:'student_sub',:'advisor_sub',:'staff_sub',:'admin_sub',:'committee_sub')
    AND is_active=TRUE;
" -v student_sub="$STUDENT_SUB" -v advisor_sub="$ADVISOR_SUB" \
  -v staff_sub="$STAFF_SUB" -v admin_sub="$ADMIN_SUB" \
  -v committee_sub="$COMMITTEE_SUB" >/dev/null

psql -X -h "$PGHOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" \
  -v ON_ERROR_STOP=1 \
  -c "SELECT role,email,student_id,is_active FROM app_users ORDER BY role;"
