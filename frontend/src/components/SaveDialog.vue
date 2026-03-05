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

      <div class="form-group" v-if="specId">
        <label for="version-select">Version</label>
        <select
          id="version-select"
          v-model="selectedVersion"
          class="w-full p-inputtext"
        >
          <option value="__create_new">Create new version...</option>
          <option v-for="v in versions" :key="v.id" :value="v.version">
            {{ v.version }}
          </option>
        </select>
      </div>

      <div class="form-group" v-if="showNewVersionInput">
        <label for="new-version">New version</label>
        <InputText
          id="new-version"
          v-model="newVersion"
          class="w-full"
          :placeholder="suggestedVersion"
        />
        <div v-if="errorMsg" class="inline-error">{{ errorMsg }}</div>
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" severity="secondary" @click="close" />
      <Button label="Save" @click="save" />
    </template>
  </Dialog>
</template>

<script>
import { ref, watch, computed } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import { listSpecVersions } from "../api/specs";

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
    specId: {
      // optional: when provided the dialog will fetch versions for this spec
      type: [Number, String],
      default: null,
    },
    currentVersion: {
      // the version string to preselect when dialog opens
      type: String,
      default: null,
    },
  },
  emits: ["update:visible", "save", "spec-saved"],
  setup(props, { emit }) {
    const name = ref("");
    const versions = ref([]);
    const selectedVersion = ref("__create_new");
    const newVersion = ref("");
    const errorMsg = ref("");

    const showNewVersionInput = computed(
      () => selectedVersion.value === "__create_new"
    );

    const suggestedVersion = computed(() => {
      // Suggest next patch version based on latest version string if available
      const v = versions.value[0]?.version;
      if (!v) return "1.0.0";
      const parts = v.split(".").map((p) => parseInt(p, 10) || 0);
      parts[2] = (parts[2] || 0) + 1;
      return parts.join(".");
    });

    watch(
      () => props.specName,
      (newName) => {
        name.value = newName;
      }
    );

    watch(
      () => props.visible,
      async (newVisible) => {
        if (newVisible) {
          name.value = props.specName;
          errorMsg.value = "";
          // Load versions lazily when dialog opens and specId is provided
          if (props.specId && props.specId !== "__unsaved") {
            try {
              versions.value = await listSpecVersions(props.specId);
              // Always select the latest version (first returned by API) if no currentVersion is provided
              if (props.currentVersion) {
                const found = versions.value.find(
                  (v) => v.version === props.currentVersion
                );
                selectedVersion.value = found
                  ? found.version
                  : versions.value[0]?.version || "__create_new";
              } else {
                selectedVersion.value =
                  versions.value[0]?.version || "__create_new";
              }
            } catch (e) {
              console.error("Failed to load versions", e);
              versions.value = [];
            }
          }
        }
      }
    );

    const close = () => {
      emit("update:visible", false);
    };

    const save = () => {
      if (!name.value.trim()) {
        errorMsg.value = "Name is required";
        return;
      }

      // Prepare version choice to inform parent how to proceed
      let versionChoice;
      if (showNewVersionInput.value) {
        const createdVersion =
          newVersion.value.trim() || suggestedVersion.value;
        versionChoice = { action: "create", version: createdVersion };
        // After save, select the new version
        selectedVersion.value = createdVersion;
      } else {
        versionChoice = { action: "use", version: selectedVersion.value };
      }

      // Emit save payload with name + versionChoice
      emit("save", { name: name.value.trim(), versionChoice });
      emit("spec-saved", {
        name: name.value.trim(),
        version: versionChoice.version,
      });
      close();
    };

    return {
      name,
      versions,
      selectedVersion,
      newVersion,
      suggestedVersion,
      errorMsg,
      showNewVersionInput,
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

.inline-error {
  color: #b91c1c;
  margin-top: 8px;
}
</style>
