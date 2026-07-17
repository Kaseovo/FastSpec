<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    header="Add Method to Path"
    :style="{ width: '520px' }"
    modal
    :draggable="false"
  >
    <div class="dialog-content">
      <div class="form-field">
        <label class="required">HTTP Method</label>
        <SelectButton
          :modelValue="methodToAdd"
          @update:modelValue="$emit('update:methodToAdd', $event)"
          :options="availableMethods"
          class="method-select-button"
        >
          <template #option="slotProps">
            <span :class="['method-chip', 'method-' + slotProps.option.toLowerCase()]">
              {{ slotProps.option.toUpperCase() }}
            </span>
          </template>
        </SelectButton>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" text @click="$emit('update:visible', false)" />
      <Button
        label="Add Method"
        icon="pi pi-plus"
        @click="$emit('confirm')"
        :disabled="!methodToAdd"
      />
    </template>
  </Dialog>
</template>

<script>
import "../../assets/form-editor-shared.css";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import SelectButton from "primevue/selectbutton";

// The "Add Method to Path" dialog, extracted verbatim from FormEditor.vue's
// trailing dialogs. FormEditor.vue keeps ownership of methodToAdd (passed
// down, updated via emit) and of addMethodToPath() (triggered via the
// `confirm` emit), since it mutates the shared formData.
export default {
  name: "AddMethodDialog",
  components: { Dialog, Button, SelectButton },
  props: {
    visible: { type: Boolean, default: false },
    availableMethods: { type: Array, default: () => [] },
    methodToAdd: { type: String, default: "" },
  },
  emits: ["update:visible", "update:methodToAdd", "confirm"],
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
