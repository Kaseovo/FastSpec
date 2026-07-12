<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    header="Edit Path"
    :style="{ width: '520px' }"
    modal
    :draggable="false"
  >
    <div class="dialog-content">
      <div class="form-field">
        <label for="edit-path">Path</label>
        <InputGroup>
          <InputGroupAddon class="path-addon">/</InputGroupAddon>
          <InputText
            id="edit-path"
            :modelValue="editPathValue"
            @update:modelValue="$emit('update:editPathValue', $event)"
            placeholder="users/{id}"
            :class="{ 'p-invalid': editPathError }"
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
