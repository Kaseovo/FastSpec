<template>
  <div class="lint-panel">
    <LintRulesetDialog
      :open="showRulesetDialog"
      :spec-content="specContent"
      @update:open="showRulesetDialog = $event"
      @saved="onRulesetDialogChanged"
      @deleted="onRulesetDialogChanged"
      @set-default="onRulesetDialogChanged"
    />
    <!-- Always-visible top bar with settings access -->
    <div class="lint-topbar">
      <Select
        v-if="canAssignRuleset"
        v-tooltip.top="'Which ruleset this spec is linted against'"
        :model-value="assignedRulesetId"
        :options="rulesetAssignOptions"
        option-label="label"
        option-value="value"
        class="ruleset-assign-select"
        size="small"
        @update:model-value="onAssignRuleset"
      />
      <Button
        icon="pi pi-sliders-h"
        severity="secondary"
        text
        size="small"
        label="Custom rules"
        aria-label="Configure lint ruleset"
        @click="showRulesetDialog = true"
      />
    </div>

    <!-- Empty / loading state -->
    <div v-if="loading" class="lint-loading">
      <ProgressSpinner style="width: 32px; height: 32px" />
      <span>Running Spectral linter…</span>
    </div>

    <div v-else-if="error" class="lint-error">
      <Message severity="error">
        <strong>Lint failed</strong>
        <p>{{ error }}</p>
      </Message>
    </div>

    <div v-else-if="!results" class="lint-empty">
      <i
        class="pi pi-search"
        style="font-size: 2rem; color: var(--p-text-muted-color)"
      />
      <p>Run the linter to see quality feedback for this spec.</p>
      <Button label="Run Lint" icon="pi pi-play" @click="$emit('run-lint')" />
    </div>

    <template v-else>
      <!-- Score bar -->
      <div class="lint-score-bar">
        <div class="score-left">
          <span class="score-text">Score:</span>
          <div class="score-label">
            <span class="score-value" :class="scoreClass">{{
              results.score
            }}</span>
            <span class="score-unit">/ 100</span>
          </div>
          <div class="score-track">
            <div
              class="score-fill"
              :class="scoreClass"
              :style="{ width: results.score + '%' }"
            />
          </div>
        </div>
        <div class="score-actions">
          <Button
            v-tooltip.top="'Custom rules'"
            icon="pi pi-sliders-h"
            severity="secondary"
            text
            aria-label="Configure lint ruleset"
            @click="showRulesetDialog = true"
          />
          <Button
            class="rerun-button"
            icon="pi pi-refresh"
            label="Rerun"
            :disabled="loading"
            @click="$emit('run-lint')"
          />
        </div>
      </div>

      <!-- Summary pills -->
      <div class="lint-summary">
        <button
          v-for="sev in severities"
          :key="sev.key"
          class="severity-pill"
          :class="[sev.key, { active: activeFilter === sev.key }]"
          @click="toggleFilter(sev.key)"
        >
          <span class="pill-icon">{{ sev.icon }}</span>
          <span class="pill-label">{{ sev.label }}</span>
          <span class="pill-count">{{ results.summary[sev.key] }}</span>
        </button>
      </div>

      <!-- Result list -->
      <div v-if="filteredResults.length === 0" class="lint-no-results">
        <i class="pi pi-check-circle" style="color: var(--p-green-500)" />
        <span
          >No {{ activeFilter ? activeFilter + " " : "" }}issues found.</span
        >
      </div>

      <div v-else class="lint-results">
        <div
          v-for="(result, idx) in filteredResults"
          :key="idx"
          class="lint-result-item"
          :class="result.severity"
          @click="$emit('go-to-line', result)"
        >
          <span class="result-icon">{{ severityIcon(result.severity) }}</span>
          <div class="result-body">
            <div class="result-message">{{ result.message }}</div>
            <div class="result-meta">
              <code class="result-code">{{ result.code }}</code>
              <span
                v-if="result.path && result.path.length"
                class="result-path"
              >
                {{ result.path.join(" › ") }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { ref, computed, watch } from "vue";
import Button from "primevue/button";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import Select from "primevue/select";
import Tooltip from "primevue/tooltip";
import LintRulesetDialog from "./LintRulesetDialog.vue";
import { assignSpecRuleset, listLintRulesets } from "../api/lint";
import { fetchSpec } from "../api/specs";

export default {
  name: "LintPanel",
  components: { Button, Message, ProgressSpinner, Select, LintRulesetDialog },
  directives: { tooltip: Tooltip },

  props: {
    /** LintResponse from the backend: { score, summary, results } */
    results: {
      type: Object,
      default: null,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    error: {
      type: String,
      default: null,
    },
    /** Id of the spec currently open, or null/"__unsaved" for an unsaved draft */
    specId: {
      type: String,
      default: null,
    },
    /** Raw JSON text of the spec currently open — forwarded to the ruleset dialog for rule previews */
    specContent: {
      type: String,
      default: "",
    },
  },

  emits: ["run-lint", "go-to-line"],

  setup(props, { emit }) {
    const activeFilter = ref(null);
    const showRulesetDialog = ref(false);

    // Per-spec ruleset assignment
    const rulesets = ref([]);
    const assignedRulesetId = ref(null);

    const canAssignRuleset = computed(
      () => Boolean(props.specId) && props.specId !== "__unsaved" && rulesets.value.length > 0,
    );

    const rulesetAssignOptions = computed(() => [
      { label: "Default ruleset", value: null },
      ...rulesets.value.map((r) => ({ label: r.name, value: r.id })),
    ]);

    async function loadAssignment() {
      if (!props.specId || props.specId === "__unsaved") {
        rulesets.value = [];
        assignedRulesetId.value = null;
        return;
      }
      try {
        const [rulesetList, spec] = await Promise.all([
          listLintRulesets(),
          fetchSpec(props.specId),
        ]);
        rulesets.value = rulesetList;
        assignedRulesetId.value = spec.active_ruleset_id ?? null;
      } catch {
        rulesets.value = [];
        assignedRulesetId.value = null;
      }
    }

    watch(() => props.specId, loadAssignment, { immediate: true });

    // The dialog's create/rename/delete/set-default actions all change data
    // this panel's own topbar dropdown displays (the ruleset list and/or
    // which one is assigned/default) -- without reloading here too, renaming
    // or deleting the currently-assigned ruleset, or changing the default,
    // left the dropdown showing stale data until the user switched specs
    // and back.
    function onRulesetDialogChanged() {
      loadAssignment();
      emit("run-lint");
    }

    async function onAssignRuleset(rulesetId) {
      if (!props.specId) return;
      // The Select is bound via :model-value/@update (not v-model) so this
      // function is the only writer of assignedRulesetId -- it can update
      // it optimistically and, on a failed PUT, revert to what was actually
      // persisted instead of leaving the dropdown showing a selection that
      // the backend never got.
      const previous = assignedRulesetId.value;
      assignedRulesetId.value = rulesetId;
      try {
        await assignSpecRuleset(props.specId, rulesetId);
        emit("run-lint");
      } catch {
        assignedRulesetId.value = previous;
      }
    }

    const severities = [
      { key: null, label: "All", icon: "⚪" },
      { key: "error", label: "Errors", icon: "🔴" },
      { key: "warn", label: "Warnings", icon: "🟠" },
      { key: "info", label: "Info", icon: "🟢" },
      { key: "hint", label: "Hints", icon: "💡" },
    ];

    const toggleFilter = (key) => {
      activeFilter.value = activeFilter.value === key ? null : key;
    };

    const filteredResults = computed(() => {
      if (!props.results) return [];
      const all = props.results.results ?? [];
      if (!activeFilter.value) return all;
      return all.filter((r) => r.severity === activeFilter.value);
    });

    const scoreClass = computed(() => {
      if (!props.results) return "";
      const s = props.results.score;
      if (s >= 80) return "score-good";
      if (s >= 50) return "score-warn";
      return "score-bad";
    });

    const severityIcon = (sev) => {
      const map = { error: "🔴", warn: "🟠", info: "🔵", hint: "💡" };
      return map[sev] ?? "⚪";
    };

    return {
      activeFilter,
      showRulesetDialog,
      rulesetAssignOptions,
      assignedRulesetId,
      canAssignRuleset,
      onAssignRuleset,
      onRulesetDialogChanged,
      severities,
      toggleFilter,
      filteredResults,
      scoreClass,
      severityIcon,
    };
  },
};
</script>

<style scoped>
.lint-topbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 4px 4px 0;
  border-bottom: 1px solid var(--p-surface-border, #dee2e6);
  margin-bottom: 4px;
}

.ruleset-assign-select {
  font-size: 0.8rem;
  max-width: 220px;
}

.lint-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--p-surface-ground, #f8f9fa);
  overflow-y: auto;
  padding: 12px;
  gap: 12px;
}

/* Loading / empty / error */
.lint-loading,
.lint-empty,
.lint-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 16px;
  color: var(--p-text-muted-color, #6c757d);
  text-align: center;
}

/* Score bar */
.lint-score-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
  background: var(--p-surface-card, #fff);
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
.score-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}
.score-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 12px;
}
.rerun-button {
  flex-shrink: 0;
}
.score-label {
  display: flex;
  align-items: baseline;
  gap: 2px;
  min-width: 64px;
}
.score-value {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
}
.score-unit {
  font-size: 0.9rem;
  color: var(--p-text-muted-color, #6c757d);
}
.score-track {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: var(--p-surface-border, #dee2e6);
  overflow: hidden;
}
.score-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}
.score-good {
  color: #22c55e;
}
.score-warn {
  color: #f97316;
}
.score-bad {
  color: #ef4444;
}
.score-fill.score-good {
  background: #22c55e;
}
.score-fill.score-warn {
  background: #f97316;
}
.score-fill.score-bad {
  background: #ef4444;
}

/* Summary pills */
.lint-summary {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.severity-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  border: 2px solid transparent;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  background: var(--p-surface-card, #fff);
  transition: border-color 0.15s, background 0.15s;
}
.severity-pill:hover {
  opacity: 0.85;
}
.severity-pill.active {
  border-color: currentColor;
}
.severity-pill.error {
  color: #ef4444;
}
.severity-pill.warn {
  color: #f97316;
}
.severity-pill.info {
  color: #1ca227;
}
.severity-pill.hint {
  color: #444644;
}
.pill-count {
  background: currentColor;
  color: #fff;
  border-radius: 10px;
  padding: 0 6px;
  font-size: 0.75rem;
  line-height: 1.4;
}

/* Result items */
.lint-no-results {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  color: var(--p-text-muted-color, #6c757d);
}
.lint-results {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lint-result-item {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  background: var(--p-surface-card, #fff);
  border-radius: 6px;
  border-left: 4px solid transparent;
  cursor: pointer;
  transition: background 0.1s;
}
.lint-result-item:hover {
  background: var(--p-surface-hover, #f1f5f9);
}
.lint-result-item.error {
  border-left-color: #ef4444;
}
.lint-result-item.warn {
  border-left-color: #f97316;
}
.lint-result-item.info {
  border-left-color: #3b82f6;
}
.lint-result-item.hint {
  border-left-color: #a855f7;
}

.result-icon {
  font-size: 1rem;
  line-height: 1.5;
  flex-shrink: 0;
}
.result-body {
  flex: 1;
  min-width: 0;
}
.result-message {
  font-size: 0.875rem;
  color: var(--p-text-color, #212529);
  word-break: break-word;
}
.result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
  font-size: 0.75rem;
  color: var(--p-text-muted-color, #6c757d);
}
.result-code {
  background: var(--p-surface-section, #f1f5f9);
  padding: 1px 5px;
  border-radius: 3px;
  font-family: monospace;
}
.result-path {
  font-family: monospace;
}
.score-text {
  font-size: 1.1rem;
  font-weight: 500;
  margin-right: 8px;
  color: var(--p-text-muted-color, #6c757d);
}
</style>
