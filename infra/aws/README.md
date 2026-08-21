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

The script:

1. Creates an immutable, scan-on-push ECR repository if needed.
2. Builds the image for `linux/amd64` and pushes it to ECR.
3. Reuses a private origin token from the ignored `infra/aws/.origin-verify-token` file (mode `600`). Back this file up securely if infrastructure deployments run from another machine.
4. Deploys App Runner, its one-instance scaling cap and CloudFront with CloudFormation.
5. Prints the protected public API URL and CloudFront distribution ID.

To receive AWS Budget alerts at 80% forecast and 100% actual of the default $20 monthly budget:

```bash
FOCUSPATH_BUDGET_ALERT_EMAIL=you@example.com ./infra/aws/deploy-app-runner.sh
```

AWS sends a confirmation message to that address.

## CloudFront Free plan

After the first deployment, open the printed distribution in the CloudFront console and choose **Plans → Free**. AWS currently manages flat-rate plan enrollment outside this CloudFormation stack. The Free plan includes CloudFront, WAF/DDoS protection and bot management with no overage charges. Configure its WAF rate rule for `/v1/scans` at the lowest suitable threshold; the application still enforces stricter per-client, per-target and global quotas.

Do not publish or use the direct `*.awsapprunner.com` URL. It returns `404` for scans without CloudFront's private origin header.

Connect the GitHub Pages frontend:

```bash
gh variable set VITE_API_URL --repo damianociarla/focuspath --body "https://example.cloudfront.net"
gh workflow run pages.yml --repo damianociarla/focuspath
```

## Production hardening

The API restricts URLs, revalidates browser requests, runs as a non-root user, limits body size, scan duration, concurrency, network requests, expensive resource types, screenshot height and requests per client/target/hour. Before promoting it beyond beta:

- Keep the CloudFront Free plan WAF and bot protection enabled.
- Move rate limits to DynamoDB or another shared store before raising App Runner above one instance.
- Use SQS and isolated ECS Fargate tasks for scan execution.
- Restrict egress through a filtering proxy if scanning fully untrusted sites.
- Store reports in an S3 bucket with short expiry and server-side encryption.
- Add CloudWatch alarms for latency, errors, throttling and unexpected browser duration.
- Keep the App Runner instance role empty; the scanner does not need AWS credentials.

## Environment variables

| Variable | Default | Purpose |
|---|---:|---|
| `ALLOWED_ORIGINS` | FocusPath Pages + localhost | Comma-separated CORS allowlist |
| `MAX_CONCURRENT_SCANS` | `2` | Browser processes per API instance |
| `MAX_FOCUS_STEPS` | `50` | Maximum Tab presses |
| `SCAN_TIMEOUT_MS` | `25000` | Page navigation timeout |
| `RATE_LIMIT_PER_10_MINUTES` | `4` | In-memory beta limit per client |
| `GLOBAL_RATE_LIMIT_PER_HOUR` | `60` | Maximum accepted scans across the instance per hour |
| `TARGET_RATE_LIMIT_PER_HOUR` | `2` | Maximum scans of the same hostname per hour |
| `ORIGIN_VERIFY_TOKEN` | empty locally | Private CloudFront-to-App Runner header value |
