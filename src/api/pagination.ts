import { apiRequest, type StripeListResponse } from "./client.ts";
import { verbose } from "../utils/logger.ts";

/**
 * Result of a paginated fetch.
 */
export interface PaginatedResult<T> {
  /** All records merged from all pages */
  items: T[];
  /** Total number of records retrieved */
  totalCount: number;
}

/**
 * Fetch all pages of a paginated Stripe endpoint.
 *
 * Stripe uses cursor-based pagination with `starting_after` and `has_more`.
 * Max 100 items per request. This function automatically fetches
 * subsequent pages until all records are retrieved.
 *
 * @param path - API path (e.g., "/customers")
 * @param params - Additional query parameters
 * @param profile - Profile name for auth
 * @returns All records merged from all pages
 */
export async function fetchAllPages<T extends { id: string } = Record<string, unknown> & { id: string }>(
  path: string,
  params: Record<string, string> = {},
  profile: string = "default",
): Promise<PaginatedResult<T>> {
  const allItems: T[] = [];
  const pageSize = params.limit ? parseInt(params.limit, 10) : 100;
  let startingAfter: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const pageParams: Record<string, string> = {
      ...params,
      limit: String(Math.min(pageSize, 100)),
    };

    if (startingAfter) {
      pageParams.starting_after = startingAfter;
    }

    verbose(
      `Fetching ${path} (limit: ${pageParams.limit}${startingAfter ? `, starting_after: ${startingAfter}` : ""})`,
    );

    const response = await apiRequest<StripeListResponse<T>>(
      path,
      { method: "GET", params: pageParams },
      profile,
    );

    const items = response.data ?? [];
    allItems.push(...items);

    verbose(`Got ${items.length} records (total: ${allItems.length})`);

    // Check if there are more pages
    hasMore = response.has_more === true;

    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1]!;
      startingAfter = lastItem.id;
    } else {
      hasMore = false;
    }

    // Safety: prevent infinite loops (max 100 pages = 10k records)
    if (allItems.length >= 10000) {
      verbose("Pagination safety limit reached (10000 records)");
      break;
    }
  }

  return {
    items: allItems,
    totalCount: allItems.length,
  };
}
