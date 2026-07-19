<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    :header="isNew ? 'Add Parameter' : 'Edit Parameter'"
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

    <div v-if="parameter" class="dialog-content">
      <!-- Step 1: Basic Info -->
      <template v-if="step === 'basicInfo'">
        <!-- Path parameter lock banner -->
        <div v-if="parameter.in === 'path'" class="path-param-banner">
          <i class="pi pi-lock"></i>
          <span>Path parameter — edit the path template to rename or remove</span>
        </div>

        <!-- Reusable-parameter toggle (path params can't be reusable —
             they're structurally tied to the path template) -->
        <div v-if="parameter.in !== 'path'" class="reusable-ref-toggle">
          <Button
            v-if="!isParameterRef(parameter)"
            label="Use existing reusable parameter"
            icon="pi pi-link"
            size="small"
            text
            @click="convertEditingParameterToRef"
          />
          <Button
            v-if="!isParameterRef(parameter)"
            label="Save as reusable parameter"
            icon="pi pi-save"
            size="small"
            text
            v-tooltip.top="'Make this parameter available to any operation, instead of redefining it each time'"
            @click="promoteEditingParameterToReusable"
          />
          <Button
            v-else
            label="Define inline instead"
            icon="pi pi-pencil"
            size="small"
            text
            @click="convertEditingParameterToInline"
          />
        </div>

        <div v-if="isParameterRef(parameter)" class="param-content">
          <div class="form-field">
            <label class="required">Reusable Parameter</label>
            <div class="tags-select-row">
              <Select
                v-model="parameter.$ref"
                :options="availableParameters"
                optionLabel="label"
                optionValue="value"
                :placeholder="availableParameters.length ? 'Select a reusable parameter' : 'No reusable parameters yet'"
                class="tags-select-row__select"
              />
              <Button
                icon="pi pi-plus"
                size="small"
                text
                rounded
                v-tooltip.top="'Define a new reusable parameter'"
                @click="onCreateReusableParameter"
              />
            </div>
            <small class="helper-text">
              New reusable parameters start blank — configure them from the Reusable Parameters section.
            </small>
          </div>
        </div>

        <div v-else class="param-content">
          <div class="form-row">
            <div class="form-field">
              <label class="required">Name</label>
              <InputText
                v-model="parameter.name"
                placeholder="id"
                :disabled="parameter.in === 'path'"
                :class="{ 'p-invalid': isEditingParameterDuplicate }"
              />
              <small v-if="isEditingParameterDuplicate" class="p-error">
                Another {{ parameter.in }} parameter already uses this name.
              </small>
            </div>
            <div class="form-field">
              <label class="required">Location</label>
              <Select
                v-model="parameter.in"
                :options="['query', 'header', 'cookie']"
                placeholder="Select location"
                :disabled="parameter.in === 'path'"
              />
            </div>
          </div>
          <div class="form-field">
            <label>Description</label>
            <InputText v-model="parameter.description" placeholder="Parameter description" />
          </div>
        </div>
      </template>

      <!-- Step 2: Type -->
      <div v-else-if="step === 'type'" class="param-content">
        <div class="form-field">
          <label class="required">Type</label>
          <Select
            v-model="parameter.schema.type"
            :options="['string', 'number', 'integer', 'boolean', 'array', 'object']"
            placeholder="Type"
            @change="onPropertyTypeChange(parameter.schema)"
          />
        </div>
        <template v-if="parameter.schema.type === 'array'">
          <div class="form-field">
            <label>Items Type(s)</label>
            <MultiSelect
              :modelValue="parameter.schema._itemSchemas ? [...new Set(parameter.schema._itemSchemas.map(s => s.type))] : []"
              :options="['string','number','integer','boolean','object']"
              placeholder="Select one or more types"
              display="chip"
              @update:modelValue="onItemTypesChange(parameter.schema, $event)"
            />
          </div>
          <!-- Per-type schema sections -->
          <div v-if="parameter.schema._itemSchemas && parameter.schema._itemSchemas.length > 0" class="item-schemas-list">
            <div
              v-for="(itemSchema, sIdx) in parameter.schema._itemSchemas"
              :key="sIdx"
              class="item-schema-entry"
            >
              <div class="item-schema-entry-header">
                <span :class="['type-badge', 'type-badge--' + itemSchema.type]">{{ itemSchema.type }}</span>
                <span v-if="itemSchema.type === 'object' && itemSchema.$ref" class="item-schema-ref-label">{{ itemSchema.$ref.split('/').pop() }}</span>
                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  size="small"
                  class="item-schema-remove"
                  v-tooltip.top="'Remove this type entry'"
                  @click="parameter.schema._itemSchemas.splice(sIdx, 1)"
                />
              </div>
              <div class="item-schema-entry-body">
                <!-- object: $ref picker + add more objects -->
                <template v-if="itemSchema.type === 'object'">
                  <div class="form-field">
                    <label>Schema Reference</label>
                    <div class="schema-selector">
                      <Select
                        v-model="itemSchema.$ref"
                        :options="availableSchemas.filter(s => s.value === itemSchema.$ref || !parameter.schema._itemSchemas.some(other => other !== itemSchema && other.type === 'object' && other.$ref === s.value))"
                        optionLabel="label"
                        optionValue="value"
                        :placeholder="availableSchemas.filter(s => s.value === itemSchema.$ref || !parameter.schema._itemSchemas.some(other => other !== itemSchema && other.type === 'object' && other.$ref === s.value)).length === 0 ? 'No schemas available' : 'Select schema'"
                        :disabled="availableSchemas.filter(s => s.value === itemSchema.$ref || !parameter.schema._itemSchemas.some(other => other !== itemSchema && other.type === 'object' && other.$ref === s.value)).length === 0"
                      />
                      <Button
                        label="New Schema"
                        icon="pi pi-plus"
                        size="small"
                        text
                        @click="addSchema"
                      />
                    </div>
                    <small
                      v-if="availableSchemas.filter(s => s.value === itemSchema.$ref || !parameter.schema._itemSchemas.some(other => other !== itemSchema && other.type === 'object' && other.$ref === s.value)).length === 0"
                      class="helper-text"
                    >{{ availableSchemas.length === 0 ? 'No schemas yet — create one first.' : 'All schemas are already used — create a new one.' }}</small>
                  </div>
                  <Button
                    v-if="sIdx === parameter.schema._itemSchemas.map((s,i) => s.type === 'object' ? i : -1).filter(i => i >= 0).slice(-1)[0]"
                    label="Add another object schema"
                    icon="pi pi-plus"
                    size="small"
                    text
                    class="mt-1"
                    @click="parameter.schema._itemSchemas.splice(sIdx + 1, 0, { type: 'object', $ref: '' })"
                  />
                </template>
                <!-- string validations -->
                <template v-else-if="itemSchema.type === 'string'">
                  <div class="form-row">
                    <div class="form-field">
                      <label>Format</label>
                      <Select v-model="itemSchema.format" :options="['','date','date-time','email','uri','uuid','hostname','ipv4','ipv6']" placeholder="Format" />
                    </div>
                    <div class="form-field">
                      <label>Pattern</label>
                      <InputText v-model="itemSchema.pattern" placeholder="^[a-zA-Z0-9]+$" />
                    </div>
                  </div>
                  <div class="form-row">
                    <div class="form-field">
                      <label>Min Length</label>
                      <InputNumber v-model="itemSchema.minLength" placeholder="Min length" :min="0" />
                    </div>
                    <div class="form-field">
                      <label>Max Length</label>
                      <InputNumber v-model="itemSchema.maxLength" placeholder="Max length" :min="0" />
                    </div>
                  </div>
                </template>
                <!-- number / integer validations -->
                <template v-else-if="itemSchema.type === 'number' || itemSchema.type === 'integer'">
                  <div class="form-row">
                    <div class="form-field">
                      <label>Format</label>
                      <Select v-model="itemSchema.format" :options="itemSchema.type === 'integer' ? ['','int32','int64'] : ['','float','double']" placeholder="Format" />
                    </div>
                    <div class="form-field">
                      <label>Multiple Of</label>
                      <InputNumber v-model="itemSchema.multipleOf" placeholder="Multiple of" :min="0" />
                    </div>
                  </div>
                  <div class="form-row">
                    <div class="form-field">
                      <label>Minimum</label>
                      <InputNumber v-model="itemSchema.minimum" placeholder="Min value" />
                    </div>
                    <div class="form-field">
                      <label>Maximum</label>
                      <InputNumber v-model="itemSchema.maximum" placeholder="Max value" />
                    </div>
                  </div>
                  <div class="form-row">
                    <template v-if="isOpenAPI31">
                      <div class="form-field">
                        <label :for="'item-excl-min-' + sIdx">Exclusive Minimum</label>
                        <InputNumber v-model="itemSchema.exclusiveMinimum" :inputId="'item-excl-min-' + sIdx" placeholder="Exclusive min value" />
                      </div>
                      <div class="form-field">
                        <label :for="'item-excl-max-' + sIdx">Exclusive Maximum</label>
                        <InputNumber v-model="itemSchema.exclusiveMaximum" :inputId="'item-excl-max-' + sIdx" placeholder="Exclusive max value" />
                      </div>
                    </template>
                    <template v-else>
                      <div class="form-field checkbox-field">
                        <Checkbox v-model="itemSchema.exclusiveMinimum" :inputId="'item-excl-min-' + sIdx" :binary="true" />
                        <label :for="'item-excl-min-' + sIdx">Exclusive Minimum</label>
                      </div>
                      <div class="form-field checkbox-field">
                        <Checkbox v-model="itemSchema.exclusiveMaximum" :inputId="'item-excl-max-' + sIdx" :binary="true" />
                        <label :for="'item-excl-max-' + sIdx">Exclusive Maximum</label>
                      </div>
                    </template>
                  </div>
                </template>
                <!-- boolean: no constraints -->
                <template v-else-if="itemSchema.type === 'boolean'">
                  <p class="helper-text">No additional constraints for boolean.</p>
                </template>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Step 3: Validation -->
      <div v-else-if="step === 'validation'" class="param-content">
        <!-- String validations -->
        <div v-if="parameter.schema.type === 'string'" class="form-row">
          <div class="form-field">
            <label>Format</label>
            <Select
              v-model="parameter.schema.format"
              :options="['', 'date', 'date-time', 'email', 'uri', 'uuid', 'hostname', 'ipv4', 'ipv6']"
              placeholder="Format"
            />
          </div>
          <div class="form-field">
            <label>Pattern</label>
            <InputText v-model="parameter.schema.pattern" placeholder="^[a-zA-Z0-9]+$" />
          </div>
        </div>

        <div v-if="parameter.schema.type === 'string'" class="form-row">
          <div class="form-field">
            <label>Min Length</label>
            <InputNumber v-model="parameter.schema.minLength" placeholder="Min length" :min="0" />
          </div>
          <div class="form-field">
            <label>Max Length</label>
            <InputNumber v-model="parameter.schema.maxLength" placeholder="Max length" :min="0" />
          </div>
        </div>

        <!-- Number/Integer validations -->
        <div
          v-if="parameter.schema.type === 'number' || parameter.schema.type === 'integer'"
          class="form-row"
        >
          <div class="form-field">
            <label>Minimum</label>
            <InputNumber v-model="parameter.schema.minimum" placeholder="Min value" />
          </div>
          <div class="form-field">
            <label>Maximum</label>
            <InputNumber v-model="parameter.schema.maximum" placeholder="Max value" />
          </div>
        </div>

        <div
          v-if="parameter.schema.type === 'number' || parameter.schema.type === 'integer'"
          class="form-row"
        >
          <div class="form-field">
            <label>Format</label>
            <Select
              v-model="parameter.schema.format"
              :options="parameter.schema.type === 'integer' ? ['', 'int32', 'int64'] : ['', 'float', 'double']"
              placeholder="Format"
            />
          </div>
          <div class="form-field">
            <label>Multiple Of</label>
            <InputNumber v-model="parameter.schema.multipleOf" placeholder="Multiple of" :min="0" />
          </div>
        </div>

        <div
          v-if="parameter.schema.type === 'number' || parameter.schema.type === 'integer'"
          class="form-row"
        >
          <template v-if="isOpenAPI31">
            <div class="form-field">
              <label for="param-excl-min">Exclusive Minimum</label>
              <InputNumber v-model="parameter.schema.exclusiveMinimum" inputId="param-excl-min" placeholder="Exclusive min value" />
            </div>
            <div class="form-field">
              <label for="param-excl-max">Exclusive Maximum</label>
              <InputNumber v-model="parameter.schema.exclusiveMaximum" inputId="param-excl-max" placeholder="Exclusive max value" />
            </div>
          </template>
          <template v-else>
            <div class="form-field checkbox-field">
              <Checkbox v-model="parameter.schema.exclusiveMinimum" inputId="param-excl-min" :binary="true" />
              <label for="param-excl-min">Exclusive Minimum</label>
            </div>
            <div class="form-field checkbox-field">
              <Checkbox v-model="parameter.schema.exclusiveMaximum" inputId="param-excl-max" :binary="true" />
              <label for="param-excl-max">Exclusive Maximum</label>
            </div>
          </template>
        </div>

        <!-- Array validations -->
        <div v-if="parameter.schema.type === 'array'" class="form-row" style="margin-top: 0.75rem;">
          <div class="form-field">
            <label>Min Items</label>
            <InputNumber v-model="parameter.schema.minItems" placeholder="Min items" :min="0" />
          </div>
          <div class="form-field">
            <label>Max Items</label>
            <InputNumber v-model="parameter.schema.maxItems" placeholder="Max items" :min="0" />
          </div>
        </div>

        <div v-if="parameter.schema.type === 'array'" class="form-field checkbox-field">
          <Checkbox v-model="parameter.schema.uniqueItems" inputId="param-unique" :binary="true" />
          <label for="param-unique">Unique Items</label>
        </div>

        <!-- Enum values -->
        <div class="form-field" v-if="parameter.schema.type !== 'object'">
          <label>Enum Values (optional)</label>
          <AutoComplete
            multiple
            typeahead
            v-model="parameter.schema.enum"
            :suggestions="[]"
            placeholder="Add enum value and press Enter"
            @keydown.enter.prevent="addChipOnEnter($event, parameter.schema, 'enum')"
          />
        </div>

        <div class="form-field">
          <label>Default Value</label>
          <InputText v-model="parameter.schema.default" placeholder="Default value" />
        </div>

        <div class="form-field">
          <label>Example</label>
          <InputText v-model="parameter.schema.example" placeholder="Example value" />
        </div>

        <div class="form-row">
          <div class="form-field checkbox-field">
            <Checkbox v-model="parameter.required" inputId="param-required" :binary="true" />
            <label for="param-required">Required</label>
          </div>
          <div class="form-field checkbox-field">
            <template v-if="isOpenAPI31">
              <Checkbox
                :modelValue="Array.isArray(parameter.schema.type) && parameter.schema.type.includes('null')"
                inputId="param-nullable"
                :binary="true"
                @update:modelValue="val => {
                  const base = Array.isArray(parameter.schema.type) ? parameter.schema.type.filter(t => t !== 'null') : [parameter.schema.type || 'string'];
                  parameter.schema.type = val ? [...base, 'null'] : (base.length === 1 ? base[0] : base);
                }"
              />
            </template>
            <template v-else>
              <Checkbox v-model="parameter.schema.nullable" inputId="param-nullable" :binary="true" />
            </template>
            <label for="param-nullable">Nullable</label>
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
        :disabled="isEditingParameterInvalid"
      />
      <Button v-else label="Done" icon="pi pi-check" @click="$emit('finish')" :disabled="isEditingParameterInvalid" />
    </template>
  </Dialog>
