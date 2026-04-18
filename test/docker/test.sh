#!/bin/bash
set -e

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "── $1 ──"; }

# ─── Setup: pre-seed all credential files ─────────────────────────────────────
mkdir -p ~/.antidrift

# Simple REST connectors
echo '{"token":"ghp_test_fake_token_for_docker_test"}' > ~/.antidrift/github.json
echo '{"apiKey":"lin_test_fake_linear_key"}' > ~/.antidrift/linear.json
echo '{"token":"att_test_fake_attio_key"}' > ~/.antidrift/attio.json
echo '{"token":"fake_clickup_token"}' > ~/.antidrift/clickup.json
echo '{"token":"fake_cloudflare_token"}' > ~/.antidrift/cloudflare.json
echo '{"token":"fake_vercel_token"}' > ~/.antidrift/vercel.json
echo '{"token":"fake_netlify_token"}' > ~/.antidrift/netlify.json
echo '{"token":"fake_pipedrive_token"}' > ~/.antidrift/pipedrive.json
echo '{"accessToken":"fake_hubspot_token"}' > ~/.antidrift/hubspot.json
echo '{"accessToken":"fake_hubspot_token"}' > ~/.antidrift/hubspot-crm.json
echo '{"accessToken":"fake_hubspot_token"}' > ~/.antidrift/hubspot-marketing.json
echo '{"domain":"test.atlassian.net","email":"test@test.com","token":"fake_jira_token"}' > ~/.antidrift/jira.json
echo '{"token":"fake_notion_token"}' > ~/.antidrift/notion.json
echo '{"apiKey":"sk_test_fake_stripe_key"}' > ~/.antidrift/stripe.json

# AWS connectors (tools use credentials.region, setup uses aws CLI)
echo '{"region":"us-east-1"}' > ~/.antidrift/aws.json
echo '{"region":"us-east-1"}' > ~/.antidrift/aws-s3.json
echo '{"region":"us-east-1"}' > ~/.antidrift/aws-spot.json

# Google connectors (token.json gates auth flow; google.json used by zeromcp)
mkdir -p ~/.antidrift/credentials/google
echo '{"access_token":"fake_token","token_type":"Bearer","expiry_date":9999999999999}' \
    > ~/.antidrift/credentials/google/token.json
echo '{"installed":{"client_id":"fake","client_secret":"fake","redirect_uris":["http://localhost"]}}' \
    > ~/.antidrift/credentials/google/client.json
echo '{"access_token":"fake_token","token_type":"Bearer"}' > ~/.antidrift/google.json

# Pre-register zeromcp in ~/.claude/settings.json (simulates installZeroMcp)
# so we can also test that init skips re-installing it
mkdir -p ~/.claude
ZEROMCP_BIN="$HOME/.antidrift/mcp-server/node_modules/@antidrift/zeromcp/bin/mcp.js"
ZERO_CONFIG="$HOME/.antidrift/zeromcp.config.json"
cat > ~/.claude/settings.json <<EOF
{
  "mcpServers": {
    "antidrift-zeromcp-server": {
      "command": "node",
      "args": ["$ZEROMCP_BIN", "serve", "--config", "$ZERO_CONFIG"]
    }
  }
}
EOF

# ─── Connector installs ────────────────────────────────────────────────────────

