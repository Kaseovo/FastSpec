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
