#!/usr/bin/env bash
set -euo pipefail

FOCUSPATH_REGION="${AWS_REGION:-eu-west-1}"
FOCUSPATH_PROFILE="${AWS_PROFILE:-}"
FOCUSPATH_STACK="${FOCUSPATH_STACK_NAME:-focuspath-api}"
FOCUSPATH_WAF_STACK="${FOCUSPATH_WAF_STACK_NAME:-focuspath-edge-security}"
FOCUSPATH_REPOSITORY="${FOCUSPATH_ECR_REPOSITORY:-focuspath-api}"
FOCUSPATH_ORIGIN="${FOCUSPATH_ALLOWED_ORIGIN:-https://damianociarla.github.io}"
FOCUSPATH_TAG="${FOCUSPATH_IMAGE_TAG:-$(git rev-parse --short HEAD)-$(date -u +%Y%m%d%H%M%S)}"
FOCUSPATH_BUDGET_EMAIL="${FOCUSPATH_BUDGET_ALERT_EMAIL:-}"
FOCUSPATH_ENABLE_WAF="${FOCUSPATH_ENABLE_WAF:-false}"
FOCUSPATH_TOKEN_FILE="${FOCUSPATH_ORIGIN_TOKEN_FILE:-infra/aws/.origin-verify-token}"
FOCUSPATH_ORIGIN_TOKEN="${FOCUSPATH_ORIGIN_VERIFY_TOKEN:-}"
FOCUSPATH_CFN_ROLE="${FOCUSPATH_CLOUDFORMATION_ROLE_ARN:-}"
FOCUSPATH_PROFILE_ARGS=()
if [[ -n "${FOCUSPATH_PROFILE}" ]]; then FOCUSPATH_PROFILE_ARGS=(--profile "${FOCUSPATH_PROFILE}"); fi
FOCUSPATH_AWS=(aws "${FOCUSPATH_PROFILE_ARGS[@]}" --region "${FOCUSPATH_REGION}")
FOCUSPATH_AWS_GLOBAL=(aws "${FOCUSPATH_PROFILE_ARGS[@]}" --region us-east-1)
FOCUSPATH_ACCOUNT="$("${FOCUSPATH_AWS[@]}" sts get-caller-identity --query Account --output text)"
FOCUSPATH_REGISTRY="${FOCUSPATH_ACCOUNT}.dkr.ecr.${FOCUSPATH_REGION}.amazonaws.com"
FOCUSPATH_IMAGE="${FOCUSPATH_REGISTRY}/${FOCUSPATH_REPOSITORY}:${FOCUSPATH_TAG}"

"${FOCUSPATH_AWS[@]}" ecr describe-repositories --repository-names "${FOCUSPATH_REPOSITORY}" >/dev/null 2>&1 \
  || "${FOCUSPATH_AWS[@]}" ecr create-repository --repository-name "${FOCUSPATH_REPOSITORY}" --image-tag-mutability IMMUTABLE --image-scanning-configuration scanOnPush=true >/dev/null

if [[ -n "${FOCUSPATH_ORIGIN_TOKEN}" ]]; then
  :
elif [[ -f "${FOCUSPATH_TOKEN_FILE}" ]]; then
  FOCUSPATH_ORIGIN_TOKEN="$(<"${FOCUSPATH_TOKEN_FILE}")"
else
  FOCUSPATH_ORIGIN_TOKEN="$(openssl rand -hex 32)"
  umask 077
  printf '%s' "${FOCUSPATH_ORIGIN_TOKEN}" > "${FOCUSPATH_TOKEN_FILE}"
fi

FOCUSPATH_CFN_ROLE_ARGS=()
if [[ -n "${FOCUSPATH_CFN_ROLE}" ]]; then FOCUSPATH_CFN_ROLE_ARGS=(--role-arn "${FOCUSPATH_CFN_ROLE}"); fi

"${FOCUSPATH_AWS[@]}" ecr get-login-password | docker login --username AWS --password-stdin "${FOCUSPATH_REGISTRY}"
docker build --platform linux/amd64 --tag "${FOCUSPATH_IMAGE}" .
docker push "${FOCUSPATH_IMAGE}"

FOCUSPATH_WEB_ACL_ARN=""
if [[ "${FOCUSPATH_ENABLE_WAF}" == "true" ]]; then
  "${FOCUSPATH_AWS_GLOBAL[@]}" cloudformation deploy \
    --stack-name "${FOCUSPATH_WAF_STACK}" \
    --template-file infra/aws/cloudfront-waf.yml
  FOCUSPATH_WEB_ACL_ARN="$("${FOCUSPATH_AWS_GLOBAL[@]}" cloudformation describe-stacks --stack-name "${FOCUSPATH_WAF_STACK}" --query "Stacks[0].Outputs[?OutputKey=='WebAclArn'].OutputValue" --output text)"
fi

"${FOCUSPATH_AWS[@]}" cloudformation deploy \
  --stack-name "${FOCUSPATH_STACK}" \
  --template-file infra/aws/apprunner.yml \
  --capabilities CAPABILITY_IAM \
  "${FOCUSPATH_CFN_ROLE_ARGS[@]}" \
  --parameter-overrides "ImageIdentifier=${FOCUSPATH_IMAGE}" "AllowedOrigin=${FOCUSPATH_ORIGIN}" "OriginVerifyToken=${FOCUSPATH_ORIGIN_TOKEN}" "BudgetAlertEmail=${FOCUSPATH_BUDGET_EMAIL}" "WebAclArn=${FOCUSPATH_WEB_ACL_ARN}"

FOCUSPATH_URL="$("${FOCUSPATH_AWS[@]}" cloudformation describe-stacks --stack-name "${FOCUSPATH_STACK}" --query "Stacks[0].Outputs[?OutputKey=='ProtectedApiUrl'].OutputValue" --output text)"
FOCUSPATH_DISTRIBUTION="$("${FOCUSPATH_AWS[@]}" cloudformation describe-stacks --stack-name "${FOCUSPATH_STACK}" --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)"
printf 'Protected FocusPath API: %s\n' "${FOCUSPATH_URL}"
printf 'CloudFront distribution: %s\n' "${FOCUSPATH_DISTRIBUTION}"
if [[ -n "${FOCUSPATH_WEB_ACL_ARN}" ]]; then
  printf 'WAF web ACL: %s\n' "${FOCUSPATH_WEB_ACL_ARN}"
  printf 'Enroll the distribution and WAF in a CloudFront flat-rate plan immediately.\n'
fi
printf 'Set VITE_API_URL to the protected URL.\n'
