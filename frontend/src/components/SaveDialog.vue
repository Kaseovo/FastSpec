<template>
  <div>
    <Dialog
      :visible="visible"
      @update:visible="$emit('update:visible', $event)"
      modal
      header="Save Specification"
      :style="{ width: '600px' }"
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
        <Button
          label="Compare & Confirm"
          class="p-button-success"
          @click="openFullCompare"
          :loading="comparing"
        />
      </template>
    </Dialog>

    <!-- Full comparison + confirmation dialog -->
    <Dialog
      :visible="showFullCompare"
      @update:visible="(v) => (showFullCompare = v)"
      modal
      header="Overview — Confirm Save"
      :style="{ width: '90vw', height: '80vh' }"
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
          <!-- Recap row: concise summaries above details -->
          <div class="overview-recap" style="margin-bottom: 12px">
            <div style="display: flex; gap: 12px">
              <div
                style="
                  flex: 1;
                  background: var(--p-surface-card, #fff);
                  padding: 12px;
                  border-radius: 8px;
                  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
                "
              >
                <div style="font-weight: 600">Changes</div>
                <div
                  style="
                    margin-top: 8px;
                    color: var(--p-text-muted-color, #6c757d);
                  "
                >
                  {{ changesSummary }}
                </div>
              </div>

              <div
                style="
                  flex: 1;
                  background: var(--p-surface-card, #fff);
                  padding: 12px;
                  border-radius: 8px;
                  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
                "
              >
                <div style="font-weight: 600">Lint</div>
                <div
                  style="
                    margin-top: 8px;
                    color: var(--p-text-muted-color, #6c757d);
                  "
                >
                  {{ lintSummary }}
                </div>
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
              <div style="font-weight: 600">Changes Overview</div>
            </div>

            <Accordion :multiple="true" :activeIndex="[-1]">
              <AccordionPanel>
                <AccordionHeader>Details</AccordionHeader>
                <AccordionContent>
                  <div
                    style="
                      height: calc(80vh - 300px);
                      overflow: auto;
                      padding-right: 8px;
                    "
                  >
                    <DiffDrawer
                      :diff="diffResult"
                      :spec="baseSpec || draftContent"
                      inline
                    />
                  </div>
                </AccordionContent>
              </AccordionPanel>
            </Accordion>
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
              <div style="font-weight: 600">Lint Overview</div>
            </div>

            <Accordion :multiple="true" :activeIndex="[-1]">
              <AccordionPanel>
                <AccordionHeader>Details</AccordionHeader>
                <AccordionContent>
                  <LintPanel
                    :results="lintResult"
                    :loading="linting"
                    :error="lintError"
                    @run-lint="runLint"
                  />
                </AccordionContent>
              </AccordionPanel>
            </Accordion>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Back" severity="secondary" @click="closeFullCompare" />
        <Button
          label="Confirm & Save"
          severity="success"
          @click="confirmSave"
          :loading="comparing || linting"
        />
      </template>
    </Dialog>
  </div>
</template>

<script>
import { ref, watch, computed } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Tag from "primevue/tag";
import SelectButton from "primevue/selectbutton";
import Accordion from "primevue/accordion";
import AccordionPanel from "primevue/accordionpanel";
import AccordionHeader from "primevue/accordionheader";
import AccordionContent from "primevue/accordioncontent";
import {
  listSpecVersions,
  compareDraftWithVersion,
  lintSpec,
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
    Tag,
    SelectButton,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
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
    const name = ref("");
    const versions = ref([]);
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

    // Compare state
    const comparing = ref(false);
    const diffResult = ref(null);
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
        name.value = newName;
      }
    );

    watch(
      () => props.visible,
      async (newVisible) => {
        if (newVisible) {
          name.value = props.specName;
          errorMsg.value = "";
          compareError.value = "";
          diffResult.value = null;
          baseSpec.value = null;
          lintResult.value = null;
          lintError.value = "";

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

    const compareDraft = async () => {
      if (!props.specId || !selectedVersion.value || !props.draftContent)
        return;
      comparing.value = true;
      compareError.value = "";
      diffResult.value = null;
      baseSpec.value = null;
      try {
        const res = await compareDraftWithVersion(
          props.specId,
          selectedVersion.value,
          props.draftContent,
          { format: "structured" }
        );
        // Response expected: { base, compare, diff } or { base, compare, markdown }
        if (res.base?.content) baseSpec.value = res.base.content;
        diffResult.value = res.diff || res;
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
            if (item.hasOwnProperty("added") || item.hasOwnProperty("new"))
              added++;
            else if (
              item.hasOwnProperty("removed") ||
              item.hasOwnProperty("old")
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

.lint-list {
  margin: 0;
  padding-left: 16px;
}

.lint-list li {
  margin-bottom: 8px;
}
</style>
