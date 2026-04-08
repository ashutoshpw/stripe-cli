import type { BaseModule } from "../modules/base-module.ts";
import {
  formatOutput,
  formatSingleRecord,
  type OutputFormat,
} from "../output/formatter.ts";
import { loadProfileConfig, resolveProfile } from "../config/config-manager.ts";
import { log, error } from "../utils/logger.ts";

/**
 * Parsed flags for a module command.
 */
export interface ModuleFlags {
  /** Record ID for get command */
  id?: string;
  /** Output format */
  format: OutputFormat;
  /** Force refresh cache */
  refresh: boolean;
  /** Skip cache entirely */
  noCache: boolean;
  /** Additional query params (--filter key=value) */
  params: Record<string, string>;
  /** Show help */
  help: boolean;
  /** Date filter: --from (parsed to unix timestamp) */
  from?: string;
  /** Date filter: --to (parsed to unix timestamp) */
  to?: string;
  /** Limit number of records */
  limit?: string;
  /** Fields to expand */
  expand: string[];
  /** Profile name */
  profile?: string;
}

/**
 * Parse a date string to a Unix timestamp (seconds).
 *
 * Accepts:
 *   - Unix timestamps (all digits): passed through
 *   - YYYY-MM-DD: parsed as local date at midnight
 *   - ISO 8601 (YYYY-MM-DDTHH:MM:SS): parsed directly
 *
 * Returns the timestamp as a string, or undefined if invalid.
 */
function parseDateToTimestamp(input: string): string | undefined {
  // Already a unix timestamp (all digits)
  if (/^\d+$/.test(input)) {
    return input;
  }

  // Try parsing as a date string
  const parsed = Date.parse(input);
  if (isNaN(parsed)) {
    error(`Invalid date: '${input}'. Use YYYY-MM-DD, ISO 8601, or Unix timestamp.`);
    return undefined;
  }

  return String(Math.floor(parsed / 1000));
}

/**
 * Parse module command flags from argv.
 *
 * Supports:
 *   - Positional ID argument (for get)
 *   - --json / --csv / --table
 *   - --refresh / --no-cache
 *   - --from / --to (date parsing)
 *   - --limit N
 *   - --expand field (repeatable)
 *   - --filter k=v (repeatable)
 *   - --profile name
 *   - Module-specific --<listParam> flags
 */
export function parseModuleFlags(
  args: string[],
  module: BaseModule,
): ModuleFlags {
  const flags: ModuleFlags = {
    format: "table",
    refresh: false,
    noCache: false,
    params: {},
    help: false,
    expand: [],
  };

  const listParamSet = new Set(module.listParams);

  let i = 0;

  while (i < args.length) {
    const arg = args[i]!;

    switch (arg) {
      case "--json":
        flags.format = "json";
        break;
      case "--csv":
        flags.format = "csv";
        break;
      case "--table":
        flags.format = "table";
        break;
      case "--refresh":
        flags.refresh = true;
        break;
      case "--no-cache":
        flags.noCache = true;
        break;
      case "--from":
        i++;
        if (args[i]) flags.from = args[i];
        break;
      case "--to":
        i++;
        if (args[i]) flags.to = args[i];
        break;
      case "--limit":
        i++;
        if (args[i]) flags.limit = args[i];
        break;
      case "--expand":
        i++;
        if (args[i]) flags.expand.push(args[i]!);
        break;
      case "--filter":
        i++;
        if (args[i]) {
          const eq = args[i]!.indexOf("=");
          if (eq > 0) {
            flags.params[args[i]!.slice(0, eq)] = args[i]!.slice(eq + 1);
          }
        }
        break;
      case "--profile":
        i++;
        if (args[i]) flags.profile = args[i];
        break;
      case "-h":
      case "--help":
        flags.help = true;
        break;
      default: {
        // Check if it's a module-specific list param (e.g., --customer, --status)
        if (arg.startsWith("--")) {
          const paramName = arg.slice(2);
          if (listParamSet.has(paramName)) {
            i++;
            if (args[i] !== undefined) {
              flags.params[paramName] = args[i]!;
            }
            break;
          }
        }

        // Positional argument = record ID
        if (!arg.startsWith("-") && !flags.id) {
          flags.id = arg;
        }
        break;
      }
    }
    i++;
  }

  return flags;
}

