import { apiRequest } from "../api/client.ts";
import { autoFormatRawResponse, type OutputFormat } from "../output/formatter.ts";
import { resolveProfile } from "../config/config-manager.ts";
import { log, error } from "../utils/logger.ts";

/**
 * Parsed flags for the raw API command.
 */
export interface RawFlags {
  /** HTTP method (default: GET) */
  method: "GET" | "POST";
  /** API path (e.g., /customers, /charges/ch_123) */
  path?: string;
  /** Query parameters (--param key=value) */
  params: Record<string, string>;
  /** Output as JSON (skip auto-table) */
  json: boolean;
  /** Profile name */
  profile?: string;
  /** Show help */
  help: boolean;
}

/**
 * Parse raw command flags from argv.
 */
export function parseRawFlags(args: string[]): RawFlags {
  const flags: RawFlags = {
    method: "GET",
    params: {},
    json: false,
    help: false,
  };

  let i = 0;
  let positionalIndex = 0;

  while (i < args.length) {
    const arg = args[i]!;

    switch (arg) {
      case "-X":
      case "--method":
        i++;
        if (args[i]) {
          const m = args[i]!.toUpperCase();
          if (m === "GET" || m === "POST") {
            flags.method = m;
          }
        }
        break;
      case "--param":
        i++;
        if (args[i]) {
          const eq = args[i]!.indexOf("=");
          if (eq > 0) {
            flags.params[args[i]!.slice(0, eq)] = args[i]!.slice(eq + 1);
          }
        }
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
            // Could be method or path
            const upper = arg.toUpperCase();
            if (upper === "GET" || upper === "POST") {
              flags.method = upper as RawFlags["method"];
            } else {
              flags.path = normalizePath(arg);
            }
          } else if (positionalIndex === 1 && !flags.path) {
            flags.path = normalizePath(arg);
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
 * Ensure the path starts with a forward slash.
 */
function normalizePath(p: string): string {
  return p.startsWith("/") ? p : `/${p}`;
}

/**
 * Handle the `xstripe raw` command.
 *
 * Makes an authenticated GET request to any Stripe API path.
 * Auto-detects response format and renders as table unless --json is passed.
 *
 * Usage:
 *   xstripe raw /customers
 *   xstripe raw /charges/ch_123
 *   xstripe raw /customers --param limit=5
 *   xstripe raw /customers --json
 *   xstripe raw /customers --profile live
 */
export async function handleRaw(args: string[]): Promise<void> {
  const flags = parseRawFlags(args);

  if (flags.help) {
    printRawHelp();
    return;
  }

  if (!flags.path) {
    error("API path required.");
    error("Usage: xstripe raw <path> [options]");
    error("Run 'xstripe raw --help' for usage.");
    process.exit(1);
  }

  const profile = await resolveProfile(flags.profile);

  try {
    const response = await apiRequest<unknown>(
      flags.path,
      {
        method: flags.method,
        params: Object.keys(flags.params).length > 0 ? flags.params : undefined,
      },
      profile,
    );

    // Auto-format: table rendering for list/search responses, key-value for single objects
    const format: OutputFormat = flags.json ? "json" : "table";
    const output = autoFormatRawResponse(response, format);
    log(output);
  } catch (err) {
    error(
      `API request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
}

/**
 * Print help for the raw command.
 */
function printRawHelp(): void {
  log("Usage: xstripe raw <path> [options]");
  log("");
  log("Make raw authenticated API requests to Stripe.");
  log("Auth headers are injected automatically. GET-only by default.");
  log("");
  log("Arguments:");
  log("  path                API path (e.g., /customers, /charges/ch_123)");
  log("");
  log("Options:");
  log("  -X, --method <m>    HTTP method (GET or POST, default: GET)");
  log("  --param k=v         Add a query parameter (repeatable)");
  log("  --json              Output raw JSON (skip auto-table rendering)");
  log("  --profile <name>    Use a specific profile");
  log("  -h, --help          Show this help");
  log("");
  log("Examples:");
  log("  xstripe raw /customers");
  log("  xstripe raw /customers --param limit=5");
  log("  xstripe raw /charges/ch_123 --json");
  log("  xstripe raw /balance");
  log("  xstripe raw /customers --profile live");
  log("");
  log("The response is auto-formatted as a table when possible.");
  log("Use --json to get the raw JSON response instead.");
}
