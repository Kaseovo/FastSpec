<template>
  <div class="lint-panel">
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
              <span
                v-if="result.range && result.range.start"
                class="result-line"
              >
                line {{ result.range.start.line + 1 }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { ref, computed } from "vue";
import Button from "primevue/button";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";

export default {
  name: "LintPanel",
  components: { Button, Message, ProgressSpinner },

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
  },

  emits: ["run-lint", "go-to-line"],

  setup(props) {
    const activeFilter = ref(null);

    const severities = [
      { key: null, label: "All", icon: "⚪" },
      { key: "error", label: "Errors", icon: "🔴" },
      { key: "warn", label: "Warnings", icon: "🟠" },
      { key: "info", label: "Info", icon: "🔵" },
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
  background: var(--p-surface-card, #fff);
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
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
  color: #3b82f6;
}
.severity-pill.hint {
  color: #a855f7;
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
.result-line {
  font-style: italic;
}
.score-text {
  font-size: 1.1rem;
  font-weight: 500;
  margin-right: 8px;
  color: var(--p-text-muted-color, #6c757d);
}
</style>