/**
 * Handle a module command (list or get).
 *
 * This is a read-only command handler. It routes to either:
 *   - `module.get(id)` — if a positional ID is provided
 *   - `module.list(params)` — otherwise
 */
export async function handleModuleCommand(
  module: BaseModule,
  args: string[],
): Promise<void> {
  const flags = parseModuleFlags(args, module);

  if (flags.help) {
    printModuleHelp(module);
    return;
  }

  // Resolve profile
  const profile = await resolveProfile(flags.profile);

  // Load profile config for default format
  const profileConfig = await loadProfileConfig(profile);
  const format = flags.format ?? profileConfig?.outputFormat ?? "table";

  // --- Get single record ---
  if (flags.id) {
    try {
      const record = await module.get(flags.id, {
        refresh: flags.refresh,
        noCache: flags.noCache,
        profile,
        expand: flags.expand.length > 0 ? flags.expand : undefined,
      });
      const output = formatSingleRecord(record, format);
      log(output);
    } catch (err) {
      error(
        `Failed to get ${module.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
    return;
  }

  // --- List records ---
  const params = { ...flags.params };

  // Apply date filters (convert to Stripe's created[gte]/created[lte])
  if (flags.from) {
    const ts = parseDateToTimestamp(flags.from);
    if (ts) params["created[gte]"] = ts;
  }
  if (flags.to) {
    const ts = parseDateToTimestamp(flags.to);
    if (ts) params["created[lte]"] = ts;
  }

  // Apply limit
  if (flags.limit) {
    params.limit = flags.limit;
  }

  // Apply expand
  if (flags.expand.length > 0) {
    for (let j = 0; j < flags.expand.length; j++) {
      params[`expand[${j}]`] = flags.expand[j]!;
    }
  }

  try {
    const records = await module.list({
      params,
      refresh: flags.refresh,
      noCache: flags.noCache,
      profile,
    });
    const output = formatOutput(records, module.columns, format);
    log(output);
  } catch (err) {
    error(
      `Failed to list ${module.name}: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
}

/**
 * Print help for a module command.
 */
function printModuleHelp(module: BaseModule): void {
  const alias = module.config.alias;
  const aliasStr = alias ? ` (alias: ${alias})` : "";

  log(`Usage: xstripe ${module.name} [id] [options]`);
  log("");
  log(`Browse Stripe ${module.name}${aliasStr}.`);
  log("");
  log("Commands:");
  log(`  (none)              List all ${module.name}`);
  log(`  <id>                Get a specific record by ID`);
  log("");
  log("Options:");
  log("  --json              Output as JSON");
  log("  --csv               Output as CSV");
  log("  --table             Output as table (default)");
  log("  --refresh           Bypass cache and fetch fresh data");
  log("  --no-cache          Skip cache entirely");
  log("  --from <date>       Filter from date (YYYY-MM-DD, ISO 8601, or Unix timestamp)");
  log("  --to <date>         Filter to date (YYYY-MM-DD, ISO 8601, or Unix timestamp)");
  log("  --limit <n>         Limit number of records per page");
  log("  --expand <field>    Expand a nested object (repeatable)");
  log("  --filter k=v        Add a query parameter (repeatable)");
  log("  --profile <name>    Use a specific profile");
  log("  -h, --help          Show this help");

  // Module-specific params
  if (module.listParams.length > 0) {
    log("");
    log("Module-specific filters:");
    const hints = module.config.listParamHints ?? {};
    for (const param of module.listParams) {
      const values = hints[param];
      if (values) {
        log(`  --${param.padEnd(20)} Filter by ${param} (${values.join(", ")})`);
      } else {
        log(`  --${param.padEnd(20)} Filter by ${param}`);
      }
    }
  }

  // Search hint
  if (module.searchable) {
    log("");
    log("Search:");
    log(`  xstripe search ${module.name} --query "..."    Full-text search`);
  }

  log("");
  log("Examples:");
  log(`  xstripe ${module.name}                            # List all`);
  log(`  xstripe ${module.name} --json                     # List as JSON`);
  log(`  xstripe ${module.name} <id>                       # Get by ID`);
  log(`  xstripe ${module.name} --from 2024-01-01          # Filter by date`);
  log(`  xstripe ${module.name} <id> --expand customer     # Expand nested object`);
  if (alias) {
    log(`  xstripe ${alias}                                  # Using alias`);
  }
}
