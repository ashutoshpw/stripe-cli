/**
 * Simple ASCII table renderer for CLI output.
 * No dependencies — pure string manipulation.
 */

export interface Column {
  /** Column header label */
  header: string;
  /** Key to extract from each row object */
  key: string;
  /** Minimum width (default: header length) */
  minWidth?: number;
  /** Maximum width (truncate with ...) */
  maxWidth?: number;
  /** Alignment (default: left) */
  align?: "left" | "right";
  /**
   * Optional transform function.
   * Applied to the raw value before display.
   * Used for amount formatting, date conversion, etc.
   */
  transform?: (value: unknown, row?: Record<string, unknown>) => string;
}

/**
 * Render an array of objects as an ASCII table.
 *
 * Example output:
 *   ID              Email                Amount       Status
 *   ──────────────  ───────────────────  ───────────  ──────────
 *   cus_abc123      john@example.com     USD 125.00   active
 *   cus_def456      jane@example.com     USD 340.50   active
 */
export function renderTable(
  rows: Record<string, unknown>[],
  columns: Column[],
): string {
  if (rows.length === 0) {
    return "No records found.";
  }

  // Calculate column widths
  const widths = columns.map((col) => {
    let width = col.header.length;

    // Check all row values
    for (const row of rows) {
      const val = col.transform
        ? col.transform(row[col.key], row)
        : formatCellValue(row[col.key]);
      width = Math.max(width, val.length);
    }

    // Apply min/max constraints
    if (col.minWidth) width = Math.max(width, col.minWidth);
    if (col.maxWidth) width = Math.min(width, col.maxWidth);

    return width;
  });

  const lines: string[] = [];

  // Header row
  const headerLine = columns
    .map((col, i) => padCell(col.header, widths[i]!, col.align ?? "left"))
    .join("  ");
  lines.push(headerLine);

  // Separator row
  const separatorLine = widths.map((w) => "─".repeat(w)).join("  ");
  lines.push(separatorLine);

  // Data rows
  for (const row of rows) {
    const rowLine = columns
      .map((col, i) => {
        let val = col.transform
          ? col.transform(row[col.key], row)
          : formatCellValue(row[col.key]);

        // Truncate if exceeding maxWidth
        const w = widths[i]!;
        if (val.length > w) {
          val = val.slice(0, w - 3) + "...";
        }

        return padCell(val, w, col.align ?? "left");
      })
      .join("  ");
    lines.push(rowLine);
  }

  // Footer with count
  lines.push("");
  lines.push(`${rows.length} record${rows.length === 1 ? "" : "s"}`);

  return lines.join("\n");
}

/**
 * Format a cell value to a display string.
 */
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Pad a cell value to the target width.
 */
function padCell(
  value: string,
  width: number,
  align: "left" | "right",
): string {
  if (align === "right") {
    return value.padStart(width);
  }
  return value.padEnd(width);
}

// ─── Formatters ─────────────────────────────────────────────

/**
 * Zero-decimal currencies where amounts are NOT in cents.
 * See: https://docs.stripe.com/currencies#zero-decimal
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
  "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

/**
 * Format a Stripe amount with currency.
 * Stripe amounts are in the smallest currency unit (e.g., cents for USD).
 *
 * @param amount - Amount in smallest unit (e.g., 1000 = $10.00 USD)
 * @param currency - Currency code (e.g., "usd", "jpy")
 * @returns Formatted string like "USD 10.00" or "JPY 1,000"
 */
export function formatAmount(
  amount: unknown,
  currency?: unknown,
): string {
  if (amount === null || amount === undefined) return "";
  const num = typeof amount === "number" ? amount : Number(amount);
  if (isNaN(num)) return String(amount);

  const cur = currency
    ? String(currency).toUpperCase()
    : "USD";

  if (ZERO_DECIMAL_CURRENCIES.has(cur)) {
    return `${cur} ${num.toLocaleString("en-US")}`;
  }

  const major = num / 100;
  return `${cur} ${major.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Create an amount formatter bound to a specific currency key.
 * Used when the currency is a sibling field of the amount in each row.
 */
export function amountWithCurrency(
  amountKey: string,
  currencyKey: string = "currency",
): (value: unknown, row?: Record<string, unknown>) => string {
  return (_value: unknown, row?: Record<string, unknown>) => {
    if (!row) return formatAmount(_value);
    return formatAmount(row[amountKey], row[currencyKey]);
  };
}

/**
 * Format a Unix timestamp to a readable date string.
 * e.g., 1545320320 => "2018-12-20 18:28"
 */
export function formatTimestamp(ts: unknown): string {
  if (ts === null || ts === undefined) return "";
  const num = typeof ts === "number" ? ts : Number(ts);
  if (isNaN(num)) return String(ts);
  const d = new Date(num * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Format a boolean value as yes/no.
 */
export function formatBoolean(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "yes" : "no";
  return String(val);
}

/**
 * Auto-detect columns from an array of objects.
 * Used for raw API responses where column definitions aren't predefined.
 */
export function autoDetectColumns(
  rows: Record<string, unknown>[],
): Column[] {
  if (rows.length === 0) return [];

  // Collect all keys from all rows
  const keySet = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      keySet.add(key);
    }
  }

  // Filter out object/array keys (not table-friendly) and "object" meta key
  const columns: Column[] = [];
  for (const key of keySet) {
    // Skip the "object" meta key Stripe adds to every resource
    if (key === "object") continue;

    // Check if most values for this key are primitives
    let primitiveCount = 0;
    for (const row of rows) {
      const val = row[key];
      if (
        val === null ||
        val === undefined ||
        typeof val === "string" ||
        typeof val === "number" ||
        typeof val === "boolean"
      ) {
        primitiveCount++;
      }
    }

    // Only include columns where at least half the values are primitives
    if (primitiveCount >= rows.length / 2) {
      const col: Column = {
        header: key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        key,
        maxWidth: 40,
      };

      // Put "id" first, make it wider
      if (key === "id") {
        col.minWidth = 18;
      }

      columns.push(col);
    }
  }

  // Sort: id first, then alphabetical
  columns.sort((a, b) => {
    if (a.key === "id") return -1;
    if (b.key === "id") return 1;
    return a.key.localeCompare(b.key);
  });

  return columns;
}
