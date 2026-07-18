<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    header="Add New Path"
    :style="{ width: '640px' }"
    modal
    :draggable="false"
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

    <div class="dialog-content">
      <!-- Step 1: Method & Path -->
      <template v-if="step === 'methodPath'">
        <div class="form-field">
          <label class="required">HTTP Method</label>
          <SelectButton
            :modelValue="newMethod"
            @update:modelValue="$emit('update:newMethod', $event)"
            :options="httpMethods"
            class="method-select-button"
          >
            <template #option="slotProps">
              <span :class="['method-chip', 'method-' + slotProps.option.toLowerCase()]">
                {{ slotProps.option.toUpperCase() }}
              </span>
            </template>
          </SelectButton>
        </div>
        <div class="form-field">
          <label for="new-path">Path</label>
          <InputGroup>
            <InputGroupAddon class="path-addon">/</InputGroupAddon>
            <InputText
              id="new-path"
              :modelValue="newPath"
              @update:modelValue="$emit('update:newPath', $event)"
              placeholder="users/{id}"
              @keydown="$emit('path-keydown', $event)"
            />
          </InputGroup>
          <small class="helper-text">Use {param} for path variables — e.g. users/{id}</small>
        </div>
      </template>

      <!-- Steps 2-5: same step components the inline operation editor uses,
           bound to the operation createWizardOperation() just created. -->
      <OperationBasicInfoStep v-else-if="step === 'basicInfo'" :form-data="formData" :api="api" />
      <OperationParametersStep v-else-if="step === 'parameters'" :form-data="formData" :api="api" />
      <OperationRequestBodyStep v-else-if="step === 'requestBody'" :form-data="formData" :api="api" />
      <OperationResponsesStep v-else-if="step === 'responses'" :form-data="formData" :api="api" />
    </div>
    <template #footer>
      <Button label="Cancel" text @click="$emit('update:visible', false); $emit('cancel')" />
      <Button v-if="stepIndex > 0" label="Back" icon="pi pi-arrow-left" text @click="$emit('back')" />
      <Button
        v-if="stepIndex < steps.length - 1"
        label="Next"
        icon="pi pi-arrow-right"
        iconPos="right"
        @click="$emit('next')"
        :disabled="step === 'methodPath' && !newMethod"
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
import SelectButton from "primevue/selectbutton";
import InputGroup from "primevue/inputgroup";
import InputGroupAddon from "primevue/inputgroupaddon";
import OperationBasicInfoStep from "./OperationBasicInfoStep.vue";
import OperationParametersStep from "./OperationParametersStep.vue";
import OperationRequestBodyStep from "./OperationRequestBodyStep.vue";
import OperationResponsesStep from "./OperationResponsesStep.vue";

const STEPS = [
  { key: "methodPath", label: "Method & Path" },
  { key: "basicInfo", label: "Basic Info" },
  { key: "parameters", label: "Parameters" },
  { key: "requestBody", label: "Request Body" },
  { key: "responses", label: "Responses" },
];

// The "Add New Path" wizard: step 1 picks the HTTP method + path template.
// Confirming it (usePathsEditor's createWizardOperation, wired to the
// `next` emit via goToNextAddPathStep in FormEditor.vue) creates the
// operation immediately and selects it, so steps 2-5 can reuse the exact
// same Basic Info / Parameters / Request Body / Responses step components
// the inline free-jump editor uses (PathsTab.vue) — editing the live
// operation directly rather than a separate draft. Cancelling after the
// operation exists rolls it back (discardWizardPath in usePathsEditor.js).
// FormEditor.vue keeps ownership of `formData`/`api` and of every handler,
// since they mutate the shared formData.
export default {
  name: "AddPathDialog",
  components: {
    Dialog,
    Button,
    InputText,
    SelectButton,
    InputGroup,
    InputGroupAddon,
    OperationBasicInfoStep,
    OperationParametersStep,
    OperationRequestBodyStep,
    OperationResponsesStep,
  },
  props: {
    visible: { type: Boolean, default: false },
    step: { type: String, default: "methodPath" },
    httpMethods: { type: Array, default: () => [] },
    newMethod: { type: String, default: "" },
    newPath: { type: String, default: "" },
    formData: { type: Object, required: true },
    api: { type: Object, required: true },
  },
  emits: ["update:visible", "update:newMethod", "update:newPath", "path-keydown", "back", "next", "cancel", "finish"],
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
/* PrimeVue's Dialog teleports its rendered content to <body>, so a plain
   ".form-editor .p-dialog" selector in the shared stylesheet would never
   match it (DOM ancestry is broken by the teleport). Vue's scoped-CSS
   :deep() is what actually survives teleportation (it tags the elements
   themselves at compile time rather than relying on DOM position), so this
   dialog chrome styling has to live here rather than in the shared file —
   same block duplicated across all dialog components in form-editor/. */
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
  max-height: 60vh;
  overflow-y: auto;
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
  gap: 6px;
  padding: 14px 20px;
  background: #f9fafb;
  border-bottom: 1px solid #f3f4f6;
  flex-wrap: wrap;
}

.wizard-step {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #9ca3af;
  white-space: nowrap;
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
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #e5e7eb;
  color: #6b7280;
  font-size: 10px;
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