</template>

<script>
import { computed } from "vue";
import "../../assets/form-editor-shared.css";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Select from "primevue/select";
import MultiSelect from "primevue/multiselect";
import Checkbox from "primevue/checkbox";
import AutoComplete from "primevue/autocomplete";

// The "Add/Edit Parameter" wizard — same shape as AddTagDialog/
// AddMethodDialog: FormEditor.vue keeps ownership of the step state
// (parameterDialogStep/goToNextParameterStep/.../cancelParameterDialog, all
// in usePathsEditor.js), this component is just presentational. Three steps
// (Basic Info / Type / Validation) for an inline parameter, but a $ref
// parameter has nothing to type/validate — ALL_STEPS collapses to just
// Basic Info for it, computed reactively so toggling inline<->ref mid-dialog
// (via the buttons on step 1) updates the step rail immediately. `api` is
// the same usePathsEditor() bundle every operation step receives; the
// parameter being edited (api.editingParameter) is the live object at
// api.selectedPath/selectedMethod's current editingParameterIndex, so
// v-model here mutates formData directly like every other dialog.
const ALL_STEPS = [
  { key: "basicInfo", label: "Basic Info" },
  { key: "type", label: "Type" },
  { key: "validation", label: "Validation" },
];
const REF_STEPS = [{ key: "basicInfo", label: "Basic Info" }];

export default {
  name: "EditParameterDialog",
  components: { Dialog, Button, InputText, InputNumber, Select, MultiSelect, Checkbox, AutoComplete },
  props: {
    visible: { type: Boolean, default: false },
    step: { type: String, default: "basicInfo" },
    isNew: { type: Boolean, default: false },
    api: { type: Object, required: true },
  },
  emits: ["update:visible", "back", "next", "cancel", "finish"],
  setup(props) {
    const parameter = computed(() => props.api.editingParameter.value);
    const steps = computed(() =>
      props.api.isParameterRef(parameter.value) ? REF_STEPS : ALL_STEPS,
    );
    const stepIndex = computed(() => steps.value.findIndex((s) => s.key === props.step));

    const onCreateReusableParameter = () => {
      const name = props.api.addReusableParameter();
      if (parameter.value) parameter.value.$ref = `#/components/parameters/${name}`;
    };

    return {
      ...props.api,
      parameter,
      steps,
      stepIndex,
      onCreateReusableParameter,
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
