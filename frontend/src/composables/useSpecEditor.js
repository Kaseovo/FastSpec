import { ref } from "vue";
// compareSpecs here diffs the in-progress editor buffer against the last
// *loaded* content on every keystroke/form edit, purely to flip the
// hasUnsavedChanges flag. Neither side of that comparison is ever
// persisted server-side (the user hasn't saved yet), so there is nothing
// on the backend to diff against and this cannot be replaced by a call to
// GET /specs/{id}/diff or POST /specs/{id}/compare — those only compare
// saved SpecVersion rows (or a draft against a saved base, which is a
// different, already backend-backed flow — see SaveDialog.vue). This is
// intentionally duplicated with backend/validation/diff_utils.py's
// compare_specs, not dead code.
import { compareSpecs } from "../utils/diffUtils";

export function useSpecEditor({
  getDefaultSpec = () => ({
    openapi: "3.0.0",
    info: { title: "My API", version: "1.0.0", description: "API Description" },
    servers: [{ url: "https://api.example.com" }],
    paths: {},
  }),
} = {}) {
  const currentSpec = ref(null);
  const specContent = ref(JSON.stringify(getDefaultSpec(), null, 2));
  const parsedSpec = ref(getDefaultSpec());
  const initialSpec = ref(JSON.parse(JSON.stringify(parsedSpec.value)));
  const unsavedSpec = ref(null);
  const hasUnsavedChanges = ref(false);
  // Set by the code editor while its text doesn't parse:
  // { format, message, line, column } or null.
  const syntaxError = ref(null);

  const updatePreview = () => {
    try {
      parsedSpec.value = JSON.parse(specContent.value);
      const diff = compareSpecs(initialSpec.value, parsedSpec.value);
      hasUnsavedChanges.value = !!(
        (diff.infoAdded?.length || 0) +
        (diff.infoModified?.length || 0) +
        (diff.infoRemoved?.length || 0) +
        (diff.added?.length || 0) +
        (diff.modified?.length || 0) +
        (diff.removed?.length || 0) +
        (diff.schemaAdded?.length || 0) +
        (diff.schemaModified?.length || 0) +
        (diff.schemaRemoved?.length || 0)
      );
    } catch (e) {
      // ignore invalid JSON
    }
  };

  const updateFromForm = (formSpec) => {
    const newContent = JSON.stringify(formSpec, null, 2);
    if (specContent.value === newContent) return;
    parsedSpec.value = formSpec;
    specContent.value = newContent;
    const diff = compareSpecs(initialSpec.value, parsedSpec.value);
    hasUnsavedChanges.value = !!(
      (diff.infoAdded?.length || 0) +
      (diff.infoModified?.length || 0) +
      (diff.infoRemoved?.length || 0) +
      (diff.added?.length || 0) +
      (diff.modified?.length || 0) +
      (diff.removed?.length || 0) +
      (diff.schemaAdded?.length || 0) +
      (diff.schemaModified?.length || 0) +
      (diff.schemaRemoved?.length || 0)
    );
  };

  const loadSpec = (spec) => {
    if (spec.content) {
      currentSpec.value = spec;
      specContent.value = JSON.stringify(spec.content, null, 2);
      initialSpec.value = JSON.parse(JSON.stringify(spec.content));
    } else if (spec.spec_json) {
      currentSpec.value = spec;
      specContent.value = JSON.stringify(spec.spec_json, null, 2);
      initialSpec.value = JSON.parse(JSON.stringify(spec.spec_json));
    } else {
      currentSpec.value = spec;
      specContent.value = JSON.stringify(getDefaultSpec(), null, 2);
      initialSpec.value = JSON.parse(JSON.stringify(getDefaultSpec()));
    }
    syntaxError.value = null;
    // Ensure parsedSpec and dependent UI update immediately after loading
    updatePreview();
    if (spec.id !== "__unsaved") unsavedSpec.value = null;
    hasUnsavedChanges.value = false;
  };

  const newSpec = () => {
    console.debug("useSpecEditor.newSpec called");
    currentSpec.value = null;
    syntaxError.value = null;
    const defaultSpec = getDefaultSpec();
    specContent.value = JSON.stringify(defaultSpec, null, 2);
    initialSpec.value = JSON.parse(JSON.stringify(defaultSpec));
    hasUnsavedChanges.value = false;
    unsavedSpec.value = {
      id: "__unsaved",
      name: "Untitled Spec",
      spec_json: defaultSpec,
      version: defaultSpec.info?.version || "1.0.0",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  };

  const loadTemplate = () => {
    const templateSpec = {
      openapi: "3.0.0",
      info: {
        title: "Sample API",
        version: "1.0.0",
        description: "A sample API with common endpoints",
        contact: { name: "API Support", email: "support@example.com" },
      },
      servers: [
        {
          url: "https://api.example.com/v1",
          description: "Production server",
        },
      ],
      paths: {
        "/users": {
          get: {
            summary: "List users",
            description: "Get a list of all users",
            tags: ["Users"],
            responses: {
              200: {
                description: "Successful response",
                content: {
                  "application/json": {
                    schema: {
                      type: "array",
                      items: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
          },
          post: {
            summary: "Create user",
            description: "Create a new user",
            tags: ["Users"],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/User" },
                },
              },
            },
            responses: { 201: { description: "User created" } },
          },
        },
        "/users/{id}": {
          get: {
            summary: "Get user",
            description: "Get a specific user by ID",
            tags: ["Users"],
            parameters: [
              {
                name: "id",
                in: "path",
                required: true,
                schema: { type: "integer" },
              },
            ],
            responses: {
              200: {
                description: "Successful response",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/User" },
                  },
                },
              },
              404: { description: "User not found" },
            },
          },
        },
      },
      components: {
        schemas: {
          User: {
            type: "object",
            required: ["id", "email"],
            properties: {
              id: { type: "integer" },
              email: { type: "string", format: "email" },
              name: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    };

    currentSpec.value = null;
    syntaxError.value = null;
    specContent.value = JSON.stringify(templateSpec, null, 2);
    initialSpec.value = JSON.parse(JSON.stringify(templateSpec));
    unsavedSpec.value = {
      id: "__unsaved",
      name: "Untitled Spec",
      spec_json: templateSpec,
      version: templateSpec.info?.version || "1.0.0",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    updatePreview();
  };

  return {
    currentSpec,
    specContent,
    parsedSpec,
    initialSpec,
    unsavedSpec,
    hasUnsavedChanges,
    syntaxError,
    updatePreview,
    updateFromForm,
    loadSpec,
    newSpec,
    loadTemplate,
  };
}
