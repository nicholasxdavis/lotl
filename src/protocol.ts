export const STUDIO_METHODS = [
  "ping",
  "place_info",
  "eval",
  "selection",
  "inspect",
  "children",
  "select",
  "get_properties",
  "set_properties",
  "transform",
  "create",
  "destroy",
  "rename",
  "parent",
  "undo",
  "redo",
  "logs",
  "camera",
  "set_camera",
  "services",
  "open_script",
  "attributes",
  "set_attribute",
  "waypoint",
  "context",
  "script_document",
  "syntax",
  "note",
  "tags",
  "add_tag",
  "remove_tag",
  "class_icon",
  "write_document",
  "mouse",
  "union",
  "separate",
  "negate",
  "intersect",
  "ribbon_tool",
] as const;

export type StudioMethod = (typeof STUDIO_METHODS)[number];

export function isStudioMethod(value: string): value is StudioMethod {
  return (STUDIO_METHODS as readonly string[]).includes(value);
}

export const MAX_EVAL_CHARS = 80_000;
export const MAX_BRIDGE_BODY = 1_000_000;
export const MAX_BRIDGE_QUEUE = 16;
export const MAX_POLL_WAIT_MS = 20_000;
