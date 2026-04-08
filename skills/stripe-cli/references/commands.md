# xstripe Command Map

Use this file when choosing the right `xstripe` command for a Stripe inspection task.

## Setup Commands

- `xstripe auth setup`
- `xstripe auth status`
- `xstripe auth clear`
- `xstripe config show`
- `xstripe config set <key> <value>`
- `xstripe cache stats`
- `xstripe cache clear [module]`
- `xstripe cache clear --all`
- `xstripe profile list`
- `xstripe profile create <name>`
- `xstripe profile delete <name>`
- `xstripe profile use <name>`
- `xstripe profile show [name]`

## Resource Commands

- `xstripe customers`
- `xstripe charges`
- `xstripe payment-intents`
- `xstripe subscriptions`
- `xstripe invoices`
- `xstripe products`
- `xstripe prices`
- `xstripe payment-methods`
- `xstripe balance`
- `xstripe events`
- `xstripe refunds`
- `xstripe disputes`
- `xstripe payouts`

Each resource command supports list and get-by-ID behavior.

## Searchable Resources

- `customers`
- `charges`
- `payment-intents`
- `subscriptions`
- `invoices`
- `products`
- `prices`

Pattern:

```bash
xstripe search <resource> --query "<stripe-search-query>"
```

## Common Flags

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

## Useful Resource-Specific Filters

- `customers`: `--email`
- `charges`: `--customer`
- `payment-intents`: `--customer`
- `subscriptions`: `--customer`, `--price`, `--status`, `--collection_method`
- `invoices`: `--customer`, `--status`, `--subscription`, `--collection_method`
- `products`: `--active`
- `prices`: `--product`, `--active`, `--type`, `--currency`
- `payment-methods`: `--customer`, `--type`
- `events`: `--type`
- `refunds`: `--charge`, `--payment_intent`
- `disputes`: `--charge`, `--payment_intent`
- `payouts`: `--status`, `--arrival_date`

## Special Case

`balance` is not a normal list resource.

Use:

```bash
xstripe balance
xstripe balance transactions
xstripe balance transactions txn_123
```
