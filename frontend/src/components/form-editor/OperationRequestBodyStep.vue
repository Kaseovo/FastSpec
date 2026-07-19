<template>
                          <div class="operation-step">
                            <div class="section-header">
                              <h5>Request Body</h5>
                              <div class="form-field checkbox-field">
                                <Checkbox
                                  v-model="
                                    currentMethodData.requestBody.required
                                  "
                                  inputId="body-required"
                                  :binary="true"
                                />
                                <label for="body-required">Required</label>
                              </div>
                            </div>
                            <div class="operation-step__body">
                              <div class="form-field">
                                <label>Description</label>
                                <Textarea
                                  v-model="
                                    currentMethodData.requestBody.description
                                  "
                                  rows="2"
                                  placeholder="Request body description"
                                />
                              </div>

                              <div class="form-field">
                                <label>Content Type</label>
                                <Select
                                  v-model="requestBodyContentType"
                                  :options="[
                                    'application/json',
                                    'application/xml',
                                    'multipart/form-data',
                                    'application/x-www-form-urlencoded',
                                  ]"
                                  placeholder="Select content type"
                                />
                              </div>

                              <div
                                class="form-field"
                                v-if="requestBodyContentType"
                              >
                                <label>Schema</label>
                                <div class="schema-selector">
                                  <Select
                                    v-model="requestBodySchemaType"
                                    :options="['reference', 'inline']"
                                    placeholder="Schema type"
                                  />
                                  <template v-if="requestBodySchemaType === 'reference'">
                                    <Select
                                      v-model="requestBodySchemaRef"
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
                                      @click="addSchema"
                                    />
                                  </template>
                                </div>
                              </div>

                              <!-- Inline schema builder (replaces raw JSON textarea) -->
                              <template v-if="requestBodySchemaType === 'inline' && requestBodyContentType">
                                <div class="form-field">
                                  <label class="required">Type</label>
                                  <Select
                                    v-model="requestBodyInlineSchemaType"
                                    :options="['object', 'array', 'string', 'number', 'integer', 'boolean']"
                                    placeholder="Select type"
                                    @change="onRequestBodyTypeChange"
                                  />
                                </div>

                                <!-- object: property list -->
                                <div v-if="requestBodyInlineSchemaType === 'object'">
                                  <div class="section-header">
                                    <h5>Properties</h5>
                                    <Button
                                      label="Add Property"
                                      icon="pi pi-plus"
                                      size="small"
                                      @click="openAddPropertyDialog"
                                    />
                                  </div>
                                  <div
                                    v-if="!currentRequestBodySchema || !currentRequestBodySchema.properties || Object.keys(currentRequestBodySchema.properties).length === 0"
                                    class="empty-state-small"
                                  >
                                    <p>No properties defined</p>
                                  </div>
                                  <div
                                    v-for="(prop, propName) in currentRequestBodySchema && currentRequestBodySchema.properties"
                                    :key="propName"
                                    class="param-item"
                                  >
                                    <div class="item-row-header" @click="openEditPropertyDialog(propName)">
                                      <span class="item-row-name">{{ propName || 'Unnamed property' }}</span>
                                      <div class="item-row-badges">
                                        <Tag v-if="prop.type === '$ref'" value="ref" severity="info" />
                                        <template v-else>
                                          <span :class="['type-badge', 'type-badge--' + (Array.isArray(prop.type) ? prop.type.find(t => t !== 'null') : prop.type)]">
                                            {{ Array.isArray(prop.type) ? prop.type.join(' | ') : prop.type }}
                                          </span>
                                          <Tag
                                            v-if="currentRequestBodySchema && currentRequestBodySchema.required && currentRequestBodySchema.required.includes(propName)"
                                            value="required"
                                            severity="warn"
                                          />
                                        </template>
                                      </div>
                                      <Button
                                        icon="pi pi-pencil"
                                        text
                                        rounded
                                        size="small"
                                        class="item-row-edit"
                                        @click.stop="openEditPropertyDialog(propName)"
                                      />
                                      <Button
                                        icon="pi pi-trash"
                                        severity="danger"
                                        text
                                        rounded
                                        size="small"
                                        class="item-row-delete"
                                        @click.stop="removeRequestBodyProperty(propName)"
                                      />
                                    </div>
                                  </div>
                                  <!-- object-level constraints -->
                                  <div class="form-row" style="margin-top: 0.75rem;">
                                    <div class="form-field">
                                      <label>Min Properties</label>
                                      <InputNumber v-if="currentRequestBodySchema" v-model="currentRequestBodySchema.minProperties" placeholder="Min properties" :min="0" />
                                    </div>
                                    <div class="form-field">
                                      <label>Max Properties</label>
                                      <InputNumber v-if="currentRequestBodySchema" v-model="currentRequestBodySchema.maxProperties" placeholder="Max properties" :min="0" />
                                    </div>
                                  </div>
                                  <div class="form-field checkbox-field">
                                    <Checkbox
                                      v-if="currentRequestBodySchema"
                                      v-model="currentRequestBodySchema.additionalProperties"
                                      inputId="rb-addl-props"
                                      :binary="true"
                                      :trueValue="true"
                                      :falseValue="false"
                                    />
                                    <label for="rb-addl-props">Allow Additional Properties</label>
                                  </div>
                                </div>

                                <!-- Non-object root schema: format, item structure, default/example/
                                     nullable stay visible; fine-tuning constraints collapse behind
                                     "Show validation rules", same as the parameter dialog's Type &
                                     Validation step. -->
                                <template v-if="requestBodyInlineSchemaType !== 'object' && currentRequestBodySchema">
                                  <div v-if="requestBodyInlineSchemaType === 'string'" class="form-field">
                                    <label>Format</label>
                                    <Select v-model="currentRequestBodySchema.format" :options="['','date','date-time','password','byte','binary','email','uri','uuid','hostname','ipv4','ipv6']" placeholder="Format" />
                                  </div>
                                  <div v-else-if="requestBodyInlineSchemaType === 'number' || requestBodyInlineSchemaType === 'integer'" class="form-field">
                                    <label>Format</label>
                                    <Select v-model="currentRequestBodySchema.format" :options="requestBodyInlineSchemaType === 'integer' ? ['','int32','int64'] : ['','float','double']" placeholder="Format" />
                                  </div>

                                  <!-- array: item structure is core to what the array holds, so it
                                       stays visible rather than collapsing with the rest -->
                                  <template v-if="requestBodyInlineSchemaType === 'array'">
                                    <div class="form-field">
                                      <label>Items Type(s)</label>
                                      <MultiSelect
                                        :modelValue="currentRequestBodySchema._itemSchemas ? [...new Set(currentRequestBodySchema._itemSchemas.map(s => s.type))] : []"
                                        :options="['string','number','integer','boolean','object']"
                                        placeholder="Select one or more types"
                                        display="chip"
                                        @update:modelValue="onItemTypesChange(currentRequestBodySchema, $event)"
                                      />
                                    </div>
                                    <div v-if="currentRequestBodySchema._itemSchemas && currentRequestBodySchema._itemSchemas.length > 0" class="item-schemas-list">
                                      <div
                                        v-for="(itemSchema, sIdx) in currentRequestBodySchema._itemSchemas"
                                        :key="sIdx"
                                        class="item-schema-entry"
                                      >
                                        <div class="item-schema-entry-header">
                                          <span :class="['type-badge', 'type-badge--' + itemSchema.type]">{{ itemSchema.type }}</span>
                                          <span v-if="itemSchema.type === 'object' && itemSchema.$ref" class="item-schema-ref-label">{{ itemSchema.$ref.split('/').pop() }}</span>
                                          <Button icon="pi pi-trash" severity="danger" text rounded size="small" class="item-schema-remove" v-tooltip.top="'Remove this type entry'" @click="currentRequestBodySchema._itemSchemas.splice(sIdx, 1)" />
                                        </div>
                                        <div class="item-schema-entry-body">
                                          <template v-if="itemSchema.type === 'object'">
                                            <div class="form-field">
                                              <label>Schema Reference</label>
                                              <div class="schema-selector">
                                                <Select
                                                  v-model="itemSchema.$ref"
                                                  :options="availableSchemas"
                                                  optionLabel="label"
                                                  optionValue="value"
                                                  :placeholder="availableSchemas.length === 0 ? 'No schemas available' : 'Select schema'"
                                                />
                                                <Button label="New Schema" icon="pi pi-plus" size="small" text @click="addSchema" />
                                              </div>
                                            </div>
                                            <Button
                                              v-if="sIdx === currentRequestBodySchema._itemSchemas.map((s,i) => s.type === 'object' ? i : -1).filter(i => i >= 0).slice(-1)[0]"
                                              label="Add another object schema"
                                              icon="pi pi-plus"
                                              size="small"
                                              text
                                              class="mt-1"
                                              @click="currentRequestBodySchema._itemSchemas.splice(sIdx + 1, 0, { type: 'object', $ref: '' })"
                                            />
                                          </template>
                                          <template v-else-if="itemSchema.type === 'string'">
                                            <div class="form-row">
                                              <div class="form-field"><label>Format</label><Select v-model="itemSchema.format" :options="['','date','date-time','email','uri','uuid','hostname','ipv4','ipv6']" placeholder="Format" /></div>
                                              <div class="form-field"><label>Pattern</label><InputText v-model="itemSchema.pattern" placeholder="^[a-zA-Z0-9]+$" /></div>
                                            </div>
                                            <div class="form-row">
                                              <div class="form-field"><label>Min Length</label><InputNumber v-model="itemSchema.minLength" placeholder="Min length" :min="0" /></div>
                                              <div class="form-field"><label>Max Length</label><InputNumber v-model="itemSchema.maxLength" placeholder="Max length" :min="0" /></div>
                                            </div>
                                          </template>
                                          <template v-else-if="itemSchema.type === 'number' || itemSchema.type === 'integer'">
                                            <div class="form-row">
                                              <div class="form-field"><label>Format</label><Select v-model="itemSchema.format" :options="itemSchema.type === 'integer' ? ['','int32','int64'] : ['','float','double']" placeholder="Format" /></div>
                                              <div class="form-field"><label>Multiple Of</label><InputNumber v-model="itemSchema.multipleOf" placeholder="Multiple of" :min="0" /></div>
                                            </div>
                                            <div class="form-row">
                                              <div class="form-field"><label>Minimum</label><InputNumber v-model="itemSchema.minimum" placeholder="Min value" /></div>
                                              <div class="form-field"><label>Maximum</label><InputNumber v-model="itemSchema.maximum" placeholder="Max value" /></div>
                                            </div>
                                          </template>
                                          <template v-else-if="itemSchema.type === 'boolean'">
                                            <p class="helper-text">No additional constraints for boolean.</p>
                                          </template>
                                        </div>
                                      </div>
                                    </div>
                                  </template>

                                  <div class="form-row">
                                    <div class="form-field"><label>Default Value</label><InputText v-model="currentRequestBodySchema.default" placeholder="Default value" /></div>
                                    <div class="form-field"><label>Example</label><InputText v-model="currentRequestBodySchema.example" placeholder="Example value" /></div>
                                  </div>
                                  <div class="form-field checkbox-field">
                                    <template v-if="isOpenAPI31">
                                      <Checkbox
                                        :modelValue="Array.isArray(currentRequestBodySchema.type) && currentRequestBodySchema.type.includes('null')"
                                        inputId="rb-nullable"
                                        :binary="true"
                                        @update:modelValue="val => {
                                          const base = Array.isArray(currentRequestBodySchema.type) ? currentRequestBodySchema.type.filter(t => t !== 'null') : [currentRequestBodySchema.type || 'string'];
                                          currentRequestBodySchema.type = val ? [...base, 'null'] : (base.length === 1 ? base[0] : base);
                                        }"
                                      />
                                    </template>
                                    <template v-else>
                                      <Checkbox v-model="currentRequestBodySchema.nullable" inputId="rb-nullable" :binary="true" />
                                    </template>
                                    <label for="rb-nullable">Nullable</label>
                                  </div>

                                  <button
                                    type="button"
                                    class="validation-advanced-toggle"
                                    @click="showRequestBodyValidationRules = !showRequestBodyValidationRules"
                                  >
                                    <i :class="['pi', showRequestBodyValidationRules ? 'pi-chevron-down' : 'pi-chevron-right']"></i>
                                    {{ showRequestBodyValidationRules ? 'Hide validation rules' : 'Show validation rules' }}
                                    <span v-if="requestBodyAdvancedFieldCount">({{ requestBodyAdvancedFieldCount }} more)</span>
                                  </button>

                                  <div v-show="showRequestBodyValidationRules" class="validation-advanced">
                                    <template v-if="requestBodyInlineSchemaType === 'string'">
                                      <div class="form-field">
                                        <label>Pattern</label>
                                        <InputText v-model="currentRequestBodySchema.pattern" placeholder="^[a-zA-Z0-9]+$" />
                                      </div>
                                      <div class="form-row">
                                        <div class="form-field"><label>Min Length</label><InputNumber v-model="currentRequestBodySchema.minLength" placeholder="Min length" :min="0" /></div>
                                        <div class="form-field"><label>Max Length</label><InputNumber v-model="currentRequestBodySchema.maxLength" placeholder="Max length" :min="0" /></div>
                                      </div>
                                    </template>

                                    <template v-if="requestBodyInlineSchemaType === 'number' || requestBodyInlineSchemaType === 'integer'">
                                      <div class="form-row">
                                        <div class="form-field"><label>Minimum</label><InputNumber v-model="currentRequestBodySchema.minimum" placeholder="Min value" /></div>
                                        <div class="form-field"><label>Maximum</label><InputNumber v-model="currentRequestBodySchema.maximum" placeholder="Max value" /></div>
                                      </div>
                                      <div class="form-field">
                                        <label>Multiple Of</label>
                                        <InputNumber v-model="currentRequestBodySchema.multipleOf" placeholder="Multiple of" :min="0" />
                                      </div>
                                      <div class="form-row">
                                        <template v-if="isOpenAPI31">
                                          <div class="form-field"><label>Exclusive Minimum</label><InputNumber v-model="currentRequestBodySchema.exclusiveMinimum" placeholder="Exclusive min" /></div>
                                          <div class="form-field"><label>Exclusive Maximum</label><InputNumber v-model="currentRequestBodySchema.exclusiveMaximum" placeholder="Exclusive max" /></div>
                                        </template>
                                        <template v-else>
                                          <div class="form-field checkbox-field">
                                            <Checkbox v-model="currentRequestBodySchema.exclusiveMinimum" inputId="rb-excl-min" :binary="true" />
                                            <label for="rb-excl-min">Exclusive Minimum</label>
                                          </div>
                                          <div class="form-field checkbox-field">
                                            <Checkbox v-model="currentRequestBodySchema.exclusiveMaximum" inputId="rb-excl-max" :binary="true" />
                                            <label for="rb-excl-max">Exclusive Maximum</label>
                                          </div>
                                        </template>
                                      </div>
                                    </template>

                                    <template v-if="requestBodyInlineSchemaType === 'array'">
                                      <div class="form-row">
                                        <div class="form-field"><label>Min Items</label><InputNumber v-model="currentRequestBodySchema.minItems" placeholder="Min items" :min="0" /></div>
                                        <div class="form-field"><label>Max Items</label><InputNumber v-model="currentRequestBodySchema.maxItems" placeholder="Max items" :min="0" /></div>
                                      </div>
                                      <div class="form-field checkbox-field">
                                        <Checkbox v-model="currentRequestBodySchema.uniqueItems" inputId="rb-unique-items" :binary="true" />
                                        <label for="rb-unique-items">Unique Items</label>
                                      </div>
                                    </template>

                                    <div class="form-field">
                                      <label>Enum Values</label>
                                      <AutoComplete
                                        multiple
                                        typeahead
                                        v-model="currentRequestBodySchema.enum"
                                        :suggestions="[]"
                                        placeholder="Add value and press Enter"
                                        @keydown.enter.prevent="addChipOnEnter($event, currentRequestBodySchema, 'enum')"
                                      />
                                    </div>
                                  </div>
                                </template>
                              </template>
                              </div>
                          </div>
