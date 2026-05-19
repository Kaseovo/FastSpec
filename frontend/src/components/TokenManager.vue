<template>
  <div class="token-manager">
    <Toast />

    <Dialog
      v-model:visible="editDialogVisible"
      header="Edit Actions"
      :modal="true"
      :closable="true"
      class="edit-dialog"
      :style="{ width: '520px' }"
    >
      <div>
        <label class="field-label">Select actions</label>
        <MultiSelect
          v-model="editActionsSelected"
          :options="actionOptions"
          optionLabel="label"
          optionValue="value"
          :optionDisabled="(opt) => editAllSelected && opt.value !== 'All'"
          placeholder="Select actions"
          class="w-full"
        >
          <template #option="{ option }">
            <div class="action-option">
              <span class="action-option-value">{{ option.value }}</span>
              <span class="action-option-desc">{{ option.description }}</span>
            </div>
          </template>
        </MultiSelect>
        <p v-if="editError" class="error">{{ editError }}</p>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="editDialogVisible = false" />
        <Button
          label="Save"
          class="p-button-primary"
          :loading="editLoading"
          @click="saveEdit"
        />
      </template>
    </Dialog>

    <div
      class="token-manager-grid"
      style="
        display: flex;
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      "
    >
      <Card class="p-mb-4" style="width: 100%">
        <template #title>
          <div class="card-title">Create New API Key</div>
        </template>
        <template #content>
          <div class="create-grid">
            <div class="actions-list">
              <label class="field-label">Select actions</label>
              <MultiSelect
                v-model="actionsSelected"
                :options="actionOptions"
                optionLabel="label"
                optionValue="value"
                :optionDisabled="(opt) => allSelected && opt.value !== 'All'"
                placeholder="Select actions"
                class="w-full"
              >
                <template #option="{ option }">
                  <div class="action-option">
                    <span class="action-option-value">{{ option.value }}</span>
                    <span class="action-option-desc">{{ option.description }}</span>
                  </div>
                </template>
              </MultiSelect>
              <p v-if="createError" class="error">{{ createError }}</p>
            </div>

            <div class="create-controls">
              <div
                style="
                  display: flex;
                  justify-content: flex-end;
                  align-items: center;
                "
              >
                <Button
                  label="Create API Key"
                  @click="handleCreate"
                  :loading="creating"
                  class="p-button-primary"
                />
              </div>
            </div>
          </div>

          <!-- created API key shown full-width below the grid -->
          <div
            v-if="createdToken"
            class="created-result full-width"
            style="margin-top: 1rem"
          >
            <label class="field-label">API Key (shown once)</label>
            <div
              class="token-line"
              style="display: flex; gap: 0.5rem; align-items: center"
            >
              <InputText
                ref="createdInput"
                :value="createdToken.api_key || createdToken.refresh_token"
                readonly
                aria-readonly="true"
                class="w-full"
              />
              <Button icon="pi pi-copy" class="p-ml-2" @click="copyCreated" />
            </div>
            <div
              class="note"
              style="
                margin-top: 0.5rem;
                color: var(--text-color, #6b7280);
                font-size: 0.875rem;
              "
            >
              Copy and store the raw API key safely — it will not be shown
              again.
            </div>
            <div class="meta">
              Expires at: {{ formatTime(createdToken.expires_at) }}
            </div>
          </div>
        </template>
      </Card>

      <Card style="width: 100%">
        <template #title>
          <div class="card-title">Existing API Keys</div>
        </template>
        <template #content>
          <div v-if="listError" class="error mb-3">{{ listError }}</div>

          <DataTable
            :value="tokens"
            :paginator="true"
            :rows="10"
            responsiveLayout="scroll"
          >
            <Column field="id" header="ID" style="max-width: 320px">
              <template #body="slotProps">
                <span class="id" :title="slotProps.data.id">{{
                  slotProps.data.id
                }}</span>
              </template>
            </Column>

            <Column field="actions" header="Actions">
              <template #body="slotProps">
                {{ slotProps.data.actions.join(", ") }}
              </template>
            </Column>

            <Column field="created_at" header="Created At">
              <template #body="slotProps">
                {{ formatTime(slotProps.data.created_at) }}
              </template>
            </Column>
            <Column field="expires_at" header="Expires At">
              <template #body="slotProps">
                {{ formatTime(slotProps.data.expires_at) }}
              </template>
            </Column>

            <Column field="revoked" header="Revoked">
              <template #body="slotProps">
                <Tag
                  :value="slotProps.data.revoked ? 'Yes' : 'No'"
                  :severity="slotProps.data.revoked ? 'danger' : 'success'"
                />
              </template>
            </Column>

            <Column header="Actions">
              <template #body="slotProps">
                <div class="row-actions">
                  <Button
                    label="Edit"
                    size="small"
                    severity="warn"
                    @click="openEditDialog(slotProps.data)"
                    :loading="editLoading && editingId === slotProps.data.id"
                    :disabled="slotProps.data.revoked"
                  />

                  <Button
                    label="Revoke"
                    size="small"
                    severity="danger"
                    @click="handleRevoke(slotProps.data)"
                    :loading="revoking[slotProps.data.id]"
                    :disabled="slotProps.data.revoked"
                  />
                </div>
              </template>
            </Column>
          </DataTable>

          <div v-if="tokens.length === 0" class="empty">No tokens</div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, nextTick, watch, computed } from "vue";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  updateApiKeyActions,
  fetchAvailableActions,
} from "../api/auth";
import Card from "primevue/card";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Tag from "primevue/tag";
import Toast from "primevue/toast";
import { useToast } from "primevue/usetoast";
import MultiSelect from "primevue/multiselect";
import Dialog from "primevue/dialog";

