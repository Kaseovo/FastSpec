<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    header="Add New Path"
    :style="{ width: '520px' }"
    modal
    :draggable="false"
  >
    <div class="dialog-content">
      <div class="form-field">
        <label class="required">HTTP Method</label>
        <SelectButton
          :modelValue="newMethod"
          @update:modelValue="$emit('update:newMethod', $event)"
          :options="httpMethods"
          class="method-select-button"
        >
          <template #option="slotProps">
            <span :class="['method-chip', 'method-' + slotProps.option.toLowerCase()]">
              {{ slotProps.option.toUpperCase() }}
            </span>
          </template>
        </SelectButton>
      </div>
      <div class="form-field">
        <label for="new-path">Path</label>
        <InputGroup>
          <InputGroupAddon class="path-addon">/</InputGroupAddon>
          <InputText
            id="new-path"
            :modelValue="newPath"
            @update:modelValue="$emit('update:newPath', $event)"
            placeholder="users/{id}"
            @keydown="$emit('path-keydown', $event)"
          />
        </InputGroup>
        <small class="helper-text">Use {param} for path variables — e.g. users/{id}</small>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" text @click="$emit('update:visible', false)" />
      <Button
        label="Add Path"
        icon="pi pi-plus"
        @click="$emit('confirm')"
        :disabled="!newMethod"
      />
    </template>
  </Dialog>
</template>

<script>
import "../../assets/form-editor-shared.css";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import SelectButton from "primevue/selectbutton";
import InputGroup from "primevue/inputgroup";
import InputGroupAddon from "primevue/inputgroupaddon";

// The "Add New Path" dialog, extracted verbatim from FormEditor.vue's
// trailing dialogs. FormEditor.vue keeps ownership of newMethod/newPath
// (passed down, updated via emit) and of the addPath() handler (triggered
// via the `confirm` emit), since addPath() mutates the shared formData.
export default {
  name: "AddPathDialog",
  components: { Dialog, Button, InputText, SelectButton, InputGroup, InputGroupAddon },
  props: {
    visible: { type: Boolean, default: false },
    httpMethods: { type: Array, default: () => [] },
    newMethod: { type: String, default: "" },
    newPath: { type: String, default: "" },
  },
  emits: ["update:visible", "update:newMethod", "update:newPath", "path-keydown", "confirm"],
};
</script>

<style scoped>
/* PrimeVue's Dialog teleports its rendered content to <body>, so a plain
   ".form-editor .p-dialog" selector in the shared stylesheet would never
   match it (DOM ancestry is broken by the teleport). Vue's scoped-CSS
   :deep() is what actually survives teleportation (it tags the elements
   themselves at compile time rather than relying on DOM position), so this
   dialog chrome styling has to live here rather than in the shared file —
   same block duplicated across all 4 dialog components in form-editor/. */
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
