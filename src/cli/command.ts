import type { FlagSpec, Parsed } from "./args";
import type { CliContext } from "./context";

/** A result key whose text is printed as is instead of the JSON document (`skill --raw`). */
export const RAW_OUTPUT = "__raw";

/** One `reframer <name>` command: its help, its flags, and what it does. */
export type Command = {
  name: string;
  summary: string;
  /** e.g. "reframer apply <project> <ops.json|->" */
  usage: string;
  flags: Record<string, FlagSpec>;
  examples?: string[];
  /** Returns the JSON result (printed as `{ ok: true, ...result }`); throws CliError on failure. */
  run: (ctx: CliContext, args: Parsed) => Promise<Record<string, unknown>>;
};
