<template>
  <Dialog
    :visible="visible"
    header="Edit Path"
    :style="{ width: '520px' }"
    modal
    :draggable="false"
    @update:visible="$emit('update:visible', $event)"
  >
    <div class="dialog-content">
      <div class="form-field">
        <label for="edit-path">Path</label>
        <InputGroup>
          <InputGroupAddon class="path-addon">/</InputGroupAddon>
          <InputText
            id="edit-path"
            :model-value="editPathValue"
            placeholder="users/{id}"
            :class="{ 'p-invalid': editPathError }"
            @update:model-value="$emit('update:editPathValue', $event)"
            @keydown="$emit('path-keydown', $event)"
          />
        </InputGroup>
        <small v-if="editPathError" class="p-error">{{ editPathError }}</small>
        <small v-else class="helper-text">Use {param} for path variables — e.g. users/{id}</small>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" text @click="$emit('update:visible', false)" />
      <Button label="Save Path" icon="pi pi-check" @click="$emit('confirm')" />
    </template>
  </Dialog>
</template>

<script>
import "../../assets/form-editor-shared.css";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import InputGroup from "primevue/inputgroup";
import InputGroupAddon from "primevue/inputgroupaddon";

// The "Edit Path" dialog, extracted verbatim from FormEditor.vue's trailing
// dialogs. FormEditor.vue keeps ownership of editPathValue/editPathError
// (passed down, updated via emit) and of confirmEditPath() (triggered via
// the `confirm` emit), since it mutates the shared formData and may need to
// show a confirm() dialog for path-parameter removal.
export default {
  name: "EditPathDialog",
  components: { Dialog, Button, InputText, InputGroup, InputGroupAddon },
  props: {
    visible: { type: Boolean, default: false },
    editPathValue: { type: String, default: "" },
    editPathError: { type: String, default: "" },
  },
  emits: ["update:visible", "update:editPathValue", "path-keydown", "confirm"],
};
</script>

<style scoped>
/* See AddPathDialog.vue's identical block for why this is here instead of
   the shared stylesheet: PrimeVue's Dialog teleports to <body>, and only
   scoped-CSS :deep() (not a plain DOM-ancestry selector) survives that. */
:deep(.p-dialog) {
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

:deep(.p-dialog-header) {
  padding: 16px 20px;
  background: #1f2937;
  color: white;
  border-bottom: none;
}

:deep(.p-dialog-title) {
  font-weight: 600;
  font-size: 15px;
}

:deep(.p-dialog-header-close) {
  color: rgba(255, 255, 255, 0.7);
  transition: color 0.15s ease;
}

:deep(.p-dialog-header-close:hover) {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
}

:deep(.p-dialog-content) {
  padding: 20px;
  background: #ffffff;
}

:deep(.p-dialog-footer) {
  padding: 12px 20px;
  border-top: 1px solid #f3f4f6;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  background: #ffffff;
}
</style>
