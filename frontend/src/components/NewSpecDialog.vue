<template>
  <Dialog
    :visible="visible"
    :header="step === 'import' ? 'Import a specification' : 'Create a specification'"
    :modal="true"
    :style="{ width: '640px' }"
    :breakpoints="{ '700px': '95vw' }"
    @update:visible="close"
  >
    <div v-if="step === 'choose'" class="new-spec-options">
      <button type="button" class="option-card" @click="$emit('example')">
        <i class="pi pi-star"></i>
        <h4>Example</h4>
        <p>A complete Petstore API to explore FastSpec with</p>
      </button>
      <button type="button" class="option-card" @click="step = 'import'">
        <i class="pi pi-upload"></i>
        <h4>Import</h4>
        <p>An OpenAPI 3 file you already have, as YAML or JSON</p>
      </button>
      <button type="button" class="option-card" @click="$emit('blank')">
        <i class="pi pi-file"></i>
        <h4>Blank</h4>
        <p>A minimal OpenAPI 3.0 document</p>
      </button>
    </div>

    <div v-else class="import-step">
      <div
        :class="['drop-zone', { 'drop-zone--active': dragging }]"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <i class="pi pi-cloud-upload"></i>
        <p>Drop a <code>.yaml</code>, <code>.yml</code> or <code>.json</code> file here, or</p>
        <Button label="Choose a file" icon="pi pi-folder-open" size="small" outlined @click="fileInput.click()" />
        <input
          ref="fileInput"
          type="file"
          accept=".yaml,.yml,.json,application/json,application/yaml,text/yaml"
          class="visually-hidden"
          data-testid="import-file"
          @change="onFileChosen"
        />
      </div>
      <label for="import-paste" class="paste-label">…or paste it</label>
      <Textarea
        id="import-paste"
        v-model="pasted"
        rows="8"
        class="paste-area"
        placeholder="openapi: 3.0.3&#10;info:&#10;  title: My API&#10;  version: 1.0.0&#10;paths: {}"
      />
      <Message v-if="error" severity="error" :closable="false" class="import-error">{{ error }}</Message>
    </div>

    <template v-if="step === 'import'" #footer>
      <Button label="Back" text @click="reset" />
      <Button label="Import" icon="pi pi-check" :disabled="!pasted.trim()" @click="importText(pasted)" />
    </template>
  </Dialog>
</template>

<script>
import { ref, watch } from "vue";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import Message from "primevue/message";
import Textarea from "primevue/textarea";
import { MAX_IMPORT_BYTES, readImportedSpec } from "../utils/specFiles";

export default {
  name: "NewSpecDialog",
  components: { Button, Dialog, Message, Textarea },
  props: {
    visible: { type: Boolean, default: false },
  },
  emits: ["update:visible", "blank", "example", "import"],
  setup(props, { emit }) {
    const step = ref("choose");
    const pasted = ref("");
    const error = ref(null);
    const dragging = ref(false);
    const fileInput = ref(null);

    const reset = () => {
      step.value = "choose";
      pasted.value = "";
      error.value = null;
      dragging.value = false;
    };

    // Start from the choices every time the dialog opens.
    watch(
      () => props.visible,
      (visible) => {
        if (visible) reset();
      },
    );

    const close = (visible) => emit("update:visible", visible);

    const importText = (text, fileName = "") => {
      const result = readImportedSpec(text, fileName);
      if (result.error) {
        error.value = result.error;
        return;
      }
      error.value = null;
      emit("import", result);
    };

    const importFile = async (file) => {
      if (!file) return;
      if (file.size > MAX_IMPORT_BYTES) {
        error.value = "That file is larger than 5 MB.";
        return;
      }
      importText(await file.text(), file.name);
    };

    const onDrop = (event) => {
      dragging.value = false;
      importFile(event.dataTransfer?.files?.[0]);
    };

    const onFileChosen = (event) => {
      importFile(event.target.files?.[0]);
      event.target.value = "";
    };

    return { step, pasted, error, dragging, fileInput, reset, close, importText, onDrop, onFileChosen };
  },
};
</script>

<style scoped>
.new-spec-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  padding: 12px 0 4px;
}

@media (max-width: 640px) {
  .new-spec-options {
    grid-template-columns: 1fr;
  }
}

.option-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 24px 18px;
  border: 1.5px solid var(--fs-border, #e5e7eb);
  border-radius: 14px;
  text-align: center;
  cursor: pointer;
  font: inherit;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  background: var(--fs-surface, #fff);
}

.option-card:hover,
.option-card:focus-visible {
  border-color: var(--fs-primary, #2563ff);
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(37, 99, 255, 0.15);
  background: linear-gradient(135deg, #e2ecfe 0%, #f0f5ff 100%);
  outline: none;
}

.option-card i {
  font-size: 2.2rem;
  color: var(--fs-primary, #2563ff);
  margin-bottom: 12px;
  display: block;
}

.option-card h4 {
  margin: 0 0 8px 0;
  color: #1e293b;
  font-size: 1rem;
  font-weight: 700;
}

.option-card p {
  margin: 0;
  color: #64748b;
  font-size: 0.85rem;
  line-height: 1.4;
}

.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px;
  border: 2px dashed var(--fs-border, #cbd5e1);
  border-radius: 12px;
  text-align: center;
  color: #64748b;
  transition: border-color 0.2s, background 0.2s;
}

.drop-zone--active {
  border-color: var(--fs-primary, #2563ff);
  background: #f0f5ff;
}

.drop-zone i {
  font-size: 2rem;
  color: var(--fs-primary, #2563ff);
}

.drop-zone p {
  margin: 0;
}

.paste-label {
  display: block;
  margin: 16px 0 6px;
  font-weight: 600;
  color: #334155;
}

.paste-area {
  width: 100%;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}

.import-error {
  margin-top: 12px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
