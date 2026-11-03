import { usage } from "./errors";

/**
 * A small, strict argument parser: positionals plus `--flag value`, `--flag=value` and boolean
 * `--flag` / `--no-flag`. Unknown flags are errors (an agent learns its mistake instead of having the
 * flag silently ignored).
 */

export type FlagSpec = {
  type: "string" | "number" | "boolean" | "list";
  description: string;
  /** Short alias without the dash, e.g. "o" for -o. */
  alias?: string;
};

export type Parsed = {
  positionals: string[];
  flags: Record<string, string | number | boolean | string[] | undefined>;
};

/** Flags every command accepts. */
export const GLOBAL_FLAGS: Record<string, FlagSpec> = {
  pretty: { type: "boolean", description: "Indent the JSON output (default when writing to a terminal)" },
  quiet: { type: "boolean", alias: "q", description: "No progress messages on stderr" },
  help: { type: "boolean", alias: "h", description: "Show this command's usage" },
  "data-dir": { type: "string", description: "Reframer data folder (default: the app's .reframer, or REFRAMER_DATA_DIR)" },
  desktop: { type: "boolean", description: "Use the desktop app's data folder" },
};

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

export const parseArgs = (argv: string[], spec: Record<string, FlagSpec>): Parsed => {
  const all = { ...GLOBAL_FLAGS, ...spec };
  const byAlias = new Map(Object.entries(all).flatMap(([name, f]) => (f.alias ? [[f.alias, name] as const] : [])));
  const positionals: string[] = [];
  const flags: Parsed["flags"] = {};
  const set = (name: string, raw: string | undefined, f: FlagSpec) => {
    const key = camel(name);
    if (f.type === "boolean") {
      flags[key] = raw === undefined ? true : !/^(false|0|no)$/i.test(raw);
      return;
    }
    if (raw === undefined) throw usage(`--${name} needs a value`);
    if (f.type === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw usage(`--${name} must be a number (got "${raw}")`);
      flags[key] = n;
    } else if (f.type === "list") {
      const list = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      flags[key] = [...((flags[key] as string[] | undefined) ?? []), ...list];
    } else flags[key] = raw;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      let name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
      let value: string | undefined = eq === -1 ? undefined : arg.slice(eq + 1);
      let f = all[name];
      if (!f && name.startsWith("no-") && all[name.slice(3)]?.type === "boolean") {
        name = name.slice(3);
        f = all[name];
        value = "false";
      }
      if (!f) throw usage(`Unknown flag --${name}`, "Run the command with --help to see its flags.");
      if (value === undefined && f.type !== "boolean") value = argv[++i];
      set(name, value, f);
    } else if (arg.length > 1 && arg.startsWith("-") && !/^-\d/.test(arg)) {
      const name = byAlias.get(arg.slice(1));
      if (!name) throw usage(`Unknown flag ${arg}`, "Run the command with --help to see its flags.");
      const f = all[name];
      set(name, f.type === "boolean" ? undefined : argv[++i], f);
    } else positionals.push(arg);
  }
  return { positionals, flags };
};

/** "0,30,90" or "0, 30" → numbers; ranges "0-90:30" expand (start-end:step). */
export const parseNumberList = (raw: string | string[] | undefined, name: string): number[] => {
  const parts = (Array.isArray(raw) ? raw : (raw ?? "").split(",")).map((s) => s.trim()).filter(Boolean);
  const out: number[] = [];
  for (const p of parts) {
    const range = /^(-?[\d.]+)-(-?[\d.]+)(?::([\d.]+))?$/.exec(p);
    if (range) {
      const [a, b, step] = [Number(range[1]), Number(range[2]), Number(range[3] ?? 1)];
      if (!(step > 0) || b < a || (b - a) / step > 2000) throw usage(`--${name}: bad range "${p}"`);
      for (let v = a; v <= b + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
      continue;
    }
    const n = Number(p);
    if (!Number.isFinite(n)) throw usage(`--${name}: "${p}" is not a number`);
    out.push(n);
  }
  return out;
};
