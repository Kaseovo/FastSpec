<template>
  <div class="pvw">
    <header class="pvw-bar">
      <img src="/logo.svg" alt="FastSpec" class="pvw-bar__logo" />
      <div class="pvw-bar__spacer"></div>
      <Button icon="pi pi-plus" text rounded title="New" @click="newSpecFn && newSpecFn()" />
      <Button icon="pi pi-save" text rounded title="Save" @click="openSaveDialogFn && openSaveDialogFn()" />
      <Button icon="pi pi-key" text rounded title="Manage Tokens" @click="showTokenDialogFn && showTokenDialogFn()" />
      <UserProfile />
    </header>

    <div class="pvw-tabstrip">
      <div class="pvw-spec-tabs">
        <button
          v-for="s in specTabs"
          :key="s.id"
          class="pvw-spec-tab"
          :class="{ 'pvw-spec-tab--active': s.id === selectedSpecId }"
          @click="loadSpec(s)"
        >
          {{ s.name }}
        </button>
        <button class="pvw-spec-tab pvw-spec-tab--manage" @click="toggleManage" title="Manage saved specs">
          <i class="pi pi-ellipsis-h"></i>
        </button>
        <Popover ref="managePopover">
          <div class="pvw-manage-popover">
            <SpecList @spec-selected="onSpecSelected" :selected-id="selectedSpecId" />
          </div>
        </Popover>
      </div>

      <div class="pvw-mode-pills">
        <button
          v-for="m in modes"
          :key="m.value"
          class="pvw-mode-pill"
          :class="[`pvw-mode-pill--${m.value}`, { 'pvw-mode-pill--active': mode === m.value }]"
          @click="setMode(m.value)"
        >
          <i :class="m.icon"></i> {{ m.label }}
        </button>
      </div>
    </div>

    <main class="pvw-content">
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
import { inject, ref, onMounted } from "vue";
import Button from "primevue/button";
import Popover from "primevue/popover";
import SpecList from "../SpecList.vue";
import UserProfile from "../UserProfile.vue";
import PagePrototypeContent from "./PagePrototypeContent.vue";
import { usePagePrototypeContent } from "../../composables/usePagePrototypeContent";
import { fetchSpecs } from "../../api/specs";

const MODES = [
  { value: "form", label: "Form", icon: "pi pi-list" },
  { value: "code", label: "Code", icon: "pi pi-code" },
  { value: "preview", label: "Preview", icon: "pi pi-eye" },
  { value: "lint", label: "Lint", icon: "pi pi-search" },
];

export default {
  name: "PageVariantWorkbench",
  components: { Button, Popover, SpecList, UserProfile, PagePrototypeContent },
  setup() {
    const state = usePagePrototypeContent();
    const specTabs = ref([]);
    // Lightweight read-only tab strip — fetched independently of SpecList.vue
    // (which owns the full manage/rename/delete/history UI, reachable via
    // the "..." tab's popover for feature parity without duplicating that
    // logic here).
    onMounted(async () => {
      try {
        specTabs.value = await fetchSpecs();
      } catch (e) {
        specTabs.value = [];
      }
    });

    const managePopover = ref(null);
    const toggleManage = (event) => managePopover.value?.toggle(event);
    const onSpecSelected = (spec) => {
      state.loadSpec(spec);
      managePopover.value?.hide();
    };

    return {
      ...state,
      modes: MODES,
      specTabs,
      managePopover,
      toggleManage,
      onSpecSelected,
      newSpecFn: inject("newSpec", null),
      openSaveDialogFn: inject("openSaveDialog", null),
      showTokenDialogFn: inject("showTokenDialog", null),
    };
  },
};
</script>

<style scoped>
.pvw {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.pvw-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
}

.pvw-bar__logo {
  height: 24px;
}

.pvw-bar__spacer {
  flex: 1;
}

.pvw-tabstrip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 0 4px 12px;
}

.pvw-spec-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
  max-width: 100%;
}

.pvw-spec-tab {
  white-space: nowrap;
  border: none;
  background: transparent;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.pvw-spec-tab:hover {
  color: #374151;
}

.pvw-spec-tab--active {
  color: var(--fs-primary, #2563ff);
  border-bottom-color: var(--fs-primary, #2563ff);
}

.pvw-spec-tab--manage {
  color: #9ca3af;
  padding: 8px 10px;
}

.pvw-manage-popover {
  width: 360px;
  max-height: 480px;
  overflow-y: auto;
}

.pvw-mode-pills {
  display: flex;
  gap: 6px;
}

.pvw-mode-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1.5px solid var(--fs-border, #e5e7eb);
  background: #fff;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
}

.pvw-mode-pill--active.pvw-mode-pill--form { background: #1d4ed8; border-color: transparent; color: #fff; }
.pvw-mode-pill--active.pvw-mode-pill--code { background: #7c3aed; border-color: transparent; color: #fff; }
.pvw-mode-pill--active.pvw-mode-pill--preview { background: #059669; border-color: transparent; color: #fff; }
.pvw-mode-pill--active.pvw-mode-pill--lint { background: #d97706; border-color: transparent; color: #fff; }

.pvw-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.pvw-content > * {
  flex: 1;
  min-height: 0;
}
</style>
