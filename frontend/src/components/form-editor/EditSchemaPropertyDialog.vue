<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    :header="isNew ? 'Add Property' : 'Edit Property'"
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

    <div v-if="property" class="dialog-content">
      <!-- Step 1: Basic Info -->
      <template v-if="step === 'basicInfo'">
        <div class="param-content">
          <div class="form-row">
            <div class="form-field">
              <label class="required">Property Name</label>
              <InputText
                :value="editingSchemaPropertyName"
                @input="renameSchemaPropertyInDialog($event.target.value)"
                placeholder="propertyName"
                :class="{ 'p-invalid': isEditingSchemaPropertyInvalid }"
              />
              <small v-if="isEditingSchemaPropertyInvalid" class="p-error">A property name is required.</small>
            </div>
            <div class="form-field">
              <label class="required">Type</label>
              <Select
                v-model="property.type"
                :options="['string', 'number', 'integer', 'boolean', 'array', 'object', '$ref']"
                placeholder="Type"
                @change="onPropertyTypeChange(property)"
              />
            </div>
          </div>

          <!-- $ref selector -->
          <div v-if="property.type === '$ref'" class="form-field">
            <label>Schema Reference</label>
            <div class="schema-selector">
              <Select
                v-model="property.$ref"
                :options="availableSchemas"
                optionLabel="label"
                optionValue="value"
                :placeholder="availableSchemas.length === 0 ? 'No schemas available' : 'Select schema'"
              />
              <Button
                label="New Schema"
                icon="pi pi-plus"
                size="small"
                text
                @click="openAddSchemaDialogFor(name => property.$ref = '#/components/schemas/' + name)"
              />
            </div>
          </div>
          <div v-else class="form-field">
            <label>Description</label>
            <InputText v-model="property.description" placeholder="Property description" />
          </div>
        </div>
      </template>

      <!-- Step 2: Type & Validation (not reachable for $ref properties) -->
      <div v-else-if="step === 'validation'" class="param-content">
        <div v-if="property.type === 'string'" class="form-field">
          <label>Format</label>
          <Select
            v-model="property.format"
            :options="['', 'date', 'date-time', 'password', 'byte', 'binary', 'email', 'uri', 'uuid', 'hostname', 'ipv4', 'ipv6']"
            placeholder="Format"
          />
        </div>
        <div v-else-if="property.type === 'number' || property.type === 'integer'" class="form-field">
          <label>Format</label>
          <Select
            v-model="property.format"
            :options="property.type === 'integer' ? ['', 'int32', 'int64'] : ['', 'float', 'double']"
            placeholder="Format"
          />
        </div>

        <!-- Array items: schema properties use a single item type, not the
             multi-type breakdown parameters/root schemas support. -->
        <template v-if="property.type === 'array' && property.items">
          <div class="form-field">
            <label>Array Items Type</label>
            <Select
              v-model="property.items.type"
              :options="['string', 'number', 'integer', 'boolean', 'object', '$ref']"
              placeholder="Items type"
            />
          </div>
          <div v-if="property.items.type === '$ref'" class="form-field">
            <label>Array Items Schema Reference</label>
            <div class="schema-selector">
              <Select
                v-model="property.items.$ref"
                :options="availableSchemas"
                optionLabel="label"
                optionValue="value"
                :placeholder="availableSchemas.length === 0 ? 'No schemas available' : 'Select schema'"
              />
              <Button
                label="New Schema"
                icon="pi pi-plus"
                size="small"
                text
                @click="openAddSchemaDialogFor(name => property.items.$ref = '#/components/schemas/' + name)"
              />
            </div>
          </div>
        </template>

        <div class="form-row">
          <div class="form-field">
            <label>Default Value</label>
            <InputText v-model="property.default" placeholder="Default value" />
          </div>
          <div class="form-field">
            <label>Example</label>
            <InputText v-model="property.example" placeholder="Example value" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-field checkbox-field">
            <Checkbox
              :modelValue="isEditingSchemaPropertyRequired"
              inputId="schemaprop-required"
              :binary="true"
              @update:modelValue="toggleEditingSchemaPropertyRequired"
            />
            <label for="schemaprop-required">Required</label>
          </div>
          <div class="form-field checkbox-field">
            <template v-if="isOpenAPI31">
              <Checkbox
                :modelValue="Array.isArray(property.type) && property.type.includes('null')"
                inputId="schemaprop-nullable"
                :binary="true"
                @update:modelValue="val => {
                  const base = Array.isArray(property.type) ? property.type.filter(t => t !== 'null') : [property.type || 'string'];
                  property.type = val ? [...base, 'null'] : (base.length === 1 ? base[0] : base);
                }"
              />
            </template>
            <template v-else>
              <Checkbox v-model="property.nullable" inputId="schemaprop-nullable" :binary="true" />
            </template>
            <label for="schemaprop-nullable">Nullable</label>
          </div>
        </div>

        <button
          type="button"
          class="validation-advanced-toggle"
          @click="showValidationRules = !showValidationRules"
        >
          <i :class="['pi', showValidationRules ? 'pi-chevron-down' : 'pi-chevron-right']"></i>
          {{ showValidationRules ? 'Hide validation rules' : 'Show validation rules' }}
          <span v-if="advancedFieldCount">({{ advancedFieldCount }} more)</span>
        </button>

        <div v-show="showValidationRules" class="validation-advanced">
          <!-- String validations -->
          <div v-if="property.type === 'string'" class="form-field">
            <label>Pattern</label>
            <InputText v-model="property.pattern" placeholder="^[a-zA-Z0-9]+$" />
          </div>
          <div v-if="property.type === 'string'" class="form-row">
            <div class="form-field">
              <label>Min Length</label>
              <InputNumber v-model="property.minLength" placeholder="Min length" :min="0" />
            </div>
            <div class="form-field">
              <label>Max Length</label>
              <InputNumber v-model="property.maxLength" placeholder="Max length" :min="0" />
            </div>
          </div>

          <!-- Number/Integer validations -->
          <div v-if="property.type === 'number' || property.type === 'integer'" class="form-row">
            <div class="form-field">
              <label>Minimum</label>
              <InputNumber v-model="property.minimum" placeholder="Min value" />
            </div>
            <div class="form-field">
              <label>Maximum</label>
              <InputNumber v-model="property.maximum" placeholder="Max value" />
            </div>
          </div>
          <div v-if="property.type === 'number' || property.type === 'integer'" class="form-field">
            <label>Multiple Of</label>
            <InputNumber v-model="property.multipleOf" placeholder="Multiple of" :min="0" />
          </div>
          <div v-if="property.type === 'number' || property.type === 'integer'" class="form-row">
            <template v-if="isOpenAPI31">
              <div class="form-field">
                <label>Exclusive Minimum</label>
                <InputNumber v-model="property.exclusiveMinimum" placeholder="Exclusive min" />
              </div>
              <div class="form-field">
                <label>Exclusive Maximum</label>
                <InputNumber v-model="property.exclusiveMaximum" placeholder="Exclusive max" />
              </div>
            </template>
            <template v-else>
              <div class="form-field checkbox-field">
                <Checkbox v-model="property.exclusiveMinimum" inputId="schemaprop-excl-min" :binary="true" />
                <label for="schemaprop-excl-min">Exclusive Minimum</label>
              </div>
              <div class="form-field checkbox-field">
                <Checkbox v-model="property.exclusiveMaximum" inputId="schemaprop-excl-max" :binary="true" />
                <label for="schemaprop-excl-max">Exclusive Maximum</label>
              </div>
            </template>
          </div>

          <!-- Array validations -->
          <div v-if="property.type === 'array'" class="form-row">
            <div class="form-field">
              <label>Min Items</label>
              <InputNumber v-model="property.minItems" placeholder="Min items" :min="0" />
            </div>
            <div class="form-field">
              <label>Max Items</label>
              <InputNumber v-model="property.maxItems" placeholder="Max items" :min="0" />
            </div>
          </div>
          <div v-if="property.type === 'array'" class="form-field checkbox-field">
            <Checkbox v-model="property.uniqueItems" inputId="schemaprop-unique" :binary="true" />
            <label for="schemaprop-unique">Unique Items</label>
          </div>

          <!-- Enum values -->
          <div class="form-field">
            <label>Enum Values</label>
            <AutoComplete
              multiple
              typeahead
              v-model="property.enum"
              :suggestions="[]"
              placeholder="Add value and press Enter"
              @keydown.enter.prevent="addChipOnEnter($event, property, 'enum')"
            />
          </div>
        </div>
      </div>
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
        :disabled="isEditingSchemaPropertyInvalid"
      />
      <Button v-else label="Done" icon="pi pi-check" @click="$emit('finish')" :disabled="isEditingSchemaPropertyInvalid" />
    </template>
  </Dialog>