connect_test() {
  local name="$1"       # e.g. "github"
  local bin="$2"        # e.g. "antidrift-mcp-github"
  local cred_key="$3"   # e.g. "github"
  local cred_file="$4"  # e.g. "github.json"
  local min_tools="$5"  # minimum expected tool count

  section "antidrift connect $name -g"

  local OUT
  OUT=$("$bin" -g 2>&1 || true)
  echo "$OUT" | grep -q "updated\|connected\|zeromcp" \
    && pass "runs without error" \
    || fail "command failed (output: $(echo "$OUT" | tail -3))"

  [ -d "$HOME/.antidrift/tools/$name" ] \
    && pass "~/.antidrift/tools/$name/ created" \
    || fail "tools dir missing"

  local COUNT
  COUNT=$(ls ~/.antidrift/tools/$name/*.mjs 2>/dev/null | wc -l | tr -d ' ')
  [ "$COUNT" -gt "$min_tools" ] \
    && pass "tool files copied ($COUNT files)" \
    || fail "expected >$min_tools tool files, got $COUNT"

  local CRED
  CRED=$(node -e "
    const c=JSON.parse(require('fs').readFileSync('$HOME/.antidrift/zeromcp.config.json','utf8'));
    console.log(c.credentials['$cred_key']?.file || '');
  " 2>/dev/null || echo '')
  [[ "$CRED" == *"$cred_file" ]] \
    && pass "$cred_key credential registered" \
    || fail "$cred_key credential missing (got: $CRED)"
}

# Simple REST connectors
connect_test "github"   "antidrift-mcp-github"   "github"   "github.json"   5
connect_test "linear"   "antidrift-mcp-linear"   "linear"   "linear.json"   5
connect_test "attio"    "antidrift-mcp-attio"    "attio"    "attio.json"    3

connect_test "clickup"  "antidrift-mcp-clickup"  "clickup"  "clickup.json"  5
connect_test "cloudflare" "antidrift-mcp-cloudflare" "cloudflare" "cloudflare.json" 5
connect_test "vercel"   "antidrift-mcp-vercel"   "vercel"   "vercel.json"   5
connect_test "netlify"  "antidrift-mcp-netlify"  "netlify"  "netlify.json"  5
connect_test "pipedrive" "antidrift-mcp-pipedrive" "pipedrive" "pipedrive.json" 5
connect_test "notion"   "antidrift-mcp-notion"   "notion"   "notion.json"   3

# HubSpot — two connectors share hubspot.json for setup, each registers its own credential key
section "antidrift connect hubspot-crm -g"
OUT=$(antidrift-mcp-hubspot-crm -g 2>&1 || true)
echo "$OUT" | grep -q "updated\|connected\|zeromcp" && pass "runs without error" || fail "command failed"
[ -d "$HOME/.antidrift/tools/hubspot-crm" ] && pass "tools/hubspot-crm/ created" || fail "tools dir missing"
HS_CRM_COUNT=$(ls ~/.antidrift/tools/hubspot-crm/*.mjs 2>/dev/null | wc -l | tr -d ' ')
[ "$HS_CRM_COUNT" -gt 5 ] && pass "tool files copied ($HS_CRM_COUNT files)" || fail "expected >5 tools, got $HS_CRM_COUNT"
HS_CRM_CRED=$(node -e "const c=JSON.parse(require('fs').readFileSync('$HOME/.antidrift/zeromcp.config.json','utf8')); console.log(c.credentials['hubspot-crm']?.file || '')" 2>/dev/null || echo '')
[[ "$HS_CRM_CRED" == *"hubspot-crm.json" ]] && pass "hubspot-crm credential registered" || fail "hubspot-crm credential missing"

section "antidrift connect hubspot-marketing -g"
OUT=$(antidrift-mcp-hubspot-marketing -g 2>&1 || true)
echo "$OUT" | grep -q "updated\|connected\|zeromcp" && pass "runs without error" || fail "command failed"
[ -d "$HOME/.antidrift/tools/hubspot-marketing" ] && pass "tools/hubspot-marketing/ created" || fail "tools dir missing"
HS_MKT_COUNT=$(ls ~/.antidrift/tools/hubspot-marketing/*.mjs 2>/dev/null | wc -l | tr -d ' ')
[ "$HS_MKT_COUNT" -gt 3 ] && pass "tool files copied ($HS_MKT_COUNT files)" || fail "expected >3 tools, got $HS_MKT_COUNT"
HS_MKT_CRED=$(node -e "const c=JSON.parse(require('fs').readFileSync('$HOME/.antidrift/zeromcp.config.json','utf8')); console.log(c.credentials['hubspot-marketing']?.file || '')" 2>/dev/null || echo '')
[[ "$HS_MKT_CRED" == *"hubspot-marketing.json" ]] && pass "hubspot-marketing credential registered" || fail "hubspot-marketing credential missing"

# Jira
section "antidrift connect jira -g"
OUT=$(antidrift-mcp-jira -g 2>&1 || true)
echo "$OUT" | grep -q "updated\|connected\|zeromcp" && pass "runs without error" || fail "command failed"
[ -d "$HOME/.antidrift/tools/jira" ] && pass "tools/jira/ created" || fail "tools dir missing"
JIRA_COUNT=$(ls ~/.antidrift/tools/jira/*.mjs 2>/dev/null | wc -l | tr -d ' ')
[ "$JIRA_COUNT" -gt 5 ] && pass "tool files copied ($JIRA_COUNT files)" || fail "expected >5 tools, got $JIRA_COUNT"
JIRA_CRED=$(node -e "const c=JSON.parse(require('fs').readFileSync('$HOME/.antidrift/zeromcp.config.json','utf8')); console.log(c.credentials.jira?.file || '')" 2>/dev/null || echo '')
[[ "$JIRA_CRED" == *"jira.json" ]] && pass "jira credential registered" || fail "jira credential missing"

# Stripe (installs stripe npm package)
section "antidrift connect stripe -g"
OUT=$(antidrift-mcp-stripe -g 2>&1 || true)
echo "$OUT" | grep -q "updated\|connected\|zeromcp" && pass "runs without error" || fail "command failed"
[ -d "$HOME/.antidrift/tools/stripe" ] && pass "tools/stripe/ created" || fail "tools dir missing"
STRIPE_COUNT=$(ls ~/.antidrift/tools/stripe/*.mjs 2>/dev/null | wc -l | tr -d ' ')
[ "$STRIPE_COUNT" -gt 5 ] && pass "tool files copied ($STRIPE_COUNT files)" || fail "expected >5 tools, got $STRIPE_COUNT"
[ -d "$HOME/.antidrift/tools/stripe/node_modules/stripe" ] && pass "stripe npm package installed" || fail "stripe npm package missing"
STRIPE_CRED=$(node -e "const c=JSON.parse(require('fs').readFileSync('$HOME/.antidrift/zeromcp.config.json','utf8')); console.log(c.credentials.stripe?.file || '')" 2>/dev/null || echo '')
[[ "$STRIPE_CRED" == *"stripe.json" ]] && pass "stripe credential registered" || fail "stripe credential missing"

# AWS connectors (require fake aws CLI on PATH)
section "antidrift connect aws -g (fake aws CLI)"
OUT=$(echo "y" | timeout 30 antidrift-mcp-aws -g 2>&1 || true)
echo "$OUT" | grep -q "connected\|updated\|zeromcp" && pass "runs without error" || fail "command failed"
[ -d "$HOME/.antidrift/tools/aws" ] && pass "tools/aws/ created" || fail "tools dir missing"
AWS_COUNT=$(ls ~/.antidrift/tools/aws/*.mjs 2>/dev/null | wc -l | tr -d ' ')
[ "$AWS_COUNT" -gt 5 ] && pass "tool files copied ($AWS_COUNT files)" || fail "expected >5 tools, got $AWS_COUNT"
AWS_CRED=$(node -e "const c=JSON.parse(require('fs').readFileSync('$HOME/.antidrift/zeromcp.config.json','utf8')); console.log(c.credentials.aws?.file || '')" 2>/dev/null || echo '')
[[ "$AWS_CRED" == *"aws.json" ]] && pass "aws credential registered" || fail "aws credential missing"

section "antidrift connect aws-s3 -g (fake aws CLI + SDK install)"
OUT=$(antidrift-mcp-aws-s3 -g 2>&1 || true)
echo "$OUT" | grep -q "connected\|updated\|zeromcp" && pass "runs without error" || fail "command failed"
[ -d "$HOME/.antidrift/tools/aws-s3" ] && pass "tools/aws-s3/ created" || fail "tools dir missing"
AWS_S3_COUNT=$(ls ~/.antidrift/tools/aws-s3/*.mjs 2>/dev/null | wc -l | tr -d ' ')
[ "$AWS_S3_COUNT" -gt 5 ] && pass "tool files copied ($AWS_S3_COUNT files)" || fail "expected >5 tools, got $AWS_S3_COUNT"
[ -d "$HOME/.antidrift/tools/aws-s3/node_modules/@aws-sdk" ] && pass "@aws-sdk packages installed" || fail "@aws-sdk packages missing"
AWS_S3_CRED=$(node -e "const c=JSON.parse(require('fs').readFileSync('$HOME/.antidrift/zeromcp.config.json','utf8')); console.log(c.credentials['aws-s3']?.file || '')" 2>/dev/null || echo '')
[[ "$AWS_S3_CRED" == *"aws-s3.json" ]] && pass "aws-s3 credential registered" || fail "aws-s3 credential missing"

section "antidrift connect aws-spot -g (fake aws CLI + SDK install)"
OUT=$(antidrift-mcp-aws-spot -g 2>&1 || true)
echo "$OUT" | grep -q "connected\|updated\|zeromcp" && pass "runs without error" || fail "command failed"
[ -d "$HOME/.antidrift/tools/aws-spot" ] && pass "tools/aws-spot/ created" || fail "tools dir missing"
AWS_SPOT_COUNT=$(ls ~/.antidrift/tools/aws-spot/*.mjs 2>/dev/null | wc -l | tr -d ' ')
[ "$AWS_SPOT_COUNT" -gt 3 ] && pass "tool files copied ($AWS_SPOT_COUNT files)" || fail "expected >3 tools, got $AWS_SPOT_COUNT"
[ -d "$HOME/.antidrift/tools/aws-spot/node_modules/@aws-sdk" ] && pass "@aws-sdk/client-ec2 installed" || fail "@aws-sdk/client-ec2 missing"
AWS_SPOT_CRED=$(node -e "const c=JSON.parse(require('fs').readFileSync('$HOME/.antidrift/zeromcp.config.json','utf8')); console.log(c.credentials['aws-spot']?.file || '')" 2>/dev/null || echo '')
[[ "$AWS_SPOT_CRED" == *"aws-spot.json" ]] && pass "aws-spot credential registered" || fail "aws-spot credential missing"

# Google connectors (googleapis install + token.json gates auth)
section "antidrift connect calendar -g (googleapis install)"
OUT=$(antidrift-mcp-calendar -g 2>&1 || true)
echo "$OUT" | grep -q "connected\|updated\|zeromcp" && pass "runs without error" || fail "command failed"
[ -d "$HOME/.antidrift/tools/calendar" ] && pass "tools/calendar/ created" || fail "tools dir missing"
CAL_COUNT=$(ls ~/.antidrift/tools/calendar/*.mjs 2>/dev/null | wc -l | tr -d ' ')
[ "$CAL_COUNT" -gt 2 ] && pass "tool files copied ($CAL_COUNT files)" || fail "expected >2 tools, got $CAL_COUNT"
[ -d "$HOME/.antidrift/tools/calendar/node_modules/googleapis" ] && pass "googleapis installed" || fail "googleapis missing"
CAL_CRED=$(node -e "const c=JSON.parse(require('fs').readFileSync('$HOME/.antidrift/zeromcp.config.json','utf8')); console.log(c.credentials.calendar?.file || '')" 2>/dev/null || echo '')
[[ "$CAL_CRED" == *"google.json" ]] && pass "calendar credential registered" || fail "calendar credential missing"

section "antidrift connect drive -g (googleapis install)"
OUT=$(antidrift-mcp-drive -g 2>&1 || true)
echo "$OUT" | grep -q "connected\|updated\|zeromcp" && pass "runs without error" || fail "command failed"
[ -d "$HOME/.antidrift/tools/drive" ] && pass "tools/drive/ created" || fail "tools dir missing"
DRIVE_COUNT=$(ls ~/.antidrift/tools/drive/*.mjs 2>/dev/null | wc -l | tr -d ' ')
[ "$DRIVE_COUNT" -gt 5 ] && pass "tool files copied ($DRIVE_COUNT files)" || fail "expected >5 tools, got $DRIVE_COUNT"
[ -d "$HOME/.antidrift/tools/drive/node_modules/googleapis" ] && pass "googleapis installed" || fail "googleapis missing"
DRIVE_CRED=$(node -e "const c=JSON.parse(require('fs').readFileSync('$HOME/.antidrift/zeromcp.config.json','utf8')); console.log(c.credentials.drive?.file || '')" 2>/dev/null || echo '')
[[ "$DRIVE_CRED" == *"google.json" ]] && pass "drive credential registered" || fail "drive credential missing"

section "antidrift connect gmail -g (googleapis install)"
OUT=$(antidrift-mcp-gmail -g 2>&1 || true)
echo "$OUT" | grep -q "connected\|updated\|zeromcp" && pass "runs without error" || fail "command failed"
[ -d "$HOME/.antidrift/tools/gmail" ] && pass "tools/gmail/ created" || fail "tools dir missing"
GMAIL_COUNT=$(ls ~/.antidrift/tools/gmail/*.mjs 2>/dev/null | wc -l | tr -d ' ')
[ "$GMAIL_COUNT" -gt 5 ] && pass "tool files copied ($GMAIL_COUNT files)" || fail "expected >5 tools, got $GMAIL_COUNT"
[ -d "$HOME/.antidrift/tools/gmail/node_modules/googleapis" ] && pass "googleapis installed" || fail "googleapis missing"
GMAIL_CRED=$(node -e "const c=JSON.parse(require('fs').readFileSync('$HOME/.antidrift/zeromcp.config.json','utf8')); console.log(c.credentials.gmail?.file || '')" 2>/dev/null || echo '')
[[ "$GMAIL_CRED" == *"google.json" ]] && pass "gmail credential registered" || fail "gmail credential missing"

section "antidrift connect google -g (googleapis install)"
OUT=$(antidrift-mcp-google -g 2>&1 || true)
echo "$OUT" | grep -q "connected\|updated\|zeromcp" && pass "runs without error" || fail "command failed"
[ -d "$HOME/.antidrift/tools/google" ] && pass "tools/google/ created" || fail "tools dir missing"
GOOGLE_COUNT=$(ls ~/.antidrift/tools/google/*.mjs 2>/dev/null | wc -l | tr -d ' ')
[ "$GOOGLE_COUNT" -gt 10 ] && pass "tool files copied ($GOOGLE_COUNT files)" || fail "expected >10 tools, got $GOOGLE_COUNT"
[ -d "$HOME/.antidrift/tools/google/node_modules/googleapis" ] && pass "googleapis installed" || fail "googleapis missing"
GOOGLE_CRED=$(node -e "const c=JSON.parse(require('fs').readFileSync('$HOME/.antidrift/zeromcp.config.json','utf8')); console.log(c.credentials.google?.file || '')" 2>/dev/null || echo '')
[[ "$GOOGLE_CRED" == *"google.json" ]] && pass "google credential registered" || fail "google credential missing"

# ─── zeromcp.config.json — verify all 20 credentials registered ───────────────
section "zeromcp.config.json — all 20 connectors"

[ -f "$HOME/.antidrift/zeromcp.config.json" ] && pass "zeromcp.config.json exists" || fail "zeromcp.config.json missing"

TOOLS_ROOT=$(node -e "const c=JSON.parse(require('fs').readFileSync('$HOME/.antidrift/zeromcp.config.json','utf8')); console.log(c.tools[0])" 2>/dev/null || echo '')
[ "$TOOLS_ROOT" = "$HOME/.antidrift/tools" ] && pass "tools root is ~/.antidrift/tools" || fail "tools root wrong: $TOOLS_ROOT"

for svc in github linear attio clickup cloudflare vercel netlify pipedrive jira notion stripe aws calendar drive gmail google; do
  CRED=$(node -e "const c=JSON.parse(require('fs').readFileSync('$HOME/.antidrift/zeromcp.config.json','utf8')); console.log(c.credentials['$svc']?.file || '')" 2>/dev/null || echo '')
  [ -n "$CRED" ] && pass "$svc credential in config" || fail "$svc credential missing from config"
done

for svc in "hubspot-crm" "hubspot-marketing" "aws-s3" "aws-spot"; do
  CRED=$(node -e "const c=JSON.parse(require('fs').readFileSync('$HOME/.antidrift/zeromcp.config.json','utf8')); console.log(c.credentials['$svc']?.file || '')" 2>/dev/null || echo '')
  [ -n "$CRED" ] && pass "$svc credential in config" || fail "$svc credential missing from config"
done

# ─── zeromcp audit ────────────────────────────────────────────────────────────
section "zeromcp audit"

[ -f "$ZEROMCP_BIN" ] && pass "zeromcp binary exists" || fail "zeromcp binary missing at $ZEROMCP_BIN"

AUDIT_OUT=$(node "$ZEROMCP_BIN" audit ~/.antidrift/tools 2>&1 || true)
echo "$AUDIT_OUT" | grep -q "passed" && pass "audit passes with no violations" || {
  fail "audit found violations:"
  echo "$AUDIT_OUT"
}

# No double-prefixed tool filenames in any service
DOUBLE_PREFIX=0
for dir in ~/.antidrift/tools/*/; do
  svc=$(basename "$dir")
  if ls "$dir" 2>/dev/null | grep -q "^${svc}_"; then
    fail "double-prefix tool files in $svc"
    DOUBLE_PREFIX=1
  fi
done
[ "$DOUBLE_PREFIX" -eq 0 ] && pass "no double-prefix tool filenames in any service"

# ─── zeromcp serve — tool discovery and naming ────────────────────────────────
section "zeromcp serve — tool list"

SERVE_OUT=$(echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.0.1"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | \
  timeout 10 node "$ZEROMCP_BIN" serve --config "$ZERO_CONFIG" 2>/dev/null || true)

echo "$SERVE_OUT" | grep -q '"tools"' && pass "serve responds with tools/list" || fail "serve did not return tools"

# Check all 20 service prefixes present
for svc in github linear attio clickup cloudflare vercel netlify pipedrive jira notion stripe aws calendar drive gmail google; do
  echo "$SERVE_OUT" | grep -q "\"${svc}_" \
    && pass "$svc tools present in serve output" \
    || fail "$svc tools missing from serve output"
done
for svc in "hubspot-crm" "hubspot-marketing" "aws-s3" "aws-spot"; do
  echo "$SERVE_OUT" | grep -q "\"${svc}_" \
    && pass "$svc tools present in serve output" \
    || fail "$svc tools missing from serve output"
done

# Spot-check well-known tool names
echo "$SERVE_OUT" | grep -q "github_list_repos" && pass "github_list_repos named correctly" || fail "github_list_repos not found"
echo "$SERVE_OUT" | grep -q "linear_list_teams" && pass "linear_list_teams named correctly" || fail "linear_list_teams not found"
echo "$SERVE_OUT" | grep -q "stripe_list_customers" && pass "stripe_list_customers named correctly" || fail "stripe_list_customers not found"
echo "$SERVE_OUT" | grep -q "calendar_today" && pass "calendar_today named correctly" || fail "calendar_today not found"
echo "$SERVE_OUT" | grep -q "aws_s3_list_buckets" && pass "aws_s3_list_buckets named correctly" || fail "aws_s3_list_buckets not found"

# No double-prefixed tool names in serve output
DUPE=0
for svc in github linear attio clickup cloudflare vercel netlify pipedrive jira notion stripe aws calendar drive gmail google; do
  if echo "$SERVE_OUT" | grep -q "\"${svc}_${svc}_"; then
    fail "double-prefix tool name found for $svc"
    DUPE=1
  fi
done
[ "$DUPE" -eq 0 ] && pass "no double-prefix tool names in serve output"

# Total tool count
SERVE_TOOL_COUNT=$(echo "$SERVE_OUT" | node -e "
  let data = '';
  process.stdin.on('data', d => data += d);
  process.stdin.on('end', () => {
    const lines = data.split('\n').filter(l => l.startsWith('{'));
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        if (msg.result?.tools) { console.log(msg.result.tools.length); process.exit(0); }
      } catch {}
    }
    console.log(0);
  });
" 2>/dev/null || echo 0)
[ "$SERVE_TOOL_COUNT" -gt 100 ] \
  && pass "serve exposes $SERVE_TOOL_COUNT tools total (all 20 connectors)" \
  || fail "expected >100 tools from serve, got $SERVE_TOOL_COUNT"

# ─── tools/call via MCP stdio ────────────────────────────────────────────────
section "tools/call via stdio"

STDIO_OUT=$(node /mcp-call.mjs "$ZEROMCP_BIN" "$ZERO_CONFIG" 2>/dev/null; exit 0)
echo "$STDIO_OUT"

STDIO_PASS=$(echo "$STDIO_OUT" | grep -c "  ✓" || true)
STDIO_FAIL=$(echo "$STDIO_OUT" | grep -c "  ✗" || true)
PASS=$((PASS + STDIO_PASS))
FAIL=$((FAIL + STDIO_FAIL))

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "────────────────────────────────────────"
echo "  Results: $PASS passed, $FAIL failed"
echo "────────────────────────────────────────"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
