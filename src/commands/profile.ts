import {
  loadGlobalConfig,
  updateGlobalConfig,
  resolveProfile,
  loadProfileConfig,
} from "../config/config-manager.ts";
import { loadAuth, clearAuth } from "../auth/key-store.ts";
import { clearProfileCache } from "../cache/cache-manager.ts";
import {
  PROFILES_DIR,
  profileDir,
  ensureProfileDir,
} from "../config/paths.ts";
import { log, error, success, warn } from "../utils/logger.ts";
import { confirm } from "../utils/prompt.ts";
import { readdir, rm } from "node:fs/promises";

/**
 * Handle `xstripe profile <subcommand>`
 *
 * Multi-profile management for different Stripe accounts / modes.
 */
export async function profileCommand(args: string[]): Promise<void> {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case "list":
    case "ls":
      return profileList();
    case "create":
      return profileCreate(subArgs);
    case "delete":
    case "rm":
      return profileDelete(subArgs);
    case "use":
      return profileUse(subArgs);
    case "show":
      return profileShow(subArgs);
    case "-h":
    case "--help":
    case undefined:
      printProfileHelp();
      process.exit(0);
    default:
      printProfileHelp();
      error(`\nUnknown subcommand: ${subcommand}`);
      process.exit(1);
  }
}

/**
 * `xstripe profile list` — List all configured profiles.
 */
async function profileList(): Promise<void> {
  const globalConfig = await loadGlobalConfig();
  const defaultProfile = globalConfig?.defaultProfile ?? "default";
  const currentProfile = await resolveProfile();

  let profiles: string[] = [];
  try {
    profiles = await readdir(PROFILES_DIR);
    // Filter to only directories
    const dirs: string[] = [];
    for (const name of profiles) {
      try {
        const stat = await Bun.file(profileDir(name) + "/auth.json").exists();
        const configExists = await Bun.file(
          profileDir(name) + "/config.json",
        ).exists();
        if (stat || configExists) {
          dirs.push(name);
        }
      } catch {
        // skip
      }
    }
    profiles = dirs;
  } catch {
    // No profiles directory yet
  }

  if (profiles.length === 0) {
    log("No profiles configured.");
    log("Run 'xstripe auth setup' to create the default profile.");
    return;
  }

  log("Profiles:");
  log("");
  for (const name of profiles) {
    const isDefault = name === defaultProfile;
    const isCurrent = name === currentProfile;
    const markers: string[] = [];
    if (isDefault) markers.push("default");
    if (isCurrent) markers.push("active");
    const suffix = markers.length > 0 ? ` (${markers.join(", ")})` : "";

    const auth = await loadAuth(name);
    const mode = auth ? auth.mode : "not configured";

    log(`  ${isCurrent ? "*" : " "} ${name.padEnd(20)} ${mode}${suffix}`);
  }
  log("");
}

/**
 * `xstripe profile create <name>` — Create a new profile.
 */
async function profileCreate(args: string[]): Promise<void> {
  const name = args[0];

  if (!name) {
    error("Profile name required. Usage: xstripe profile create <name>");
    process.exit(1);
  }

  // Validate profile name
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    error(
      "Invalid profile name. Use only letters, numbers, hyphens, and underscores.",
    );
    process.exit(1);
  }

  // Check if profile already exists
  const existingAuth = await loadAuth(name);
  if (existingAuth) {
    warn(`Profile '${name}' already exists.`);
    const overwrite = await confirm("Overwrite existing profile?", false);
    if (!overwrite) {
      log("Cancelled.");
      return;
    }
  }

  // Create profile directory
  await ensureProfileDir(name);

  // Run setup wizard for this profile
  const { runSetupWizard } = await import("../auth/setup-wizard.ts");
  await runSetupWizard(name);
}

/**
 * `xstripe profile delete <name>` — Delete a profile.
 */
async function profileDelete(args: string[]): Promise<void> {
  const name = args[0];

  if (!name) {
    error("Profile name required. Usage: xstripe profile delete <name>");
    process.exit(1);
  }

  if (name === "default") {
    error("Cannot delete the 'default' profile.");
    process.exit(1);
  }

  const auth = await loadAuth(name);
  if (!auth) {
    error(`Profile '${name}' does not exist.`);
    process.exit(1);
  }

  const confirmed = await confirm(
    `Delete profile '${name}'? This will remove credentials and cache.`,
    false,
  );
  if (!confirmed) {
    log("Cancelled.");
    return;
  }

  // Clear auth and cache
  await clearAuth(name);
  await clearProfileCache(name);

  // Remove profile directory
  try {
    await rm(profileDir(name), { recursive: true, force: true });
  } catch {
    // ignore
  }

  // If this was the default, reset default
  const globalConfig = await loadGlobalConfig();
  if (globalConfig?.defaultProfile === name) {
    await updateGlobalConfig({ defaultProfile: "default" });
    log("Default profile reset to 'default'.");
  }

  success(`Profile '${name}' deleted.`);
}

/**
 * `xstripe profile use <name>` — Set a profile as the default.
 */
async function profileUse(args: string[]): Promise<void> {
  const name = args[0];

  if (!name) {
    error("Profile name required. Usage: xstripe profile use <name>");
    process.exit(1);
  }

  const auth = await loadAuth(name);
  if (!auth) {
    warn(`Profile '${name}' has no credentials configured.`);
    log(`Run 'xstripe auth setup --profile ${name}' first.`);
    process.exit(1);
  }

  await updateGlobalConfig({ defaultProfile: name });
  success(`Default profile set to '${name}'.`);
  log(`  Mode: ${auth.mode}`);
}

/**
 * `xstripe profile show [name]` — Show details of a profile.
 */
async function profileShow(args: string[]): Promise<void> {
  const name = args[0] ?? (await resolveProfile());

  log(`Profile: ${name}`);
  log("");

  const auth = await loadAuth(name);
  if (auth) {
    log("Authentication:");
    log(`  Mode:         ${auth.mode}`);
    log(`  Secret key:   ${auth.secretKey.slice(0, 12)}...${"*".repeat(8)}`);
  } else {
    log("Authentication: Not configured");
  }
  log("");

  const config = await loadProfileConfig(name);
  if (config) {
    log("Configuration:");
    log(`  Output format:  ${config.outputFormat ?? "table"}`);
    log(`  Cache TTL:      ${config.cacheTtl ?? 3600}s`);
  } else {
    log("Configuration: Not set (using defaults)");
  }
}

/**
 * Print help for the profile command.
 */
function printProfileHelp(): void {
  log("Usage: xstripe profile <subcommand>");
  log("");
  log("Manage multiple Stripe profiles (accounts / modes).");
  log("");
  log("Subcommands:");
  log("  list (ls)        List all configured profiles");
  log("  create <name>    Create a new profile (runs setup wizard)");
  log("  delete <name>    Delete a profile and its data");
  log("  use <name>       Set a profile as the default");
  log("  show [name]      Show profile details (default: current profile)");
  log("");
  log("Examples:");
  log("  xstripe profile list                # List profiles");
  log("  xstripe profile create live         # Create 'live' profile");
  log("  xstripe profile use live            # Switch to 'live'");
  log("  xstripe profile show live           # Show 'live' details");
  log("  xstripe profile delete live         # Delete 'live'");
  log("");
  log("Tips:");
  log("  - Use --profile <name> on any command to override the default");
  log("  - Set XSTRIPE_PROFILE env var to override the default globally");
}
