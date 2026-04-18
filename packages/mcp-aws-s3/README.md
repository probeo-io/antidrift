# @antidrift/mcp-aws-s3

AWS S3 MCP server for [antidrift](https://antidrift.io) — manage buckets and objects from Claude Code, Codex, and other AI agents.

## Setup

```bash
antidrift connect aws-s3
```

You'll be prompted for your AWS access key ID and secret. Credentials are stored locally at `~/.antidrift/aws-s3.json`.

Required IAM permissions: `s3:ListAllMyBuckets`, `s3:ListBucket`, `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, `s3:CopyObject`, `s3:CreateBucket`, `s3:DeleteBucket`, and related `s3:Get*` config actions.

## Tools (12)

### Buckets (4)

| Tool | Description |
|---|---|
| `s3_list_buckets` | List all buckets in the account |
| `s3_create_bucket` | Create a new bucket |
| `s3_delete_bucket` | Delete an empty bucket |
| `s3_bucket_info` | Get bucket config — location, versioning, encryption, tags, lifecycle, CORS |

### Objects (7)

| Tool | Description |
|---|---|
| `s3_list_objects` | List objects in a bucket with optional prefix and pagination |
| `s3_get_object` | Read an object's content as text |
| `s3_put_object` | Upload text content to an object |
| `s3_delete_object` | Delete an object |
| `s3_copy_object` | Copy an object within or between buckets |
| `s3_head_object` | Get object metadata without downloading |
| `s3_presign` | Generate a presigned URL for GET or PUT |

### Search (1)

| Tool | Description |
|---|---|
| `s3_search` | Search for objects by key prefix, substring, or suffix |

## Platform support

```bash
antidrift connect aws-s3               # Claude Code (default)
antidrift connect aws-s3 --cowork      # Claude Desktop / Cowork
antidrift connect aws-s3 --all         # All detected platforms
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/aws-s3.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
