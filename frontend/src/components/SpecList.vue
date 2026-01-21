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
        :class="['spec-card', { active: spec.id === selectedId }]"
        @click="selectSpec(spec)"
      >
        <div class="spec-header">
          <div class="spec-info">
            <h4>{{ spec.name }}</h4>
            <p>{{ spec.title }} v{{ spec.version }}</p>
          </div>
          <div class="spec-actions">
            <Button
              :icon="
                expanded.has(spec.id)
                  ? 'pi pi-chevron-up'
                  : 'pi pi-chevron-down'
              "
              text
              rounded
              @click.stop="toggleExpand(spec.id)"
              :aria-expanded="expanded.has(spec.id)"
              aria-label="Toggle details"
            />
            <Button
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              @click.stop="confirmDelete(spec)"
            />
          </div>
        </div>
        <transition name="expand">
          <div v-if="expanded.has(spec.id)" class="spec-details">
            <div class="detail-row">
              <span class="label">ID:</span>
              <span>{{ spec.id }}</span>
            </div>
            <div class="detail-row">
              <span class="label">User ID:</span>
              <span>{{ spec.user_id }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Created:</span>
              <span>{{ formatRelativeTime(spec.created_at) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Updated:</span>
              <span>{{ formatRelativeTime(spec.updated_at) }}</span>
            </div>
          </div>
        </transition>
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
    const expanded = ref(new Set());

    const toggleExpand = (id) => {
      if (expanded.value.has(id)) {
        expanded.value.delete(id);
      } else {
        expanded.value.add(id);
      }
    };

    const formatRelativeTime = (date) => {
      const now = new Date();
      const diff = now - new Date(date);
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
      if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
      if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
      return "Just now";
    };

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
      expanded,
      toggleExpand,
      formatRelativeTime,
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

.spec-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.spec-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.spec-card.active {
  border-left: 4px solid #2563eb;
  background: #f0f9ff;
}

.spec-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.spec-actions {
  display: flex;
  gap: 4px;
}

.spec-details {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 4px;
}

.label {
  font-weight: 500;
  color: #374151;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 200px;
}

/* Responsive design */
@media (max-width: 768px) {
  .spec-card {
    padding: 10px;
  }
  .spec-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .spec-actions {
    align-self: flex-end;
  }
}
</style>
