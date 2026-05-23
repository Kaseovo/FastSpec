<template>
  <div class="sidebar">
    <h3>Saved Specs</h3>
    <!-- Removed unused selectedSpec/selectedVersion global dropdown -->
    <div v-if="loading" class="loading">
      <ProgressSpinner style="width: 30px; height: 30px" />
    </div>
    <div v-else-if="error" class="error">
      <Message severity="error">{{ error }}</Message>
    </div>
    <div v-else class="spec-list">
      <div v-if="loading" class="loading">
        - <ProgressSpinner style="width: 30px; height: 30px" /> -
      </div>
      <div v-if="loading" class="loading">
        + <ProgressSpinner class="spinner-small" /> +
      </div>
      <div
        v-for="spec in specs"
        :key="spec.id"
        :class="[
          'spec-card',
          {
            active: spec.id === selectedId,
            changed:
              (spec.id === selectedId && hasUnsavedChanges) ||
              spec.id === '__unsaved',
          },
        ]"
        @click="selectSpec(spec)"
      >
        <div class="spec-header">
          <div class="spec-info">
            <h4>{{ spec.name }}</h4>
          </div>
          <div class="spec-actions">
            <Button
              icon="pi pi-pencil"
              text
              rounded
              size="small"
              @click.stop="startRename(spec)"
              aria-label="Rename spec"
              v-tooltip.top="'Rename'"
              v-if="spec.id !== '__unsaved'"
            />
            <Button
              icon="pi pi-history"
              text
              rounded
              size="small"
              @click.stop="openHistory(spec)"
              aria-label="Open version history"
              v-tooltip.top="'Version history'"
              v-if="spec.id !== '__unsaved'"
            />
            <Button
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              size="small"
              @click.stop="confirmDelete(spec)"
              v-tooltip.top="'Delete'"
            />
          </div>
        </div>
        <button
          v-if="spec.id !== '__unsaved'"
          class="spec-expand-toggle"
          :aria-expanded="expanded.has(spec.id)"
          @click.stop="toggleExpand(spec.id)"
        >
          <span class="spec-expand-label">Details</span>
          <i :class="expanded.has(spec.id) ? 'pi pi-angle-up' : 'pi pi-angle-down'"></i>
        </button>
        <div class="version-row" v-if="spec.id !== '__unsaved'">
          <span>Version</span>
          <span>
            <div class="version-select-row">
              <Select
                v-model="spec.selectedVersion"
                :options="spec.versionOptions"
                optionLabel="label"
                optionValue="value"
                class="version-select"
                @change="onSpecVersionChange(spec)()"
              />
            </div>
          </span>
        </div>
        <span v-if="spec.id === '__unsaved'" class="unsaved-badge"
          >Unsaved</span
        >
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

    <Drawer
      :visible="historyOpen"
      @update:visible="(v) => (historyOpen = v)"
      position="right"
      class="history-drawer"
      :style="{ width: '80rem' }"
    >
      <template #header>
        <div class="drawer-header">
          <h3>Version history - {{ historySpec?.name }}</h3>
        </div>
      </template>

      <div class="drawer-body">
        <div v-if="versionsLoading">Loading versions...</div>
        <div v-else>
          <div v-if="versions.length === 0">No versions available</div>

          <div v-else class="version-controls">
            <div class="control-row">
              <p class="compare-instructions">
                Select two versions to compare within this panel.
              </p>
            </div>

            <div class="control-row row-controls controls-with-top">
              <label class="control-label">Base</label>
              <Select
                v-model="baseVersion"
                :options="versionOptions"
                optionLabel="label"
                optionValue="value"
                aria-label="Base version"
                placeholder="Select base"
              />

              <label class="control-label">Compare</label>
              <Select
                v-model="compareVersion"
                :options="compareOptions"
                optionLabel="label"
                optionValue="value"
                aria-label="Compare version"
                placeholder="Select compare"
              />

              <Button
                label="Compare"
                icon="pi pi-search"
                class="p-button-outlined"
                :loading="comparing"
                @click="runCompare"
              />
              <Button
                label="Compare draft"
                icon="pi pi-file"
                class="p-button-outlined"
                :loading="comparingDraft"
                @click="runCompareWithDraft"
              />
            </div>

            <div v-if="compareError" class="inline-error" role="alert">
              {{ compareError }}
            </div>
          </div>
        </div>

        <div class="diff-area">
          <DiffDrawer :diff="historyDiff" :spec="historySpec" inline />
        </div>
      </div>
    </Drawer>

    <!-- Rename Dialog -->
    <Dialog
      :visible="renameDialogVisible"
      @update:visible="renameDialogVisible = $event"
      modal
      header="Rename Specification"
      :style="{ width: '400px' }"
    >
      <div class="form-group">
        <label for="rename-input" style="margin-bottom: 0.5rem; display: block">New name</label>
        <InputText
          id="rename-input"
          v-model="renameValue"
          class="w-full"
          @keyup.enter="confirmRename"
        />
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="cancelRename" />
        <Button label="Rename" @click="confirmRename" />
      </template>
    </Dialog>
  </div>
