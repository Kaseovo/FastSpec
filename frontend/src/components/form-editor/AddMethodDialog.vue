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
