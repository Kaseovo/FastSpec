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

    return {
      newSpec,
      openSaveDialog,
      validateCurrentSpec,
      loadTemplate,
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
