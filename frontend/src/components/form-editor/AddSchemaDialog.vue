<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    header="Add New Schema"
    :style="{ width: '560px' }"
    modal
    :draggable="false"
    @hide="$emit('cancel')"
  >
    <div class="wizard-steps">
      <div class="wizard-step" :class="{ 'wizard-step--active': step === 1, 'wizard-step--done': step > 1 }">
        <span class="wizard-step__dot">1</span> Name &amp; Type
      </div>
      <template v-if="newSchemaKind === 'object'">
        <div class="wizard-step__divider"></div>
        <div class="wizard-step" :class="{ 'wizard-step--active': step === 2 }">
          <span class="wizard-step__dot">2</span> Properties
        </div>
      </template>
    </div>

    <div class="dialog-content">
      <!-- Step 1: Name, Type, Description -->
      <template v-if="step === 1">
        <div class="form-field">
          <label class="required">Schema Name</label>
          <InputText
            :modelValue="newSchemaName"
            @update:modelValue="$emit('update:newSchemaName', $event)"
            placeholder="SchemaName"
            :class="{ 'p-invalid': isNewSchemaNameDuplicate }"
          />
          <small v-if="isNewSchemaNameDuplicate" class="p-error">
            A schema with this name already exists.
          </small>
        </div>
        <div class="form-field">
          <label class="required">Type</label>
          <Select
            :modelValue="newSchemaKind"
            @update:modelValue="$emit('update:newSchemaKind', $event)"
            :options="[
              'object',
              'array',
              'string',
              'number',
              'integer',
              'boolean',
              'oneOf',
              'anyOf',
              'allOf',
            ]"
            placeholder="Select type"
          />
        </div>
        <div class="form-field">
          <label>Description</label>
          <Textarea
            :modelValue="newSchemaDescription"
            @update:modelValue="$emit('update:newSchemaDescription', $event)"
            rows="3"
            placeholder="What does this schema represent?"
          />
        </div>
        <small v-if="newSchemaKind === 'object'" class="helper-text">
          Next, quickly add a few properties — you can refine or add more afterward.
        </small>
        <small v-else class="helper-text">
          Format, enum values and other details can be added next, once the schema is created.
        </small>
      </template>

      <!-- Step 2: quick-start properties (object schemas only) -->
      <template v-else>
        <div class="section-header">
          <h5>Properties</h5>
          <Button label="Add Property" icon="pi pi-plus" size="small" @click="$emit('add-property')" />
        </div>

        <div v-if="newSchemaProperties.length === 0" class="empty-state-small">
          <p>No properties yet — add one, or skip and add properties later.</p>
        </div>

        <div v-for="(prop, index) in newSchemaProperties" :key="index" class="wizard-property-row">
          <InputText
            :modelValue="prop.name"
            @update:modelValue="prop.name = $event"
            placeholder="propertyName"
            class="wizard-property-row__name"
          />
          <Select
            :modelValue="prop.type"
            @update:modelValue="prop.type = $event"
            :options="['string', 'number', 'integer', 'boolean', 'array', 'object']"
            class="wizard-property-row__type"
          />
          <div class="wizard-property-row__required">
            <Checkbox
              :modelValue="prop.required"
              @update:modelValue="prop.required = $event"
              :inputId="'wizard-prop-required-' + index"
              :binary="true"
            />
            <label :for="'wizard-prop-required-' + index">Required</label>
          </div>
          <Button
            icon="pi pi-trash"
            severity="danger"
            text
            rounded
            size="small"
            @click="$emit('remove-property', index)"
          />
        </div>
      </template>
    </div>
    <template #footer>
      <Button label="Cancel" text @click="$emit('update:visible', false); $emit('cancel')" />
      <Button v-if="step === 2" label="Back" icon="pi pi-arrow-left" text @click="$emit('update:step', 1)" />
      <Button
        v-if="step === 1"
        :label="newSchemaKind === 'object' ? 'Next' : 'Create Schema'"
        :icon="newSchemaKind === 'object' ? 'pi pi-arrow-right' : 'pi pi-check'"
        :iconPos="newSchemaKind === 'object' ? 'right' : undefined"
        @click="$emit('next')"
        :disabled="!newSchemaName.trim() || isNewSchemaNameDuplicate"
      />
      <Button v-else label="Create Schema" icon="pi pi-check" @click="$emit('confirm')" />
    </template>
  </Dialog>
</template>

<script>
import "../../assets/form-editor-shared.css";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import Select from "primevue/select";
import Checkbox from "primevue/checkbox";

// The "Add New Schema" wizard: step 1 picks the name/type/description, and —
// for object schemas only — step 2 offers a quick-start property list before
// the schema is actually created. Non-object schemas (string/array/oneOf/...)
// have nothing essential to configure up front, so "Next" on step 1 creates
// them immediately. FormEditor.vue keeps ownership of every field and of the
// goToAddSchemaStep2()/confirmAddSchema()/cancelAddSchemaDialog() handlers,
// since they mutate the shared formData. Full property details (format,
// validation, $ref, etc.) stay out of the wizard — they're edited afterward
// in the already-guided schema editor, same pattern as AddPathDialog.
export default {
  name: "AddSchemaDialog",
  components: { Dialog, Button, InputText, Textarea, Select, Checkbox },
  props: {
    visible: { type: Boolean, default: false },
    step: { type: Number, default: 1 },
    newSchemaName: { type: String, default: "" },
    newSchemaKind: { type: String, default: "object" },
    newSchemaDescription: { type: String, default: "" },
    newSchemaProperties: { type: Array, default: () => [] },
    isNewSchemaNameDuplicate: { type: Boolean, default: false },
  },
  emits: [
    "update:visible",
    "update:step",
    "update:newSchemaName",
    "update:newSchemaKind",
    "update:newSchemaDescription",
    "add-property",
    "remove-property",
    "next",
    "cancel",
    "confirm",
  ],
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

.wizard-step__divider {
  flex: 1;
  height: 1px;
  background: #e5e7eb;
  max-width: 40px;
}

/* ── Quick-start property row ── */
.wizard-property-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.wizard-property-row__name {
  flex: 1.2;
}

.wizard-property-row__type {
  flex: 1;
}

.wizard-property-row__required {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
}

.wizard-property-row__required label {
  cursor: pointer;
}
</style>
