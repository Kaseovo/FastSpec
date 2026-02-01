<template>
  <div class="token-manager">
    <Toast />

    <Card class="p-mb-4">
      <template #title>
        <div class="card-title">Create New Token</div>
      </template>
      <template #content>
        <div class="create-grid">
          <div class="actions-list">
            <label class="field-label">Select actions</label>
            <MultiSelect
              v-model="actionsSelected"
              :options="actionOptions"
              optionLabel="label"
              placeholder="Select actions"
              class="w-full"
            />
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
                label="Create Token"
                @click="handleCreate"
                :loading="creating"
                class="p-button-primary"
              />
            </div>

            <div v-if="createdToken" class="created-result">
              <label class="field-label">Token (copy and store safely)</label>
              <div class="created-row">
                <InputText
                  ref="createdInput"
                  :value="createdToken.token"
                  readonly
                  aria-readonly="true"
                />
                <Button icon="pi pi-copy" class="p-ml-2" @click="copyCreated" />
              </div>
              <div class="meta">Expires at: {{ createdToken.expires_at }}</div>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <Card>
      <template #title>
        <div class="card-title">Existing Tokens</div>
      </template>
      <template #content>
        <div v-if="listError" class="error mb-3">{{ listError }}</div>

        <DataTable
          :value="tokens"
          :paginator="true"
          :rows="10"
          responsiveLayout="scroll"
        >
          <Column field="jti" header="JTI" style="max-width: 320px">
            <template #body="slotProps">
              <span class="jti" :title="slotProps.data.jti">{{
                slotProps.data.jti
              }}</span>
            </template>
          </Column>

          <Column field="actions" header="Actions">
            <template #body="slotProps">
              {{ slotProps.data.actions.join(", ") }}
            </template>
          </Column>

          <Column field="created_at" header="Created At"></Column>
          <Column field="expires_at" header="Expires At"></Column>

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
              <Button
                label="Revoke"
                size="small"
                severity="danger"
                @click="handleRevoke(slotProps.data)"
                :loading="revoking[slotProps.data.jti]"
                :disabled="slotProps.data.revoked"
                class="p-mr-2"
              />

              <Button
                label="Refresh"
                size="small"
                @click="handleRefresh(slotProps.data)"
                :loading="refreshing[slotProps.data.jti]"
                :disabled="slotProps.data.revoked"
              />
            </template>
          </Column>
        </DataTable>

        <div v-if="tokens.length === 0" class="empty">No tokens</div>
      </template>
    </Card>
  </div>
</template>

<script>
import { ref, onMounted, nextTick } from "vue";
import {
  createToken,
  listTokens,
  revokeToken,
  refreshToken,
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
  },
  setup() {
    const toast = useToast();
    const actionOptions = [
      { label: "Action A", value: "action_a" },
      { label: "Action B", value: "action_b" },
    ];
    const actionsSelected = ref([]);
    const creating = ref(false);
    const createError = ref("");
    const createdToken = ref(null);

    const tokens = ref([]);
    const listError = ref("");

    const revoking = ref({});
    const refreshing = ref({});

    const createdInput = ref(null);

    const loadList = async () => {
      listError.value = "";
      try {
        const data = await listTokens();
        tokens.value = data;
      } catch (e) {
        console.error("Failed to list tokens", e);
        listError.value =
          e.response?.data?.detail || e.message || "Failed to load tokens";
      }
    };

    onMounted(() => {
      loadList();
    });

    const handleCreate = async () => {
      createError.value = "";
      // Ensure actionsSelected is an array to avoid runtime errors from non-array bindings
      if (!Array.isArray(actionsSelected.value)) {
        actionsSelected.value = [];
      }
      if (!actionsSelected.value || actionsSelected.value.length === 0) {
        createError.value = "Select at least one action";
        return;
      }

      // Map frontend option values to API expected action codes
      const valueMap = { action_a: "A", action_b: "B" };
      // Normalize selections to support both string items and object items from MultiSelect.
      // Fallback to raw value when no explicit mapping exists.
      const mapped = actionsSelected.value
        .map((a) => {
          const val = typeof a === "string" ? a : (a && a.value) || "";
          return valueMap[val] ?? val;
        })
        .filter(Boolean);

      // Debug: payload about to be sent to createToken
      console.debug("create token payload", { actions: mapped });

      if (mapped.length === 0) {
        createError.value = "Invalid actions selected";
        return;
      }

      creating.value = true;
      try {
        const res = await createToken(mapped);
        createdToken.value = res;

        tokens.value.unshift({
          jti: res.jti,
          actions: mapped,
          created_at: new Date().toISOString(),
          expires_at: res.expires_at,
          revoked: false,
        });

        toast.add({
          severity: "success",
          summary: "Token Created",
          detail: "New token generated — copy it now",
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
        console.error("Create token failed", e);
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
      revoking.value[t.jti] = true;
      const oldRevoked = t.revoked;
      t.revoked = true;
      try {
        await revokeToken(t.jti);
        toast.add({
          severity: "success",
          summary: "Token Revoked",
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
        revoking.value[t.jti] = false;
      }
    };

    const handleRefresh = async (t) => {
      refreshing.value[t.jti] = true;
      try {
        const res = await refreshToken(t.jti);
        toast.add({
          severity: "success",
          summary: "Token Refreshed",
          detail: "New token generated",
          life: 7000,
        });
        t.expires_at = res.expires_at;
      } catch (e) {
        console.error("Refresh failed", e);
        toast.add({
          severity: "error",
          summary: "Refresh Failed",
          detail: e.response?.data?.detail || e.message || "Refresh failed",
          life: 5000,
        });
      } finally {
        refreshing.value[t.jti] = false;
      }
    };

    const copyCreated = async () => {
      try {
        const val = createdToken.value?.token;
        if (!val) return;
        await navigator.clipboard.writeText(val);
        toast.add({
          severity: "success",
          summary: "Copied",
          detail: "Token copied to clipboard",
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
      creating,
      createError,
      createdToken,
      tokens,
      listError,
      revoking,
      refreshing,
      createdInput,
      handleCreate,
      handleRevoke,
      handleRefresh,
      copyCreated,
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
.created-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
.jti {
  display: inline-block;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.w-full {
  width: 100%;
}
</style>

