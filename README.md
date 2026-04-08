# xstripe

Read-only Stripe CLI for browsing account data with local caching, profile support, table/JSON/CSV output, and direct access to Stripe's Search API.

`xstripe` is built for developers who want a fast terminal workflow for inspecting Stripe resources without opening the dashboard for every lookup.

The npm package name is `@w3devx/stripe-cli`, and the installed executable is `xstripe`.

## Features

- Read-only Stripe data browser
- Local response caching for faster repeat queries
- Multiple profiles for test/live or multiple Stripe accounts
- Table, JSON, and CSV output
- Stripe Search API support for supported resources
- Raw authenticated API requests for endpoints outside the built-in modules
- Expand support for nested Stripe objects

## Supported Resources

- `customers`
- `charges`
- `payment-intents`
- `subscriptions`
- `invoices`
- `products`
- `prices`
- `payment-methods`
- `balance`
- `events`
- `refunds`
- `disputes`
- `payouts`

Short aliases are also available, for example `cust`, `ch`, `pi`, `sub`, `inv`, `prod`, `pr`, `pm`, `bal`, `ev`, `ref`, `dis`, and `po`.

## Installation

`xstripe` is a Bun-based CLI published as `@w3devx/stripe-cli`. Users need `bun` installed and available on their `PATH`.

```bash
npm install -g @w3devx/stripe-cli
```

Verify the install after global installation:

```bash
xstripe --version
```

After installation, run the CLI as `xstripe`.

If you are using it from source instead of the npm registry:

```bash
bun install
bun run src/index.ts --help
```

## Quick Start

1. Get a Stripe secret key from `https://dashboard.stripe.com/apikeys`
2. Run the setup wizard:

```bash
xstripe auth setup
```

3. Browse data:

```bash
xstripe customers
xstripe charges
xstripe balance
```

## Authentication

`xstripe` stores credentials per profile under `~/.xstripe/profiles/<name>/auth.json`.

- Accepted key prefixes: `sk_test_`, `sk_live_`, `rk_test_`, `rk_live_`
- File permissions are set to `0600`
- Authentication is validated against `GET /v1/balance` during setup when possible

Useful commands:

```bash
xstripe auth setup
xstripe auth status
xstripe auth clear
```

## Common Usage

List records:

```bash
xstripe customers
xstripe charges --limit 20
xstripe subscriptions --status active
```

Get a single record by ID:

```bash
xstripe cust cus_123
xstripe pi pi_123
xstripe invoices in_123
```

Filter by date:

```bash
xstripe charges --from 2026-01-01 --to 2026-03-31
```

Expand nested Stripe objects:

```bash
xstripe payment-intents pi_123 --expand customer --expand latest_charge
```

Choose output format:

```bash
xstripe customers --table
xstripe customers --json
xstripe customers --csv
```

## Search API

For searchable Stripe resources, `xstripe` supports Stripe's Search API:

```bash
xstripe search customers --query "email:'john@example.com'"
xstripe search charges --query "amount>5000 AND status:'succeeded'"
xstripe search invoices --query "customer:'cus_123'" --limit 10
```

Searchable resources:

- `customers`
- `charges`
- `payment-intents`
- `subscriptions`
- `invoices`
- `products`
- `prices`

## Raw API Access

Use `raw` when you want to hit Stripe endpoints that do not have a dedicated module yet.

```bash
xstripe raw /customers
xstripe raw /customers --param limit=5
xstripe raw /charges/ch_123 --json
xstripe raw /balance
```

Supported methods today:

- `GET`
- `POST`

## Profiles

Profiles let you separate credentials and preferences for different Stripe accounts or modes.

```bash
xstripe profile list
xstripe profile create live
xstripe profile use live
xstripe profile show
xstripe customers --profile default
```

Profile resolution order:

1. `--profile <name>`
2. `XSTRIPE_PROFILE`
3. default profile from `~/.xstripe/config.json`
4. `default`

## Configuration

Per-profile settings:

- `outputFormat`: `table`, `json`, `csv`
- `cacheTtl`: cache TTL in seconds

Examples:

```bash
xstripe config show
xstripe config set outputFormat json
xstripe config set cacheTtl 7200
```

## Caching

API responses are cached under `~/.xstripe/cache/<profile>/<module>/`.

Useful flags:

- `--refresh` to bypass cache and refresh it
- `--no-cache` to skip cache entirely

Cache commands:

```bash
xstripe cache stats
xstripe cache clear
xstripe cache clear customers
xstripe cache clear --all
```

## Balance Commands

`balance` is a special command:

```bash
xstripe balance
xstripe balance transactions
xstripe balance transactions txn_123
```

## Global Flags

Available on the CLI root:

- `-h`, `--help`
- `-V`, `--version`
- `-v`, `--verbose`
- `-q`, `--quiet`

Available on most data commands:

- `--json`
- `--csv`
- `--table`
- `--refresh`
- `--no-cache`
- `--from <date>`
- `--to <date>`
- `--limit <n>`
- `--expand <field>`
- `--filter k=v`
- `--profile <name>`

## Data Directory

`xstripe` stores all local state in:

```text
~/.xstripe/
  config.json
  profiles/<name>/auth.json
  profiles/<name>/config.json
  cache/<name>/<module>/
```

## Development

```bash
bun install
bun run src/index.ts --help
bun run dev
bun run build
```

Package scripts:

- `bun run start`
- `bun run dev`
- `bun run build`
- `bun run link`
- `bun run unlink`
- `bun test`

## Notes

- This CLI is intentionally read-only for built-in resource commands.
- It uses Stripe's REST API directly at `https://api.stripe.com/v1`.
- Search behavior depends on Stripe's Search API support for each resource.

## License

MIT
