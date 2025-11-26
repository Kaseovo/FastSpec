<template>
  <div id="app">
    <div class="header">
      <h1>🧩 FastSpec</h1>
      <p>Create, edit, and validate OpenAPI specifications</p>
    </div>

    <div class="main-content">
      <Toolbar />

      <Message v-if="alert.show" :severity="alert.type" @close="closeAlert">
        {{ alert.message }}
      </Message>

      <div class="view-mode-toggle">
        <SelectButton
          v-model="viewMode"
          :options="viewModeOptions"
          optionLabel="label"
          optionValue="value"
        />
      </div>

      <div class="editor-container">
        <SpecList @spec-selected="loadSpec" :selected-id="currentSpec?.id" />
        <FormEditor
          v-if="viewMode === 'form'"
          :model-value="parsedSpec"
          @update:modelValue="updateFromForm"
        />
        <EditorPanel
          v-else-if="viewMode === 'code'"
          v-model="specContent"
          @update:modelValue="updatePreview"
        />
        <div v-else class="split-view">
          <FormEditor
            :model-value="parsedSpec"
            @update:modelValue="updateFromForm"
          />
          <EditorPanel
            v-model="specContent"
            @update:modelValue="updatePreview"
          />
        </div>
      </div>
    </div>

    <SaveDialog
      :visible="showSaveDialog"
      @update:visible="showSaveDialog = $event"
      :spec-name="currentSpec?.name || ''"
      @save="saveSpec"
    />

    <Drawer
      :visible="showPreviewDrawer"
      @update:visible="showPreviewDrawer = $event"
      position="right"
      :style="{ width: '50vw' }"
      header="Swagger Preview"
    >
      <PreviewPanel :spec="parsedSpec" />
    </Drawer>

    <DiffDrawer
      :visible="showDiffDrawer"
      @update:visible="showDiffDrawer = $event"
      :diff="specDiff"
    />

    <Toast />
  </div>
</template>

<script>
import { ref, computed, provide } from "vue";
import Message from "primevue/message";
import Drawer from "primevue/drawer";
import Toast from "primevue/toast";
import SelectButton from "primevue/selectbutton";
import Toolbar from "./components/Toolbar.vue";
import SpecList from "./components/SpecList.vue";
import EditorPanel from "./components/EditorPanel.vue";
import FormEditor from "./components/FormEditor.vue";
import PreviewPanel from "./components/PreviewPanel.vue";
import SaveDialog from "./components/SaveDialog.vue";
import DiffDrawer from "./components/DiffDrawer.vue";
import { validateSpec, createSpec, updateSpec } from "./api/specs";
import { compareSpecs } from "./utils/diffUtils";

