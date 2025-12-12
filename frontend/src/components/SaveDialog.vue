<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    modal
    header="Save Specification"
    :style="{ width: '450px' }"
  >
    <div class="dialog-content">
      <div class="form-group">
        <label for="spec-name">Specification Name</label>
        <InputText
          id="spec-name"
          v-model="name"
          placeholder="Enter a unique name..."
          class="w-full"
        />
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" severity="secondary" @click="close" />
      <Button label="Save" @click="save" />
    </template>
  </Dialog>
</template>

<script>
import { ref, watch } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import InputText from "primevue/inputtext";

export default {
  name: "SaveDialog",
  components: {
    Dialog,
    Button,
    InputText,
  },
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    specName: {
      type: String,
      default: "",
    },
  },
  emits: ["update:visible", "save", "spec-saved"],
  setup(props, { emit }) {
    const name = ref("");

    watch(
      () => props.specName,
      (newName) => {
        name.value = newName;
      }
    );

    watch(
      () => props.visible,
      (newVisible) => {
        if (newVisible) {
          name.value = props.specName;
        }
      }
    );

    const close = () => {
      emit("update:visible", false);
    };

    const save = () => {
      if (name.value.trim()) {
        // Notify parent to perform the actual save API call (create/update).
        // Parent listens for "save" and will run the API; we emit it so the save flow starts.
        emit("save", name.value.trim());

        // Also emit a higher-level 'spec-saved' event with the saved spec payload.
        // This is used by the parent to trigger a sidebar refresh (incrementing the refresh ref).
        // Emitting here is safe: it only notifies parents and does not change routing or global state.
        // Note: payload is minimal here (name) because the dialog only knows the spec name;
        // the parent will replace/augment this with the full saved spec response if needed.
        emit("spec-saved", { name: name.value.trim() });

        close();
      }
    };

    return {
      name,
      close,
      save,
    };
  },
};
</script>

<style scoped>
.dialog-content {
  padding: 20px 0;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.w-full {
  width: 100%;
}
</style>
