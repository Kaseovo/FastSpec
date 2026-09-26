<template>
  <Dialog
    :visible="visible"
    :header="isNew ? 'Add New Tag' : 'Edit Tag'"
    :style="{ width: '560px' }"
    modal
    :draggable="false"
    @update:visible="$emit('update:visible', $event)"
    @hide="$emit('cancel')"
  >
    <div class="wizard-steps">
      <div
        v-for="(s, index) in steps"
        :key="s.key"
        class="wizard-step"
        :class="{
          'wizard-step--active': step === s.key,
          'wizard-step--done': stepIndex > index,
        }"
      >
        <span class="wizard-step__dot">{{ index + 1 }}</span> {{ s.label }}
      </div>
    </div>

    <div v-if="tag" class="dialog-content">
      <!-- Step 1: Basic Info -->
      <template v-if="step === 'basicInfo'">
        <div class="form-field">
          <label class="required">Name</label>
          <InputText v-model="tag.name" placeholder="pet" :class="{ 'p-invalid': isNameInvalid }" />
          <small v-if="isNameInvalid" class="p-error">
            {{ !tag.name || !tag.name.trim() ? "A tag name is required." : "Another tag already uses this name." }}
          </small>
        </div>
        <div class="form-field">
          <label>Description</label>
          <InputText v-model="tag.description" placeholder="Everything about your Pets" />
        </div>
      </template>

      <!-- Step 2: External Docs (always optional) -->
      <template v-else>
        <div class="form-field">
          <label>Docs Description</label>
          <InputText v-model="tag.externalDocs.description" placeholder="Find out more" />
        </div>
        <div class="form-field">
          <label>Docs URL</label>
          <InputText v-model="tag.externalDocs.url" placeholder="https://example.com" />
        </div>
        <small class="helper-text">
          Optional — link out to fuller documentation for operations under this tag.
        </small>
      </template>
    </div>
    <template #footer>
      <Button label="Cancel" text @click="$emit('update:visible', false); $emit('cancel')" />
      <Button v-if="stepIndex > 0" label="Back" icon="pi pi-arrow-left" text @click="$emit('back')" />
      <Button
        v-if="stepIndex < steps.length - 1"
        label="Next"
        icon="pi pi-arrow-right"
        icon-pos="right"
        :disabled="isNameInvalid"
        @click="$emit('next')"
      />
      <Button v-else label="Finish" icon="pi pi-check" @click="$emit('finish')" />
    </template>
  </Dialog>
</template>

<script>
import "../../assets/form-editor-shared.css";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import InputText from "primevue/inputtext";

const STEPS = [
  { key: "basicInfo", label: "Basic Info" },
  { key: "externalDocs", label: "External Docs" },
];

// The "Add/Edit Tag" wizard — step 1 (name + description) then step 2
// (external docs, always optional). Same shape as AddPathDialog/
// AddMethodDialog: FormEditor.vue keeps ownership of every handler
// (openAddTagDialog/openEditTagDialog/goToNextTagStep/.../cancelTagDialog
// in useFormEditorState.js), since they mutate the shared formData. `tag`
// is the live tag object (formData.tags[editingTagIndex]) — v-model here
// mutates it directly, same pattern as every other tab in this app.
export default {
  name: "AddTagDialog",
  components: { Dialog, Button, InputText },
  props: {
    visible: { type: Boolean, default: false },
    step: { type: String, default: "basicInfo" },
    tag: { type: Object, default: null },
    isNew: { type: Boolean, default: false },
    isNameInvalid: { type: Boolean, default: false },
  },
  emits: ["update:visible", "back", "next", "cancel", "finish"],
  data() {
    return { steps: STEPS };
  },
  computed: {
    stepIndex() {
      return STEPS.findIndex((s) => s.key === this.step);
    },
  },
};
</script>

<style scoped>
/* See AddPathDialog.vue's identical block for why this is here instead of
   the shared stylesheet: PrimeVue's Dialog teleports to <body>, and only
   scoped-CSS :deep() (not a plain DOM-ancestry selector) survives that. */
:deep(.p-dialog) {
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

:deep(.p-dialog-header) {
  padding: 16px 20px;
  background: #1f2937;
  color: white;
  border-bottom: none;
}

:deep(.p-dialog-title) {
  font-weight: 600;
  font-size: 15px;
}

:deep(.p-dialog-header-close) {
  color: rgba(255, 255, 255, 0.7);
  transition: color 0.15s ease;
}

:deep(.p-dialog-header-close:hover) {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
}

:deep(.p-dialog-content) {
  padding: 20px;
  background: #ffffff;
}

:deep(.p-dialog-footer) {
  padding: 12px 20px;
  border-top: 1px solid #f3f4f6;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  background: #ffffff;
}

/* ── Step indicator ── */
.wizard-steps {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  background: #f9fafb;
  border-bottom: 1px solid #f3f4f6;
}

.wizard-step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #9ca3af;
}

.wizard-step--active {
  color: #111827;
}

.wizard-step--done {
  color: #16a34a;
}

.wizard-step__dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #e5e7eb;
  color: #6b7280;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.wizard-step--active .wizard-step__dot {
  background: #3b82f6;
  color: #ffffff;
}

.wizard-step--done .wizard-step__dot {
  background: #16a34a;
  color: #ffffff;
}
</style>
