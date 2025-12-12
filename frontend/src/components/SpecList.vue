<template>
  <div class="sidebar">
    <h3>Saved Specs</h3>
    <div v-if="loading" class="loading">
      <ProgressSpinner style="width: 30px; height: 30px" />
    </div>
    <div v-else-if="error" class="error">
      <Message severity="error">{{ error }}</Message>
    </div>
    <div v-else class="spec-list">
      <div
        v-for="spec in specs"
        :key="spec.id"
        :class="['spec-item', { active: spec.id === selectedId }]"
        @click="selectSpec(spec)"
      >
        <div class="spec-info">
          <h4>{{ spec.name }}</h4>
          <p>{{ spec.title }} v{{ spec.version }}</p>
        </div>
        <Button
          icon="pi pi-trash"
          severity="danger"
          text
          rounded
          @click.stop="confirmDelete(spec)"
        />
      </div>
      <div v-if="specs.length === 0" class="empty">
        <p>No saved specs yet</p>
      </div>
    </div>

    <ConfirmDialog></ConfirmDialog>
  </div>
</template>

<script>
import { ref, onMounted, watch, inject } from "vue";
import Button from "primevue/button";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import ConfirmDialog from "primevue/confirmdialog";
import { useConfirm } from "primevue/useconfirm";
import { fetchSpecs, deleteSpec } from "../api/specs";

export default {
  name: "SpecList",
  components: {
    Button,
    Message,
    ProgressSpinner,
    ConfirmDialog,
  },
  props: {
    selectedId: {
      type: Number,
      default: null,
    },
  },
  emits: ["spec-selected"],
  setup(props, { emit }) {
    const specs = ref([]);
    const loading = ref(false);
    const error = ref(null);
    const confirm = useConfirm();
    const refreshSpecList = inject("refreshSpecList");

    const loadSpecs = async () => {
      loading.value = true;
      error.value = null;
      try {
        specs.value = await fetchSpecs();
      } catch (err) {
        error.value = "Failed to load specs";
        console.error(err);
      } finally {
        loading.value = false;
      }
    };

    const selectSpec = (spec) => {
      emit("spec-selected", spec);
    };

    const confirmDelete = (spec) => {
      confirm.require({
        message: `Are you sure you want to delete "${spec.name}"?`,
        header: "Confirm Deletion",
        icon: "pi pi-exclamation-triangle",
        acceptClass: "p-button-danger",
        accept: async () => {
          try {
            await deleteSpec(spec.id);
            await loadSpecs();
          } catch (err) {
            console.error("Failed to delete spec:", err);
          }
        },
      });
    };

    onMounted(loadSpecs);

    // Watch for refresh trigger
    watch(refreshSpecList, loadSpecs);

    return {
      specs,
      loading,
      error,
      selectSpec,
      confirmDelete,
    };
  },
};
</script>

<style scoped>
.sidebar {
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
}

.sidebar h3 {
  margin-bottom: 15px;
  color: #1f2937;
}

.loading,
.error,
.empty {
  text-align: center;
  padding: 20px;
  color: #6b7280;
}

.spec-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.spec-item {
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid transparent;
}

.spec-item:hover {
  background: #f3f4f6;
}

.spec-item.active {
  background: #dbeafe;
  border-left: 3px solid #2563eb;
}

.spec-info h4 {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 4px;
}

.spec-info p {
  font-size: 12px;
  color: #6b7280;
}
</style>
