# @antidrift/mcp-aws

AWS MCP server for [antidrift](https://antidrift.io) — S3, Lambda, ECS, CloudWatch, SQS, and cost tracking from Claude Code, Codex, and other AI agents.

> **No API key needed** — uses your existing AWS CLI credentials. Zero dependencies. Works on macOS, Linux, and Windows.

## Setup

```bash
antidrift connect aws
```

### Prerequisites

1. [AWS CLI](https://aws.amazon.com/cli/) installed
2. Credentials configured via `aws configure`

The setup wizard verifies your CLI is installed, checks credentials via `aws sts get-caller-identity`, and detects your default region. No credentials are stored by antidrift — the connector calls the `aws` CLI directly.

## Tools (15)

### Identity (1)

| Tool | Description |
|---|---|
| `aws_whoami` | Show current AWS identity (account, ARN) |

### S3 (3)

| Tool | Description |
|---|---|
| `aws_s3_list_buckets` | List all buckets |
| `aws_s3_list_objects` | List objects in a bucket (with prefix/limit) |
| `aws_s3_get_object` | Read a text file from S3 |

### Lambda (3)

| Tool | Description |
|---|---|
| `aws_lambda_list_functions` | List functions |
| `aws_lambda_get_function` | Get function configuration |
| `aws_lambda_invoke` | Invoke a function |

### ECS (3)

| Tool | Description |
|---|---|
| `aws_ecs_list_clusters` | List clusters |
| `aws_ecs_list_services` | List services in a cluster |
| `aws_ecs_describe_service` | Service details (running/desired count, events) |

### CloudWatch Logs (2)

| Tool | Description |
|---|---|
| `aws_logs_list_groups` | List log groups |
| `aws_logs_tail` | Get recent log events from a log group |

### SQS (2)

| Tool | Description |
|---|---|
| `aws_sqs_list_queues` | List queues |
| `aws_sqs_get_queue_attributes` | Queue depth, messages in flight |

### Cost (1)

| Tool | Description |
|---|---|
| `aws_cost_today` | Today's estimated AWS cost |

## Platform support

```bash
antidrift connect aws                 # global install (default)
antidrift connect aws --cowork      # also register with Claude Desktop
antidrift connect aws --local           # local project only
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No credentials are stored by antidrift — the connector shells out to the `aws` CLI using your existing configuration. All inputs are sanitized and commands have a 30-second timeout.

## License

MIT — [antidrift.io](https://antidrift.io)
