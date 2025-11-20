<template>
  <div class="toolbar">
    <Button label="New" icon="pi pi-plus" @click="newSpec" />
    <Button label="Save" icon="pi pi-save" @click="openSaveDialog" />
    <Button
      label="Validate"
      icon="pi pi-check-circle"
      severity="secondary"
      @click="validateCurrentSpec"
    />
    <Button
      label="Load Template"
      icon="pi pi-file"
      severity="secondary"
      @click="loadTemplate"
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
</template>

<script>
import { inject } from "vue";
import Button from "primevue/button";

export default {
  name: "Toolbar",
  components: {
    Button,
  },
  setup() {
    const newSpec = inject("newSpec");
    const openSaveDialog = inject("openSaveDialog");
    const validateCurrentSpec = inject("validateCurrentSpec");
    const loadTemplate = inject("loadTemplate");
    const togglePreview = inject("togglePreview");
    const toggleDiff = inject("toggleDiff");

    return {
      newSpec,
      openSaveDialog,
      validateCurrentSpec,
      loadTemplate,
      togglePreview,
      toggleDiff,
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
</style>
