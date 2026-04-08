import {
  clearAllCache,
  clearProfileCache,
  clearModuleCache,
  getCacheStats,
} from "../cache/cache-manager.ts";
import { resolveProfile } from "../config/config-manager.ts";
import { CACHE_DIR } from "../config/paths.ts";
import { log, error, success } from "../utils/logger.ts";

/**
 * Handle `xstripe cache <subcommand>`
 *
 * Profile-scoped cache management.
 */
export async function cacheCommand(args: string[]): Promise<void> {
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
    case "clear":
      return cacheClear(profile, filteredArgs.slice(1));
    case "stats":
      return cacheStats(profile);
    default:
      printCacheHelp();
      if (subcommand) {
        error(`\nUnknown subcommand: ${subcommand}`);
      }
      process.exit(subcommand ? 1 : 0);
  }
}

/**
 * `xstripe cache clear [module] [--all]`
 *
 * - No args: clear cache for current profile
 * - With module name: clear that module's cache only
 * - With --all: clear cache for ALL profiles
 */
async function cacheClear(profile: string, args: string[]): Promise<void> {
  const hasAllFlag = args.includes("--all");
  const moduleName = args.find((a) => !a.startsWith("-"));

  if (hasAllFlag) {
    await clearAllCache();
    success("All cache cleared (all profiles).");
    return;
  }

  if (moduleName) {
    const count = await clearModuleCache(profile, moduleName);
    success(
      `Cleared ${count} cached file${count === 1 ? "" : "s"} for ${moduleName} (profile: ${profile}).`,
    );
  } else {
    await clearProfileCache(profile);
    success(`All cache cleared for profile '${profile}'.`);
  }
}

/**
 * `xstripe cache stats` — Show cache statistics.
 */
async function cacheStats(profile: string): Promise<void> {
  const stats = await getCacheStats(profile);

  log(`Cache Statistics (profile: ${profile}):`);
  log(`  Directory:    ${CACHE_DIR}`);
  log(`  Total files:  ${stats.totalFiles}`);
  log(`  Total size:   ${formatBytes(stats.totalBytes)}`);

  if (Object.keys(stats.modules).length > 0) {
    log("");
    log("  By module:");
    for (const [mod, count] of Object.entries(stats.modules)) {
      log(`    ${mod.padEnd(20)} ${count} file${count === 1 ? "" : "s"}`);
    }
  }
}

/**
 * Format bytes to human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Print help for the cache command.
 */
function printCacheHelp(): void {
  log("Usage: xstripe cache <subcommand> [--profile <name>]");
  log("");
  log("Manage cached API responses.");
  log("");
  log("Subcommands:");
  log("  clear [module]   Clear cache (profile or specific module)");
  log("  clear --all      Clear cache for all profiles");
  log("  stats            Show cache statistics");
  log("");
  log("Options:");
  log("  --profile <name>    Target a specific profile");
  log("");
  log("Examples:");
  log("  xstripe cache stats                       # Show stats");
  log("  xstripe cache clear                       # Clear current profile cache");
  log("  xstripe cache clear customers             # Clear customers cache only");
  log("  xstripe cache clear --all                 # Clear all profiles");
  log("  xstripe cache stats --profile live        # Stats for 'live' profile");
}
