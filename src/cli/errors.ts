/**
 * Every failure the CLI reports has a stable code (for scripts and agents to branch on), a process
 * exit code, a message a person can act on, and optionally structured details and a hint.
 */

export const EXIT_CODES = {
  E_INTERNAL: 1,
  E_USAGE: 2,
  E_NOT_FOUND: 3,
  E_INVALID: 4,
  E_RENDER: 5,
  E_CHECK: 6,
  E_CONFLICT: 7,
  E_ENV: 8,
} as const;

export type ErrorCode = keyof typeof EXIT_CODES;

export class CliError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
    readonly hint?: string,
  ) {
    super(message);
  }
}

export const usage = (message: string, hint?: string) => new CliError("E_USAGE", message, undefined, hint);
export const notFound = (message: string, hint?: string) => new CliError("E_NOT_FOUND", message, undefined, hint);
export const invalid = (message: string, details?: unknown, hint?: string) => new CliError("E_INVALID", message, details, hint);
