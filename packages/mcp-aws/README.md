# @antidrift/mcp-aws

AWS connector for [antidrift](https://antidrift.io) — access AWS services from Claude, Codex, and other AI agents via MCP.

**No API key needed** — uses your existing AWS CLI credentials.

## Prerequisites

1. **AWS CLI** installed: https://aws.amazon.com/cli/
2. **AWS CLI configured**: run `aws configure` to set up credentials and default region

## Setup

```bash
npx antidrift connect aws
```

The setup wizard will:
- Verify `aws` CLI is installed
- Check your credentials via `aws sts get-caller-identity`
- Detect or ask for your default region
- Write the MCP server config

## Tools

| Tool | Description |
|------|-------------|
| `aws_whoami` | Show current AWS identity (account, ARN) |
| `aws_s3_list_buckets` | List all S3 buckets |
| `aws_s3_list_objects` | List objects in a bucket (with prefix/limit) |
| `aws_s3_get_object` | Read a text file from S3 |
| `aws_lambda_list_functions` | List Lambda functions |
| `aws_lambda_get_function` | Get Lambda function configuration |
| `aws_lambda_invoke` | Invoke a Lambda function |
| `aws_ecs_list_clusters` | List ECS clusters |
| `aws_ecs_list_services` | List services in a cluster |
| `aws_ecs_describe_service` | Service details (running/desired count, events) |
| `aws_logs_list_groups` | List CloudWatch log groups |
| `aws_logs_tail` | Get recent log events from a log group |
| `aws_sqs_list_queues` | List SQS queues |
| `aws_sqs_get_queue_attributes` | Queue depth, messages in flight |
| `aws_cost_today` | Today's estimated AWS cost |

## Privacy

By installing this connector, you acknowledge that data accessed through it will be sent to your AI model provider (Anthropic, OpenAI, Google, etc.) as part of your conversation.

No credentials are stored by antidrift — the connector shells out to the `aws` CLI which uses your existing AWS configuration.

## How it works

This connector has **zero dependencies**. It uses Node.js `child_process.execSync` to call the `aws` CLI with `--output json`. All user inputs are sanitized before being passed to the shell. Commands have a 30-second timeout.

---

[antidrift.io](https://antidrift.io) — Built by [Probeo.io](https://probeo.io)
