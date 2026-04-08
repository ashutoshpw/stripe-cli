/**
 * Simple logger with verbose/quiet modes.
 * No dependencies — just wraps console with level control.
 */

export type LogLevel = "quiet" | "normal" | "verbose";

let currentLevel: LogLevel = "normal";

/**
 * Set the global log level.
 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/**
 * Get the current log level.
 */
export function getLogLevel(): LogLevel {
  return currentLevel;
}

/**
 * Log a message (shown in normal and verbose modes).
 */
export function log(message: string): void {
  if (currentLevel !== "quiet") {
    console.log(message);
  }
}

/**
 * Log a verbose/debug message (shown only in verbose mode).
 */
export function verbose(message: string): void {
  if (currentLevel === "verbose") {
    console.log(`[debug] ${message}`);
  }
}

/**
 * Log an error message (always shown, even in quiet mode).
 */
export function error(message: string): void {
  console.error(message);
}

/**
 * Log a warning message (shown in normal and verbose modes).
 */
export function warn(message: string): void {
  if (currentLevel !== "quiet") {
    console.warn(message);
  }
}

/**
 * Log a success message (shown in normal and verbose modes).
 */
export function success(message: string): void {
  if (currentLevel !== "quiet") {
    console.log(message);
  }
}