export default {
  name: "App",
  components: {
    Message,
    Drawer,
    Toast,
    SelectButton,
    Toolbar,
    SpecList,
    EditorPanel,
    FormEditor,
    PreviewPanel,
    SaveDialog,
    DiffDrawer,
  },
  setup() {
    const currentSpec = ref(null);
    const specContent = ref(JSON.stringify(getDefaultSpec(), null, 2));
    const parsedSpec = ref(getDefaultSpec());
    const initialSpec = ref(getDefaultSpec()); // Track initial state for diff
    const showSaveDialog = ref(false);
    const showPreviewDrawer = ref(false);
    const showDiffDrawer = ref(false);
    const specDiff = ref({ info: null, added: [], modified: [], removed: [] });
    const alert = ref({ show: false, message: "", type: "info" });
    const specListKey = ref(0);
    const viewMode = ref("split"); // 'form', 'code', or 'split'
    const viewModeOptions = [
      { label: "Form", value: "form", icon: "pi pi-list" },
      { label: "Code", value: "code", icon: "pi pi-code" },
      { label: "Split", value: "split", icon: "pi pi-window-maximize" },
    ];

    const showAlert = (message, type = "info") => {
      alert.value = { show: true, message, type };
      setTimeout(() => {
        alert.value.show = false;
      }, 5000);
    };

    const closeAlert = () => {
      alert.value.show = false;
    };

    const updatePreview = () => {
      try {
        parsedSpec.value = JSON.parse(specContent.value);
        // Compute diff against initial state
        specDiff.value = compareSpecs(initialSpec.value, parsedSpec.value);
      } catch (e) {
        // Invalid JSON - preview will handle error display
      }
    };

    const updateFromForm = (formSpec) => {
      parsedSpec.value = formSpec;
      specContent.value = JSON.stringify(formSpec, null, 2);
      specDiff.value = compareSpecs(initialSpec.value, parsedSpec.value);
    };

    const loadSpec = (spec) => {
      currentSpec.value = spec;
      specContent.value = JSON.stringify(spec.spec_json, null, 2);
      initialSpec.value = JSON.parse(JSON.stringify(spec.spec_json)); // Deep clone
      updatePreview();
    };

    const newSpec = () => {
      currentSpec.value = null;
      const defaultSpec = getDefaultSpec();
      specContent.value = JSON.stringify(defaultSpec, null, 2);
      initialSpec.value = JSON.parse(JSON.stringify(defaultSpec)); // Deep clone
      updatePreview();
    };

    const openSaveDialog = () => {
      showSaveDialog.value = true;
    };

    const saveSpec = async (name) => {
      try {
        const spec_json = JSON.parse(specContent.value);

        if (currentSpec.value) {
          // Update existing
          const updated = await updateSpec(currentSpec.value.id, {
            name,
            spec_json,
          });
          currentSpec.value = updated;
          showAlert("Spec updated successfully!", "success");
        } else {
          // Create new
          const created = await createSpec({ name, spec_json });
          currentSpec.value = created;
          showAlert("Spec created successfully!", "success");
        }

        showSaveDialog.value = false;
        specListKey.value++;
      } catch (error) {
        showAlert(error.response?.data?.detail || error.message, "error");
      }
    };

    const validateCurrentSpec = async () => {
      try {
        const spec_json = JSON.parse(specContent.value);
        const result = await validateSpec(spec_json);

        if (result.valid) {
          showAlert("✓ Specification is valid!", "success");
        } else {
          let message = "✗ Validation errors:\n";
          result.errors.forEach((err) => {
            message += `\n• ${err.field}: ${err.message}`;
          });
          showAlert(message, "error");
        }
      } catch (error) {
        showAlert("Invalid JSON", "error");
      }
    };

    const loadTemplate = () => {
      newSpec();
      showAlert("Template loaded", "info");
    };

    const togglePreview = () => {
      showPreviewDrawer.value = !showPreviewDrawer.value;
    };

    const toggleDiff = () => {
      showDiffDrawer.value = !showDiffDrawer.value;
    };

    function getDefaultSpec() {
      return {
        openapi: "3.0.0",
        info: {
          title: "My API",
          version: "1.0.0",
          description: "API Description",
        },
        servers: [{ url: "https://api.example.com" }],
        paths: {},
      };
    }

    // Provide methods to child components
    provide("newSpec", newSpec);
    provide("openSaveDialog", openSaveDialog);
    provide("validateCurrentSpec", validateCurrentSpec);
    provide("loadTemplate", loadTemplate);
    provide("togglePreview", togglePreview);
    provide("toggleDiff", toggleDiff);
    provide("refreshSpecList", () => specListKey.value++);

    return {
      currentSpec,
      specContent,
      parsedSpec,
      showSaveDialog,
      showPreviewDrawer,
      showDiffDrawer,
      specDiff,
      alert,
      viewMode,
      viewModeOptions,
      showAlert,
      closeAlert,
      updatePreview,
      updateFromForm,
      loadSpec,
      saveSpec,
    };
  },
};
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica,
    Arial, sans-serif;
  background: #f9fafb;
  color: #1f2937;
}

#app {
  min-height: 100vh;
  padding: 20px;
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

.header h1 {
  font-size: 2.5rem;
  margin-bottom: 10px;
}

.header p {
  color: #6b7280;
  font-size: 1.1rem;
}

.main-content {
  max-width: 1800px;
  margin: 0 auto;
}

.view-mode-toggle {
  display: flex;
  justify-content: center;
  margin: 20px 0;
}

.editor-container {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 20px;
  height: calc(100vh - 300px);
}

.split-view {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  height: 100%;
}

@media (max-width: 1200px) {
  .editor-container {
    grid-template-columns: 1fr;
    height: auto;
  }

  .split-view {
    grid-template-columns: 1fr;
  }
}
</style>
