---
name: connect
description: Connect external services (Google Workspace, Stripe, Attio) to your brain via MCP
---

Help the user connect external services to their brain. Each service is a separate npm package that installs independently.

## Available Services

| Service | Package | What It Adds |
|---|---|---|
| Google Workspace | `@antidrift/mcp-google` | Sheets, Docs, Drive, Gmail, Calendar |
| Stripe | `@antidrift/mcp-stripe` | Invoices, customers, products |
| Attio CRM | `@antidrift/mcp-attio` | People, companies, deals, notes |

## Instructions

### Step 1 — Check what's already connected

Look for a `.mcp.json` file in the current directory. If it exists, read it and show which services are already configured.

Also check `~/.antidrift/` for credential files:
- `google-token.json` → Google is connected
- `stripe.json` → Stripe is connected
- `attio.json` → Attio is connected

Show the user what's connected and what's available:

```
Connected:
  ✓ Google Workspace (Sheets, Docs, Drive, Gmail, Calendar)

Available:
  ○ Stripe — invoices, customers, products
  ○ Attio CRM — people, companies, deals, notes
```

### Step 2 — Ask what they want to connect

Ask: "What would you like to connect?"

### Step 3 — Install and set up

For each service, run the install and setup:

**Google Workspace:**
```bash
npm install @antidrift/mcp-google
npx @antidrift/mcp-google
```
This will walk them through the Google OAuth flow. They need a Google Cloud project with OAuth credentials.

**Stripe:**
```bash
npm install @antidrift/mcp-stripe
npx @antidrift/mcp-stripe
```
This will ask for their Stripe API key (starts with `sk_`).

**Attio:**
```bash
npm install @antidrift/mcp-attio
npx @antidrift/mcp-attio
```
This will ask for their Attio API key.

### Step 4 — Confirm

After setup, tell them to restart Claude Code for the new tools to be available. Then show what they can now do:

- **Google:** "You can now say things like 'read the Q1 revenue sheet' or 'send an email to Sarah' or 'create a meeting for Thursday at 2pm'"
- **Stripe:** "You can now say 'create an invoice for Acme Corp' or 'list all customers'"
- **Attio:** "You can now say 'find all deals in pipeline' or 'add a note to the Acme account'"
