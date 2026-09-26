<template>
  <Dialog
    :visible="visible"
    :header="isNew ? 'Add Schema' : 'Edit Schema'"
    :style="{ width: '680px' }"
    modal
    :draggable="false"
    @update:visible="$emit('update:visible', $event)"
    @hide="$emit('cancel')"
  >
    <div v-if="!showJson" class="wizard-steps">
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

    <div v-if="schemaData" class="dialog-content">
      <!-- Raw JSON escape hatch — replaces the whole step area, same schema
           object either way, so switching back to the builder always
           reflects whatever was typed here. -->
      <div v-if="showJson" class="schema-json-editor">
        <div class="json-editor-header">
          <label>Schema JSON</label>
          <div class="json-editor-actions">
            <Button
              label="Format"
              icon="pi pi-align-left"
              size="small"
              text
              @click="updateSchema(editingSchemaName, JSON.stringify(JSON.parse(JSON.stringify(schemaData, null, 2)), null, 2))"
            />
            <Button
              label="Copy"
              icon="pi pi-copy"
              size="small"
              text
              @click="navigator.clipboard.writeText(JSON.stringify(schemaData, null, 2))"
            />
          </div>
        </div>
        <div class="json-editor-wrapper">
          <Textarea
            :value="JSON.stringify(schemaData, null, 2)"
            rows="16"
            class="json-textarea monaco-style"
            spellcheck="false"
            @input="updateSchema(editingSchemaName, $event.target.value)"
          />
        </div>
      </div>

      <template v-else>
        <!-- Step 1: Basic Info -->
        <template v-if="step === 'basicInfo'">
          <div class="form-row">
            <div class="form-field">
              <label class="required">Schema Name</label>
              <InputText
                :value="editingSchemaName"
                placeholder="SchemaName"
                :class="{ 'p-invalid': isEditingSchemaNameInvalid }"
                @input="renameSchemaInDialog($event.target.value)"
              />
              <small v-if="isEditingSchemaNameInvalid" class="p-error">A schema name is required.</small>
            </div>
            <div class="form-field">
              <label class="required">Type</label>
              <Select
                :model-value="getSchemaKind(schemaData)"
                :options="['object', 'array', 'string', 'number', 'integer', 'boolean', 'oneOf', 'anyOf', 'allOf']"
                placeholder="Select type"
                @update:model-value="setSchemaKind(schemaData, $event)"
              />
            </div>
          </div>
          <div class="form-field">
            <label>Description</label>
            <Textarea v-model="schemaData.description" rows="3" placeholder="What does this schema represent?" />
          </div>
        </template>

        <!-- Step 2a: Composition (oneOf/anyOf/allOf) -->
        <template v-else-if="step === 'composition'">
          <div class="form-field">
            <label class="required">Member Schemas</label>
            <MultiSelect
              :model-value="compositionMemberRefs(schemaData, getSchemaKind(schemaData))"
              :options="availableSchemas.filter((s) => s.label !== editingSchemaName)"
              option-label="label"
              option-value="value"
              display="chip"
              placeholder="Select the schemas that make up this composition"
              @update:model-value="setCompositionMembers(schemaData, getSchemaKind(schemaData), $event)"
            />
            <small class="helper-text">
              {{
                getSchemaKind(schemaData) === 'allOf'
                  ? 'The resulting schema must satisfy ALL of the selected schemas.'
                  : getSchemaKind(schemaData) === 'oneOf'
                    ? 'The resulting schema must satisfy EXACTLY ONE of the selected schemas.'
                    : 'The resulting schema must satisfy AT LEAST ONE of the selected schemas.'
              }}
            </small>
          </div>

          <div v-if="getSchemaKind(schemaData) !== 'allOf'" class="form-field checkbox-field">
            <Checkbox
              :model-value="!!schemaData.discriminator"
              input-id="discriminator-enabled"
              :binary="true"
              @update:model-value="setDiscriminatorEnabled(schemaData, $event)"
            />
            <label for="discriminator-enabled">
              Use a discriminator (tells readers which member schema applies, by property value)
            </label>
          </div>

          <template v-if="schemaData.discriminator">
            <div class="form-field">
              <label class="required">Discriminator Property</label>
              <InputText v-model="schemaData.discriminator.propertyName" placeholder="e.g. petType" />
            </div>

            <div class="section-header">
              <button type="button" class="section-header__toggle" @click="showMapping = !showMapping">
                <i class="pi pi-chevron-right method-section-caret" :class="{ 'method-section-caret--open': showMapping }"></i>
                <h5>Mapping (optional)</h5>
                <span
                  v-if="schemaData.discriminator.mapping && Object.keys(schemaData.discriminator.mapping).length"
                  class="section-header__count"
                >{{ Object.keys(schemaData.discriminator.mapping).length }}</span>
              </button>
              <Button
                label="Add Mapping"
                icon="pi pi-plus"
                size="small"
                text
                @click="showMapping = true; addDiscriminatorMapping(schemaData)"
              />
            </div>
            <div v-show="showMapping">
              <small class="helper-text">
                If omitted, the discriminator property's value is matched against member schema names directly.
              </small>
              <div v-for="(ref, key) in schemaData.discriminator.mapping" :key="key" class="list-item">
                <div class="list-item-content">
                  <div class="form-row">
                    <div class="form-field">
                      <label>Property Value</label>
                      <InputText :value="key" @input="renameDiscriminatorMappingKey(schemaData, key, $event.target.value)" />
                    </div>
                    <div class="form-field">
                      <label>Schema</label>
                      <Select v-model="schemaData.discriminator.mapping[key]" :options="availableSchemas" option-label="label" option-value="value" />
                    </div>
                  </div>
                </div>
                <Button icon="pi pi-trash" severity="danger" text rounded @click="removeDiscriminatorMapping(schemaData, key)" />
              </div>
            </div>
          </template>
        </template>

        <!-- Step 2b: Properties (object) -->
        <template v-else-if="step === 'properties'">
          <div class="section-header">
            <h5>Properties</h5>
            <span v-if="schemaData.properties && Object.keys(schemaData.properties).length" class="section-header__count">
              {{ Object.keys(schemaData.properties).length }}
            </span>
            <Button label="Add Property" icon="pi pi-plus" size="small" @click="openAddSchemaPropertyDialog(editingSchemaName)" />
          </div>

          <div
            v-if="!schemaData.properties || Object.keys(schemaData.properties).length === 0"
            class="empty-state-small"
          >
            <p>No properties defined</p>
          </div>

          <div
            v-for="(prop, propName, propIndex) in schemaData.properties"
            :key="propName"
            class="param-item"
            draggable="true"
            :class="{ dragging: draggedProperty === propName }"
            @dragstart="handleDragStart($event, editingSchemaName, propName, propIndex)"
            @dragover="handleDragOver($event)"
            @drop="handleDrop($event, editingSchemaName, propIndex)"
            @dragend="handleDragEnd"
          >
            <div class="item-row-header" @click="openEditSchemaPropertyDialog(editingSchemaName, propName)">
              <div class="drag-handle" title="Drag to reorder">
                <i class="pi pi-bars"></i>
              </div>
              <span class="item-row-name">{{ propName }}</span>
              <div class="item-row-badges">
                <Tag v-if="prop.type === '$ref'" value="ref" severity="info" />
                <template v-else>
                  <span :class="['type-badge', 'type-badge--' + (Array.isArray(prop.type) ? prop.type.find(t => t !== 'null') : prop.type)]">
                    {{ Array.isArray(prop.type) ? prop.type.join(' | ') : prop.type }}
                  </span>
                  <Tag v-if="schemaData.required?.includes(propName)" value="required" severity="warn" />
                </template>
              </div>
              <Button
                icon="pi pi-pencil"
                text
                rounded
                size="small"
                class="item-row-edit"
                @click.stop="openEditSchemaPropertyDialog(editingSchemaName, propName)"
              />
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                size="small"
                class="item-row-delete"
                @click.stop="removeSchemaProperty(editingSchemaName, propName)"
              />
            </div>
          </div>

          <div class="form-row" style="margin-top: 0.75rem;">
            <div class="form-field">
              <label>Min Properties</label>
              <InputNumber v-model="schemaData.minProperties" placeholder="Min properties" :min="0" />
            </div>
            <div class="form-field">
              <label>Max Properties</label>
              <InputNumber v-model="schemaData.maxProperties" placeholder="Max properties" :min="0" />
            </div>
          </div>
          <div class="form-field checkbox-field">
            <Checkbox
              v-model="schemaData.additionalProperties"
              input-id="schema-addl-props"
              :binary="true"
              :true-value="true"
              :false-value="false"
            />
            <label for="schema-addl-props">Allow Additional Properties</label>
          </div>
        </template>

        <!-- Step 2c: Validation (string/number/integer/boolean/array) -->
        <template v-else-if="step === 'validation'">
          <div v-if="schemaData.type === 'string'" class="form-field">
            <label>Format</label>
            <Select
              v-model="schemaData.format"
              :options="['', 'date', 'date-time', 'password', 'byte', 'binary', 'email', 'uri', 'uuid', 'hostname', 'ipv4', 'ipv6']"
              placeholder="Format"
            />
          </div>
          <div v-else-if="schemaData.type === 'number' || schemaData.type === 'integer'" class="form-field">
            <label>Format</label>
            <Select
              v-model="schemaData.format"
              :options="schemaData.type === 'integer' ? ['', 'int32', 'int64'] : ['', 'float', 'double']"
              placeholder="Format"
            />
          </div>

          <template v-if="schemaData.type === 'array'">
            <div v-if="schemaData.items" class="form-field">
              <label>Array Items Type</label>
              <Select
                v-model="schemaData.items.type"
                :options="['string', 'number', 'integer', 'boolean', 'object', '$ref']"
                placeholder="Items type"
              />
            </div>
            <div v-if="schemaData.items && schemaData.items.type === '$ref'" class="form-field">
              <label>Array Items Schema Reference</label>
              <div class="schema-selector">
                <Select
                  v-model="schemaData.items.$ref"
                  :options="availableSchemas"
                  option-label="label"
                  option-value="value"
                  :placeholder="availableSchemas.length === 0 ? 'No schemas available' : 'Select schema'"
                />
                <Button
                  label="New Schema"
                  icon="pi pi-plus"
                  size="small"
                  text
                  @click="openAddSchemaDialogFor(name => schemaData.items.$ref = '#/components/schemas/' + name)"
                />
              </div>
            </div>
          </template>

          <div class="form-row">
            <div class="form-field">
              <label>Default Value</label>
              <InputText v-model="schemaData.default" placeholder="Default value" />
            </div>
            <div class="form-field">
              <label>Example</label>
              <InputText v-model="schemaData.example" placeholder="Example value" />
            </div>
          </div>
          <div class="form-field checkbox-field">
            <template v-if="isOpenAPI31">
              <Checkbox
                :model-value="Array.isArray(schemaData.type) && schemaData.type.includes('null')"
                input-id="schema-nullable"
                :binary="true"
                @update:model-value="val => {
                  const base = Array.isArray(schemaData.type) ? schemaData.type.filter(t => t !== 'null') : [schemaData.type || 'string'];
                  schemaData.type = val ? [...base, 'null'] : (base.length === 1 ? base[0] : base);
                }"
              />
            </template>
            <template v-else>
              <Checkbox v-model="schemaData.nullable" input-id="schema-nullable" :binary="true" />
            </template>
            <label for="schema-nullable">Nullable</label>
          </div>

          <button type="button" class="validation-advanced-toggle" @click="showValidationRules = !showValidationRules">
            <i :class="['pi', showValidationRules ? 'pi-chevron-down' : 'pi-chevron-right']"></i>
            {{ showValidationRules ? 'Hide validation rules' : 'Show validation rules' }}
          </button>

          <div v-show="showValidationRules" class="validation-advanced">
            <div v-if="schemaData.type === 'string'" class="form-field">
              <label>Pattern</label>
              <InputText v-model="schemaData.pattern" placeholder="^[a-zA-Z0-9]+$" />
            </div>
            <div v-if="schemaData.type === 'string'" class="form-row">
              <div class="form-field">
                <label>Min Length</label>
                <InputNumber v-model="schemaData.minLength" placeholder="Min length" :min="0" />
              </div>
              <div class="form-field">
                <label>Max Length</label>
                <InputNumber v-model="schemaData.maxLength" placeholder="Max length" :min="0" />
              </div>
            </div>

            <template v-if="schemaData.type === 'number' || schemaData.type === 'integer'">
              <div class="form-row">
                <div class="form-field">
                  <label>Minimum</label>
                  <InputNumber v-model="schemaData.minimum" placeholder="Min value" />
                </div>
                <div class="form-field">
                  <label>Maximum</label>
                  <InputNumber v-model="schemaData.maximum" placeholder="Max value" />
                </div>
              </div>
              <div class="form-field">
                <label>Multiple Of</label>
                <InputNumber v-model="schemaData.multipleOf" placeholder="Multiple of" :min="0" />
              </div>
              <div class="form-row">
                <template v-if="isOpenAPI31">
                  <div class="form-field">
                    <label for="schema-excl-min">Exclusive Minimum</label>
                    <InputNumber v-model="schemaData.exclusiveMinimum" input-id="schema-excl-min" placeholder="Exclusive min value" />
                  </div>
                  <div class="form-field">
                    <label for="schema-excl-max">Exclusive Maximum</label>
                    <InputNumber v-model="schemaData.exclusiveMaximum" input-id="schema-excl-max" placeholder="Exclusive max value" />
                  </div>
                </template>
                <template v-else>
                  <div class="form-field checkbox-field">
                    <Checkbox v-model="schemaData.exclusiveMinimum" input-id="schema-excl-min" :binary="true" />
                    <label for="schema-excl-min">Exclusive Minimum</label>
                  </div>
                  <div class="form-field checkbox-field">
                    <Checkbox v-model="schemaData.exclusiveMaximum" input-id="schema-excl-max" :binary="true" />
                    <label for="schema-excl-max">Exclusive Maximum</label>
                  </div>
                </template>
              </div>
            </template>

            <template v-if="schemaData.type === 'array'">
              <div class="form-row">
                <div class="form-field">
                  <label>Min Items</label>
                  <InputNumber v-model="schemaData.minItems" placeholder="Min items" :min="0" />
                </div>
                <div class="form-field">
                  <label>Max Items</label>
                  <InputNumber v-model="schemaData.maxItems" placeholder="Max items" :min="0" />
                </div>
              </div>
              <div class="form-field checkbox-field">
                <Checkbox v-model="schemaData.uniqueItems" input-id="schema-unique" :binary="true" />
                <label for="schema-unique">Unique Items</label>
              </div>
            </template>

            <div class="form-field">
              <label>Enum Values</label>
              <AutoComplete
                v-model="schemaData.enum"
                multiple
                typeahead
                :suggestions="[]"
                placeholder="Add value and press Enter"
                @keydown.enter.prevent="addChipOnEnter($event, schemaData, 'enum')"
              />
            </div>
          </div>
        </template>
      </template>
    </div>
    <template #footer>
      <Button
        :label="showJson ? 'Back to Builder' : 'View JSON'"
        :icon="showJson ? 'pi pi-sitemap' : 'pi pi-code'"
        text
        @click="showJson = !showJson"
      />
      <Button label="Cancel" text @click="$emit('update:visible', false); $emit('cancel')" />
      <template v-if="!showJson">
        <Button v-if="stepIndex > 0" label="Back" icon="pi pi-arrow-left" text @click="$emit('back')" />
        <Button
          v-if="stepIndex < steps.length - 1"
          label="Next"
          icon="pi pi-arrow-right"
          icon-pos="right"
          :disabled="isEditingSchemaNameInvalid"
          @click="$emit('next')"
        />
        <Button v-else label="Done" icon="pi pi-check" :disabled="isEditingSchemaNameInvalid" @click="$emit('finish')" />
      </template>
      <Button v-else label="Done" icon="pi pi-check" :disabled="isEditingSchemaNameInvalid" @click="$emit('finish')" />
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
import Textarea from "primevue/textarea";
import Select from "primevue/select";
import MultiSelect from "primevue/multiselect";
import Checkbox from "primevue/checkbox";
import AutoComplete from "primevue/autocomplete";
import Tag from "primevue/tag";

