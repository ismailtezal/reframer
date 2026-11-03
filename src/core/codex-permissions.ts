export const CODEX_PERMISSIONS = [
  { id: "read", label: "Read only", description: "Inspect the timeline, media and playbooks without changing the video." },
  { id: "edit", label: "Edit video", description: "Use Reframer's editing tools. Local files stay read-only." },
  { id: "full", label: "Full access", description: "Edit the video, run commands and change files on this computer." },
] as const;

export type CodexPermission = (typeof CODEX_PERMISSIONS)[number]["id"];
export const DEFAULT_CODEX_PERMISSION: CodexPermission = "edit";
export const isCodexPermission = (value: unknown): value is CodexPermission => CODEX_PERMISSIONS.some((option) => option.id === value);

export const CODEX_READ_TOOLS = [
  "get_project",
  "get_clips",
  "list_styles",
  "get_style",
  "list_components",
  "get_errors",
  "load_skill",
  "review_frames",
  "view_media",
  "list_open_projects",
  "seek",
  "select_clips",
  "ask_user",
  "set_plan",
  "update_plan",
] as const;
