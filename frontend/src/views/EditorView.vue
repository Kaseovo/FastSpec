<template>
  <div class="ev">
    <header class="ev-bar">
      <div class="ev-bar__left">
        <img src="/logo.svg" alt="FastSpec" class="ev-bar__logo" />

        <div class="ev-spec-wrap" ref="specWrapEl">
          <button class="ev-bar__spec" @click="toggleSpecs">
            <i class="pi pi-folder"></i>
            <span>{{ currentSpecName }}</span>
            <i class="pi pi-chevron-down ev-bar__spec-caret"></i>
          </button>
          <!--
            Deliberately v-show, not a PrimeVue Popover (which v-if's its
            content — SpecList would then remount on every open, and it
            unconditionally auto-selects+emits its first spec on mount,
            closing this dropdown before a real click on a different spec
            could land. Keeping SpecList permanently mounted means that
            auto-select only ever fires once, on first page load.
          -->
          <div v-show="specMenuOpen" class="ev-spec-popover">
            <div class="ev-spec-popover__header">
              <span>Saved Specs</span>
              <button class="ev-spec-popover__new" @click="openNewSpecDialog?.()">
                <i class="pi pi-plus"></i> New
              </button>
            </div>
            <div class="ev-spec-popover__list">
              <ErrorBoundary v-if="isAuthenticated">
                <SpecList @spec-selected="onSpecSelected" :selected-id="selectedSpecId" />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </div>

      <div class="ev-bar__modes">
        <button
          v-for="m in modes"
          :key="m.value"
          class="ev-bar__mode"
          :class="{ 'ev-bar__mode--active': mode === m.value }"
          @click="setMode(m.value)"
        >
          <i :class="m.icon"></i> {{ m.label }}
        </button>
      </div>

      <div class="ev-bar__actions">
        <button
          v-if="lintResults"
          class="ev-lint-status"
          :class="lintScoreClass"
          title="Go to Lint"
          @click="setMode('lint')"
        >
          <span class="ev-lint-status__score">{{ lintResults.score }}<span class="ev-lint-status__max">/100</span></span>
          <span v-if="lintErrorCount" class="ev-lint-status__count ev-lint-status__count--error">
            <i class="pi pi-times-circle"></i>{{ lintErrorCount }}
          </span>
          <span v-if="lintWarnCount" class="ev-lint-status__count ev-lint-status__count--warn">
            <i class="pi pi-exclamation-triangle"></i>{{ lintWarnCount }}
          </span>
        </button>
        <Button
          v-else
          :icon="lintLoading ? 'pi pi-spin pi-spinner' : 'pi pi-search'"
          text
          rounded
          title="Run Lint"
          :disabled="lintLoading"
          @click="runLint"
        />
        <Button icon="pi pi-plus" text rounded title="New" @click="openNewSpecDialog?.()" />
        <Button icon="pi pi-save" text rounded title="Save" @click="openSaveDialogFn?.()" />
        <Button icon="pi pi-key" text rounded title="API keys" @click="showTokenDialogFn?.()" />
        <UserProfile v-if="isAuthenticated" />
      </div>
    </header>

    <main class="ev-content">
      <template v-if="mode === 'form'">
        <div :class="['code-split', { 'with-preview': showLivePreview }]">
          <div class="code-split__editor">
            <FormEditor
              :model-value="parsedSpec"
              :show-live-preview="showLivePreview"
              @update:modelValue="updateFromForm"
              @toggle-live-preview="toggleLivePreview"
            />
          </div>
          <div v-if="showLivePreview" class="code-split__preview">
            <PreviewPanel :spec="parsedSpec" />
          </div>
        </div>
      </template>

      <template v-else-if="mode === 'code'">
        <div :class="['code-split', { 'with-preview': showLivePreview }]">
          <div class="code-split__editor">
            <EditorPanel
              ref="editorPanelRef"
              v-model="specContent"
              :show-validate="true"
              :lint-results="lintResults"
              :show-live-preview="showLivePreview"
              @update:modelValue="updatePreview"
              @toggle-live-preview="toggleLivePreview"
            />
          </div>
          <div v-if="showLivePreview" class="code-split__preview">
            <PreviewPanel :spec="parsedSpec" />
          </div>
        </div>
      </template>

      <template v-else-if="mode === 'preview'">
        <PreviewPanel :spec="parsedSpec" />
      </template>

      <template v-else-if="mode === 'lint'">
        <LintPanel
          :results="lintResults"
          :loading="lintLoading"
          :error="lintError"
          :spec-id="selectedSpecId"
          :spec-content="specContent"
          @run-lint="runLint"
          @go-to-line="handleGoToLine"
        />
      </template>
    </main>
  </div>
</template>

<script>
import Button from "primevue/button";
import SpecList from "../components/SpecList.vue";
import UserProfile from "../components/UserProfile.vue";
import EditorPanel from "../components/EditorPanel.vue";
import FormEditor from "../components/FormEditor.vue";
import LintPanel from "../components/LintPanel.vue";
import PreviewPanel from "../components/PreviewPanel.vue";
import ErrorBoundary from "../components/ErrorBoundary.vue";
import { computed, ref, inject, nextTick, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const MODES = [
  { value: "form", label: "Form", icon: "pi pi-list" },
  { value: "code", label: "Code", icon: "pi pi-code" },
  { value: "preview", label: "Preview", icon: "pi pi-eye" },
  { value: "lint", label: "Lint", icon: "pi pi-search" },
];

export default {
  name: "EditorView",
  components: {
    Button,
    SpecList,
    UserProfile,
    EditorPanel,
    FormEditor,
    LintPanel,
    PreviewPanel,
    ErrorBoundary,
  },
  setup() {
    const specEditor = inject("specEditor");
    const lint = inject("lint");
    const auth = useAuthStore();
    const isAuthenticated = computed(() => auth.isAuthenticated);

    const route = useRoute();
    const router = useRouter();

    const mode = computed(() => route.query.view || "form");
    const setMode = (value) => {
      router
        .push({ name: route.name || "editor", params: route.params, query: { view: value } })
        .catch(() => {});
    };

    // if route has :id param, load spec
    if (route.params.id) {
      specEditor.loadSpec(route.params.id);
    }

    // Local state
    const showLivePreview = ref(false);
    const toggleLivePreview = () => {
      showLivePreview.value = !showLivePreview.value;
    };

    const editorPanelRef = ref(null);
    const handleGoToLine = (result) => {
      router.push({ name: "editor", query: { view: "code" } }).catch(() => {});
      nextTick(() => {
        editorPanelRef.value?.goToLine(result);
      });
    };

    const selectedSpecId = computed(
      () =>
        specEditor.currentSpec.value?.id ??
        (specEditor.unsavedSpec.value ? "__unsaved" : null),
    );

    // ── Spec switcher popover ──────────────────────────────────────────────
    const openNewSpecDialog = inject("openNewSpecDialog", null);
    const openSaveDialogFn = inject("openSaveDialog", null);
    const showTokenDialogFn = inject("showTokenDialog", null);

    const specMenuOpen = ref(false);
    const specWrapEl = ref(null);
    const toggleSpecs = () => {
      specMenuOpen.value = !specMenuOpen.value;
    };
    const onSpecSelected = (spec) => {
      specEditor.loadSpec(spec);
      specMenuOpen.value = false;
    };
    const onClickOutside = (event) => {
      if (specMenuOpen.value && specWrapEl.value && !specWrapEl.value.contains(event.target)) {
        specMenuOpen.value = false;
      }
    };
    onMounted(() => document.addEventListener("click", onClickOutside));
    onUnmounted(() => document.removeEventListener("click", onClickOutside));

    const currentSpecName = computed(
      () => specEditor.parsedSpec.value?.info?.title || "Untitled Spec",
    );

    // ── Lint status badge ──────────────────────────────────────────────────
    // Same thresholds as LintPanel.vue's scoreClass, so the topbar badge and
    // the Lint panel never disagree about what "good" means.
    const lintScoreClass = computed(() => {
      const score = lint.lintResults.value?.score;
      if (score == null) return "";
      if (score >= 80) return "ev-lint-status--good";
      if (score >= 50) return "ev-lint-status--warn";
      return "ev-lint-status--bad";
    });
    // LintPanel.vue's severity keys are error/warn/info/hint — the topbar
    // only has room for the two that actually block shipping.
    const lintErrorCount = computed(() => lint.lintResults.value?.summary?.error ?? 0);
    const lintWarnCount = computed(() => lint.lintResults.value?.summary?.warn ?? 0);

    return {
      isAuthenticated,
      modes: MODES,
      parsedSpec: specEditor.parsedSpec,
      specContent: specEditor.specContent,
      updateFromForm: specEditor.updateFromForm,
      updatePreview: specEditor.updatePreview,
      lintResults: lint.lintResults,
      lintLoading: lint.lintLoading,
      lintError: lint.lintError,
      runLint: lint.runLint,
      mode,
      setMode,
      showLivePreview,
      toggleLivePreview,
      editorPanelRef,
      handleGoToLine,
      selectedSpecId,
      openNewSpecDialog,
      openSaveDialogFn,
      showTokenDialogFn,
      specMenuOpen,
      specWrapEl,
      toggleSpecs,
      onSpecSelected,
      currentSpecName,
      lintScoreClass,
      lintErrorCount,
      lintWarnCount,
    };
  },
};
</script>

<style scoped>
.ev {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ev-bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: #ffffff;
  border-radius: var(--fs-radius, 10px);
  box-shadow: var(--fs-shadow, 0 4px 16px rgba(0, 0, 0, 0.06));
  margin-bottom: 16px;
}

.ev-bar__left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.ev-bar__logo {
  height: 28px;
  flex-shrink: 0;
}

.ev-bar__spec {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--fs-border, #e5e7eb);
  background: #f9fafb;
  color: #374151;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.ev-bar__spec:hover {
  background: #f3f4f6;
}

.ev-bar__spec-caret {
  font-size: 10px;
  opacity: 0.6;
}

.ev-bar__modes {
  display: flex;
  gap: 2px;
  background: #f3f4f6;
  border-radius: 999px;
  padding: 3px;
  justify-self: center;
}

.ev-bar__mode {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
}

.ev-bar__mode--active {
  background: #ffffff;
  color: var(--fs-primary, #2563ff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.ev-bar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-self: end;
}

.ev-lint-status {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1.5px solid transparent;
  border-radius: 999px;
  padding: 5px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ev-lint-status:hover {
  filter: brightness(0.96);
}

.ev-lint-status--good { background: #ecfdf5; border-color: #a7f3d0; }
.ev-lint-status--warn { background: #fffbeb; border-color: #fde68a; }
.ev-lint-status--bad  { background: #fef2f2; border-color: #fecaca; }

.ev-lint-status__score {
  font-size: 13px;
  font-weight: 800;
}

.ev-lint-status--good .ev-lint-status__score { color: #059669; }
.ev-lint-status--warn .ev-lint-status__score { color: #d97706; }
.ev-lint-status--bad  .ev-lint-status__score { color: #dc2626; }

.ev-lint-status__max {
  font-weight: 600;
  opacity: 0.6;
  font-size: 11px;
}

.ev-lint-status__count {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 700;
}

.ev-lint-status__count i {
  font-size: 10px;
}

.ev-lint-status__count--error { color: #dc2626; }
.ev-lint-status__count--warn { color: #d97706; }

.ev-spec-wrap {
  position: relative;
}

.ev-spec-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 100;
  width: 340px;
  max-height: 480px;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid var(--fs-border, #e5e7eb);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.16);
  overflow: hidden;
}

.ev-spec-popover__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--fs-border, #e5e7eb);
  flex-shrink: 0;
}

.ev-spec-popover__header span {
  font-size: 11px;
  font-weight: 700;
  color: var(--fs-text-muted, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.ev-spec-popover__new {
  display: flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: var(--fs-primary-light, rgba(37, 99, 255, 0.1));
  color: var(--fs-primary, #2563ff);
  font-size: 11px;
  font-weight: 700;
  padding: 5px 10px;
  border-radius: 999px;
  cursor: pointer;
}

.ev-spec-popover__new:hover {
  background: rgba(37, 99, 255, 0.18);
}

.ev-spec-popover__new i {
  font-size: 9px;
}

.ev-spec-popover__list {
  overflow-y: auto;
  padding: 10px;
}

/* SpecList.vue ships its own generic card-list styling (built for a
   persistent light sidebar) — deep-override it here to match the unified
   bar's rounder, brand-accented, tighter-spaced look. SpecList.vue itself
   stays untouched; only this popover's presentation of it changes. */
.ev-spec-popover__list :deep(.sidebar) {
  padding: 0;
  box-shadow: none;
  background: transparent;
}

.ev-spec-popover__list :deep(.sidebar h3) {
  display: none;
}

.ev-spec-popover__list :deep(.spec-card) {
  border-radius: 10px;
  border-color: var(--fs-border, #e5e7eb);
  padding: 10px 12px;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.ev-spec-popover__list :deep(.spec-card:hover) {
  border-color: #d1d5db;
  box-shadow: none;
  background: #f9fafb;
}

.ev-spec-popover__list :deep(.spec-card.active) {
  border: 1px solid var(--fs-primary, #2563ff);
  border-left: 3px solid var(--fs-primary, #2563ff);
  background: var(--fs-primary-light, rgba(37, 99, 255, 0.06));
}

.ev-spec-popover__list :deep(.spec-card.changed) {
  border-left: 3px solid #f59e0b;
  background: #fffbeb;
}

.ev-spec-popover__list :deep(.spec-info h4) {
  font-family: "Space Grotesk", sans-serif;
  font-size: 13px;
}

.ev-spec-popover__list :deep(.spec-actions .p-button) {
  width: 26px;
  height: 26px;
}

.ev-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ev-content > * {
  flex: 1;
  min-height: 0;
}

/* Split pane layout for code + live preview */
.code-split {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  gap: 0;
  height: 100%;
  position: relative;
}

.code-split.with-preview {
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.code-split__editor {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.code-split__editor > * {
  flex: 1;
  min-height: 0;
}

.code-split__preview {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #e5e7eb;
}

.code-split__preview > * {
  flex: 1;
  min-height: 0;
}
</style>
