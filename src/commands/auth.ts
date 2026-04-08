import { runSetupWizard } from "../auth/setup-wizard.ts";
import { loadAuth, clearAuth } from "../auth/key-store.ts";
import { loadProfileConfig, resolveProfile } from "../config/config-manager.ts";
import { profileAuthPath, profileConfigPath } from "../config/paths.ts";
import { log, success, error } from "../utils/logger.ts";

/**
 * Handle `xstripe auth <subcommand>`
 *
 * All subcommands accept --profile to target a specific profile.
 */
export async function authCommand(args: string[]): Promise<void> {
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
    case "setup":
      return authSetup(profile);
    case "status":
      return authStatus(profile);
    case "clear":
      return authClear(profile);
    case "-h":
    case "--help":
    case undefined:
      printAuthHelp();
      process.exit(0);
    default:
      printAuthHelp();
      error(`\nUnknown subcommand: ${subcommand}`);
      process.exit(1);
  }
}

/**
 * `xstripe auth setup` — Run the interactive setup wizard.
 */
async function authSetup(profile: string): Promise<void> {
  await runSetupWizard(profile);
}

/**
 * `xstripe auth status` — Show current authentication status.
 */
async function authStatus(profile: string): Promise<void> {
  const authPath = profileAuthPath(profile);
  const configPath = profileConfigPath(profile);

  log(`Profile: ${profile}`);
  log("");

  const profileConfig = await loadProfileConfig(profile);
  log("Configuration:");
  log(`  Config file:     ${configPath}`);
  log(`  Output format:   ${profileConfig?.outputFormat ?? "table"}`);
  log(`  Cache TTL:       ${profileConfig?.cacheTtl ?? 3600}s`);
  log("");

  const auth = await loadAuth(profile);
  if (!auth) {
    log("Authentication: Not configured");
    log(`  Auth file: ${authPath} (not found)`);
    log("");
    log(`Run 'xstripe auth setup --profile ${profile}' to configure.`);
    return;
  }

  success("Authentication: Configured");
  log(`  Mode:         ${auth.mode}`);
  log(`  Secret key:   ${auth.secretKey.slice(0, 12)}...${"*".repeat(8)}`);
  log(`  Auth file:    ${authPath}`);
  log("");
  log("Note: Stripe uses Bearer Auth. Keys don't expire unless revoked.");
}

/**
 * `xstripe auth clear` — Remove stored credentials.
 */
async function authClear(profile: string): Promise<void> {
  await clearAuth(profile);
  success(`Credentials cleared for profile '${profile}'.`);
  log(`Run 'xstripe auth setup --profile ${profile}' to re-configure.`);
}

/**
 * Print help for the auth command.
 */
function printAuthHelp(): void {
  log("Usage: xstripe auth <subcommand> [--profile <name>]");
  log("");
  log("Manage authentication with the Stripe API.");
  log("");
  log("Subcommands:");
  log("  setup     Interactive setup wizard (configure API key)");
  log("  status    Show current authentication status");
  log("  clear     Remove stored credentials");
  log("");
  log("Options:");
  log("  --profile <name>    Target a specific profile (default: 'default')");
  log("");
  log("Examples:");
  log("  xstripe auth setup                     # Setup default profile");
  log("  xstripe auth setup --profile live       # Setup 'live' profile");
  log("  xstripe auth status                    # Check status");
  log("  xstripe auth clear                     # Remove credentials");
}
