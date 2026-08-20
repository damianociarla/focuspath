#!/usr/bin/env bash
set -euo pipefail

FOCUSPATH_REGION="${AWS_REGION:-eu-west-1}"
FOCUSPATH_STACK="${FOCUSPATH_STACK_NAME:-focuspath-api}"
FOCUSPATH_REPOSITORY="${FOCUSPATH_ECR_REPOSITORY:-focuspath-api}"
FOCUSPATH_ORIGIN="${FOCUSPATH_ALLOWED_ORIGIN:-https://damianociarla.github.io}"
FOCUSPATH_TAG="${FOCUSPATH_IMAGE_TAG:-$(git rev-parse --short HEAD)}"
FOCUSPATH_ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
FOCUSPATH_REGISTRY="${FOCUSPATH_ACCOUNT}.dkr.ecr.${FOCUSPATH_REGION}.amazonaws.com"
FOCUSPATH_IMAGE="${FOCUSPATH_REGISTRY}/${FOCUSPATH_REPOSITORY}:${FOCUSPATH_TAG}"

aws ecr describe-repositories --repository-names "${FOCUSPATH_REPOSITORY}" --region "${FOCUSPATH_REGION}" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "${FOCUSPATH_REPOSITORY}" --image-tag-mutability IMMUTABLE --image-scanning-configuration scanOnPush=true --region "${FOCUSPATH_REGION}" >/dev/null

aws ecr get-login-password --region "${FOCUSPATH_REGION}" | docker login --username AWS --password-stdin "${FOCUSPATH_REGISTRY}"
docker build --platform linux/amd64 --tag "${FOCUSPATH_IMAGE}" .
docker push "${FOCUSPATH_IMAGE}"

aws cloudformation deploy \
  --region "${FOCUSPATH_REGION}" \
  --stack-name "${FOCUSPATH_STACK}" \
  --template-file infra/aws/apprunner.yml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides "ImageIdentifier=${FOCUSPATH_IMAGE}" "AllowedOrigin=${FOCUSPATH_ORIGIN}"

FOCUSPATH_URL="$(aws cloudformation describe-stacks --region "${FOCUSPATH_REGION}" --stack-name "${FOCUSPATH_STACK}" --query "Stacks[0].Outputs[?OutputKey=='ServiceUrl'].OutputValue" --output text)"
printf 'FocusPath API: %s\n' "${FOCUSPATH_URL}"
printf 'Set the GitHub Actions variable VITE_API_URL to this value, then redeploy Pages.\n'
