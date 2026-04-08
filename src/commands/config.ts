import {
  loadProfileConfig,
  updateProfileConfig,
  resolveProfile,
  type ProfileConfig,
} from "../config/config-manager.ts";
import { profileConfigPath } from "../config/paths.ts";
import { log, error, success } from "../utils/logger.ts";

/**
 * Handle `xstripe config <subcommand>`
 *
 * Profile-scoped configuration management.
 */
export async function configCommand(args: string[]): Promise<void> {
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
  const subcommand = filteredArgs[0];

  switch (subcommand) {
    case "show":
      return configShow(profile);
    case "set":
      return configSet(profile, filteredArgs.slice(1));
    default:
      printConfigHelp();
      if (subcommand) {
        error(`\nUnknown subcommand: ${subcommand}`);
      }
      process.exit(subcommand ? 1 : 0);
  }
}

/**
 * `xstripe config show` — Display current profile configuration.
 */
async function configShow(profile: string): Promise<void> {
  const config = await loadProfileConfig(profile);
  const path = profileConfigPath(profile);

  log(`Profile: ${profile}`);
  log("");

  if (!config) {
    log("No configuration found.");
    log(`Expected at: ${path}`);
    log(`Run 'xstripe auth setup --profile ${profile}' to configure.`);
    return;
  }

  log("Current Configuration:");
  log(`  outputFormat:    ${config.outputFormat ?? "table"}`);
  log(`  cacheTtl:        ${config.cacheTtl ?? 3600}s`);
  log("");
  log(`Config file: ${path}`);
}

/**
 * `xstripe config set <key> <value>` — Set a profile configuration value.
 */
async function configSet(profile: string, args: string[]): Promise<void> {
  const key = args[0];
  const value = args[1];

  if (!key || !value) {
    error("Usage: xstripe config set <key> <value> [--profile <name>]");
    log("");
    log("Settable keys:");
    log("  outputFormat     Default output format (json, table, csv)");
    log("  cacheTtl         Cache TTL in seconds (default: 3600)");
    process.exit(1);
  }

  const allowedKeys: Array<keyof ProfileConfig> = ["outputFormat", "cacheTtl"];

  if (!allowedKeys.includes(key as keyof ProfileConfig)) {
    error(`Cannot set '${key}'. Allowed keys: ${allowedKeys.join(", ")}`);
    process.exit(1);
  }

  // Type coercion
  let coerced: string | number = value;
  if (key === "cacheTtl") {
    coerced = parseInt(value, 10);
    if (isNaN(coerced) || coerced < 0) {
      error("cacheTtl must be a non-negative number (seconds).");
      process.exit(1);
    }
  }
  if (key === "outputFormat" && !["json", "table", "csv"].includes(value)) {
    error("outputFormat must be one of: json, table, csv");
    process.exit(1);
  }

  await updateProfileConfig(profile, {
    [key]: coerced,
  } as Partial<ProfileConfig>);
  success(`Set ${key} = ${value} (profile: ${profile})`);
}

/**
 * Print help for the config command.
 */
function printConfigHelp(): void {
  log("Usage: xstripe config <subcommand> [--profile <name>]");
  log("");
  log("Manage per-profile CLI configuration.");
  log("");
  log("Subcommands:");
  log("  show         Display current configuration");
  log("  set <k> <v>  Set a configuration value");
  log("");
  log("Settable keys:");
  log("  outputFormat     Default output format (json, table, csv)");
  log("  cacheTtl         Cache TTL in seconds (default: 3600)");
  log("");
  log("Options:");
  log("  --profile <name>    Target a specific profile");
  log("");
  log("Examples:");
  log("  xstripe config show");
  log("  xstripe config set outputFormat json");
  log("  xstripe config set cacheTtl 7200");
  log("  xstripe config set cacheTtl 7200 --profile live");
}
