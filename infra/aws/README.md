# AWS deployment

The beta deployment uses one Docker image on AWS App Runner behind CloudFront. The same image can later run as an ECS Fargate service or one task per queued scan.

## Why App Runner first

- Managed HTTPS endpoint and health checks
- Deploys the exact Playwright container tested locally
- No Lambda browser packaging or API Gateway's 30-second HTTP API timeout
- CloudFront is the only usable scan entry point; direct App Runner requests do not have the private origin header
- App Runner is capped at one instance to put a hard ceiling on compute scale-out

For a larger public service, move scan execution to SQS + one ECS Fargate task per job. Fargate provides a dedicated, hardware-virtualized environment for every task and avoids keeping untrusted browsing work in the API process.

## Deploy

Requirements: AWS CLI authenticated, Docker running, and permission to manage ECR, CloudFormation, IAM and App Runner.

```bash
AWS_PROFILE=portfolio-bootstrap AWS_REGION=eu-west-1 ./infra/aws/deploy-app-runner.sh
```

## Release automation

Tagged releases use GitHub OIDC—without long-lived AWS keys—to validate the release, deploy and health-check the reversible API, publish npm, and only then publish GitHub Pages and the GitHub Release. Bootstrap the roles once:

```bash
aws cloudformation deploy --profile portfolio-bootstrap --region eu-west-1 \
  --stack-name focuspath-github-deploy \
  --template-file infra/aws/github-deploy-role.yml \
  --capabilities CAPABILITY_NAMED_IAM
```

If the account already has the account-level GitHub Actions OIDC provider, reuse it:

```bash
aws cloudformation deploy --profile portfolio-bootstrap --region eu-west-1 \
  --stack-name focuspath-github-deploy \
  --template-file infra/aws/github-deploy-role.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ExistingGitHubOidcProviderArn=arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com
```

Configure repository variables `AWS_DEPLOY_ROLE_ARN`, `AWS_CLOUDFORMATION_ROLE_ARN`, `AWS_ACCOUNT_ID`, and the repository secret `FOCUSPATH_ORIGIN_VERIFY_TOKEN` from the stack outputs and the existing ignored origin-token file. The trust policy accepts only version tags from `damianociarla/focuspath` and uses GitHub's immutable owner and repository IDs. Override `GitHubOwnerId` and `GitHubRepositoryId` when reusing this template for another repository.

Verify the repository OIDC subject configuration before changing the AWS trust policy:

```bash
gh api repos/damianociarla/focuspath/actions/oidc/customization/sub
```

Repositories created after GitHub's immutable-subject rollout already emit the ID-based prefix. Make that intent explicit without changing the current subject format:

```bash
gh api --method PUT repos/damianociarla/focuspath/actions/oidc/customization/sub \
  -F use_default=true \
  -F use_immutable_subject=true
```

To roll back an OIDC customization, first deploy an AWS trust policy that accepts both the current and intended rollback subjects, verify assumption from a tag-bound job, and only then change the GitHub setting. Never change GitHub and AWS trust in the opposite order.

The CloudFormation execution role can manage only the explicit `ApplicationRoleName`, FocusPath App Runner resources, the known CloudFront distribution and origin policy, and the FocusPath budget. The application role has a managed permission boundary that caps it to read-only access to the FocusPath ECR repository even if an inline policy is changed. The default preserves the physical role already owned by the production stack, avoiding an App Runner service replacement. If the application stack is recreated, read the new `AppRunnerEcrAccessRole` physical ID with `aws cloudformation describe-stack-resources` and redeploy the bootstrap stack with `ApplicationRoleName=<physical-id>` before the next application update.

## Release recovery

Every release step is idempotent: an existing immutable ECR tag is reused, an npm version is accepted only when its `gitHead` matches the release commit, Pages may be redeployed, and an existing GitHub Release is retained. Retry a failed release from its existing tag:

```bash
gh workflow run release.yml --repo damianociarla/focuspath --ref main -f tag=v0.6.0
```

The AWS deploy job intentionally keeps the tag-based OIDC subject instead of attaching a GitHub environment, because the default environment subject would replace the tag ref in `sub`. Protected `v*` tags and `main` gate who can reach the tag-bound AWS trust.

