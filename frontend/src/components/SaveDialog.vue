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
  emits: ["update:visible", "save"],
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
        emit("save", name.value.trim());
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
