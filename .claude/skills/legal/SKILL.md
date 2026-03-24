---
name: legal
description: Generate legal documents (NDA, subscription agreement, demo agreement, PSA, order form) from templates with customer details filled in.
argument-hint: <document-type> [customer-name]
---

Generates legal documents from templates. Available documents:

- **nda** — Mutual Non-Disclosure Agreement
- **subscription** — Master Subscription Agreement
- **demo** — Demo/Trial Agreement (configurable days)
- **psa** — Professional Services Agreement
- **order-form** — Subscription Order Form (Exhibit A)

## Instructions

### Step 1 — What document?

Check `$ARGUMENTS` for the document type. If not provided, ask:
"What document do you need? (nda, subscription, demo, psa, order-form)"

### Step 2 — Gather details

Read the template from `packs/legal/templates/<type>.md` in the brain.

Look for all `{{VARIABLE}}` placeholders. Check the brain for existing info:
- Company details: check root CLAUDE.md, finance/CLAUDE.md
- Customer details: check customers/<name>/CLAUDE.md

Ask the user for anything not found. Ask one question at a time.

Common variables:
- `{{EFFECTIVE_DATE}}` — today's date unless specified
- `{{COMPANY_LEGAL_NAME}}` — from brain
- `{{COMPANY_SHORT_NAME}}` — from brain
- `{{COMPANY_STATE}}` — from brain
- `{{COMPANY_ENTITY_TYPE}}` — from brain
- `{{CUSTOMER_LEGAL_NAME}}` — ask or check customers/
- `{{CUSTOMER_STATE}}` — ask
- `{{CUSTOMER_ENTITY_TYPE}}` — ask
- `{{GOVERNING_STATE}}` — default to company state
- `{{TERM_LENGTH}}` — ask (default 12)
- `{{MONTHLY_FEE}}` — ask or check customers/
- `{{DEMO_DAYS}}` — ask (default 60)

### Step 3 — Generate

Replace all placeholders with gathered values. Output the completed document.

### Step 4 — Save

Save to `customers/<name>/agreements/<type>-<date>.md`. Create the directory if needed.

### Step 5 — Google Docs

If Google Drive MCP is connected, offer to create a Google Doc for sharing/signatures.