export default {
  name: "TokenManager",
  components: {
    Card,
    Button,
    MultiSelect,
    InputText,
    DataTable,
    Column,
    Tag,
    Toast,
    Dialog,
  },
  setup() {
    const toast = useToast();
    const actionOptions = ref([]);
    const actionsSelected = ref([]);
    const creating = ref(false);
    const createError = ref("");
    const createdToken = ref(null);

    const tokens = ref([]);
    const listError = ref("");

    const revoking = ref({});

    const createdInput = ref(null);

    // Edit dialog state
    const editDialogVisible = ref(false);
    const editingId = ref(null);
    const editActionsSelected = ref([]);
    const editLoading = ref(false);
    const editError = ref("");

    const loadActions = async () => {
      try {
        const data = await fetchAvailableActions();
        actionOptions.value = data.map((a) => ({
          label: a.value,
          value: a.value,
          description: a.description || "",
        }));
      } catch (e) {
        console.error("Failed to load available actions", e);
      }
    };

    // Computed: whether "All" is selected
    const allSelected = computed(() => actionsSelected.value.includes("All"));
    const editAllSelected = computed(() => editActionsSelected.value.includes("All"));

    // When "All" is selected, auto-select all other options
    watch(actionsSelected, (val) => {
      if (val.includes("All")) {
        const allValues = actionOptions.value.map((o) => o.value);
        if (val.length !== allValues.length) {
          actionsSelected.value = allValues;
        }
      }
    });

    watch(editActionsSelected, (val) => {
      if (val.includes("All")) {
        const allValues = actionOptions.value.map((o) => o.value);
        if (val.length !== allValues.length) {
          editActionsSelected.value = allValues;
        }
      }
    });

    const loadList = async () => {
      listError.value = "";
      try {
        const data = await listApiKeys();
        tokens.value = data;
      } catch (e) {
        console.error("Failed to list API keys", e);
        listError.value =
          e.response?.data?.detail || e.message || "Failed to load tokens";
      }
    };

    onMounted(() => {
      loadActions();
      loadList();
    });

    const handleCreate = async () => {
      createError.value = "";
      if (!Array.isArray(actionsSelected.value)) {
        actionsSelected.value = [];
      }

      const actions = actionsSelected.value.includes("All")
        ? ["All"]
        : actionsSelected.value.filter(Boolean);

      creating.value = true;
      try {
        const res = await createApiKey(actions);
        // res: { api_key, refresh_token?, id, expires_at }
        createdToken.value = res;

        tokens.value.unshift({
          id: res.id,
          actions: actions,
          created_at: new Date().toISOString(),
          expires_at: res.expires_at,
          revoked: false,
        });

        toast.add({
          severity: "success",
          summary: "API Key Created",
          detail: "New API key generated — copy it now",
          life: 5000,
        });

        await nextTick();
        const el =
          createdInput.value?.$el?.querySelector("input") ||
          createdInput.value?.$el ||
          createdInput.value;
        if (el && typeof el.select === "function") {
          el.focus();
          el.select();
        }
      } catch (e) {
        console.error("Create API key failed", e);
        createError.value =
          e.response?.data?.detail || e.message || "Create failed";
        toast.add({
          severity: "error",
          summary: "Create Failed",
          detail: createError.value,
          life: 5000,
        });
      } finally {
        creating.value = false;
      }
    };

    const handleRevoke = async (t) => {
      revoking.value[t.id] = true;
      const oldRevoked = t.revoked;
      t.revoked = true;
      try {
        await revokeApiKey(t.id);
        toast.add({
          severity: "success",
          summary: "API Key Revoked",
          detail: "Token has been successfully revoked",
          life: 3000,
        });
      } catch (e) {
        console.error("Revoke failed", e);
        t.revoked = oldRevoked;
        toast.add({
          severity: "error",
          summary: "Revoke Failed",
          detail: e.response?.data?.detail || e.message || "Revoke failed",
          life: 5000,
        });
      } finally {
        revoking.value[t.id] = false;
      }
    };

    // Open edit dialog and pre-populate selections from token.actions
    const openEditDialog = (token) => {
      editError.value = "";
      editActionsSelected.value = [...(token.actions || [])];
      editingId.value = token.id;
      editDialogVisible.value = true;
    };

    const saveEdit = async () => {
      editError.value = "";
      if (!editingId.value) return;
      editLoading.value = true;
      try {
        const actions = (editActionsSelected.value || []).includes("All")
          ? ["All"]
          : (editActionsSelected.value || []).filter(Boolean);

        await updateApiKeyActions(editingId.value, actions);

        const idx = tokens.value.findIndex((t) => t.id === editingId.value);
        if (idx !== -1) {
          tokens.value[idx].actions = actions;
        }

        toast.add({
          severity: "success",
          summary: "Updated",
          detail: "Token actions updated",
          life: 3000,
        });
        editDialogVisible.value = false;
      } catch (e) {
        console.error("Update actions failed", e);
        editError.value =
          e.response?.data?.detail || e.message || "Update failed";
        toast.add({
          severity: "error",
          summary: "Update Failed",
          detail: editError.value,
          life: 5000,
        });
      } finally {
        editLoading.value = false;
      }
    };

    const formatTime = (iso) => {
      if (!iso) return "";
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
        d.getDate()
      )} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const copyCreated = async () => {
      try {
        const val =
          createdToken.value?.api_key || createdToken.value?.refresh_token;
        if (!val) return;
        await navigator.clipboard.writeText(val);
        toast.add({
          severity: "success",
          summary: "Copied",
          detail: "API key copied to clipboard",
          life: 2000,
        });
      } catch (e) {
        console.error("Copy failed", e);
        toast.add({
          severity: "error",
          summary: "Copy Failed",
          detail: e.message || "Unable to copy",
          life: 3000,
        });
      }
    };

    return {
      actionOptions,
      actionsSelected,
      allSelected,
      creating,
      createError,
      createdToken,
      tokens,
      listError,
      revoking,
      createdInput,
      handleCreate,
      handleRevoke,
      formatTime,
      copyCreated,
      // edit dialog
      editDialogVisible,
      editActionsSelected,
      editAllSelected,
      editLoading,
      editError,
      openEditDialog,
      saveEdit,
      editingId,
    };
  },
};
</script>

