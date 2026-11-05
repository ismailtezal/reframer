import { GLOBAL_FLAGS, parseArgs } from "./args";
import { type Command, RAW_OUTPUT } from "./command";
import { applyCommand } from "./commands/apply";
import {
  componentsCommand,
  doctorCommand,
  newCommand,
  projectsCommand,
  schemaCommand,
  showCommand,
  stylesCommand,
  undoCommand,
} from "./commands/basic";
import { checkCommand } from "./commands/check";
import { importCommand } from "./commands/import";
import { packsCommand } from "./commands/packs";
import { renderCommand, stillCommand } from "./commands/render";
import { skillCommand } from "./commands/skill";
import { playbookCommand, toolCommand } from "./commands/tool";
import { variantsCommand } from "./commands/variants";
import { createContext } from "./context";
import { CliError, EXIT_CODES } from "./errors";

/**
 * `reframer`: Reframer without its window. Every command answers with one JSON document on stdout
 * (`{ "ok": true, ... }` or `{ "ok": false, "error": { "code", "message", ... } }`), progress goes to
 * stderr, nothing ever waits for input, and the exit code says what happened (0 ok, 2 usage,
 * 3 not found, 4 invalid edit, 5 render failed, 6 check failed, 7 conflict, 8 environment).
 */

const COMMANDS: Command[] = [
  newCommand,
  projectsCommand,
  showCommand,
  componentsCommand,
  stylesCommand,
  packsCommand,
  schemaCommand,
  importCommand,
  applyCommand,
  undoCommand,
  toolCommand,
  playbookCommand,
  stillCommand,
  checkCommand,
  variantsCommand,
  renderCommand,
  skillCommand,
  doctorCommand,
];

const helpFor = (c: Command) => ({
  command: c.name,
  summary: c.summary,
  usage: c.usage,
  flags: Object.fromEntries(
    Object.entries({ ...c.flags }).map(([name, f]) => [`--${name}${f.alias ? ` (-${f.alias})` : ""}`, `${f.type}: ${f.description}`]),
  ),
  ...(c.examples ? { examples: c.examples } : {}),
});

const overview = () => ({
  usage: "reframer <command> [arguments] [flags]",
  output: "One JSON document on stdout; progress on stderr; exit code 0 on success.",
  commands: Object.fromEntries(COMMANDS.map((c) => [c.name, c.summary])),
  globalFlags: Object.fromEntries(Object.entries(GLOBAL_FLAGS).map(([n, f]) => [`--${n}`, f.description])),
  more: "reframer <command> --help · the agent guide: reframer skill",
});

export type MainOptions = { cwd: string; appRoot: string };

export const main = async (argv: string[], opts: MainOptions): Promise<number> => {
  const pretty = argv.includes("--pretty") || (process.stdout.isTTY && !argv.includes("--no-pretty"));
  const print = (doc: unknown) => process.stdout.write(`${JSON.stringify(doc, null, pretty ? 2 : undefined)}\n`);
  const [name, ...rest] = argv;
  try {
    if (!name || name === "help" || name === "--help" || name === "-h") {
      const topic = name === "help" ? COMMANDS.find((c) => c.name === rest[0]) : undefined;
      print({ ok: true, ...(topic ? helpFor(topic) : overview()) });
      return 0;
    }
    if (name === "--version" || name === "version") {
      print({ ok: true, version: process.env.REFRAMER_VERSION ?? "0.1.0" });
      return 0;
    }
    const command = COMMANDS.find((c) => c.name === name);
    if (!command)
      throw new CliError("E_USAGE", `Unknown command "${name}"`, undefined, `Commands: ${COMMANDS.map((c) => c.name).join(", ")}`);
    const args = parseArgs(rest, command.flags);
    if (args.flags.help) {
      print({ ok: true, ...helpFor(command) });
      return 0;
    }
    const ctx = createContext({ cwd: opts.cwd, appRoot: opts.appRoot, quiet: Boolean(args.flags.quiet) });
    const result = await command.run(ctx, args);
    if (typeof result[RAW_OUTPUT] === "string") process.stdout.write(result[RAW_OUTPUT]);
    else print({ ok: true, ...result });
    return 0;
  } catch (err) {
    const e =
      err instanceof CliError
        ? err
        : new CliError(
            "E_INTERNAL",
            err instanceof Error ? err.message : String(err),
            err instanceof Error ? { stack: err.stack?.split("\n").slice(0, 6) } : undefined,
          );
    print({
      ok: false,
      error: {
        code: e.code,
        message: e.message,
        ...(e.hint ? { hint: e.hint } : {}),
        ...(e.details !== undefined ? { details: e.details } : {}),
      },
    });
    if (!argv.includes("--quiet") && !argv.includes("-q")) process.stderr.write(`reframer: ${e.message}${e.hint ? ` (${e.hint})` : ""}\n`);
    return EXIT_CODES[e.code];
  }
};
