<template>
  <div>
    <div class="toolbar">
      <div class="toolbar-left">
        <Button label="New" icon="pi pi-plus" @click="showNewDialog = true" />
        <Button label="Save" icon="pi pi-save" @click="openSaveDialog" />

        <!-- Lint button + score badge -->
        <Button
          label="Lint"
          icon="pi pi-search"
          severity="secondary"
          :loading="lintLoading"
          @click="runLint"
        />
        <div
          v-if="lintScore !== null"
          class="lint-score-badge"
          :class="scoreBadgeClass"
          :title="`Spectral quality score: ${lintScore}/100`"
        >
          {{ lintScore }}
        </div>
      </div>

      <!-- User Profile Section -->
      <div v-if="isAuthenticated" class="toolbar-right">
        <Button
          label="Manage Tokens"
          icon="pi pi-key"
          @click="showTokenDialog"
          class="me-2"
        />
        <UserProfile />
      </div>
    </div>

    <!-- New Spec Dialog -->
    <Dialog
      :visible="showNewDialog"
      @update:visible="(val) => (showNewDialog = val)"
      header="Create New Specification"
      :modal="true"
      :style="{ width: '500px' }"
    >
      <div class="new-spec-options">
        <div class="option-card" @click="createBlank">
          <i class="pi pi-file"></i>
          <h4>Blank Specification</h4>
          <p>Start with a minimal OpenAPI 3.0 structure</p>
        </div>
        <div class="option-card" @click="createFromTemplate">
          <i class="pi pi-clone"></i>
          <h4>From Template</h4>
          <p>Start with a pre-configured API template</p>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script>
import { inject, ref, computed } from "vue";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import UserProfile from "./UserProfile.vue";
import { useAuthStore } from "../stores/auth";
import { useConfirm } from "primevue/useconfirm";

export default {
  name: "Toolbar",
  components: {
    Button,
    Dialog,
    UserProfile,
  },
  setup() {
    const auth = useAuthStore();
    const isAuthenticated = computed(() => auth.isAuthenticated);
    const showNewDialog = ref(false);
    const newSpec = inject("newSpec");
    const openSaveDialog = inject("openSaveDialog");
    const loadTemplate = inject("loadTemplate");
    const togglePreview = inject("togglePreview");
    const toggleDiff = inject("toggleDiff");
    const viewMode = inject("viewMode", ref("form"));
    const showTokenDialog = inject("showTokenDialog");

    // Unsaved helpers injected from App.vue
    const hasUnsavedChanges = inject("hasUnsavedChanges", ref(false));
    const discardUnsaved = inject("discardUnsaved", () => {});

    // Lint state (injected from App.vue)
    const lintScore = inject("lintScore", ref(null));
    const lintLoading = inject("lintLoading", ref(false));
    const runLint = inject("runLint", () => {});

    const confirm = useConfirm();

    // Guard to avoid opening multiple confirm dialogs (re-entrancy)
    const confirmOpen = ref(false);

    const scoreBadgeClass = computed(() => {
      if (lintScore.value === null) return "";
      if (lintScore.value >= 80) return "score-good";
      if (lintScore.value >= 50) return "score-warn";
      return "score-bad";
    });

    const createBlank = () => {
      // If there are unsaved changes, confirm discard first
      if (hasUnsavedChanges.value) {
        if (!confirmOpen.value) {
          confirmOpen.value = true;
          confirm.require({
            message: `You have unsaved changes. Discard them and create a new blank spec?`,
            header: "Discard unsaved changes?",
            icon: "pi pi-exclamation-triangle",
            acceptClass: "p-button-danger",
            accept: () => {
              discardUnsaved();
              newSpec();
              showNewDialog.value = false;
              confirmOpen.value = false;
            },
            reject: () => {
              // close the guard so future confirms can open
              confirmOpen.value = false;
            },
            onHide: () => {
              // in case the dialog is closed by other means (e.g. escape key), reset the guard
              confirmOpen.value = false;
            },
          });
        }
        return;
      }

      newSpec();
      showNewDialog.value = false;
    };

    const createFromTemplate = () => {
      if (hasUnsavedChanges.value) {
        if (!confirmOpen.value) {
          confirmOpen.value = true;
          confirm.require({
            message: `You have unsaved changes. Discard them and create a new spec from template?`,
            header: "Discard unsaved changes?",
            icon: "pi pi-exclamation-triangle",
            acceptClass: "p-button-danger",
            accept: () => {
              discardUnsaved();
              loadTemplate();
              showNewDialog.value = false;
              confirmOpen.value = false;
            },
            reject: () => {
              confirmOpen.value = false;
            },
            onHide: () => {
              confirmOpen.value = false;
            },
          });
        }
        return;
      }

      loadTemplate();
      showNewDialog.value = false;
    };

    return {
      isAuthenticated,
      showNewDialog,
      openSaveDialog,
      togglePreview,
      toggleDiff,
      viewMode,
      createBlank,
      createFromTemplate,
      showTokenDialog,
      lintScore,
      lintLoading,
      runLint,
      scoreBadgeClass,
    };
  },
  methods: {
    goToTokens() {
      this.$router.push("/tokens");
    },
  },
};
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Score badge */
.lint-score-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  border-radius: 18px;
  padding: 0 10px;
  font-weight: 700;
  font-size: 0.9rem;
  color: #fff;
  cursor: default;
}
.lint-score-badge.score-good {
  background: #22c55e;
}
.lint-score-badge.score-warn {
  background: #f97316;
}
.lint-score-badge.score-bad {
  background: #ef4444;
}

.new-spec-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 16px 0;
}

.option-card {
  padding: 24px;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  background: white;
}

.option-card:hover {
  border-color: #667eea;
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.2);
  background: linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%);
}

.option-card i {
  font-size: 2.5rem;
  color: #667eea;
  margin-bottom: 12px;
  display: block;
}

.option-card h4 {
  margin: 0 0 8px 0;
  color: #1e293b;
  font-size: 1rem;
  font-weight: 700;
}

.option-card p {
  margin: 0;
  color: #64748b;
  font-size: 0.875rem;
  line-height: 1.4;
}
</style>