<style scoped>
.token-manager {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}
.card-title {
  font-weight: 600;
  font-size: 1rem;
}
.create-grid {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}
.actions-list {
  min-width: 220px;
}
.field-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}
.inline-label {
  margin-left: 0.5rem;
}
.action-item {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
}
.create-controls {
  flex: 1;
}
/* token area adjustments */
.full-width {
  width: 100%;
}
.token-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}
.token-line .w-full {
  flex: 1;
  min-width: 0; /* allow input to shrink inside flex */
}
.meta {
  margin-top: 0.5rem;
  color: var(--text-color, #6b7280);
}
.error {
  color: var(--danger-color, #dc2626);
  margin-top: 0.5rem;
}
.empty {
  text-align: center;
  padding: 1rem 0;
  color: var(--muted-color, #6b7280);
}
.id {
  display: inline-block;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.w-full {
  width: 100%;
}

/* Action buttons row spacing */
.row-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

/* Keep edit dialog from resizing when MultiSelect content changes */
.edit-dialog {
  /* Dialog root spacing handled via inline style for width; ensure content area respects it */
}
.edit-dialog .p-dialog-content {
  min-width: 520px; /* match the inline width to prevent shrink/grow */
  max-width: calc(100vw - 2rem);
}
.edit-dialog .p-multiselect {
  width: 100%;
}
.edit-dialog .p-multiselect .p-multiselect-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.action-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.action-option-value {
  font-weight: 600;
  font-size: 0.875rem;
}
.action-option-desc {
  font-size: 0.75rem;
  color: var(--text-color-secondary, #6b7280);
}
</style>
