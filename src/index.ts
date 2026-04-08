import { authCommand } from "./commands/auth.ts";
import { configCommand } from "./commands/config.ts";
import { cacheCommand } from "./commands/cache.ts";
import { profileCommand } from "./commands/profile.ts";
import { handleModuleCommand } from "./commands/module.ts";
import { handleRaw } from "./commands/raw.ts";
import { handleSearch } from "./commands/search.ts";
import { formatError } from "./utils/errors.ts";
import { setLogLevel, log } from "./utils/logger.ts";
import type { BaseModule } from "./modules/base-module.ts";

// Modules
import { customersModule } from "./modules/customers.ts";
import { chargesModule } from "./modules/charges.ts";
import { paymentIntentsModule } from "./modules/payment-intents.ts";
import { subscriptionsModule } from "./modules/subscriptions.ts";
import { invoicesModule } from "./modules/invoices.ts";
import { productsModule } from "./modules/products.ts";
import { pricesModule } from "./modules/prices.ts";
import { paymentMethodsModule } from "./modules/payment-methods.ts";
import { balanceModule } from "./modules/balance.ts";
import { eventsModule } from "./modules/events.ts";
import { refundsModule } from "./modules/refunds.ts";
import { disputesModule } from "./modules/disputes.ts";
import { payoutsModule } from "./modules/payouts.ts";

const VERSION = "0.1.0";

/** Map of module command names to their module instances */
const MODULES: Record<string, BaseModule> = {
  customers: customersModule,
  charges: chargesModule,
  "payment-intents": paymentIntentsModule,
  subscriptions: subscriptionsModule,
  invoices: invoicesModule,
  products: productsModule,
  prices: pricesModule,
  "payment-methods": paymentMethodsModule,
  balance: balanceModule,
  events: eventsModule,
  refunds: refundsModule,
  disputes: disputesModule,
  payouts: payoutsModule,

  // Aliases (short forms)
  cust: customersModule,
  ch: chargesModule,
  pi: paymentIntentsModule,
  sub: subscriptionsModule,
  inv: invoicesModule,
  prod: productsModule,
  pr: pricesModule,
  pm: paymentMethodsModule,
  bal: balanceModule,
  ev: eventsModule,
  ref: refundsModule,
  dis: disputesModule,
  po: payoutsModule,
};

/**
 * Handle the special `balance` command.
 *
 * Unlike other modules:
 *   - `xstripe balance` → GET /v1/balance (single object)
 *   - `xstripe balance transactions` → list /v1/balance_transactions
 *   - `xstripe balance transactions <id>` → GET /v1/balance_transactions/<id>
 */
