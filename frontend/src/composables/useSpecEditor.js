import { ref } from "vue";
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
    // Ensure parsedSpec and dependent UI update immediately after loading
    updatePreview();
    if (spec.id !== "__unsaved") unsavedSpec.value = null;
    hasUnsavedChanges.value = false;
  };

  const newSpec = () => {
    currentSpec.value = null;
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

  return {
    currentSpec,
    specContent,
    parsedSpec,
    initialSpec,
    unsavedSpec,
    hasUnsavedChanges,
    updatePreview,
    updateFromForm,
    loadSpec,
    newSpec,
  };
}
