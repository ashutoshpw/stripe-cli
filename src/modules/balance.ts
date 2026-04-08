import { BaseModule, type ModuleConfig } from "./base-module.ts";
import { formatAmount } from "../output/table.ts";
import { apiGet } from "../api/client.ts";
import { loadProfileConfig, resolveProfile } from "../config/config-manager.ts";
import { readCache, writeCache } from "../cache/cache-manager.ts";
import { fetchAllPages } from "../api/pagination.ts";
import { listCacheFilename, getCacheFilename } from "../cache/cache-key.ts";
import { verbose } from "../utils/logger.ts";
import type { Column } from "../output/table.ts";
import type { ListOptions, GetOptions } from "./base-module.ts";

/**
 * Balance Transactions columns (for the sub-resource).
 */
const balanceTransactionColumns: Column[] = [
  { header: "ID", key: "id", minWidth: 22 },
  {
    header: "Amount",
    key: "amount",
    align: "right",
    transform: (val: unknown, row?: Record<string, unknown>) =>
      formatAmount(val, row?.currency),
  },
  {
    header: "Fee",
    key: "fee",
    align: "right",
    transform: (val: unknown, row?: Record<string, unknown>) =>
      formatAmount(val, row?.currency),
  },
  {
    header: "Net",
    key: "net",
    align: "right",
    transform: (val: unknown, row?: Record<string, unknown>) =>
      formatAmount(val, row?.currency),
  },
  { header: "Currency", key: "currency", maxWidth: 6 },
  { header: "Type", key: "type", maxWidth: 18 },
  { header: "Status", key: "status", maxWidth: 12 },
  { header: "Source", key: "source", maxWidth: 22 },
  {
    header: "Created",
    key: "created",
    transform: (val: unknown) => {
      if (val === null || val === undefined) return "";
      const num = typeof val === "number" ? val : Number(val);
      if (isNaN(num)) return String(val);
      const d = new Date(num * 1000);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const h = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      return `${y}-${m}-${day} ${h}:${min}`;
    },
  },
];

/**
 * Balance module — SPECIAL.
 *
 * Unlike other modules:
 *   - `xstripe balance` → GET /v1/balance (single object, no list)
 *   - `xstripe balance transactions` → list /v1/balance_transactions
 *   - `xstripe balance transactions <id>` → GET /v1/balance_transactions/<id>
 *
 * This module extends BaseModule but overrides list/get behavior.
 */
class BalanceModule extends BaseModule {
  /** Columns for balance transactions sub-resource */
  readonly txnColumns: Column[] = balanceTransactionColumns;

  /**
   * Get current balance (GET /v1/balance).
   * This is a single object, not a list.
   */
  async getBalance(
    options: GetOptions = {},
  ): Promise<Record<string, unknown>> {
    const profile = options.profile ?? "default";
    const profileConfig = await loadProfileConfig(profile);
    const ttl = options.cacheTtl ?? profileConfig?.cacheTtl ?? 3600;

    // Check cache
    if (!options.refresh && !options.noCache) {
      const filename = getCacheFilename("balance");
      const cached = await readCache<Record<string, unknown>>(
        profile,
        "balance",
        filename,
        ttl,
      );
      if (cached) {
        verbose("Using cached balance data");
        return cached.data;
      }
    }

    const record = await apiGet<Record<string, unknown>>(
      "/balance",
      undefined,
      profile,
    );

    // Cache it
    if (!options.noCache) {
      const filename = getCacheFilename("balance");
      await writeCache(profile, "balance", filename, record, ttl);
    }

    return record;
  }

  /**
   * List balance transactions.
   */
  async listTransactions(
    options: ListOptions = {},
  ): Promise<Record<string, unknown>[]> {
    const profile = options.profile ?? "default";
    const profileConfig = await loadProfileConfig(profile);
    const ttl = options.cacheTtl ?? profileConfig?.cacheTtl ?? 3600;
    const params = options.params ?? {};

    // Check cache
    if (!options.refresh && !options.noCache) {
      const filename = await listCacheFilename(params);
      const cached = await readCache<Record<string, unknown>[]>(
        profile,
        "balance-transactions",
        filename,
        ttl,
      );
      if (cached) {
        verbose("Using cached balance transaction data");
        return cached.data;
      }
    }

    const result = await fetchAllPages<
      Record<string, unknown> & { id: string }
    >("/balance_transactions", params, profile);

    // Cache
    if (!options.noCache) {
      const filename = await listCacheFilename(params);
      await writeCache(
        profile,
        "balance-transactions",
        filename,
        result.items,
        ttl,
        { totalCount: result.totalCount },
      );
    }

    return result.items;
  }

  /**
   * Get a single balance transaction.
   */
  async getTransaction(
    id: string,
    options: GetOptions = {},
  ): Promise<Record<string, unknown>> {
    const profile = options.profile ?? "default";
    const profileConfig = await loadProfileConfig(profile);
    const ttl = options.cacheTtl ?? profileConfig?.cacheTtl ?? 3600;

    // Check cache
    if (!options.refresh && !options.noCache) {
      const filename = getCacheFilename(id);
      const cached = await readCache<Record<string, unknown>>(
        profile,
        "balance-transactions",
        filename,
        ttl,
      );
      if (cached) {
        verbose(`Using cached balance transaction ${id}`);
        return cached.data;
      }
    }

    const record = await apiGet<Record<string, unknown>>(
      `/balance_transactions/${id}`,
      undefined,
      profile,
    );

    if (!options.noCache) {
      const filename = getCacheFilename(id);
      await writeCache(profile, "balance-transactions", filename, record, ttl);
    }

    return record;
  }
}

/**
 * The balance module columns are for the top-level balance object display.
 * We use a simple key-value display for the balance object itself.
 */
export const balanceModule = new BalanceModule({
  name: "balance",
  apiPath: "/balance",
  alias: "bal",
  searchable: false,
  columns: balanceTransactionColumns,
  listParams: ["type", "source", "payout"],
});