</template>

<script>
import { ref, onMounted, watch, inject, computed, onUnmounted } from "vue";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import Drawer from "primevue/drawer";
import { useConfirm } from "primevue/useconfirm";
import {
  fetchSpecs,
  deleteSpec,
  updateSpec,
  listSpecVersions,
  compareSpecVersions,
  compareDraftWithVersion,
  getSpecVersion,
} from "../api/specs";
import DiffDrawer from "./DiffDrawer.vue";

export default {
  name: "SpecList",
  components: {
    Button,
    Dialog,
    InputText,
    Select,
    Message,
    ProgressSpinner,
    Drawer,
    DiffDrawer,
  },
  props: {
    selectedId: {
      type: [Number, String],
      default: null,
    },
  },
  emits: ["spec-selected"],
  setup(props, { emit }) {
    const specs = ref([]);
    const loading = ref(false);
    const error = ref(null);
    const confirm = useConfirm();
    const confirmOpen = ref(false);
    const refreshSpecList = inject("refreshSpecList", ref(0));
    // Inject unsaved transient spec from parent so we can render a temporary card
    const unsavedSpec = inject("unsavedSpec", ref(null));
    // Also inject the whole specEditor as a fallback to access unsavedSpec reliably
    const specEditor = inject("specEditor", null);
    // Inject unsaved state and discard helper from parent (App.vue)
    const hasUnsavedChanges = inject("hasUnsavedChanges", ref(false));
    const discardUnsaved = inject("discardUnsaved", () => {});
    const expanded = ref(new Set());
    // Access current editor parsed spec for draft comparisons (provided by App.vue)
    const getCurrentEditorSpec = inject("getCurrentEditorSpec", () => null);

    // History drawer state
    const historyOpen = ref(false);
    const historySpec = ref(null);
    const versions = ref([]);
    const versionsLoading = ref(false);
    const historyDiff = ref({
      info: null,
      added: [],
      modified: [],
      removed: [],
    });

    // version compare controls
    const baseVersion = ref(null);
    const compareVersion = ref(null);
    const comparing = ref(false);
    const comparingDraft = ref(false);
    const compareError = ref(null);

    const versionOptions = computed(() =>
      versions.value.map((v) => ({
        label: `${v.version}${v.is_published ? " (published)" : ""}`,
        value: v.id,
      }))
    );

    // Compare options exclude the selected base so the same version cannot be chosen
    const compareOptions = computed(() =>
      versions.value
        .filter((v) => v.id !== baseVersion.value)
        .map((v) => ({
          label: `${v.version}${v.is_published ? " (published)" : ""}`,
          value: v.id,
        }))
    );

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

    // Per-spec version dropdown
    const updateSpecVersions = async (spec) => {
      if (!spec) return;
      if (spec.id === "__unsaved") {
        // Prepopulate minimal fields for unsaved spec
        spec.versionOptions = [];
        spec.selectedVersion = null;
        return;
      }
      const vers = await listSpecVersions(spec.id);
      spec.versionOptions = vers.map((v) => ({
        label: `${v.version}`,
        value: v.id,
      }));
      // Always preselect the latest version (first returned by API)
      spec.selectedVersion = vers[0]?.id || null;
    };

    const onSpecVersionChange = (spec) => async () => {
      if (!spec.selectedVersion) return;
      const versionData = await getSpecVersion(spec.id, spec.selectedVersion);
      // Ensure the selectedId is updated to match the version's id for highlighting
      emit("spec-selected", { ...spec, ...versionData, id: spec.id });
    };

    const loadSpecs = async () => {
      loading.value = true;
      error.value = null;
      try {
        console.debug(
          "SpecList.loadSpecs: starting load, unsavedSpec:",
          unsavedSpec.value
        );
        const fetched = await fetchSpecs();
        console.log("Fetched specs:", fetched);
        console.debug(
          "SpecList.loadSpecs: fetched specs count",
          fetched?.length,
          "unsavedSpec:",
          unsavedSpec.value
        );

        // Fetch versions in parallel to avoid N+1 sequential calls.
        // Use Promise.allSettled so a single failing spec versions fetch doesn't block others.
        const versionFetchPromises = fetched.map((spec) =>
          updateSpecVersions(spec).catch((err) => {
            console.error(`Failed to load versions for spec ${spec.id}:`, err);
            // Ensure spec has sensible defaults on failure so UI can still render
            spec.versionOptions = [];
            spec.selectedVersion = null;
          })
        );
        await Promise.allSettled(versionFetchPromises);

        // Prepend transient unsavedSpec if present. Prefer explicitly injected unsavedSpec,
        // otherwise fall back to the injected specEditor (some callers provide that).
        const transient =
          (unsavedSpec && unsavedSpec.value) ||
          (specEditor &&
            specEditor.unsavedSpec &&
            specEditor.unsavedSpec.value) ||
          null;
        if (transient) {
          console.debug(
            "SpecList.loadSpecs: prepending transient unsavedSpec to list",
            transient
          );
          specs.value = [transient, ...fetched];
        } else {
          specs.value = fetched;
        }
        console.debug(
          "SpecList.loadSpecs: final specs length",
          specs.value.length,
          "first item id",
          specs.value[0]?.id
        );

        // Always select the latest version for each spec if available
        for (const spec of fetched) {
          if (spec.versionOptions?.length > 0) {
            spec.selectedVersion = spec.versionOptions[0].value;
          } else {
            spec.selectedVersion = null;
          }
        }

        // Optionally, auto-select the first spec as active in the UI
        if (
          specs.value.length > 0 &&
          specs.value[0].versionOptions?.length > 0
        ) {
          const firstSpec = specs.value[0];
          if (firstSpec.selectedVersion) {
            try {
              const versionData = await getSpecVersion(
                firstSpec.id,
                firstSpec.selectedVersion
              );
              emit("spec-selected", {
                ...firstSpec,
                ...versionData,
                id: firstSpec.id,
              });
            } catch (err) {
              console.error(
                `Failed to load selected version for first spec ${firstSpec.id}:`,
                err
              );
              // Emit spec without full version data so editor can still load metadata
              emit("spec-selected", firstSpec);
            }
          } else {
            // No selectedVersion available (versions fetch may have failed)
            emit("spec-selected", firstSpec);
          }
        } else if (
          specs.value.length > 0 &&
          specs.value[0].id === "__unsaved"
        ) {
          // If the top item is the unsaved transient spec, emit it so editor loads it
          emit("spec-selected", specs.value[0]);
        }
      } catch (err) {
        error.value = "Failed to load specs";
        console.error(err);
      } finally {
        loading.value = false;
      }
    };

    const proceedSelect = async (spec) => {
      // If this is the transient unsaved card, emit it directly
      if (spec.id === "__unsaved") {
        emit("spec-selected", spec);
        return;
      }

      // Always fetch the selected version if available, or use already selected version if no new version is picked
      let versionId = spec.selectedVersion;
      if (!versionId && spec.versionOptions && spec.versionOptions.length > 0) {
        // Try to find the version id matching the current spec.version
        const found = spec.versionOptions.find((v) =>
          v.label.startsWith(spec.version)
        );
        versionId = found ? found.value : spec.versionOptions[0].value;
      }
      if (versionId) {
        const versionData = await getSpecVersion(spec.id, versionId);
        // Ensure the selected spec object is updated with the correct version fields, just like onSpecVersionChange
        emit("spec-selected", { ...spec, ...versionData, id: spec.id });
      } else {
        emit("spec-selected", spec);
      }
    };

    const selectSpec = async (spec) => {
      // Skip prompt when clicking the card that is already selected / is the unsaved card itself
      const isAlreadySelected = spec.id === props.selectedId || spec.id === selectedId.value;
      const isUnsavedCard = spec.id === "__unsaved";

      // Never discard when re-clicking the same spec — just return silently
      if (isAlreadySelected) return;

      if (!isUnsavedCard && hasUnsavedChanges.value) {
        if (!confirmOpen.value) {
          confirmOpen.value = true;
          confirm.require({
            message: `You have unsaved changes. Discard them and open "${spec.name}"?`,
            header: "Discard unsaved changes?",
            icon: "pi pi-exclamation-triangle",
            acceptClass: "p-button-danger",
            accept: async () => {
              try {
                discardUnsaved();
                // loadSpecs will re-run due to watch(unsavedSpec) but call to ensure UI updates promptly
                await loadSpecs();
                await proceedSelect(spec);
              } catch (err) {
                console.error("Failed during discard/select:", err);
              } finally {
                confirmOpen.value = false;
              }
            },
            reject: () => {
              // no-op
              confirmOpen.value = false;
            },
            onHide: () => {
              // Ensure guard is reset when dialog closes by any means
              confirmOpen.value = false;
            },
          });
        }
        return;
      }

      await proceedSelect(spec);
    };

    const confirmDelete = (spec) => {
      if (spec.id === "__unsaved") {
        // For transient unsaved spec, just discard without confirmation
        discardUnsaved();
        return;
      }
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

    // --- Rename spec (modal) ---
    const renameDialogVisible = ref(false);
    const renamingSpec = ref(null);
    const renameValue = ref("");

    const startRename = (spec) => {
      renamingSpec.value = spec;
      renameValue.value = spec.name;
      renameDialogVisible.value = true;
    };

    const cancelRename = () => {
      renameDialogVisible.value = false;
      renamingSpec.value = null;
      renameValue.value = "";
    };

    const confirmRename = async () => {
      const spec = renamingSpec.value;
      if (!spec) return;
      const newName = renameValue.value.trim();
      if (!newName || newName === spec.name) {
        cancelRename();
        return;
      }
      try {
        await updateSpec(spec.id, { name: newName, version: spec.version });
        spec.name = newName;
      } catch (err) {
        console.error("Failed to rename spec:", err);
      }
      cancelRename();
    };

    const openHistory = async (spec) => {
      historySpec.value = spec;
      historyOpen.value = true;
      versionsLoading.value = true;
      try {
        versions.value = await listSpecVersions(spec.id);
        if (versions.value && versions.value.length > 0) {
          // pre-select sensible defaults: older as base, newer as compare
          baseVersion.value =
            versions.value[1]?.id || versions.value[0]?.id || null;
          compareVersion.value =
            versions.value[0]?.id || versions.value[1]?.id || null;
        }
      } catch (err) {
        console.error("Failed to load versions:", err);
        versions.value = [];
      } finally {
        versionsLoading.value = false;
      }
    };

    const runCompare = async () => {
      compareError.value = null;
      if (!historySpec.value || !baseVersion.value || !compareVersion.value) {
        compareError.value = "Please select both versions to compare";
        return;
      }
      // Prevent identical comparisons
      if (baseVersion.value === compareVersion.value) {
        compareError.value = "Please select two different versions";
        return;
      }
      comparing.value = true;
      try {
        const res = await compareSpecVersions(
          historySpec.value.id,
          baseVersion.value,
          compareVersion.value
        );
        // API returns { base, compare, diff }
        historyDiff.value = res.diff || res;
      } catch (err) {
        console.error("Compare failed:", err);
        compareError.value = "Failed to compare versions";
      } finally {
        comparing.value = false;
      }
    };

    const runCompareWithDraft = async () => {
      compareError.value = null;
      if (!historySpec.value || !baseVersion.value) {
        compareError.value =
          "Please select a base version to compare with the draft";
        return;
      }
      const draft = getCurrentEditorSpec ? getCurrentEditorSpec() : null;
      if (!draft || typeof draft !== "object") {
        compareError.value =
          "No valid draft available in the editor to compare";
        return;
      }
      comparingDraft.value = true;
      try {
        const res = await compareDraftWithVersion(
          historySpec.value.id,
          baseVersion.value,
          draft,
          {}
        );
        historyDiff.value = res.diff || res;
      } catch (err) {
        console.error("Draft compare failed:", err);
        compareError.value = "Failed to compare draft with version";
      } finally {
        comparingDraft.value = false;
      }
    };

    onMounted(async () => {
      await loadSpecs();
    });

    // Re-load when parent requests a refresh or when transient unsavedSpec changes
    // Explicitly watch refreshSpecList.value and unsavedSpec.value.id to guarantee triggers.
    // Watch the provided ref and also a global fallback event so the wrapper can notify
    // components even if the provide/watch chain fails in some edge cases.
    const onGlobalNewSpec = async (e) => {
      console.debug(
        "SpecList: received global fastspec:newSpec event",
        e?.detail
      );
      await loadSpecs();
    };

    watch(
      () => (refreshSpecList && refreshSpecList.value) || 0,
      async (val) => {
        console.debug(
          "SpecList: refreshSpecList changed, reloading specs, key:",
          val
        );
        await loadSpecs();
      }
    );

    watch(
      () => (unsavedSpec && unsavedSpec.value ? unsavedSpec.value.id : null),
      async (id) => {
        console.debug("SpecList: unsavedSpec.id changed:", id);
        await loadSpecs();
      }
    );

    // global fallback listener
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("fastspec:newSpec", onGlobalNewSpec);
    }

    // remove listener on unmount
    onUnmounted(() => {
      if (typeof window !== "undefined" && window.removeEventListener) {
        window.removeEventListener("fastspec:newSpec", onGlobalNewSpec);
      }
    });

    // Ensure compareVersion is never equal to baseVersion by auto-adjusting when base changes
    watch(baseVersion, (newBase) => {
      if (!newBase) return;
      if (compareVersion.value === newBase) {
        const alt = versions.value.find((v) => v.id !== newBase);
        compareVersion.value = alt ? alt.id : null;
      }
    });

    // Normalize prop into a computed so template comparisons are reliable
    const selectedId = computed(() => props.selectedId);

    return {
      specs,
      loading,
      error,
      selectSpec,
      confirmDelete,
      renameDialogVisible,
      renameValue,
      startRename,
      cancelRename,
      confirmRename,
      expanded,
      toggleExpand,
      formatRelativeTime,
      onSpecVersionChange,
      // history
      historyOpen,
      historySpec,
      versions,
      versionsLoading,
      historyDiff,
      openHistory,
      // compare controls
      baseVersion,
      compareVersion,
      comparing,
      compareError,
      runCompare,
      versionOptions,
      compareOptions,
      // expose unsaved flag for template to render "Unsaved" badges
      hasUnsavedChanges,
      selectedId,
      // expose draft-compare helper for history drawer when user selects a stored spec to compare with the current editor
      runCompareWithDraft,
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
  color: var(--text-secondary, #6b7280);
}

.spinner-small {
  width: 30px !important;
  height: 30px !important;
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

.spec-card.changed {
  border-left: 4px solid #fbbf24;
  background: #fffbeb;
}

.spec-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.spec-info {
  flex: 1;
  min-width: 0;
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
  gap: 2px;
  align-items: center;
}

.spec-expand-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  margin-top: 8px;
  padding: 4px 8px;
  background: transparent;
  border: none;
  border-top: 1px solid #f3f4f6;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;
  border-radius: 0 0 6px 6px;
  transition: background 0.15s, color 0.15s;
}

.spec-expand-toggle:hover {
  background: #f3f4f6;
  color: #374151;
}

.spec-expand-label {
  font-weight: 500;
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

.version-controls .control-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.version-controls .row-controls {
  flex-direction: row;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.row-controls label {
  margin: 0 4px;
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
}

.controls-with-top {
  margin-top: 12px;
}

.control-label {
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
}

.compare-instructions {
  margin: 0;
}

.version-row {
  margin: 8px 0 0 0;
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
  display: flex;
  align-items: center;
  gap: 8px;
}

.version-select-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.version-select {
  min-width: 110px;
}

.history-drawer {
  width: 80rem;
  max-width: 80rem;
}

.drawer-body {
  padding: 16px;
}

.diff-area {
  margin-top: 18px;
}

.inline-error {
  color: #b91c1c;
  margin-top: 8px;
}

.unsaved-badge {
  background: #fbbf24;
  color: #1f2937;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 12px;
  display: block;
  width: fit-content;
  margin: 0 auto;
  margin-top: 8px;
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
