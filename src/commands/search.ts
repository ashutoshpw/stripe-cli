import { apiRequest, type StripeSearchResponse } from "../api/client.ts";
import {
  formatOutput,
  autoFormatRawResponse,
  type OutputFormat,
} from "../output/formatter.ts";
import { resolveProfile } from "../config/config-manager.ts";
import { log, error } from "../utils/logger.ts";
import type { BaseModule } from "../modules/base-module.ts";

/**
 * Searchable resources and their Stripe search API paths.
 */
const SEARCHABLE_RESOURCES: Record<
  string,
  { path: string; moduleName: string }
> = {
  customers: { path: "/customers/search", moduleName: "customers" },
  charges: { path: "/charges/search", moduleName: "charges" },
  "payment-intents": {
    path: "/payment_intents/search",
    moduleName: "payment-intents",
  },
  payment_intents: {
    path: "/payment_intents/search",
    moduleName: "payment-intents",
  },
  subscriptions: {
    path: "/subscriptions/search",
    moduleName: "subscriptions",
  },
  invoices: { path: "/invoices/search", moduleName: "invoices" },
  products: { path: "/products/search", moduleName: "products" },
  prices: { path: "/prices/search", moduleName: "prices" },
};

/**
 * Parsed flags for the search command.
 */
interface SearchFlags {
  /** Resource name (e.g., "customers") */
  resource?: string;
  /** Search query string (Stripe search syntax) */
  query?: string;
  /** Limit number of results */
  limit?: string;
  /** Output format */
  json: boolean;
  /** Profile name */
  profile?: string;
  /** Show help */
  help: boolean;
}

/**
 * Parse search command flags.
 */
function parseSearchFlags(args: string[]): SearchFlags {
  const flags: SearchFlags = {
    json: false,
    help: false,
  };

  let i = 0;
  let positionalIndex = 0;

  while (i < args.length) {
    const arg = args[i]!;

    switch (arg) {
      case "--query":
      case "-q":
        i++;
        if (args[i]) flags.query = args[i];
        break;
      case "--limit":
        i++;
        if (args[i]) flags.limit = args[i];
        break;
      case "--json":
        flags.json = true;
        break;
      case "--profile":
        i++;
        if (args[i]) flags.profile = args[i];
        break;
      case "-h":
      case "--help":
        flags.help = true;
        break;
      default:
        if (!arg.startsWith("-")) {
          if (positionalIndex === 0) {
            flags.resource = arg;
          }
          positionalIndex++;
        }
        break;
    }
    i++;
  }

  return flags;
}

/**
 * Handle the `xstripe search` command.
 *
 * Uses Stripe's Search API to query resources by arbitrary criteria.
 * Supports cursor pagination with `next_page` token.
 *
 * Usage:
 *   xstripe search customers --query "email:'john@example.com'"
 *   xstripe search charges --query "amount>5000 AND status:'succeeded'"
 *   xstripe search invoices --query "customer:'cus_123'" --limit 10
 */
export async function handleSearch(
  args: string[],
  modules: Record<string, BaseModule>,
): Promise<void> {
  const flags = parseSearchFlags(args);

  if (flags.help) {
    printSearchHelp();
    return;
  }

  if (!flags.resource) {
    error("Resource name required.");
    error("Usage: xstripe search <resource> --query \"...\"");
    error("");
    error("Searchable resources: " + Object.keys(SEARCHABLE_RESOURCES).filter(r => !r.includes("_")).join(", "));
    process.exit(1);
  }

  const resourceInfo = SEARCHABLE_RESOURCES[flags.resource];
  if (!resourceInfo) {
    error(`Resource '${flags.resource}' is not searchable.`);
    error(
      "Searchable resources: " +
        Object.keys(SEARCHABLE_RESOURCES).filter(r => !r.includes("_")).join(", "),
    );
    process.exit(1);
  }

  if (!flags.query) {
    error("Search query required. Use --query \"...\"");
    error("");
    error("Examples:");
    error("  xstripe search customers --query \"email:'john@example.com'\"");
    error("  xstripe search charges --query \"amount>5000\"");
    process.exit(1);
  }

  const profile = await resolveProfile(flags.profile);
  const format: OutputFormat = flags.json ? "json" : "table";

  // Build params
  const params: Record<string, string> = {
    query: flags.query,
  };
  if (flags.limit) {
    params.limit = flags.limit;
  }

  try {
    // Fetch all pages of search results
    const allItems: Record<string, unknown>[] = [];
    let nextPage: string | undefined;
    let pageCount = 0;
    const maxPages = 100; // Safety limit

    do {
      const pageParams = { ...params };
      if (nextPage) {
        pageParams.page = nextPage;
      }

      const response = await apiRequest<StripeSearchResponse>(
        resourceInfo.path,
        { method: "GET", params: pageParams },
        profile,
      );

      const items = response.data ?? [];
      allItems.push(...items);

      nextPage = response.has_more ? response.next_page : undefined;
      pageCount++;
    } while (nextPage && pageCount < maxPages);

    if (allItems.length === 0) {
      log("No results found.");
      return;
    }

    // Use module columns if available, otherwise auto-detect
    const module = modules[resourceInfo.moduleName];
    if (module && format !== "json") {
      const output = formatOutput(allItems, module.columns, format);
      log(output);
    } else {
      const output = autoFormatRawResponse(
        { object: "search_result", data: allItems },
        format,
      );
      log(output);
    }
  } catch (err) {
    error(
      `Search failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
}

/**
 * Print help for the search command.
 */
function printSearchHelp(): void {
  log("Usage: xstripe search <resource> --query \"...\" [options]");
  log("");
  log("Search Stripe resources using the Search API.");
  log("");
  log("Arguments:");
  log("  resource            Resource to search (see list below)");
  log("");
  log("Options:");
  log("  -q, --query <str>   Search query (Stripe search syntax, required)");
  log("  --limit <n>         Limit results per page (max 100)");
  log("  --json              Output raw JSON");
  log("  --profile <name>    Use a specific profile");
  log("  -h, --help          Show this help");
  log("");
  log("Searchable resources:");
  log("  customers           Search by email, name, phone, metadata");
  log("  charges             Search by amount, status, customer, metadata");
  log("  payment-intents     Search by amount, status, customer, metadata");
  log("  subscriptions       Search by status, customer, price, metadata");
  log("  invoices            Search by status, customer, subscription, metadata");
  log("  products            Search by name, active, metadata");
  log("  prices              Search by product, currency, type, metadata");
  log("");
  log("Query syntax:");
  log("  field:'value'       Exact match");
  log("  field~'value'       Substring match");
  log("  field>N             Greater than");
  log("  field<N             Less than");
  log("  field>=N            Greater than or equal");
  log("  field<=N            Less than or equal");
  log("  A AND B             Both conditions");
  log("  A OR B              Either condition");
  log("  -field:'value'      Negation");
  log("");
  log("Examples:");
  log("  xstripe search customers --query \"email:'john@example.com'\"");
  log("  xstripe search charges --query \"amount>5000 AND status:'succeeded'\"");
  log("  xstripe search products --query \"name~'Premium'\"");
  log("  xstripe search invoices --query \"customer:'cus_123'\" --limit 10");
  log("");
  log("Docs: https://stripe.com/docs/search");
}
