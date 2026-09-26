<template>
  <div class="form-section">
    <div class="section-header">
      <h4>Servers</h4>
      <Button
        v-tooltip.left="
          hasEmptyServerUrl
            ? 'Please fill in the URL for all existing servers before adding a new one.'
            : ''
        "
        label="Add Server"
        icon="pi pi-plus"
        size="small"
        :disabled="hasEmptyServerUrl"
        @click="$emit('add-server')"
      />
    </div>

    <div v-if="formData.servers.length === 0" class="empty-state">
      <i class="pi pi-server"></i>
      <p>No servers defined. Add one to get started.</p>
    </div>

    <div
      v-for="(server, index) in formData.servers"
      :key="index"
      class="list-item"
    >
      <div class="list-item-content">
        <div class="form-field">
          <label class="required">URL</label>
          <InputText v-model="server.url" placeholder="https://api.example.com" />
        </div>
        <div class="form-field">
          <label>Description</label>
          <InputText v-model="server.description" placeholder="Production server" />
        </div>
      </div>
      <Button
        icon="pi pi-trash"
        severity="danger"
        text
        rounded
        @click="$emit('remove-server', index)"
      />
    </div>
  </div>
</template>

<script>
import "../../assets/form-editor-shared.css";
import Button from "primevue/button";
import InputText from "primevue/inputtext";

// The "Servers" tab of FormEditor. Receives the whole reactive `formData`
// object (not a copy) as a prop and mutates `server.url`/`server.description`
// directly on its array items — same mutation pattern used before this was
// extracted. Add/remove are emitted since they involve confirm/toast side
// effects that stay owned by FormEditor.vue.
export default {
  name: "ServersTab",
  components: { Button, InputText },
  props: {
    formData: {
      type: Object,
      required: true,
    },
    hasEmptyServerUrl: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["add-server", "remove-server"],
};
</script>
