# @antidrift/mcp-stripe

Stripe MCP server for [antidrift](https://antidrift.io) — customers, invoices, subscriptions, charges, products, and payment links from Claude Code, Codex, and other AI agents.

> **Heads up:** This connector can create invoices, modify customers, and cancel subscriptions. Use a restricted key with only the permissions you need. Never use this in a PCI-sensitive context or to process raw card numbers.

## Setup

```bash
antidrift connect stripe
```

You'll be prompted for your Stripe API key. Get one from [Stripe Dashboard > Developers > API keys](https://dashboard.stripe.com/apikeys).

Recommended restricted key permissions: Customers (read/write), Invoices (read/write), Products (read), Prices (read), Subscriptions (read/write), Charges (read), Balance (read), Payment Links (write).

Credentials are stored locally at `~/.antidrift/stripe.json`.

## Tools (17)

| Tool | Description |
|---|---|
| `stripe_list_customers` | List customers, optional email filter |
| `stripe_get_customer` | Get customer details by ID |
| `stripe_create_customer` | Create a new customer |
| `stripe_update_customer` | Update an existing customer |
| `stripe_list_products` | List active products |
| `stripe_list_prices` | List prices for a product |
| `stripe_create_invoice` | Create a draft invoice |
| `stripe_add_invoice_line` | Add a line item to a draft invoice |
| `stripe_finalize_invoice` | Finalize a draft invoice for payment |
| `stripe_list_invoices` | List invoices, optional customer/status filter |
| `stripe_send_invoice` | Send an invoice to the customer via email |
| `stripe_void_invoice` | Void an invoice |
| `stripe_list_subscriptions` | List subscriptions, optional customer/status filter |
| `stripe_cancel_subscription` | Cancel a subscription (at period end by default) |
| `stripe_get_balance` | Get the current account balance |
| `stripe_list_charges` | List charges, optional customer filter |
| `stripe_create_payment_link` | Create a payment link for a price |

## Platform support

```bash
antidrift connect stripe              # Claude Code (default)
antidrift connect stripe --cowork     # Claude Desktop / Cowork
antidrift connect stripe --all        # All detected platforms
```

## Privacy

Data accessed through this connector is sent to your AI model provider (Anthropic, OpenAI, etc.) as part of your conversation. No data is stored or sent to antidrift. Credentials are saved locally in `~/.antidrift/stripe.json`.

## License

MIT — [antidrift.io](https://antidrift.io)
