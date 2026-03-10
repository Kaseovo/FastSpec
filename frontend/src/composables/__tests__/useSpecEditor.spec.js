import { useSpecEditor } from "../useSpecEditor";

describe("useSpecEditor", () => {
  test("initializes with default spec and parses content", () => {
    const { specContent, parsedSpec, updatePreview } = useSpecEditor();
    // default spec JSON should parse to an object
    expect(typeof specContent.value).toBe("string");
    updatePreview();
    expect(parsedSpec.value).toBeDefined();
    expect(parsedSpec.value.openapi).toBe("3.0.0");
  });

  test("updateFromForm updates content and parsedSpec", () => {
    const { specContent, parsedSpec, updateFromForm } = useSpecEditor();
    const newSpec = {
      openapi: "3.0.0",
      info: { title: "X", version: "1.2.3" },
      servers: [],
      paths: {},
    };
    updateFromForm(newSpec);
    expect(parsedSpec.value.info.title).toBe("X");
    expect(specContent.value).toContain("1.2.3");
  });

  test("loadSpec handles spec_json and content shapes", () => {
    const { loadSpec, specContent, currentSpec } = useSpecEditor();
    const a = {
      id: 1,
      spec_json: {
        openapi: "3.0.0",
        info: { title: "A", version: "0.1" },
        paths: {},
        servers: [],
      },
    };
    loadSpec(a);
    expect(currentSpec.value.id).toBe(1);
    expect(specContent.value).toContain("A");
    const b = {
      id: 2,
      content: {
        openapi: "3.0.0",
        info: { title: "B" },
        paths: {},
        servers: [],
      },
    };
    loadSpec(b);
    expect(currentSpec.value.id).toBe(2);
    expect(specContent.value).toContain("B");
  });
});