The script:

1. Creates an immutable, scan-on-push ECR repository if needed.
2. Reuses an existing immutable release image or builds it for `linux/amd64` and pushes it to ECR.
3. Reuses a private origin token from the ignored `infra/aws/.origin-verify-token` file (mode `600`). Back this file up securely if infrastructure deployments run from another machine.
4. Optionally deploys the global WAF stack in `us-east-1` when `FOCUSPATH_ENABLE_WAF=true`.
5. Deploys App Runner, its one-instance scaling cap and CloudFront with CloudFormation.
6. Prints the protected API URL and distribution ID.

To receive AWS Budget alerts at 80% forecast and 100% actual of the default $20 monthly budget:

```bash
FOCUSPATH_BUDGET_ALERT_EMAIL=you@example.com ./infra/aws/deploy-app-runner.sh
```

AWS sends a confirmation message to that address.

## CloudFront Free plan

AWS accounts still using the AWS Free Tier are not eligible for CloudFront flat-rate plans. For those accounts, leave WAF disabled to avoid its pay-as-you-go base charge; CloudFront, the one-instance cap and application quotas remain active.

Once the account is eligible, deploy and immediately enroll the printed distribution and WAF web ACL in **Plans → Free** in the CloudFront console:

```bash
FOCUSPATH_ENABLE_WAF=true ./infra/aws/deploy-app-runner.sh
```

Pricing-plan subscriptions are managed outside CloudFormation. The WAF stack blocks clients above 10 requests per minute on `/v1/scans`; the application also enforces stricter per-client, per-target and global quotas.

Do not publish or use the direct `*.awsapprunner.com` URL. It returns `404` for scans without CloudFront's private origin header.

Connect the GitHub Pages frontend:

```bash
gh variable set VITE_API_URL --repo damianociarla/focuspath --body "https://example.cloudfront.net"
gh workflow run pages.yml --repo damianociarla/focuspath
```

## Production hardening

The API restricts URLs, pins browser connections to DNS-validated public IPs through a loopback egress proxy, runs as a non-root user, limits body size, scan duration, concurrency, network requests, expensive resource types, screenshot height and requests per client/target/hour. Before promoting it beyond beta:

- Keep the CloudFront Free plan WAF and bot protection enabled.
- Move rate limits to DynamoDB or another shared store before raising App Runner above one instance.
- Use SQS and isolated ECS Fargate tasks for scan execution.
- Add infrastructure-enforced egress filtering as defense in depth for fully untrusted, general-purpose scanning.
- Store reports in an S3 bucket with short expiry and server-side encryption.
- Add CloudWatch alarms for latency, errors, throttling and unexpected browser duration.
- Keep the App Runner instance role empty; the scanner does not need AWS credentials.

## Environment variables

| Variable | Default | Purpose |
|---|---:|---|
| `ALLOWED_ORIGINS` | FocusPath Pages + localhost | Comma-separated CORS allowlist |
| `MAX_CONCURRENT_SCANS` | `2` | Browser processes per API instance |
| `MAX_FOCUS_STEPS` | `50` | Maximum observable focus stops recorded |
| `MAX_TAB_PRESSES` | `200` | Maximum total Tab presses, including opaque hosts |
| `MAX_OPAQUE_TAB_PRESSES` | `100` | Maximum repeated Tab presses within one opaque host |
| `SCAN_TIMEOUT_MS` | `25000` | Page navigation timeout |
| `RATE_LIMIT_PER_10_MINUTES` | `4` | In-memory beta limit per client |
| `GLOBAL_RATE_LIMIT_PER_HOUR` | `60` | Maximum accepted scans across the instance per hour |
| `TARGET_RATE_LIMIT_PER_HOUR` | `2` | Maximum scans of the same hostname per hour |
| `PREFLIGHT_RATE_LIMIT_PER_MINUTE` | `12` | URL/DNS validation attempts per client before scan admission |
| `PREFLIGHT_GLOBAL_RATE_LIMIT_PER_MINUTE` | `120` | Global URL/DNS validation attempts before scan admission |
| `ORIGIN_VERIFY_TOKEN` | empty locally | Private CloudFront-to-App Runner header value |
