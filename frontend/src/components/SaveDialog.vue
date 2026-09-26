<template>
  <div>
    <Dialog
      :visible="visible"
      modal
      header="Save Specification"
      :style="{ width: '600px' }"
      @update:visible="$emit('update:visible', $event)"
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

        <div
          v-if="specId !== null && specId !== '__unsaved'"
          class="form-group"
        >
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
          <InputText
            v-if="showNewVersionInput"
            id="new-version-inline"
            v-model="newVersion"
            class="w-full"
            style="margin-top: 0.5rem"
            :placeholder="suggestedVersion"
          />
          <div v-if="showNewVersionInput && errorMsg" class="inline-error">{{ errorMsg }}</div>
        </div>

        <div v-else class="form-group">
          <label for="new-version">Version</label>
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
        <Button
          label="Compare & Confirm"
          class="p-button-success"
          :loading="comparing"
          :disabled="!!errorMsg"
          @click="openFullCompare"
        />
      </template>
    </Dialog>

    <!-- Full comparison + confirmation dialog -->
    <Dialog
      :visible="showFullCompare"
      modal
      header="Overview — Confirm Save"
      :style="{ width: '90vw', height: '80vh' }"
      @update:visible="(v) => (showFullCompare = v)"
    >
      <div style="height: calc(80vh - 120px); overflow: auto">
        <div
          v-if="compareError"
          class="inline-error"
          style="margin-bottom: 8px"
        >
          {{ compareError }}
        </div>

        <!-- Overview sections with expandable details -->
        <div class="overview-section">
          <!-- Compact recap strip: shows small counts/icons + view buttons -->
          <div
            class="recap-strip"
            style="
              margin-bottom: 12px;
              display: flex;
              gap: 12px;
              align-items: center;
            "
          >
            <div class="recap-item changes">
              <div class="recap-left">
                <span class="recap-icon" aria-hidden="true">🔀</span>
                <div class="recap-text">
                  <span class="recap-title">Changes</span>
                  <span class="recap-value">{{ changesSummary }}</span>
                </div>
              </div>
              <div class="recap-actions">
                <button
                  class="p-button p-component p-button-text view-btn"
                  :class="{ active: showChangesView }"
                  :aria-controls="'changes-panel'"
                  :aria-expanded="showChangesView"
                  @click.prevent="togglePanel('changes')"
                >
                  {{ showChangesView ? "Hide" : "View" }}
                </button>
              </div>
            </div>

            <div class="recap-item lint">
              <div class="recap-left">
                <span class="recap-icon" aria-hidden="true">🔎</span>
                <div class="recap-text">
                  <span class="recap-title">Lint</span>
                  <span class="recap-value">{{ lintSummary }}</span>
                </div>
              </div>
              <div class="recap-actions">
                <button
                  class="p-button p-component p-button-text view-btn"
                  :class="{ active: showLintView }"
                  :aria-controls="'lint-panel'"
                  :aria-expanded="showLintView"
                  @click.prevent="togglePanel('lint')"
                >
                  {{ showLintView ? "Hide" : "View" }}
                </button>
              </div>
            </div>
          </div>

          <!-- Changes Overview -->
          <div class="overview-item" style="margin-bottom: 12px">
            <div
              style="
                display: flex;
                align-items: center;
                justify-content: space-between;
              "
            >
              <div v-if="showChangesView" style="font-weight: 600">
                Changes Overview
              </div>
            </div>

            <div
              v-if="showChangesView"
              id="changes-panel-body"
              style="
                height: calc(80vh - 300px);
                overflow: auto;
                padding-right: 8px;
              "
            >
              <DiffDrawer
                :diff="diffResult"
                :markdown="diffResultMarkdown"
                :spec="baseSpec || draftContent"
                inline
              />
            </div>
          </div>

          <!-- Lint Overview -->
          <div class="overview-item">
            <div
              style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 8px;
              "
            >
              <div v-if="showLintView" style="font-weight: 600">
                Lint Overview
              </div>
            </div>

            <div
              v-if="showLintView"
              id="lint-panel-body"
              style="max-height: calc(80vh - 300px); overflow: auto"
            >
              <LintPanel
                :results="lintResult"
                :loading="linting"
                :error="lintError"
                @run-lint="runLint"
              />
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Back" severity="secondary" @click="closeFullCompare" />
        <Button
          label="Confirm & Save"
          severity="success"
          :loading="comparing || linting"
          :disabled="!!errorMsg"
          @click="confirmSave"
        />
      </template>
    </Dialog>
  </div>