async function handleBalanceCommand(args: string[]): Promise<void> {
  const { resolveProfile } = await import("./config/config-manager.ts");
  const { loadProfileConfig } = await import("./config/config-manager.ts");
  const { formatSingleRecord, formatOutput } = await import("./output/formatter.ts");
  const { log: logMsg, error: logErr } = await import("./utils/logger.ts");

  // Extract --profile from args
  let profileFlag: string | undefined;
  const filteredArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--profile" && args[i + 1]) {
      profileFlag = args[++i];
    } else {
      filteredArgs.push(args[i]!);
    }
  }

  const profile = await resolveProfile(profileFlag);

  // Parse flags
  let format: "json" | "table" | "csv" = "table";
  let refresh = false;
  let noCache = false;
  let help = false;
  const positionals: string[] = [];
  const params: Record<string, string> = {};

  for (let i = 0; i < filteredArgs.length; i++) {
    const arg = filteredArgs[i]!;
    switch (arg) {
      case "--json": format = "json"; break;
      case "--csv": format = "csv"; break;
      case "--table": format = "table"; break;
      case "--refresh": refresh = true; break;
      case "--no-cache": noCache = true; break;
      case "-h":
      case "--help": help = true; break;
      case "--from":
        i++;
        if (filteredArgs[i]) params["created[gte]"] = filteredArgs[i]!;
        break;
      case "--to":
        i++;
        if (filteredArgs[i]) params["created[lte]"] = filteredArgs[i]!;
        break;
      case "--limit":
        i++;
        if (filteredArgs[i]) params.limit = filteredArgs[i]!;
        break;
      case "--filter":
        i++;
        if (filteredArgs[i]) {
          const eq = filteredArgs[i]!.indexOf("=");
          if (eq > 0) {
            params[filteredArgs[i]!.slice(0, eq)] = filteredArgs[i]!.slice(eq + 1);
          }
        }
        break;
      default:
        if (!arg.startsWith("-")) positionals.push(arg);
        break;
    }
  }

  if (help) {
    printBalanceHelp();
    return;
  }

  const balMod = balanceModule;
  const opts = { refresh, noCache, profile };

  try {
    if (positionals[0] === "transactions" || positionals[0] === "txn") {
      // Balance transactions sub-resource
      if (positionals[1]) {
        // Get single transaction
        const record = await balMod.getTransaction(positionals[1], opts);
        const output = formatSingleRecord(record, format);
        logMsg(output);
      } else {
        // List transactions
        const records = await balMod.listTransactions({ ...opts, params });
        const output = formatOutput(records, balMod.txnColumns, format);
        logMsg(output);
      }
    } else if (positionals[0]) {
      // Treat as transaction ID if it starts with txn_
      if (positionals[0].startsWith("txn_")) {
        const record = await balMod.getTransaction(positionals[0], opts);
        const output = formatSingleRecord(record, format);
        logMsg(output);
      } else {
        logErr(`Unknown balance subcommand: ${positionals[0]}`);
        logErr("Use 'xstripe balance' or 'xstripe balance transactions'.");
        process.exit(1);
      }
    } else {
      // Default: show current balance
      const record = await balMod.getBalance(opts);
      const output = formatSingleRecord(record, format);
      logMsg(output);
    }
  } catch (err) {
    logErr(
      `Failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
}

/**
 * Print help for the balance command.
 */
function printBalanceHelp(): void {
  log("Usage: xstripe balance [subcommand] [options]");
  log("");
  log("View your Stripe balance and balance transactions.");
  log("");
  log("Commands:");
  log("  (none)                   Show current balance");
  log("  transactions             List balance transactions");
  log("  transactions <id>        Get a specific balance transaction");
  log("");
  log("Options:");
  log("  --json                   Output as JSON");
  log("  --csv                    Output as CSV");
  log("  --table                  Output as table (default)");
  log("  --refresh                Bypass cache");
  log("  --no-cache               Skip cache entirely");
  log("  --from <date>            Filter from date");
  log("  --to <date>              Filter to date");
  log("  --limit <n>              Limit results");
  log("  --profile <name>         Use a specific profile");
  log("  -h, --help               Show this help");
  log("");
  log("Aliases: bal");
  log("");
  log("Examples:");
  log("  xstripe balance                          # Show balance");
  log("  xstripe balance --json                   # Balance as JSON");
  log("  xstripe balance transactions             # List transactions");
  log("  xstripe balance transactions txn_123     # Get transaction");
  log("  xstripe bal                              # Using alias");
}

/**
 * Main CLI entry point.
 * Parses global flags, routes to subcommands.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse global flags
  let verbose = false;
  let quiet = false;
  let help = false;
  let version = false;

  const commandArgs: string[] = [];
  let foundCommand = false;

  for (const arg of args) {
    if (!foundCommand) {
      if (arg === "--verbose" || arg === "-v") {
        verbose = true;
        continue;
      }
      if (arg === "--quiet" || arg === "-q") {
        quiet = true;
        continue;
      }
      if (arg === "--help" || arg === "-h") {
        help = true;
        continue;
      }
      if (arg === "--version" || arg === "-V") {
        version = true;
        continue;
      }
      // --profile is a global flag too, pass through to commands
      foundCommand = true;
    }
    commandArgs.push(arg);
  }

  // Set log level
  if (verbose) {
    setLogLevel("verbose");
  } else if (quiet) {
    setLogLevel("quiet");
  }

  // Handle --version
  if (version) {
    console.log(`xstripe ${VERSION}`);
    process.exit(0);
  }

  // Handle --help or no command
  if (help || commandArgs.length === 0) {
    printHelp();
    process.exit(0);
  }

  const command = commandArgs[0]!;
  const subArgs = commandArgs.slice(1);

  try {
    // Built-in commands
    switch (command) {
      case "auth":
        await authCommand(subArgs);
        return;
      case "config":
        await configCommand(subArgs);
        return;
      case "cache":
        await cacheCommand(subArgs);
        return;
      case "profile":
        await profileCommand(subArgs);
        return;
      case "raw":
        await handleRaw(subArgs);
        return;
      case "search":
        await handleSearch(subArgs, MODULES);
        return;
    }

    // Special: balance command has sub-resources
    if (command === "balance" || command === "bal") {
      await handleBalanceCommand(subArgs);
      return;
    }

    // Module commands (including aliases)
    const module = MODULES[command];
    if (module) {
      await handleModuleCommand(module, subArgs);
      return;
    }

    // Unknown command
    console.error(`Unknown command: ${command}`);
    console.error("Run 'xstripe --help' for usage information.");
    process.exit(1);
  } catch (err) {
    console.error(formatError(err));
    process.exit(1);
  }
}

/**
 * Print comprehensive help text.
 */
function printHelp(): void {
  console.log(`
xstripe v${VERSION} - Stripe Data Browser CLI

Usage: xstripe [options] <command> [subcommand] [flags]

Options:
  -h, --help           Show this help message
  -V, --version        Show version number
  -v, --verbose        Enable verbose/debug output
  -q, --quiet          Suppress non-essential output

Setup Commands:
  auth                 Manage authentication
    setup              Interactive setup wizard (configure API key)
    status             Show current authentication status
    clear              Remove stored credentials
  config               Manage per-profile configuration
    show               Display current configuration
    set <k> <v>        Set a configuration value
  cache                Manage cached data
    clear [module]     Clear cache (profile, module, or --all)
    stats              Show cache statistics
  profile              Manage multiple profiles
    list               List all profiles
    create <name>      Create a new profile
    delete <name>      Delete a profile
    use <name>         Set default profile
    show [name]        Show profile details

Data Commands:
  customers            List/get customers                         (alias: cust)
  charges              List/get charges                           (alias: ch)
  payment-intents      List/get payment intents                   (alias: pi)
  subscriptions        List/get subscriptions                     (alias: sub)
  invoices             List/get invoices                          (alias: inv)
  products             List/get products                          (alias: prod)
  prices               List/get prices                            (alias: pr)
  payment-methods      List/get payment methods                   (alias: pm)
  balance              Show balance / list balance transactions    (alias: bal)
  events               List/get events                            (alias: ev)
  refunds              List/get refunds                           (alias: ref)
  disputes             List/get disputes                          (alias: dis)
  payouts              List/get payouts                           (alias: po)

  raw <path>           Make raw authenticated API requests
  search <resource>    Search using Stripe Search API

Read Options (all data commands):
  [id]                 Get a specific record by ID
  --json               Output as JSON
  --csv                Output as CSV
  --table              Output as table (default)
  --refresh            Bypass cache and fetch fresh data
  --no-cache           Skip cache entirely
  --from <date>        Filter from date (YYYY-MM-DD, ISO 8601, or Unix timestamp)
  --to <date>          Filter to date (YYYY-MM-DD, ISO 8601, or Unix timestamp)
  --limit <n>          Limit records per page
  --expand <field>     Expand a nested object (repeatable)
  --filter k=v         Add a query parameter (repeatable)
  --profile <name>     Use a specific profile

Getting Started:
  1. Get your secret API key from https://dashboard.stripe.com/apikeys
  2. Run 'xstripe auth setup' to configure
  3. Run 'xstripe customers' to list your customers
  4. Run 'xstripe balance' to check your balance

Examples:
  xstripe auth setup                                    # First-time setup
  xstripe customers                                     # List customers
  xstripe customers --json                              # List as JSON
  xstripe cust cus_123                                  # Get customer by ID
  xstripe charges --from 2024-01-01 --to 2024-12-31     # Filter by date
  xstripe pi pi_123 --expand customer                   # Expand nested object
  xstripe sub --status active                           # Filter by status
  xstripe balance                                       # Show balance
  xstripe bal transactions                              # Balance transactions
  xstripe search customers --query "email:'john@e.com'" # Search
  xstripe raw /coupons                                  # Raw API request
  xstripe raw /customers --param limit=5                # Raw with params
  xstripe cache stats                                   # View cache usage

  # Multi-profile:
  xstripe auth setup --profile live                     # Setup live profile
  xstripe profile use live                              # Switch to live
  xstripe customers --profile test                      # Override per-command

Configuration:
  All data is stored in ~/.xstripe/
    config.json                   Global config (default profile)
    profiles/<name>/auth.json     API key (permissions: 0600)
    profiles/<name>/config.json   Profile preferences
    cache/<name>/<module>/        Cached API responses

Documentation:
  https://stripe.com/docs/api
`.trim());
}

// Run
main();
