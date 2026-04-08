---
name: stripe-cli
description: Use when an agent needs to inspect Stripe account data from the terminal using the local stripe-cli package and its xstripe executable. Covers authentication, profile selection, listing resources, fetching records by ID, searching supported resources, checking balances, inspecting cached data behavior, and using raw API requests only when the built-in commands are insufficient.
---

# Stripe CLI Usage

Use the `xstripe` executable from the `@w3devx/stripe-cli` package as the first choice when the task is to read or inspect Stripe data in this repository's environment.

## When To Use

- The user wants to inspect Stripe objects from the terminal
- The user asks for customers, charges, invoices, subscriptions, products, prices, payment intents, payment methods, refunds, disputes, payouts, events, or balance data
- The user wants to search Stripe data with the Search API
- The user wants to check auth, profiles, config, or cache state for this CLI
- The user wants a quick read-only answer without writing custom Stripe API code

## When Not To Use

- The task requires mutating Stripe data through this CLI
- The task is about implementing or changing the CLI itself rather than using it
- The task is unrelated to Stripe account inspection

## Preferred Workflow

1. Confirm the CLI is available with `xstripe --version` if there is any doubt.
2. Check auth or profile state when access may be the blocker.
3. Prefer the built-in module commands over `raw`.
4. Prefer specific IDs when the user already knows the object identifier.
5. Use `search` for supported resources when the user gives search-like criteria.
6. Use `raw` only for endpoints not covered by built-in commands.
7. Use `--json` when the output needs to be parsed or quoted precisely.
8. Use `--refresh` when stale cached data might mislead the result.

## Command Selection

Use the dedicated resource commands first:

- `xstripe customers`
- `xstripe charges`
- `xstripe payment-intents`
- `xstripe subscriptions`
- `xstripe invoices`
- `xstripe products`
- `xstripe prices`
- `xstripe payment-methods`
- `xstripe events`
- `xstripe refunds`
- `xstripe disputes`
- `xstripe payouts`
- `xstripe balance`

Use aliases only when brevity helps and clarity is still preserved:

- `cust`, `ch`, `pi`, `sub`, `inv`, `prod`, `pr`, `pm`, `bal`, `ev`, `ref`, `dis`, `po`

## Core Patterns

List records:

```bash
xstripe customers
xstripe charges --limit 20
xstripe subscriptions --status active
```

Fetch a single record by ID:

```bash
xstripe cust cus_123
xstripe pi pi_123
xstripe inv in_123
```

Filter and shape output:

```bash
xstripe charges --from 2026-01-01 --to 2026-03-31
xstripe payment-intents pi_123 --expand customer --expand latest_charge
xstripe customers --json
xstripe customers --csv
```

Use profiles explicitly when needed:

```bash
xstripe profile list
xstripe profile show
xstripe customers --profile live
xstripe auth status --profile default
```

Check balance:

```bash
xstripe balance
xstripe balance transactions
xstripe balance transactions txn_123
```

## Search Guidance

Use `search` for these resources:

- `customers`
- `charges`
- `payment-intents`
- `subscriptions`
- `invoices`
- `products`
- `prices`

Examples:

```bash
xstripe search customers --query "email:'john@example.com'"
xstripe search charges --query "amount>5000 AND status:'succeeded'"
xstripe search invoices --query "customer:'cus_123'" --limit 10
```

If a resource is not supported by `search`, fall back to its list command with filters or use `raw`.

## Raw Fallback

Use `raw` only when the built-in commands do not cover the needed endpoint or response shape.

Examples:

```bash
xstripe raw /customers --param limit=5
xstripe raw /charges/ch_123 --json
xstripe raw /balance
```

Supported methods are `GET` and `POST`.

## Auth, Config, And Cache

Auth and profile setup:

```bash
xstripe auth setup
xstripe auth status
xstripe profile list
xstripe profile use live
```

Config:

```bash
xstripe config show
xstripe config set outputFormat json
xstripe config set cacheTtl 7200
```

Cache:

```bash
xstripe cache stats
xstripe cache clear
xstripe cache clear customers
xstripe cache clear --all
```

## Operational Notes

- This CLI is read-only for the built-in resource commands.
- Data is stored under `~/.xstripe/`.
- Profile resolution order is `--profile`, then `XSTRIPE_PROFILE`, then the configured default profile, then `default`.
- Cached responses can affect freshness; use `--refresh` or `--no-cache` when the task needs current data.
- `payment-methods` listing typically requires a `customer` filter.

## References

- Read `references/commands.md` for the command map and resource coverage.
