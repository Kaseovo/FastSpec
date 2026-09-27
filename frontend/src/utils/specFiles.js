// Importing specs from files or pasted text, and downloading them.
import exampleYaml from "../assets/example-petstore.yaml?raw";
import { parseSpecText, specToText } from "./specText";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** The example spec offered to new users (a fresh copy each time). */
export function exampleSpec() {
  return parseSpecText(exampleYaml).value;
}

/**
 * Parse imported JSON/YAML text and check it's an OpenAPI 3.x document.
 * Returns { spec, name } or { error } (a message for the user).
 */
export function readImportedSpec(text, fileName = "") {
  if (!text || !text.trim()) return { error: "The file is empty." };
  const { value, error } = parseSpecText(text);
  if (error) {
    return { error: `Couldn't read this as JSON or YAML (line ${error.line}): ${error.message}` };
  }
  if (value.swagger) {
    return {
      error:
        "This is a Swagger 2.0 document. FastSpec edits OpenAPI 3.0 and 3.1 — " +
        "convert it first (for example with swagger2openapi).",
    };
  }
  if (!/^3\.[01]\./.test(String(value.openapi ?? ""))) {
    return {
      error: "This doesn't look like an OpenAPI 3.0 or 3.1 document (no `openapi: 3.x` field).",
    };
  }
  const title = typeof value.info?.title === "string" ? value.info.title.trim() : "";
  const fromFile = fileName.replace(/\.(ya?ml|json)$/i, "").trim();
  return { spec: value, name: title || fromFile || "Imported spec" };
}

/** A download file name like "petstore-1.0.0.yaml". */
export function exportFileName(spec, format) {
  const slug = (value) =>
    String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // accents: "é" → "e"
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const parts = [slug(spec?.info?.title) || "openapi", slug(spec?.info?.version)].filter(Boolean);
  return `${parts.join("-")}.${format === "json" ? "json" : "yaml"}`;
}

/** Save the spec as a JSON or YAML file in the browser. */
export function downloadSpec(spec, format) {
  const text = specToText(spec, format);
  const type = format === "json" ? "application/json" : "application/yaml";
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(spec, format);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