</template>

<script>
import { computed, ref } from "vue";
import "../../assets/form-editor-shared.css";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Textarea from "primevue/textarea";
import Select from "primevue/select";
import MultiSelect from "primevue/multiselect";
import Checkbox from "primevue/checkbox";
import AutoComplete from "primevue/autocomplete";
import Tag from "primevue/tag";

// One step ("Request Body") of the operation editor — see
// OperationBasicInfoStep.vue's header comment for the shared contract.
// Object-body properties are edited via EditPropertyDialog.vue (opened
// through api.openAddPropertyDialog/openEditPropertyDialog, both defined in
// usePathsEditor.js) rather than inline here — this step only renders their
// summary rows, same split as OperationParametersStep.vue/
// EditParameterDialog.vue.
export default {
  name: "OperationRequestBodyStep",
  components: { Button, InputText, InputNumber, Textarea, Select, MultiSelect, Checkbox, AutoComplete, Tag },
  props: {
    formData: { type: Object, required: true },
    api: { type: Object, required: true },
  },
  setup(props) {
    // Collapsed by default, same reasoning as EditParameterDialog's
    // showValidationRules — this step is only ever mounted while its wizard
    // step/tab is active (v-else-if in PathsTab.vue/AddPathDialog.vue/
    // AddMethodDialog.vue), so it naturally resets on remount without
    // needing an explicit watch like the always-mounted dialogs do.
    const showRequestBodyValidationRules = ref(false);

    const requestBodyAdvancedFieldCount = computed(() => {
      const type = props.api.requestBodyInlineSchemaType.value;
      if (type === "object") return 0;
      let count = 1; // enum
      if (type === "string") count += 3; // pattern, minLength, maxLength
      if (type === "number" || type === "integer") count += 5; // min, max, multipleOf, exclusiveMin, exclusiveMax
      if (type === "array") count += 3; // minItems, maxItems, uniqueItems
      return count;
    });

    return {
      formData: computed(() => props.formData),
      ...props.api,
      showRequestBodyValidationRules,
      requestBodyAdvancedFieldCount,
    };
  },
};
</script>
