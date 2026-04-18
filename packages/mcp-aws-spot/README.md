# @antidrift/mcp-aws-spot

AWS Spot Instance MCP server for [antidrift](https://antidrift.io) — query spot prices, compare regions and availability zones, and find the cheapest instances for your workload from Claude Code, Codex, and other AI agents.

## Setup

```bash
antidrift connect aws-spot
```

You'll be prompted for your AWS access key ID and secret. Credentials are stored locally at `~/.antidrift/aws-spot.json`.

Required IAM permissions: `ec2:DescribeSpotPriceHistory`, `ec2:DescribeAvailabilityZones`, `ec2:DescribeInstanceTypes`, `ec2:GetSpotPlacementScores`.

## Tools (6)

| Tool | Description |
|---|---|
| `spot_prices` | Get current spot prices for instance types in a region |
| `spot_cheapest` | Find the cheapest instances matching CPU/memory requirements |
| `spot_compare_azs` | Compare spot prices across availability zones in a region |
| `spot_compare_regions` | Compare spot prices for an instance type across multiple regions |
| `spot_list_azs` | List availability zones in a region with their state |
| `spot_placement_scores` | Get fulfillment likelihood scores (1–10) for spot requests |

## Platform support

```bash
antidrift connect aws-spot               # Claude Code (default)
antidrift connect aws-spot --cowork      # Claude Desktop / Cowork
antidrift connect aws-spot --all         # All detected platforms
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/aws-spot.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
