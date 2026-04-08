import { apiGet } from "../api/client.ts";
import { fetchAllPages } from "../api/pagination.ts";
import { readCache, writeCache } from "../cache/cache-manager.ts";
import { listCacheFilename, getCacheFilename } from "../cache/cache-key.ts";
import { loadProfileConfig } from "../config/config-manager.ts";
import { verbose } from "../utils/logger.ts";
import type { Column } from "../output/table.ts";

/**
 * Configuration for a Stripe module.
 *
 * Each module (customers, charges, etc.) provides a config
 * object that defines its API path, columns, and capabilities.
 */
export interface ModuleConfig {
  /** Module name (e.g., "customers", "charges") */
  name: string;
  /** API path (e.g., "/customers", "/charges") */
  apiPath: string;
  /** Column definitions for table display */
  columns: Column[];
  /** ID prefix for this entity (e.g., "cus_", "ch_") — informational only */
  idPrefix?: string;
  /** Whether this resource supports the Stripe Search API */
  searchable?: boolean;
  /** Search API path (e.g., "/customers/search") — defaults to `${apiPath}/search` */
  searchPath?: string;
  /**
   * Module-specific filter parameters accepted on list.
   * e.g., ["customer", "status"] for subscriptions.
   * These are exposed as --<param> flags on the CLI.
   */
  listParams?: string[];
  /**
   * Optional hints showing possible values for list params.
   * e.g., { status: ["pending", "paid", "failed", "canceled"] }
   * Displayed in --help output.
   */
  listParamHints?: Record<string, string[]>;
  /** Short alias for the module (e.g., "cust" for customers) */
  alias?: string;
}

/**
 * Options for a list command.
 */
export interface ListOptions {
  /** Query parameters to pass to the API */
  params?: Record<string, string>;
  /** Force refresh (bypass cache, but update it) */
  refresh?: boolean;
  /** Skip cache entirely */
  noCache?: boolean;
  /** Cache TTL override in seconds */
  cacheTtl?: number;
  /** Profile name */
  profile?: string;
}

/**
 * Options for a get command.
 */
export interface GetOptions {
  /** Force refresh */
  refresh?: boolean;
  /** Skip cache entirely */
  noCache?: boolean;
  /** Cache TTL override in seconds */
  cacheTtl?: number;
  /** Profile name */
  profile?: string;
  /** Fields to expand (Stripe expand[]) */
  expand?: string[];
}

/**
 * Read-only base module for Stripe resources.
 *
 * Provides cache-aware `list()` and `get()` methods.
 * All Stripe modules (customers, charges, etc.) extend this
 * with their specific config. No create/update/delete — this
 * CLI is a read-only data browser.
 */
export class BaseModule {
  constructor(public readonly config: ModuleConfig) {}

  /** Module name */
  get name(): string {
    return this.config.name;
  }

  /** Column definitions for table output */
  get columns(): Column[] {
    return this.config.columns;
  }

  /** Module-specific list params */
  get listParams(): string[] {
    return this.config.listParams ?? [];
  }

  /** Whether module supports search */
  get searchable(): boolean {
    return this.config.searchable ?? false;
  }

  /** Search API path */
  get searchPath(): string {
    return this.config.searchPath ?? `${this.config.apiPath}/search`;
  }

  /**
   * List all records, with caching and auto-pagination.
   *
   * Uses cursor-based pagination (starting_after / has_more).
   * Results are cached per-profile under ~/.xstripe/cache/<profile>/<module>/
   */
  async list(options: ListOptions = {}): Promise<Record<string, unknown>[]> {
    const profile = options.profile ?? "default";
    const profileConfig = await loadProfileConfig(profile);
    const ttl = options.cacheTtl ?? profileConfig?.cacheTtl ?? 3600;
    const params = options.params ?? {};

    // Check cache first (unless --refresh or --no-cache)
    if (!options.refresh && !options.noCache) {
      const filename = await listCacheFilename(params);
      const cached = await readCache<Record<string, unknown>[]>(
        profile,
        this.config.name,
        filename,
        ttl,
      );
      if (cached) {
        verbose(`Using cached data for ${this.config.name} list`);
        return cached.data;
      }
    }

    // Fetch from API
    verbose(`Fetching ${this.config.name} from API`);

    const result = await fetchAllPages<Record<string, unknown> & { id: string }>(
      this.config.apiPath,
      params,
      profile,
    );

    // Write to cache (unless --no-cache)
    if (!options.noCache) {
      const filename = await listCacheFilename(params);
      await writeCache(profile, this.config.name, filename, result.items, ttl, {
        totalCount: result.totalCount,
      });
    }

    return result.items;
  }

  /**
   * Get a single record by ID, with caching.
   */
  async get(
    id: string,
    options: GetOptions = {},
  ): Promise<Record<string, unknown>> {
    const profile = options.profile ?? "default";
    const profileConfig = await loadProfileConfig(profile);
    const ttl = options.cacheTtl ?? profileConfig?.cacheTtl ?? 3600;

    // Check cache first
    if (!options.refresh && !options.noCache) {
      const filename = getCacheFilename(id);
      const cached = await readCache<Record<string, unknown>>(
        profile,
        this.config.name,
        filename,
        ttl,
      );
      if (cached) {
        verbose(`Using cached data for ${this.config.name}/${id}`);
        return cached.data;
      }
    }

    // Build params for expand support
    const params: Record<string, string> = {};
    if (options.expand && options.expand.length > 0) {
      for (let i = 0; i < options.expand.length; i++) {
        params[`expand[${i}]`] = options.expand[i]!;
      }
    }

    // Fetch from API
    verbose(`Fetching ${this.config.name}/${id} from API`);
    const record = await apiGet<Record<string, unknown>>(
      `${this.config.apiPath}/${id}`,
      Object.keys(params).length > 0 ? params : undefined,
      profile,
    );

    // Write to cache
    if (!options.noCache) {
      const filename = getCacheFilename(id);
      await writeCache(profile, this.config.name, filename, record, ttl);
    }

    return record;
  }
}