</template>

<script>
import { computed, ref, watch } from "vue";
import "../../assets/form-editor-shared.css";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Select from "primevue/select";
import Checkbox from "primevue/checkbox";
import AutoComplete from "primevue/autocomplete";

// The "Add/Edit Property" wizard for a component schema's properties — same
// two-step shape as EditPropertyDialog.vue (request body properties), just
// wired to useComponentsEditor.js's schema-property dialog state instead of
// usePathsEditor.js's request-body one. A schema property additionally
// needs an *owner* schema name tracked (api.editingSchemaPropertyOwner),
// since ComponentsTab can have many schemas' property lists in play at
// once, unlike a request body which only ever has "the current operation's".
// `api` here is componentsApi (not pathsApi) — see FormEditor.vue.
const BASIC_STEPS = [
  { key: "basicInfo", label: "Basic Info" },
  { key: "validation", label: "Type & Validation" },
];
const REF_STEPS = [{ key: "basicInfo", label: "Basic Info" }];

export default {
  name: "EditSchemaPropertyDialog",
  components: { Dialog, Button, InputText, InputNumber, Select, Checkbox, AutoComplete },
  props: {
    visible: { type: Boolean, default: false },
    step: { type: String, default: "basicInfo" },
    isNew: { type: Boolean, default: false },
    api: { type: Object, required: true },
  },
  emits: ["update:visible", "back", "next", "cancel", "finish"],
  setup(props) {
    const property = computed(() => props.api.editingSchemaProperty.value);
    const steps = computed(() => (property.value?.type === "$ref" ? REF_STEPS : BASIC_STEPS));
    const stepIndex = computed(() => steps.value.findIndex((s) => s.key === props.step));

    const showValidationRules = ref(false);
    watch(
      () => props.visible,
      (visible) => {
        if (visible) showValidationRules.value = false;
      },
    );

    const advancedFieldCount = computed(() => {
      const type = property.value?.type;
      let count = 1; // enum — shown for every non-$ref property type
      if (type === "string") count += 3; // pattern, minLength, maxLength
      if (type === "number" || type === "integer") count += 5; // min, max, multipleOf, exclusiveMin, exclusiveMax
      if (type === "array") count += 3; // minItems, maxItems, uniqueItems
      return count;
    });

    return {
      ...props.api,
      property,
      steps,
      stepIndex,
      showValidationRules,
      advancedFieldCount,
    };
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