// The "Add/Edit Schema" wizard — the component-schema equivalent of
// EditParameterDialog.vue, replacing ComponentsTab's old always-open
// Accordion "Builder" tab. One dialog handles both creating and editing
// (api.editingSchemaName is the current key into components.schemas), with
// steps that adapt to the schema's kind: Basic Info always, then
// Composition (oneOf/anyOf/allOf member schemas + discriminator),
// Properties (object — summary rows that open
// EditSchemaPropertyDialog.vue for each one, same nesting relationship as
// a parameter's Array Items step), or Validation (primitive types, same
// collapsed "advanced fields" pattern as every other Type & Validation
// step in this app). A raw JSON view is one toggle away at any step,
// since some things (deeply nested composition, edge-case keywords) are
// still faster to hand-edit than click through.
const BASIC_INFO_STEP = { key: "basicInfo", label: "Basic Info" };

export default {
  name: "EditSchemaDialog",
  components: { Dialog, Button, InputText, InputNumber, Textarea, Select, MultiSelect, Checkbox, AutoComplete, Tag },
  props: {
    visible: { type: Boolean, default: false },
    step: { type: String, default: "basicInfo" },
    isNew: { type: Boolean, default: false },
    api: { type: Object, required: true },
  },
  emits: ["update:visible", "back", "next", "cancel", "finish"],
  setup(props) {
    const schemaData = computed(() => props.api.editingSchema.value);

    const steps = computed(() => {
      const data = schemaData.value;
      if (!data) return [BASIC_INFO_STEP];
      const kind = props.api.getSchemaKind(data);
      if (props.api.isCompositionKind(kind)) {
        return [BASIC_INFO_STEP, { key: "composition", label: "Composition" }];
      }
      if (kind === "object") {
        return [BASIC_INFO_STEP, { key: "properties", label: "Properties" }];
      }
      return [BASIC_INFO_STEP, { key: "validation", label: "Validation" }];
    });
    const stepIndex = computed(() => steps.value.findIndex((s) => s.key === props.step));

    const showJson = ref(false);
    const showMapping = ref(false);
    const showValidationRules = ref(false);
    watch(
      () => props.visible,
      (visible) => {
        if (visible) {
          showJson.value = false;
          showMapping.value = false;
          showValidationRules.value = false;
        }
      },
    );

    return {
      ...props.api,
      schemaData,
      steps,
      stepIndex,
      showJson,
      showMapping,
      showValidationRules,
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
  max-height: 65vh;
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

:deep(.p-dialog-footer) > :first-child {
  margin-right: auto;
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
