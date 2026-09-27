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

  // Cycle 1: loadTemplate exists
  test("loadTemplate is a function on the returned object", () => {
    const editor = useSpecEditor();
    expect(typeof editor.loadTemplate).toBe("function");
  });

  // Cycle 2: loadTemplate sets specContent to valid JSON string
  test("loadTemplate sets specContent to a valid JSON string", () => {
    const { loadTemplate, specContent } = useSpecEditor();
    loadTemplate();
    expect(() => JSON.parse(specContent.value)).not.toThrow();
    const parsed = JSON.parse(specContent.value);
    expect(parsed.openapi).toMatch(/^3\.0\./);
    expect(parsed.info.title).toBe("Petstore");
  });

  // Cycle 3: loadTemplate sets currentSpec to null
  test("loadTemplate sets currentSpec to null", () => {
    const { loadTemplate, currentSpec, loadSpec } = useSpecEditor();
    // pre-load a spec so currentSpec is non-null
    loadSpec({ id: 99, spec_json: { openapi: "3.0.0", info: { title: "T", version: "1" }, paths: {}, servers: [] } });
    expect(currentSpec.value).not.toBeNull();
    loadTemplate();
    expect(currentSpec.value).toBeNull();
  });

  // Cycle 4: loadTemplate sets unsavedSpec with id === "__unsaved"
  test("loadTemplate sets unsavedSpec with id === '__unsaved'", () => {
    const { loadTemplate, unsavedSpec } = useSpecEditor();
    loadTemplate();
    expect(unsavedSpec.value).not.toBeNull();
    expect(unsavedSpec.value.id).toBe("__unsaved");
  });

  // Cycle 5: loadTemplate triggers updatePreview (parsedSpec is populated)
  test("loadTemplate triggers updatePreview so parsedSpec is populated", () => {
    const { loadTemplate, parsedSpec } = useSpecEditor();
    loadTemplate();
    expect(parsedSpec.value).not.toBeNull();
    expect(parsedSpec.value.openapi).toMatch(/^3\.0\./);
    expect(parsedSpec.value.paths).toBeDefined();
  });
});


describe("loadDraft", () => {
  test("opens a spec as a named, unsaved draft", () => {
    const { loadDraft, parsedSpec, unsavedSpec, currentSpec, hasUnsavedChanges } = useSpecEditor();
    const spec = { openapi: "3.1.0", info: { title: "Orders", version: "2.0.0" }, paths: {} };

    loadDraft(spec, "Orders");

    expect(parsedSpec.value).toEqual(spec);
    expect(unsavedSpec.value).toMatchObject({ id: "__unsaved", name: "Orders", version: "2.0.0" });
    expect(currentSpec.value).toBeNull();
    expect(hasUnsavedChanges.value).toBe(false);
  });

  test("clears a syntax error left by the code editor", () => {
    const { loadDraft, syntaxError } = useSpecEditor();
    syntaxError.value = { format: "yaml", message: "bad", line: 3, column: 1 };
    loadDraft({ openapi: "3.0.3", info: { title: "X", version: "1" }, paths: {} });
    expect(syntaxError.value).toBeNull();
  });
});
