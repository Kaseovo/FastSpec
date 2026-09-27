// Converting OpenAPI documents between objects and JSON/YAML text, and
// finding where a JSON path lives in that text.
//
// The editor stores specs as objects (and the canonical JSON string derived
// from them); JSON and YAML are just two ways of showing and typing them. YAML
// comments and custom formatting therefore don't survive a round trip — see
// docs/ROADMAP.md.
import { isMap, isScalar, isSeq, parseDocument, stringify } from "yaml";

export const FORMATS = ["yaml", "json"];

/** Serialize a spec object for display in the given format. */
export function specToText(spec, format) {
  if (format === "json") return JSON.stringify(spec, null, 2);
  // lineWidth 0: never fold long strings; no anchors/aliases for repeated
  // objects, which OpenAPI tooling generally doesn't expect.
  return stringify(spec, { lineWidth: 0, aliasDuplicateObjects: false });
}

/** Guess the format of pasted or uploaded text. */
export function detectFormat(text) {
  return /^\s*[{[]/.test(text) ? "json" : "yaml";
}

/**
 * Parse JSON or YAML text (YAML 1.2 is a superset of JSON).
 * Returns { value } on success, or { error: { message, line, column } } with
 * 1-based positions when the text isn't a single mapping.
 */
export function parseSpecText(text) {
  const doc = parseDocument(text, { uniqueKeys: true, prettyErrors: false });
  const problem = doc.errors[0];
  if (problem) {
    const [line, column] = positionOf(text, problem.pos?.[0] ?? 0);
    return { error: { message: firstLine(problem.message), line, column } };
  }
  const value = doc.toJS({ maxAliasCount: 100 });
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {
      error: { message: "An OpenAPI document must be a mapping (key: value pairs).", line: 1, column: 1 },
    };
  }
  return { value };
}

/**
 * Where a JSON path (e.g. ["paths", "/pets", "get"]) sits in `text`, as
 * character offsets { start, end } — the key when the path ends at a mapping
 * entry, the item for sequence indexes, the whole document for []. Works for
 * both JSON and YAML text; null when the path isn't found or the text doesn't
 * parse.
 */
export function locatePath(text, path) {
  const doc = parseDocument(text);
  if (doc.errors.length || !doc.contents) return null;
  let node = doc.contents;
  let range = node.range;
  for (const segment of path) {
    if (isMap(node)) {
      const pair = node.items.find((item) => keyOf(item) === String(segment));
      if (!pair) return null;
      range = pair.key?.range ?? pair.value?.range;
      node = pair.value;
    } else if (isSeq(node)) {
      const item = node.items[Number(segment)];
      if (!item) return null;
      range = item.range;
      node = item;
    } else {
      return null;
    }
  }
  return range ? { start: range[0], end: range[1] } : null;
}

function keyOf(pair) {
  const key = pair.key;
  return isScalar(key) ? String(key.value) : String(key);
}

function positionOf(text, offset) {
  const before = text.slice(0, offset).split("\n");
  return [before.length, before[before.length - 1].length + 1];
}

function firstLine(message) {
  return String(message).split("\n")[0];
}
