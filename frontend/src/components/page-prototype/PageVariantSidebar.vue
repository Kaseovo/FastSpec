<template>
  <div class="pvs">
    <aside class="pvs-sidebar">
      <div class="pvs-sidebar__brand">
        <img src="/logo.svg" alt="FastSpec" class="pvs-sidebar__logo" />
        <span>FastSpec</span>
      </div>
      <SpecList @spec-selected="loadSpec" :selected-id="selectedSpecId" />
    </aside>

    <div class="pvs-main">
      <header class="pvs-topbar">
        <div class="pvs-topbar__modes">
          <button
            v-for="m in modes"
            :key="m.value"
            class="pvs-topbar__mode"
            :class="{ 'pvs-topbar__mode--active': mode === m.value }"
            @click="setMode(m.value)"
          >
            <i :class="m.icon"></i> {{ m.label }}
          </button>
        </div>

        <div class="pvs-topbar__actions">
          <Button label="New" icon="pi pi-plus" size="small" text @click="newSpecFn && newSpecFn()" />
          <Button label="Save" icon="pi pi-save" size="small" severity="success" @click="openSaveDialogFn && openSaveDialogFn()" />
          <Button icon="pi pi-key" text rounded title="Manage Tokens" @click="showTokenDialogFn && showTokenDialogFn()" />
          <UserProfile />
        </div>
      </header>

      <main class="pvs-content">
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
  </div>
</template>

<script>
import { inject } from "vue";
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
  name: "PageVariantSidebar",
  components: { Button, SpecList, UserProfile, PagePrototypeContent },
  setup() {
    const state = usePagePrototypeContent();
    return {
      ...state,
      modes: MODES,
      newSpecFn: inject("newSpec", null),
      openSaveDialogFn: inject("openSaveDialog", null),
      showTokenDialogFn: inject("showTokenDialog", null),
    };
  },
};
</script>

<style scoped>
.pvs {
  display: grid;
  grid-template-columns: 280px 1fr;
  height: 100%;
  gap: 16px;
}

.pvs-sidebar {
  display: flex;
  flex-direction: column;
  background: #14181f;
  border-radius: var(--fs-radius, 10px);
  padding: 16px;
  overflow-y: auto;
}

.pvs-sidebar__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.pvs-sidebar__logo {
  height: 24px;
}

.pvs-sidebar__brand span {
  color: #fff;
  font-weight: 700;
  font-size: 14px;
}

/* SpecList.vue ships its own light-theme styling (.sidebar, .spec-card,
   headings) — deep-override just enough to sit on the dark rail without
   forking the component. */
.pvs-sidebar :deep(.sidebar) {
  background: transparent;
  padding: 0;
  box-shadow: none;
}

.pvs-sidebar :deep(.sidebar h3) {
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pvs-sidebar :deep(.spec-card) {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
}

.pvs-sidebar :deep(.spec-card h4) {
  color: #fff;
}

.pvs-sidebar :deep(.spec-card.active) {
  border-color: var(--fs-primary, #2563ff);
  background: rgba(37, 99, 255, 0.15);
}

.pvs-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.pvs-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #ffffff;
  border-radius: var(--fs-radius, 10px);
  box-shadow: var(--fs-shadow, 0 4px 16px rgba(0, 0, 0, 0.06));
  margin-bottom: 16px;
}

.pvs-topbar__modes {
  display: flex;
  gap: 2px;
  background: #f3f4f6;
  border-radius: 999px;
  padding: 3px;
}

.pvs-topbar__mode {
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

.pvs-topbar__mode--active {
  background: #ffffff;
  color: var(--fs-primary, #2563ff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.pvs-topbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pvs-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.pvs-content > * {
  flex: 1;
  min-height: 0;
}
</style>
