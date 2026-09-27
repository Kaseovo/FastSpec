import { downloadSpec, exampleSpec, exportFileName, readImportedSpec } from "../specFiles";

describe("exampleSpec", () => {
  test("is a complete OpenAPI 3 document", () => {
    const spec = exampleSpec();
    expect(spec.openapi).toMatch(/^3\.0\./);
    expect(spec.info.title).toBe("Petstore");
    expect(Object.keys(spec.paths)).toEqual(["/pets", "/pets/{petId}"]);
    expect(spec.components.schemas.Pet).toBeTruthy();
  });

  test("returns a fresh copy each time", () => {
    const first = exampleSpec();
    first.info.title = "changed";
    expect(exampleSpec().info.title).toBe("Petstore");
  });
});

describe("readImportedSpec", () => {
  test("reads YAML and names the spec after its title", () => {
    const result = readImportedSpec("openapi: 3.1.0\ninfo:\n  title: Orders\n  version: 2.0.0\npaths: {}\n");
    expect(result.name).toBe("Orders");
    expect(result.spec.info.version).toBe("2.0.0");
  });

  test("reads JSON", () => {
    const result = readImportedSpec('{"openapi": "3.0.3", "info": {"title": "X", "version": "1"}, "paths": {}}');
    expect(result.spec.openapi).toBe("3.0.3");
  });

  test("falls back to the file name without a title", () => {
    const result = readImportedSpec("openapi: 3.0.0\ninfo: {version: '1'}\npaths: {}\n", "billing-api.yml");
    expect(result.name).toBe("billing-api");
  });

  test.each([
    ["", /empty/],
    ["openapi: [", /Couldn't read this as JSON or YAML \(line \d+\)/],
    ["swagger: '2.0'\ninfo: {title: Old, version: '1'}\n", /Swagger 2\.0/],
    ["openapi: 2.0.0\n", /OpenAPI 3\.0 or 3\.1/],
    ["name: not a spec\n", /OpenAPI 3\.0 or 3\.1/],
  ])("rejects %j", (text, message) => {
    expect(readImportedSpec(text).error).toMatch(message);
  });
});

describe("exportFileName", () => {
  test.each([
    [{ info: { title: "Pet Store API", version: "1.2.0" } }, "yaml", "pet-store-api-1.2.0.yaml"],
    [{ info: { title: "Pet Store API", version: "1.2.0" } }, "json", "pet-store-api-1.2.0.json"],
    [{ info: {} }, "yaml", "openapi.yaml"],
    [{ info: { title: "  Éclair / Café ", version: "v2" } }, "json", "eclair-cafe-v2.json"],
  ])("%j as %s → %s", (spec, format, name) => {
    expect(exportFileName(spec, format)).toBe(name);
  });
});

describe("downloadSpec", () => {
  test("downloads the spec as a file", () => {
    URL.createObjectURL = vi.fn(() => "blob:fake");
    URL.revokeObjectURL = vi.fn();
    const clicks = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      clicks.push({ download: this.download, href: this.href });
    });

    downloadSpec({ openapi: "3.0.3", info: { title: "Pets", version: "1.0.0" } }, "yaml");

    expect(clicks).toEqual([{ download: "pets-1.0.0.yaml", href: "blob:fake" }]);
    const blob = URL.createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("application/yaml");
    click.mockRestore();
  });
});
