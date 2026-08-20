# AWS deployment

The beta deployment uses one Docker image on AWS App Runner. The same image can later run as an ECS Fargate service or one task per queued scan.

## Why App Runner first

- Managed HTTPS endpoint and health checks
- Deploys the exact Playwright container tested locally
- No Lambda browser packaging or API Gateway's 30-second HTTP API timeout
- Can be protected by AWS WAF without changing the application

For a larger public service, move scan execution to SQS + one ECS Fargate task per job. Fargate provides a dedicated, hardware-virtualized environment for every task and avoids keeping untrusted browsing work in the API process.

## Deploy

Requirements: AWS CLI authenticated, Docker running, and permission to manage ECR, CloudFormation, IAM and App Runner.

```bash
AWS_REGION=eu-west-1 ./infra/aws/deploy-app-runner.sh
```

The script:

1. Creates an immutable, scan-on-push ECR repository if needed.
2. Builds the image for `linux/amd64` and pushes it to ECR.
3. Deploys the App Runner service with CloudFormation.
4. Prints the public API URL.

Connect the GitHub Pages frontend:

```bash
gh variable set VITE_API_URL --repo damianociarla/focuspath --body "https://example.eu-west-1.awsapprunner.com"
gh workflow run pages.yml --repo damianociarla/focuspath
```

## Production hardening

The API already restricts URLs, revalidates browser requests, runs as a non-root user, limits body size, scan duration, concurrency and requests per client. Before promoting it beyond beta:

- Associate an AWS WAF web ACL with rate-based and managed bot-control rules.
- Move rate limits to DynamoDB or another shared store before scaling past one instance.
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
