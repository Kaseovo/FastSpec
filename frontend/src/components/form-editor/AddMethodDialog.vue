<template>
  <Dialog
    :visible="visible"
    header="Add Method to Path"
    :style="{ width: '640px' }"
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

    <div class="dialog-content">
      <!-- Step 1: Method (path is already fixed) -->
      <template v-if="step === 'method'">
        <div class="form-field">
          <label>Path</label>
          <div class="method-dialog-path">{{ currentPathForMethod }}</div>
        </div>
        <div class="form-field">
          <label class="required">HTTP Method</label>
          <SelectButton
            :model-value="methodToAdd"
            :options="availableMethods"
            class="method-select-button"
            @update:model-value="$emit('update:methodToAdd', $event)"
          >
            <template #option="slotProps">
              <span :class="['method-chip', 'method-' + slotProps.option.toLowerCase()]">
                {{ slotProps.option.toUpperCase() }}
              </span>
            </template>
          </SelectButton>
        </div>
      </template>

      <!-- Steps 2-5: same step components AddPathDialog's wizard and the
           inline free-jump editor use, bound to the operation
           createWizardMethod() just created. -->
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
        icon-pos="right"
        :disabled="step === 'method' && !methodToAdd"
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
import SelectButton from "primevue/selectbutton";
import OperationBasicInfoStep from "./OperationBasicInfoStep.vue";
import OperationParametersStep from "./OperationParametersStep.vue";
import OperationRequestBodyStep from "./OperationRequestBodyStep.vue";
import OperationResponsesStep from "./OperationResponsesStep.vue";

const STEPS = [
  { key: "method", label: "Method" },
  { key: "basicInfo", label: "Basic Info" },
  { key: "parameters", label: "Parameters" },
  { key: "requestBody", label: "Request Body" },
  { key: "responses", label: "Responses" },
];

// The "Add Method to Path" wizard — same shape as AddPathDialog's wizard
// minus the path-template step, since the path already exists. Step 1
// picks the HTTP method; confirming it (usePathsEditor's createWizardMethod,
// wired to the `next` emit via goToNextAddMethodStep in FormEditor.vue)
// creates the operation immediately and selects it, so steps 2-5 reuse the
// exact same step components AddPathDialog and the inline free-jump editor
// use. Cancelling after the operation exists rolls it back
// (discardWizardPath in usePathsEditor.js — shared with AddPathDialog's
// wizard, since both just track "the operation this wizard created").
export default {
  name: "AddMethodDialog",
  components: {
    Dialog,
    Button,
    SelectButton,
    OperationBasicInfoStep,
    OperationParametersStep,
    OperationRequestBodyStep,
    OperationResponsesStep,
  },
  props: {
    visible: { type: Boolean, default: false },
    step: { type: String, default: "method" },
    availableMethods: { type: Array, default: () => [] },
    methodToAdd: { type: String, default: "" },
    currentPathForMethod: { type: String, default: "" },
    formData: { type: Object, required: true },
    api: { type: Object, required: true },
  },
  emits: ["update:visible", "update:methodToAdd", "back", "next", "cancel", "finish"],
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

.method-dialog-path {
  font-family: "SF Mono", "Monaco", "Inconsolata", "Courier New", monospace;
  font-size: 13px;
  color: #374151;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 10px 12px;
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
