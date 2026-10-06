import { customAlphabet } from "nanoid";

// Short, readable ids keep agent prompts compact ("clip_k3f9a2").
const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const short = customAlphabet(alphabet, 6);
const long = customAlphabet(alphabet, 12);

export type IdKind = "clip" | "track" | "asset" | "marker" | "fx" | "comp" | "proj" | "turn" | "scene" | "msg" | "thread";

export const newId = (kind: IdKind): string => (kind === "proj" ? `proj_${long()}` : `${kind}_${short()}`);
