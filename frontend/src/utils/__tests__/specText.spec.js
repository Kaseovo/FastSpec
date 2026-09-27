import { detectFormat, locatePath, parseSpecText, specToText } from "../specText";

const SPEC = {
  openapi: "3.0.3",
  info: { title: "Pets", version: "1.0.0" },
  paths: {
    "/pets": {
      get: {
        parameters: [{ name: "limit", in: "query" }],
        responses: { 200: { description: "ok" } },
      },
    },
  },
};

describe("specToText / parseSpecText", () => {
  test.each(["yaml", "json"])("round-trips through %s", (format) => {
    const { value, error } = parseSpecText(specToText(SPEC, format));
    expect(error).toBeUndefined();
    expect(value).toEqual(JSON.parse(JSON.stringify(SPEC)));
  });

  test("YAML output is plain block style without anchors", () => {
    const shared = { type: "string" };
    const text = specToText({ a: shared, b: shared }, "yaml");
    expect(text).toBe("a:\n  type: string\nb:\n  type: string\n");
  });

  test("reports syntax errors with a position", () => {
    const { error } = parseSpecText("openapi: 3.0.3\ninfo:\n  title: [unclosed\n");
    expect(error.line).toBeGreaterThanOrEqual(3);
    expect(error.message).toBeTruthy();
  });

  test("rejects duplicate keys", () => {
    expect(parseSpecText("a: 1\na: 2\n").error).toBeTruthy();
  });

  test.each(["just a string", "- a\n- b\n", ""])("rejects non-mapping documents: %j", (text) => {
    expect(parseSpecText(text).error.message).toMatch(/mapping/);
  });
});

describe("detectFormat", () => {
  test.each([
    ['{"openapi": "3.0.0"}', "json"],
    ['  \n {"a": 1}', "json"],
    ["openapi: 3.0.0", "yaml"],
    ["# comment\nopenapi: 3.1.0", "yaml"],
  ])("%j → %s", (text, format) => {
    expect(detectFormat(text)).toBe(format);
  });
});

describe("locatePath", () => {
  test.each(["yaml", "json"])("finds keys and sequence items in %s", (format) => {
    const text = specToText(SPEC, format);
    const at = (path) => {
      const range = locatePath(text, path);
      return text.slice(range.start, range.end);
    };
    expect(at(["info", "title"])).toMatch(/^"?title"?$/);
    expect(at(["paths", "/pets", "get"])).toMatch(/^"?get"?$/);
    expect(at(["paths", "/pets", "get", "responses", "200"])).toMatch(/^"?200"?$/);
    expect(at(["paths", "/pets", "get", "parameters", 0])).toContain("limit");
  });

  test("returns null for missing paths and unparsable text", () => {
    expect(locatePath(specToText(SPEC, "yaml"), ["paths", "/nope"])).toBeNull();
    expect(locatePath("a: [", ["a"])).toBeNull();
  });

  test("the empty path covers the document", () => {
    expect(locatePath("a: 1\n", [])).toEqual({ start: 0, end: 5 });
  });
});
