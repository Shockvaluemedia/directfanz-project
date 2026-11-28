#!/usr/bin/env bash
# Opens a temporary tunnel from this machine to the private RDS database, for
# the move-day data copy (docs/migration/DATABASE_COPY.md, "A route to RDS").
#
#   infra/aws/scripts/db-tunnel.sh [minutes]      # default 120, max set in Terraform
#
# While it runs, Postgres answers on 127.0.0.1:${LOCAL_PORT:-5432}. Ctrl-C (or
# the time running out) closes the tunnel and stops the task. Nothing stays
# open afterwards.
#
# Needs: aws CLI v2 with the Session Manager plugin, terraform (run from a
# checkout initialised against the real state), and jq. Uses the caller's own
# AWS login; it prints no password and reads no secret.
set -euo pipefail

MINUTES="${1:-120}"
LOCAL_PORT="${LOCAL_PORT:-5432}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"

for bin in aws terraform jq session-manager-plugin; do
  command -v "$bin" >/dev/null || { echo "Missing $bin" >&2; exit 1; }
done
[[ "$MINUTES" =~ ^[0-9]+$ ]] && (( MINUTES >= 5 )) || { echo "Minutes must be a whole number, 5 or more" >&2; exit 1; }

out() { terraform -chdir="$HERE" output -json | jq -r "$1"; }
CLUSTER="$(out .ecs_cluster_name.value)"
FAMILY="$(out .db_access_task_definition_family.value)"
SG="$(out .db_access_security_group_id.value)"
SUBNETS="$(out '.app_subnet_ids.value | join(",")')"
DB_HOST="$(out .db_address.value)"
export AWS_REGION="$(out .aws_region.value)"
MAX_SECONDS="$(out .db_access_max_seconds.value)"
(( MINUTES * 60 <= MAX_SECONDS )) || { echo "At most $((MAX_SECONDS / 60)) minutes (db_access_max_seconds)" >&2; exit 1; }

TASK_ARN=""
cleanup() {
  if [[ -n "$TASK_ARN" ]]; then
    echo "Stopping tunnel task..."
    aws ecs stop-task --cluster "$CLUSTER" --task "$TASK_ARN" --reason "db-tunnel closed" >/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

overrides="$(jq -nc --arg s "$((MINUTES * 60))" '{containerOverrides: [{name: "tunnel", command: ["sleep", $s]}]}')"
TASK_ARN="$(aws ecs run-task --cluster "$CLUSTER" --task-definition "$FAMILY" \
  --launch-type FARGATE --count 1 --enable-execute-command \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=ENABLED}" \
  --overrides "$overrides" --started-by "db-tunnel" \
  --query 'tasks[0].taskArn' --output text)"
echo "Started $TASK_ARN (stops itself after $MINUTES minutes)"

aws ecs wait tasks-running --cluster "$CLUSTER" --tasks "$TASK_ARN"

# ECS Exec's agent comes up a little after the task does.
agent=""
RUNTIME_ID=""
for _ in $(seq 1 40); do
  read -r agent RUNTIME_ID < <(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" \
    --query "tasks[0].containers[?name=='tunnel'] | [0].[managedAgents[?name=='ExecuteCommandAgent'] | [0].lastStatus, runtimeId]" \
    --output text)
  [[ "$agent" == "RUNNING" ]] && break
  sleep 3
done
[[ "$agent" == "RUNNING" ]] || { echo "ECS Exec agent didn't start" >&2; exit 1; }

TARGET="ecs:${CLUSTER}_${TASK_ARN##*/}_${RUNTIME_ID}"
echo "Tunnel open: Postgres on 127.0.0.1:${LOCAL_PORT}. Ctrl-C to close."
aws ssm start-session --target "$TARGET" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "$(jq -nc --arg h "$DB_HOST" --arg l "$LOCAL_PORT" \
    '{host: [$h], portNumber: ["5432"], localPortNumber: [$l]}')"
