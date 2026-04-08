import { renderTable, autoDetectColumns, type Column } from "./table.ts";

/**
 * Supported output formats.
 */
export type OutputFormat = "json" | "table" | "csv";

/**
 * Format and print a list of records.
 *
 * @param records - Array of record objects
 * @param columns - Column definitions for table output
 * @param format - Output format (json, table, csv)
 */
export function formatOutput(
  records: Record<string, unknown>[],
  columns: Column[],
  format: OutputFormat = "table",
): string {
  switch (format) {
    case "json":
      return formatJson(records);
    case "csv":
      return formatCsv(records, columns);
    case "table":
    default:
      return renderTable(records, columns);
  }
}

/**
 * Format as pretty-printed JSON.
 */
function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Format as CSV.
 */
function formatCsv(
  records: Record<string, unknown>[],
  columns: Column[],
): string {
  const lines: string[] = [];

  // Header
  lines.push(columns.map((c) => escapeCsv(c.header)).join(","));

  // Rows
  for (const row of records) {
    const values = columns.map((c) => {
      const val = c.transform ? c.transform(row[c.key], row) : row[c.key];
      if (val === null || val === undefined) return "";
      return escapeCsv(String(val));
    });
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

/**
 * Escape a CSV field value.
 */
function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format a single record for display (key-value pairs).
 */
export function formatSingleRecord(
  record: Record<string, unknown>,
  format: OutputFormat = "table",
): string {
  if (format === "json") {
    return formatJson(record);
  }

  if (format === "csv") {
    // For CSV single record, use key-value format
    const lines: string[] = ["key,value"];
    for (const [key, value] of Object.entries(record)) {
      const displayValue =
        value === null || value === undefined
          ? ""
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value);
      lines.push(`${escapeCsv(key)},${escapeCsv(displayValue)}`);
    }
    return lines.join("\n");
  }

  // Table format: key-value pairs
  const lines: string[] = [];
  const keys = Object.keys(record);
  if (keys.length === 0) return "No data.";

  const maxKeyLen = Math.max(...keys.map((k) => k.length));

  for (const [key, value] of Object.entries(record)) {
    const displayValue =
      value === null || value === undefined
        ? ""
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);

    lines.push(`${key.padEnd(maxKeyLen)}  ${displayValue}`);
  }

  return lines.join("\n");
}

/**
 * Auto-format a raw API response for display.
 *
 * - If the response is a Stripe list (object: "list"), render data[] as a table
 * - If the response is a single object, render as key-value pairs
 * - If --json is specified, always return raw JSON
 */
export function autoFormatRawResponse(
  data: unknown,
  format: OutputFormat = "table",
): string {
  if (format === "json") {
    return formatJson(data);
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;

    // Stripe list response
    if (obj.object === "list" && Array.isArray(obj.data)) {
      const records = obj.data as Record<string, unknown>[];
      if (records.length === 0) return "No records found.";

      const columns = autoDetectColumns(records);
      if (columns.length === 0) return formatJson(data);

      return renderTable(records, columns);
    }

    // Stripe search response
    if (obj.object === "search_result" && Array.isArray(obj.data)) {
      const records = obj.data as Record<string, unknown>[];
      if (records.length === 0) return "No records found.";

      const columns = autoDetectColumns(records);
      if (columns.length === 0) return formatJson(data);

      return renderTable(records, columns);
    }

    // Single object
    return formatSingleRecord(obj, format);
  }

  // Fallback
  return formatJson(data);
}
