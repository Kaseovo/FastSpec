<template>
  <div>
    <div class="toolbar">
      <Button label="New" icon="pi pi-plus" @click="showNewDialog = true" />
      <Button label="Save" icon="pi pi-save" @click="openSaveDialog" />
      <Button
        label="Validate"
        icon="pi pi-check-circle"
        severity="secondary"
        @click="validateCurrentSpec"
      />
      <Button
        label="Preview"
        icon="pi pi-eye"
        severity="info"
        @click="togglePreview"
      />
      <Button
        label="Changes"
        icon="pi pi-history"
        severity="secondary"
        @click="toggleDiff"
      />
    </div>

    <!-- New Spec Dialog -->
    <Dialog
      v-model:visible="showNewDialog"
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
import { inject, ref } from "vue";
import Button from "primevue/button";
import Dialog from "primevue/dialog";

export default {
  name: "Toolbar",
  components: {
    Button,
    Dialog,
  },
  setup() {
    const showNewDialog = ref(false);
    const newSpec = inject("newSpec");
    const openSaveDialog = inject("openSaveDialog");
    const validateCurrentSpec = inject("validateCurrentSpec");
    const loadTemplate = inject("loadTemplate");
    const togglePreview = inject("togglePreview");
    const toggleDiff = inject("toggleDiff");

    const createBlank = () => {
      newSpec();
      showNewDialog.value = false;
    };

    const createFromTemplate = () => {
      loadTemplate();
      showNewDialog.value = false;
    };

    return {
      showNewDialog,
      openSaveDialog,
      validateCurrentSpec,
      togglePreview,
      toggleDiff,
      createBlank,
      createFromTemplate,
    };
  },
};
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
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
