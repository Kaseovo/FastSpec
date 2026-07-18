<template>
  <div class="pvu">
    <header class="pvu-bar">
      <div class="pvu-bar__left">
        <img src="/logo.svg" alt="FastSpec" class="pvu-bar__logo" />

        <div class="pvu-spec-wrap" ref="specWrapEl">
          <button class="pvu-bar__spec" @click="toggleSpecs">
            <i class="pi pi-folder"></i>
            <span>{{ currentSpecName }}</span>
            <i class="pi pi-chevron-down pvu-bar__spec-caret"></i>
          </button>
          <!--
            Deliberately v-show, not a PrimeVue Popover (which v-if's its
            content — SpecList would then remount on every open, and it
            unconditionally auto-selects+emits its first spec on mount.
            That auto-emit was closing this dropdown before a real click on
            a different spec could land. Keeping SpecList permanently
            mounted (matching how it always ran in the sidebar variant and
            in production) means that auto-select only ever fires once, on
            first page load.
          -->
          <div v-show="specMenuOpen" class="pvu-spec-popover">
            <div class="pvu-spec-popover__header">
              <span>Saved Specs</span>
              <button class="pvu-spec-popover__new" @click="newSpecFn && newSpecFn()">
                <i class="pi pi-plus"></i> New
              </button>
            </div>
            <div class="pvu-spec-popover__list">
              <SpecList @spec-selected="onSpecSelected" :selected-id="selectedSpecId" />
            </div>
          </div>
        </div>
      </div>

      <div class="pvu-bar__modes">
        <button
          v-for="m in modes"
          :key="m.value"
          class="pvu-bar__mode"
          :class="{ 'pvu-bar__mode--active': mode === m.value }"
          @click="setMode(m.value)"
        >
          <i :class="m.icon"></i> {{ m.label }}
        </button>
      </div>

      <div class="pvu-bar__actions">
        <button
          v-if="lintResults"
          class="pvu-lint-status"
          :class="lintScoreClass"
          title="Go to Lint"
          @click="setMode('lint')"
        >
          <span class="pvu-lint-status__score">{{ lintResults.score }}<span class="pvu-lint-status__max">/100</span></span>
          <span v-if="lintErrorCount" class="pvu-lint-status__count pvu-lint-status__count--error">
            <i class="pi pi-times-circle"></i>{{ lintErrorCount }}
          </span>
          <span v-if="lintWarnCount" class="pvu-lint-status__count pvu-lint-status__count--warn">
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
        <Button icon="pi pi-plus" text rounded title="New" @click="newSpecFn && newSpecFn()" />
        <Button icon="pi pi-save" text rounded title="Save" @click="openSaveDialogFn && openSaveDialogFn()" />
        <Button icon="pi pi-key" text rounded title="Manage Tokens" @click="showTokenDialogFn && showTokenDialogFn()" />
        <UserProfile />
      </div>
    </header>

    <main class="pvu-content">
      <PagePrototypeContent
        :mode="mode"
        :parsed-spec="parsedSpec"
        :spec-content="specContent"
        :lint-results="lintResults"
        :lint-loading="lintLoading"
        :lint-error="lintError"
        :show-live-preview="showLivePreview"
        :update-from-form="updateFromForm"
        :update-preview="updatePreview"
        @toggle-live-preview="toggleLivePreview"
        @run-lint="runLint"
        @go-to-line="handleGoToLine"
      />
    </main>
  </div>
</template>

<script>
import { computed, inject, ref, onMounted, onUnmounted } from "vue";
import Button from "primevue/button";
import SpecList from "../SpecList.vue";
import UserProfile from "../UserProfile.vue";
import PagePrototypeContent from "./PagePrototypeContent.vue";
import { usePagePrototypeContent } from "../../composables/usePagePrototypeContent";

const MODES = [
  { value: "form", label: "Form", icon: "pi pi-list" },
  { value: "code", label: "Code", icon: "pi pi-code" },
  { value: "preview", label: "Preview", icon: "pi pi-eye" },
  { value: "lint", label: "Lint", icon: "pi pi-search" },
];

export default {
  name: "PageVariantUnifiedBar",
  components: { Button, SpecList, UserProfile, PagePrototypeContent },
  setup() {
    const state = usePagePrototypeContent();
    const newSpecFn = inject("newSpec", null);
    const openSaveDialogFn = inject("openSaveDialog", null);
    const showTokenDialogFn = inject("showTokenDialog", null);

    const specMenuOpen = ref(false);
    const specWrapEl = ref(null);
    const toggleSpecs = () => {
      specMenuOpen.value = !specMenuOpen.value;
    };
    const onSpecSelected = (spec) => {
      state.loadSpec(spec);
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
      () => state.parsedSpec.value?.info?.title || "Untitled Spec",
    );

    // Same thresholds as LintPanel.vue's scoreClass, so the topbar badge and
    // the Lint panel never disagree about what "good" means.
    const lintScoreClass = computed(() => {
      const score = state.lintResults.value?.score;
      if (score == null) return "";
      if (score >= 80) return "pvu-lint-status--good";
      if (score >= 50) return "pvu-lint-status--warn";
      return "pvu-lint-status--bad";
    });

    // LintPanel.vue's severity keys are error/warn/info/hint — the topbar
    // only has room for the two that actually block shipping.
    const lintErrorCount = computed(() => state.lintResults.value?.summary?.error ?? 0);
    const lintWarnCount = computed(() => state.lintResults.value?.summary?.warn ?? 0);

    return {
      ...state,
      modes: MODES,
      newSpecFn,
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
.pvu {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.pvu-bar {
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

.pvu-bar__left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.pvu-bar__logo {
  height: 28px;
  flex-shrink: 0;
}

.pvu-bar__spec {
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

.pvu-bar__spec:hover {
  background: #f3f4f6;
}

.pvu-bar__spec-caret {
  font-size: 10px;
  opacity: 0.6;
}

.pvu-bar__modes {
  display: flex;
  gap: 2px;
  background: #f3f4f6;
  border-radius: 999px;
  padding: 3px;
  justify-self: center;
}

.pvu-bar__mode {
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

.pvu-bar__mode--active {
  background: #ffffff;
  color: var(--fs-primary, #2563ff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.pvu-bar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-self: end;
}

.pvu-lint-status {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1.5px solid transparent;
  border-radius: 999px;
  padding: 5px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pvu-lint-status:hover {
  filter: brightness(0.96);
}

.pvu-lint-status--good { background: #ecfdf5; border-color: #a7f3d0; }
.pvu-lint-status--warn { background: #fffbeb; border-color: #fde68a; }
.pvu-lint-status--bad  { background: #fef2f2; border-color: #fecaca; }

.pvu-lint-status__score {
  font-size: 13px;
  font-weight: 800;
}

.pvu-lint-status--good .pvu-lint-status__score { color: #059669; }
.pvu-lint-status--warn .pvu-lint-status__score { color: #d97706; }
.pvu-lint-status--bad  .pvu-lint-status__score { color: #dc2626; }

.pvu-lint-status__max {
  font-weight: 600;
  opacity: 0.6;
  font-size: 11px;
}

.pvu-lint-status__count {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 700;
}

.pvu-lint-status__count i {
  font-size: 10px;
}

.pvu-lint-status__count--error { color: #dc2626; }
.pvu-lint-status__count--warn { color: #d97706; }

.pvu-spec-wrap {
  position: relative;
}

.pvu-spec-popover {
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

.pvu-spec-popover__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--fs-border, #e5e7eb);
  flex-shrink: 0;
}

.pvu-spec-popover__header span {
  font-size: 11px;
  font-weight: 700;
  color: var(--fs-text-muted, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.pvu-spec-popover__new {
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

.pvu-spec-popover__new:hover {
  background: rgba(37, 99, 255, 0.18);
}

.pvu-spec-popover__new i {
  font-size: 9px;
}

.pvu-spec-popover__list {
  overflow-y: auto;
  padding: 10px;
}

/* SpecList.vue ships its own generic card-list styling (built for a
   persistent light sidebar) — deep-override it here to match the unified
   bar's rounder, brand-accented, tighter-spaced look, same pattern used in
   PageVariantSidebar.vue for the dark-rail version. SpecList.vue itself
   stays untouched; only this popover's presentation of it changes. */
.pvu-spec-popover__list :deep(.sidebar) {
  padding: 0;
  box-shadow: none;
  background: transparent;
}

.pvu-spec-popover__list :deep(.sidebar h3) {
  display: none;
}

.pvu-spec-popover__list :deep(.spec-card) {
  border-radius: 10px;
  border-color: var(--fs-border, #e5e7eb);
  padding: 10px 12px;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.pvu-spec-popover__list :deep(.spec-card:hover) {
  border-color: #d1d5db;
  box-shadow: none;
  background: #f9fafb;
}

.pvu-spec-popover__list :deep(.spec-card.active) {
  border: 1px solid var(--fs-primary, #2563ff);
  border-left: 3px solid var(--fs-primary, #2563ff);
  background: var(--fs-primary-light, rgba(37, 99, 255, 0.06));
}

.pvu-spec-popover__list :deep(.spec-card.changed) {
  border-left: 3px solid #f59e0b;
  background: #fffbeb;
}

.pvu-spec-popover__list :deep(.spec-info h4) {
  font-family: "Space Grotesk", sans-serif;
  font-size: 13px;
}

.pvu-spec-popover__list :deep(.spec-actions .p-button) {
  width: 26px;
  height: 26px;
}

.pvu-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.pvu-content > * {
  flex: 1;
  min-height: 0;
}
</style>
