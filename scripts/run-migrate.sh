#!/usr/bin/env bash
# run-migrate.sh — invoke the Migration ECS task against floci and wait for it.
# Exits non-zero if the task's container exits with a non-zero stop code.
set -euo pipefail

ENDPOINT="http://localhost:4566"
REGION="us-east-1"
COMPUTE_STACK="FastSpec-Compute-local"

AWS="aws --endpoint-url $ENDPOINT --region $REGION"
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=$REGION

echo "→ Resolving cluster and task definition from CloudFormation…"

CLUSTER_ARN=$($AWS cloudformation describe-stack-resource \
  --stack-name "$COMPUTE_STACK" \
  --logical-resource-id Cluster \
  --query 'StackResourceDetail.PhysicalResourceId' \
  --output text)

MIGRATE_TASK_DEF=$($AWS cloudformation describe-stack-resource \
  --stack-name "$COMPUTE_STACK" \
  --logical-resource-id MigrateTaskDef \
  --query 'StackResourceDetail.PhysicalResourceId' \
  --output text)

# Resolve the VPC subnets so we can pass a network configuration.
# We pick the first public subnet from the VPC created by DataStack or ComputeStack.
SUBNETS=$($AWS ec2 describe-subnets \
  --filters "Name=tag:aws:cloudformation:stack-name,Values=$COMPUTE_STACK" \
  --query 'Subnets[*].SubnetId' \
  --output text | tr '\t' ',')

echo "  cluster  : $CLUSTER_ARN"
echo "  task def : $MIGRATE_TASK_DEF"
echo "  subnets  : $SUBNETS"

echo "→ Starting migration task…"
TASK_ARN=$($AWS ecs run-task \
  --cluster "$CLUSTER_ARN" \
  --task-definition "$MIGRATE_TASK_DEF" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],assignPublicIp=ENABLED}" \
  --query 'tasks[0].taskArn' \
  --output text)

echo "  task ARN : $TASK_ARN"

echo "→ Waiting for task to stop…"
$AWS ecs wait tasks-stopped \
  --cluster "$CLUSTER_ARN" \
  --tasks "$TASK_ARN"

echo "→ Checking exit code…"
STOP_CODE=$($AWS ecs describe-tasks \
  --cluster "$CLUSTER_ARN" \
  --tasks "$TASK_ARN" \
  --query 'tasks[0].containers[0].exitCode' \
  --output text)

if [ "$STOP_CODE" != "0" ] && [ "$STOP_CODE" != "None" ]; then
  echo "✗ Migration task failed with exit code $STOP_CODE" >&2
  exit 1
fi

echo "✓ Migration task completed successfully (exit code: $STOP_CODE)"