</template>

<script>
import { ref, watch, computed, nextTick } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import {
  listSpecVersions,
  compareDraftWithVersion,
  lintSpec,
  fetchSpecs,
} from "../api/specs";
import DiffDrawer from "./DiffDrawer.vue";
import LintPanel from "./LintPanel.vue";

export default {
  name: "SaveDialog",
  components: {
    Dialog,
    Button,
    InputText,
    DiffDrawer,
    LintPanel,
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
    // current editor draft content (parsed JSON)
    draftContent: {
      type: Object,
      default: null,
    },
  },
  emits: ["update:visible", "save", "spec-saved"],
  setup(props, { emit }) {
    // Inline view flags for the previously-collapsible sections
    const showChangesView = ref(false);
    const showLintView = ref(false);

    // Hide titles by default until their sections are opened
    // Initially show lint overview per user request
    showChangesView.value = false;
    showLintView.value = false;

    const name = ref("");
    const versions = ref([]);
    const existingSpecs = ref([]);
    const selectedVersion = ref("__create_new");
    const newVersion = ref("");
    const errorMsg = ref("");

    const showNewVersionInput = computed(
      () => selectedVersion.value === "__create_new"
    );

    const suggestedVersion = computed(() => {
      const v = versions.value[0]?.version;
      if (!v) return "1.0.0";
      const parts = v.split(".").map((p) => parseInt(p, 10) || 0);
      parts[2] = (parts[2] || 0) + 1;
      return parts.join(".");
    });

    // (replaced accordions with inline views)

    // Compare state
    const comparing = ref(false);
    const diffResult = ref(null);
    // Markdown rendering computed server-side alongside diffResult.
    const diffResultMarkdown = ref(null);
    const compareError = ref("");
    const baseSpec = ref(null);

    // Lint state for draft
    const linting = ref(false);
    const lintResult = ref(null);
    const lintError = ref("");

    // View mode for full compare dialog (changes | lint)
    const viewMode = ref("changes");
    const viewOptions = [
      { label: "Changes", value: "changes" },
      { label: "Lint", value: "lint" },
    ];

    watch(
      () => props.specName,
      (newName) => {
        if (newName) {
          name.value = newName;
        }
      },
      { immediate: true }
    );

    // Reset version suggestion and related state when the selected spec changes
    watch(
      () => props.specId,
      async (newId) => {
        // Clear previously loaded versions and reset inputs/state
        versions.value = [];
        selectedVersion.value = "__create_new";
        newVersion.value = "";
        errorMsg.value = "";
        compareError.value = "";
        diffResult.value = null;
        diffResultMarkdown.value = null;
        baseSpec.value = null;
        lintResult.value = null;
        lintError.value = "";

        // If dialog isn't open, don't attempt to load versions now
        if (!props.visible) return;

        if (newId && newId !== "__unsaved") {
          try {
            versions.value = await listSpecVersions(newId);
            selectedVersion.value =
              props.currentVersion &&
              versions.value.find((v) => v.version === props.currentVersion)
                ? props.currentVersion
                : versions.value[0]?.version || "__create_new";

            // If we have a draft and a real version selected, auto-run compare
            if (props.draftContent) {
              if (
                selectedVersion.value &&
                selectedVersion.value !== "__create_new"
              ) {
                try {
                  await compareDraft();
                } catch (e) {
                  // compareDraft sets compareError
                }
              }

              // Always run lint for the (new) draft so user sees score/errors
              try {
                await runLint();
              } catch (e) {
                // runLint sets lintError
              }
            }
          } catch (e) {
            console.error("Failed to load versions on spec change", e);
            versions.value = [];
          }
        } else {
          // New/unsaved spec — still run lint if we have draft content
          if (props.draftContent) {
            try {
              await runLint();
            } catch (e) {
              // ignore
            }
          }
        }
      }
    );

    // Live-validate the name against fetched existing specs and update error message
    watch(name, (val) => {
      errorMsg.value = "";
      if (!val || !val.trim()) return;
      const dup = existingSpecs.value.find(
        (s) =>
          s.name &&
          s.name.toString().trim().toLowerCase() === val.trim().toLowerCase()
      );
      if (
        dup &&
        (props.specId === null ||
          props.specId === "__unsaved" ||
          String(dup.id) !== String(props.specId))
      ) {
        errorMsg.value = "A spec with this name already exists";
      }
    });

    watch(
      () => props.visible,
      async (newVisible) => {
        if (newVisible) {
          name.value =
            props.specName && props.specName !== "Untitled Spec"
              ? props.specName
              : "";
          errorMsg.value = "";
          compareError.value = "";
          diffResult.value = null;
          diffResultMarkdown.value = null;
          baseSpec.value = null;
          lintResult.value = null;
          lintError.value = "";

          // Load existing spec names to validate uniqueness on save
          existingSpecs.value = [];
          try {
            const fetched = await fetchSpecs();
            existingSpecs.value = (fetched || []).map((s) => ({
              id: s.id,
              name: s.name,
            }));
          } catch (e) {
            // non-blocking; we'll still allow user to save if fetch fails
            existingSpecs.value = [];
          }

          // Load versions lazily when dialog opens and specId is provided
          if (props.specId && props.specId !== "__unsaved") {
            try {
              versions.value = await listSpecVersions(props.specId);
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

              // Auto-run compare when dialog opens if we have draft content
              if (
                props.draftContent &&
                selectedVersion.value &&
                selectedVersion.value !== "__create_new"
              ) {
                try {
                  await compareDraft();
                } catch (e) {
                  // ignore; compareDraft sets compareError
                }
              }

              // Always run lint for the draft when dialog opens so user sees score
              if (props.draftContent) {
                try {
                  await runLint();
                } catch (e) {
                  // runLint sets lintError
                }
              }
            } catch (e) {
              console.error("Failed to load versions", e);
              versions.value = [];
            }
          } else {
            // No specId (new/unsaved) — still run lint on draft
            if (props.draftContent) {
              try {
                await runLint();
              } catch (e) {
                // ignore
              }
            }
          }
        }
      }
    );

    const close = () => {
      // Ensure full compare modal is closed as well
      if (showFullCompare.value) showFullCompare.value = false;
      emit("update:visible", false);
    };

    async function focusPanel(panel) {
      // Keep existing behavior: always open modal and show requested panel
      if (!showFullCompare.value) {
        showFullCompare.value = true;
        await nextTick();
      }

      // Ensure target panel is visible
      if (panel === "changes") {
        showChangesView.value = true;
        showLintView.value = false;
      } else if (panel === "lint") {
        showLintView.value = true;
        showChangesView.value = false;
      }

      await nextTick();

      const id = panel === "changes" ? "changes-panel-body" : "lint-panel-body";
      const el = document.getElementById(id);
      if (el && el.scrollIntoView) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const btn = el.querySelector(
          "button, a, [tabindex]:not([tabindex='-1'])"
        );
        if (btn) btn.focus();
      }
    }

    // Toggle view when user clicks the compact "View" button: open modal and show, or hide if already visible
    async function togglePanel(panel) {
      // If modal is closed, open and show the requested panel
      if (!showFullCompare.value) {
        showFullCompare.value = true;
        await nextTick();
        if (panel === "changes") {
          showChangesView.value = true;
          showLintView.value = false;
        } else if (panel === "lint") {
          showLintView.value = true;
          showChangesView.value = false;
        }
        return;
      }

      // If modal open and the requested panel is already visible, hide it
      if (panel === "changes") {
        if (showChangesView.value) {
          showChangesView.value = false;
        } else {
          showChangesView.value = true;
          showLintView.value = false;
        }
      } else if (panel === "lint") {
        if (showLintView.value) {
          showLintView.value = false;
        } else {
          showLintView.value = true;
          showChangesView.value = false;
        }
      }
      await nextTick();
    }

    const compareDraft = async () => {
      // Do not attempt to compare when there is no stored spec to compare against
      // The sentinel value "__unsaved" means the spec isn't persisted yet.
      if (
        !props.specId ||
        props.specId === "__unsaved" ||
        !selectedVersion.value ||
        !props.draftContent
      )
        return;
      comparing.value = true;
      compareError.value = "";
      diffResult.value = null;
      diffResultMarkdown.value = null;
      baseSpec.value = null;
      try {
        const res = await compareDraftWithVersion(
          props.specId,
          selectedVersion.value,
          props.draftContent,
          { format: "structured" }
        );
        // Response expected: { base, compare, diff, markdown }
        if (res.base?.content) baseSpec.value = res.base.content;
        diffResult.value = res.diff || res;
        diffResultMarkdown.value = res?.markdown || null;
      } catch (err) {
        console.error("Compare failed:", err);
        compareError.value =
          err.response?.data?.detail || err.message || "Compare failed";
      } finally {
        comparing.value = false;
      }
    };

    const runLint = async () => {
      if (!props.draftContent) return;
      linting.value = true;
      lintError.value = "";
      lintResult.value = null;
      try {
        // lintSpec expects raw spec JSON object
        const res = await lintSpec(props.draftContent);
        lintResult.value = res;
      } catch (err) {
        console.error("Lint failed:", err);
        lintError.value =
          err.response?.data?.detail || err.message || "Lint failed";
      } finally {
        linting.value = false;
      }
    };

    // Full-compare modal controls
    const showFullCompare = ref(false);
    const openFullCompare = async () => {
      // Ensure we have a diff before opening
      if (!diffResult.value) {
        await compareDraft();
      }
      // Run lint before showing so user sees score/errors
      await runLint();
      showFullCompare.value = true;
    };
    const closeFullCompare = () => {
      showFullCompare.value = false;
      showChangesView.value = false;
      showLintView.value = false;
    };

    const confirmSave = async () => {
      // Run lint one more time before saving so state is fresh
      await runLint();

      // Close full compare and perform save
      showFullCompare.value = false;
      save();
    };

    const save = () => {
      if (!name.value.trim()) {
        errorMsg.value = "Name is required";
        return;
      }

      // Check for duplicate name (case-insensitive) against fetched specs
      const dup = existingSpecs.value.find(
        (s) =>
          s.name &&
          s.name.toString().trim().toLowerCase() ===
            name.value.trim().toLowerCase()
      );
      if (
        dup &&
        (props.specId === null ||
          props.specId === "__unsaved" ||
          String(dup.id) !== String(props.specId))
      ) {
        errorMsg.value = "A spec with this name already exists";
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

    const changesSummary = computed(() => {
      // always compute explicit counts (show zeros)
      let added = 0;
      let removed = 0;
      let modified = 0;

      if (!diffResult.value) {
        return `${added} added · ${removed} removed · ${modified} modified`;
      }

      // If server provided stats, use them (coerce to number)
      if (diffResult.value?.stats) {
        const s = diffResult.value.stats;
        added = Number(s.added) || 0;
        removed = Number(s.removed) || 0;
        modified = Number(s.modified) || 0;
      } else if (Array.isArray(diffResult.value)) {
        // Try to infer counts from an array of diff entries
        diffResult.value.forEach((item) => {
          const opRaw = (
            item?.op ||
            item?.action ||
            item?.kind ||
            item?.change ||
            item?.operation ||
            item?.type ||
            ""
          )
            .toString()
            .toLowerCase();
          const op = opRaw.trim();
          if (["n", "add", "added", "create"].includes(op)) added++;
          else if (["d", "delete", "deleted", "remove", "removed"].includes(op))
            removed++;
          else if (
            ["e", "edit", "update", "updated", "modify", "modified"].includes(
              op
            )
          )
            modified++;
          else if (item && typeof item === "object") {
            // best-effort heuristics
            if (Object.hasOwn(item, "added") || Object.hasOwn(item, "new"))
              added++;
            else if (
              Object.hasOwn(item, "removed") ||
              Object.hasOwn(item, "old")
            )
              removed++;
            else modified++;
          }
        });
      } else if (
        typeof diffResult.value === "object" &&
        diffResult.value !== null
      ) {
        // Fallback: handle structured diff objects where keys are arrays
        // Example format (preferred):
        // { added: [], modified: [], removed: [], infoAdded: [], infoModified: [], infoRemoved: [], serverAdded: [], serverModified: [], serverRemoved: [], schemaAdded: [], schemaModified: [], schemaRemoved: [] }
        const r = diffResult.value;

        const countVal = (v) => {
          if (Array.isArray(v)) return v.length;
          if (typeof v === "number") return v;
          if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
          return 0;
        };

        // Prefer explicit structured counts by summing known keys
        const sumKeys = (keys) =>
          keys.reduce(
            (acc, k) => acc + countVal(r[k] ?? r[k.toLowerCase()] ?? 0),
            0
          );

        // compute added/removed/modified using the authoritative grouped keys
        added = sumKeys([
          "added",
          "infoAdded",
          "serverAdded",
          "schemaAdded",
          "additions",
        ]);
        removed = sumKeys([
          "removed",
          "infoRemoved",
          "serverRemoved",
          "schemaRemoved",
          "deletions",
        ]);
        modified = sumKeys([
          "modified",
          "infoModified",
          "serverModified",
          "schemaModified",
          "edits",
        ]);

        // Ensure we include infoAdded/infoModified etc. in modified/added semantics per user request
        // Users expect added = added + infoAdded + serverAdded + schemaAdded
        added =
          countVal(r.added) +
          countVal(r.infoAdded) +
          countVal(r.serverAdded) +
          countVal(r.schemaAdded);
        modified =
          countVal(r.modified) +
          countVal(r.infoModified) +
          countVal(r.serverModified) +
          countVal(r.schemaModified);
        removed =
          countVal(r.removed) +
          countVal(r.infoRemoved) +
          countVal(r.serverRemoved) +
          countVal(r.schemaRemoved);

        // If none of the structured keys were present (counts still zero), fall back to scanning any keys
        if (added === 0 && removed === 0 && modified === 0) {
          Object.entries(r).forEach(([k, v]) => {
            const key = String(k).toLowerCase();
            if (
              key.endsWith("added") ||
              key === "added" ||
              key.includes("add")
            ) {
              added += countVal(v);
            } else if (
              key.endsWith("removed") ||
              key === "removed" ||
              key.includes("remove") ||
              key.includes("delet")
            ) {
              removed += countVal(v);
            } else if (
              key.endsWith("modified") ||
              key === "modified" ||
              key.includes("modif") ||
              key.includes("edit")
            ) {
              modified += countVal(v);
            }
          });
        }
      }

      // Always return explicit numeric counts
      return `${added} added · ${modified} modified · ${removed} removed`;
    });

    const lintSummary = computed(() => {
      if (!lintResult.value) return "No lint run";
      const score = lintResult.value.score ?? null;
      const totalIssues =
        (lintResult.value.summary &&
          Object.values(lintResult.value.summary).reduce(
            (a, b) => a + (b || 0),
            0
          )) ||
        0;
      if (score !== null) return `Score: ${score}/100 · ${totalIssues} issues`;
      return `${totalIssues} issues`;
    });

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
      // compare
      comparing,
      diffResult,
      diffResultMarkdown,
      compareError,
      compareDraft,
      baseSpec,
      // full compare controls
      showFullCompare,
      openFullCompare,
      closeFullCompare,
      confirmSave,
      // lint
      linting,
      lintResult,
      lintError,
      // view mode
      viewMode,
      viewOptions,
      runLint,
      // summaries
      changesSummary,
      lintSummary,
      // expose refs and helpers used by template
      focusPanel,
      togglePanel,
      showChangesView,
      showLintView,
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

.compare-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.diff-preview {
  margin-top: 12px;
}

.view-btn.active {
  background: var(--p-primary-600, #0d6efd);
  color: white;
  border-radius: 6px;
  padding: 6px 10px;
  transition: background 0.15s ease;
}

/* Recap strip improvements */
.recap-strip {
  display: flex;
  gap: 12px;
}
.recap-item {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--p-surface-card, #fff);
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.recap-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.recap-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.04);
  font-size: 16px;
}
.recap-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.recap-title {
  font-weight: 600;
  font-size: 13px;
}
.recap-value {
  color: var(--p-text-muted-color, #6c757d);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}
.recap-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.recap-badge {
  background: var(--p-primary-600, #0d6efd);
  color: white;
  padding: 4px 8px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 12px;
}
.recap-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.18s ease, transform 0.12s ease;
}
.view-btn {
  padding: 4px 8px;
  border-radius: 6px;
}

.lint-list {
  margin: 0;
  padding-left: 16px;
}

.lint-list li {
  margin-bottom: 8px;
}
</style>
