import fs from "node:fs/promises";
import { EDIT_TOOL_NAMES, isEditTool } from "@/agent/edits";
import { TOOL_SCHEMAS } from "@/agent/tool-schemas";
import type { CliContext } from "./context";
import { invalid, notFound, usage } from "./errors";

/** One edit to apply: an op name (a timeline tool) and its input. */
export type Op = { op: string; input: unknown };

/** Reads JSON from a file, stdin ("-") or an inline argument that starts with [ or {. */
export const readJsonArg = async (ctx: CliContext, source: string | undefined, what: string): Promise<unknown> => {
  if (!source) throw usage(`Pass the ${what}: a JSON file, - for stdin, or inline JSON.`);
  let text: string;
  if (source === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    text = Buffer.concat(chunks).toString("utf8");
  } else if (/^\s*[[{]/.test(source)) text = source;
  else {
    try {
      text = await fs.readFile(ctx.resolvePath(source), "utf8");
    } catch {
      throw notFound(`Can't read the ${what} at ${ctx.resolvePath(source)}`);
    }
  }
  try {
    return JSON.parse(text.replace(/^﻿/, ""));
  } catch (err) {
    throw invalid(`The ${what} isn't valid JSON: ${err instanceof Error ? err.message : err}`);
  }
};

/**
 * Accepts `[{ "op": "add_clips", "clips": [...] }]`, `[{ "tool": "add_clips", "input": {...} }]`,
 * `{ "ops": [...] }` or a single op object.
 */
export const normalizeOps = (raw: unknown): Op[] => {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { ops?: unknown }).ops)
      ? (raw as { ops: unknown[] }).ops
      : [raw];
  return list.map((item, i) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw invalid(`Op ${i + 1} is not an object`);
    const o = item as Record<string, unknown>;
    const name = (o.op ?? o.tool) as unknown;
    if (typeof name !== "string") throw invalid(`Op ${i + 1} has no "op" name`, undefined, `Ops: ${EDIT_TOOL_NAMES.join(", ")}`);
    if (o.input !== undefined) return { op: name, input: o.input };
    const { op: _op, tool: _tool, ...rest } = o;
    return { op: name, input: rest };
  });
};

/** Checks every op against its tool schema; returns the parsed inputs (defaults applied) or throws all problems at once. */
export const validateOps = (ops: Op[]): Op[] => {
  const problems: { op: number; name: string; issues: { path: string; message: string }[] }[] = [];
  const parsed = ops.map(({ op, input }, i) => {
    if (!isEditTool(op)) {
      problems.push({ op: i + 1, name: op, issues: [{ path: "op", message: `not an edit op (ops: ${EDIT_TOOL_NAMES.join(", ")})` }] });
      return { op, input };
    }
    const result = TOOL_SCHEMAS[op].input.safeParse(input);
    if (!result.success) {
      problems.push({
        op: i + 1,
        name: op,
        issues: result.error.issues.slice(0, 8).map((issue) => ({ path: issue.path.join(".") || "(input)", message: issue.message })),
      });
      return { op, input };
    }
    return { op, input: result.data };
  });
  if (problems.length)
    throw invalid(
      `${problems.length} op${problems.length > 1 ? "s are" : " is"} invalid: ${problems
        .slice(0, 3)
        .map((p) => `#${p.op} ${p.name} (${p.issues[0].path}: ${p.issues[0].message})`)
        .join("; ")}`,
      { problems },
      "See an op's fields with `reframer schema <op>`.",
    );
  return parsed;
};
