# @antidrift/mcp-stripe

Stripe MCP server for antidrift. Gives your AI agent live access to customers, invoices, subscriptions, charges, products, and payment links.

**Important:** This connector uses the Stripe API with your secret key. It can create invoices, modify customers, and cancel subscriptions. Use a restricted key with only the permissions you need. Never use this in a PCI-sensitive context or to process raw card numbers.

## Install

```bash
antidrift connect stripe
```

You will be prompted for your Stripe API key. The key is stored at `~/.antidrift/stripe.json`.

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
| `stripe_get_balance` | Get the current Stripe account balance |
| `stripe_list_charges` | List charges, optional customer filter |
| `stripe_create_payment_link` | Create a payment link for a price |

## Auth

Provide a Stripe secret key or restricted key. Get one from [Stripe Dashboard > Developers > API keys](https://dashboard.stripe.com/apikeys).

Recommended restricted key permissions: Customers (read/write), Invoices (read/write), Products (read), Prices (read), Subscriptions (read/write), Charges (read), Balance (read), Payment Links (write).

## Platform support

```bash
antidrift connect stripe                # Claude Code (default)
antidrift connect stripe --cowork       # Claude Cowork / Desktop
antidrift connect stripe --all          # All detected platforms
```

## Learn more

[antidrift.io](https://antidrift.io)
