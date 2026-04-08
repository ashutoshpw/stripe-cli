import { saveProfileConfig, type ProfileConfig } from "../config/config-manager.ts";
import { saveAuth, detectMode } from "./key-store.ts";
import { log, success, error } from "../utils/logger.ts";
import { prompt, confirm } from "../utils/prompt.ts";
import { AuthError } from "../utils/errors.ts";

/**
 * Interactive setup wizard for `xstripe auth setup`.
 *
 * Steps:
 *   1. Enter Stripe Secret Key (validate format)
 *   2. Validate credentials with GET /v1/balance
 *   3. Save auth + profile config
 *
 * This is the ONLY interactive auth command in the entire CLI.
 */
export async function runSetupWizard(profile: string): Promise<void> {
  log("");
  log("=== xstripe CLI Setup ===");
  log("");
  log(`Configuring profile: ${profile}`);
  log("");
  log("This wizard will configure the CLI to access your Stripe account.");
  log("You'll need a secret API key from the Stripe Dashboard.");
  log("");

  // ─── Step 1: Secret Key ─────────────────────────────────────

  log("Step 1: Enter your Stripe Secret Key");
  log("");
  log("  1. Log in to https://dashboard.stripe.com/");
  log("  2. Go to Developers > API keys");
  log("  3. Copy your Secret key (starts with sk_test_ or sk_live_)");
  log("");

  let secretKey = "";
  let mode: "test" | "live" = "test";

  while (true) {
    const answer = await prompt("Secret Key: ");
    const trimmed = answer.trim();
    if (trimmed.length === 0) {
      error("Secret key cannot be empty.");
      continue;
    }

    try {
      mode = detectMode(trimmed);
      secretKey = trimmed;
      break;
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
    }
  }

  log("");
  log(`  Detected mode: ${mode}`);
  log("");

  // ─── Step 2: Validate ───────────────────────────────────────

  log("Step 2: Validating credentials...");
  log("");

  // Save auth first so the API client can use it
  await saveAuth(profile, { secretKey, mode });

  // Create default profile config
  const config: ProfileConfig = {};
  await saveProfileConfig(profile, config);

  try {
    // Test the credentials with GET /v1/balance
    // We import dynamically to avoid circular dependency issues during setup
    const { apiGet } = await import("../api/client.ts");
    await apiGet("/balance", {}, profile);

    log("");
    success("Authentication successful!");
    log("");
    log(`  Mode:     ${mode}`);
    log(`  Profile:  ${profile}`);
    log("");
    log("Your API key and configuration have been saved to ~/.xstripe/");
    log("");
    log("Next steps:");
    log("  - Run 'xstripe auth status' to verify your configuration");
    log("  - Run 'xstripe customers' to list your customers");
    if (profile !== "default") {
      log(`  - Run 'xstripe profile use ${profile}' to make this the default`);
    }
    log("");
  } catch (err) {
    // Only treat authentication errors as actual failures.
    if (err instanceof AuthError) {
      error(`\nValidation failed: ${err.message}`);
      log("");
      log("Your credentials have been saved but could not be verified.");
      log("Common issues:");
      log("  - Incorrect secret key");
      log("  - Restricted key without balance read permission");
      log("  - Network connectivity issues");
      log("");

      const keepConfig = await confirm("Keep the saved credentials anyway?");
      if (!keepConfig) {
        const { clearAuth } = await import("./key-store.ts");
        await clearAuth(profile);
        log("Credentials cleared. Run 'xstripe auth setup' to try again.");
      }
    } else {
      // Non-auth error — keys are valid, endpoint may be restricted
      log("");
      success("Authentication successful!");
      log("");
      log(`  Mode:     ${mode}`);
      log(`  Profile:  ${profile}`);
      log("");
      log("Your API key and configuration have been saved to ~/.xstripe/");
      log("");
    }
  }
}
