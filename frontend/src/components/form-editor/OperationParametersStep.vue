<template>
                          <div class="operation-step">
                            <div class="section-header">
                              <h5>Parameters</h5>
                              <span v-if="currentMethodData.parameters?.length" class="section-header__count">{{ currentMethodData.parameters.length }}</span>
                              <Button
                                label="Add Parameter"
                                icon="pi pi-plus"
                                size="small"
                                @click="onAddParameter"
                              />
                            </div>
                            <div class="operation-step__body">
                              <div
                                v-if="
                                  !currentMethodData.parameters ||
                                  currentMethodData.parameters.length === 0
                                "
                                class="empty-state-small"
                              >
                                <p>No parameters defined</p>
                              </div>

                              <div
                                v-for="(
                                  param, pIndex
                                ) in currentMethodData.parameters"
                                :key="pIndex"
                                :class="['param-item', { 'param-item--path': param.in === 'path' }]"
                              >
                                <div
                                  class="item-row-header"
                                  @click="toggleParamExpanded(param, pIndex)"
                                >
                                  <i
                                    class="pi pi-chevron-right item-row-caret"
                                    :class="{ 'item-row-caret--open': isParamExpanded(param, pIndex) }"
                                  ></i>
                                  <span
                                    class="item-row-name"
                                    :class="{ 'item-row-name--empty': isParameterRef(param) ? !param.$ref : !param.name }"
                                  >{{
                                    isParameterRef(param)
                                      ? (param.$ref ? param.$ref.split('/').pop() : 'No reusable parameter selected')
                                      : (param.name || 'Unnamed parameter')
                                  }}</span>
                                  <div class="item-row-badges">
                                    <Tag v-if="isParameterRef(param)" value="ref" severity="info" />
                                    <template v-else>
                                      <Tag :value="param.in" severity="secondary" />
                                      <span :class="['type-badge', 'type-badge--' + (Array.isArray(param.schema?.type) ? param.schema.type.find(t => t !== 'null') : param.schema?.type)]">
                                        {{ Array.isArray(param.schema?.type) ? param.schema.type.join(' | ') : param.schema?.type }}
                                      </span>
                                      <Tag v-if="param.required" value="required" severity="warn" />
                                    </template>
                                  </div>
                                  <i
                                    v-if="!isParameterRef(param) && (!param.name || isParameterDuplicate(currentMethodData.parameters, pIndex))"
                                    class="pi pi-exclamation-triangle item-row-error"
                                    v-tooltip.top="!param.name ? 'This parameter needs a name' : 'Duplicate parameter name'"
                                  ></i>
                                  <Button
                                    v-if="param.in !== 'path'"
                                    icon="pi pi-trash"
                                    severity="danger"
                                    text
                                    rounded
                                    size="small"
                                    class="item-row-delete"
                                    @click.stop="
                                      removeParameter(
                                        selectedPath,
                                        selectedMethod,
                                        pIndex
                                      )
                                    "
                                  />
                                </div>
                                <div v-show="isParamExpanded(param, pIndex)" class="item-row-body">
                                <!-- Path parameter lock banner -->
                                <div v-if="param.in === 'path'" class="path-param-banner">
                                  <i class="pi pi-lock"></i>
                                  <span>Path parameter — edit the path template to rename or remove</span>
                                </div>

                                <!-- Reusable-parameter toggle (path params can't be reusable —
                                     they're structurally tied to the path template) -->
                                <div v-if="param.in !== 'path'" class="reusable-ref-toggle">
                                  <Button
                                    v-if="!isParameterRef(param)"
                                    label="Use existing reusable parameter"
                                    icon="pi pi-link"
                                    size="small"
                                    text
                                    @click="convertParameterToRef(selectedPath, selectedMethod, pIndex)"
                                  />
                                  <Button
                                    v-else
                                    label="Define inline instead"
                                    icon="pi pi-pencil"
                                    size="small"
                                    text
                                    @click="convertParameterToInline(selectedPath, selectedMethod, pIndex)"
                                  />
                                </div>

                                <div v-if="isParameterRef(param)" class="param-content">
                                  <div class="form-field">
                                    <label class="required">Reusable Parameter</label>
                                    <Select
                                      v-model="param.$ref"
                                      :options="availableParameters"
                                      optionLabel="label"
                                      optionValue="value"
                                      placeholder="Select a reusable parameter"
                                    />
                                  </div>
                                </div>

                                <div v-else class="param-content">
                                  <div class="form-row">
                                    <div class="form-field">
                                      <label class="required">Name</label>
                                      <InputText
                                        v-model="param.name"
                                        placeholder="id"
                                        :disabled="param.in === 'path'"
                                        :class="{ 'p-invalid': isParameterDuplicate(currentMethodData.parameters, pIndex) }"
                                      />
                                      <small
                                        v-if="isParameterDuplicate(currentMethodData.parameters, pIndex)"
                                        class="p-error"
                                      >
                                        Another {{ param.in }} parameter already uses this name.
                                      </small>
                                    </div>
                                    <div class="form-field">
                                      <label class="required">Location</label>
                                      <Select
                                        v-model="param.in"
                                        :options="[
                                          'query',
                                          'header',
                                          'cookie',
                                        ]"
                                        placeholder="Select location"
                                        :disabled="param.in === 'path'"
                                      />
                                    </div>
                                  </div>
                                  <div class="form-field">
                                    <label>Description</label>
                                    <InputText
                                      v-model="param.description"
                                      placeholder="Parameter description"
                                    />
                                  </div>
                                  <div class="form-field">
                                    <label class="required">Type</label>
                                    <Select
                                      v-model="param.schema.type"
                                      :options="[
                                        'string',
                                        'number',
                                        'integer',
                                        'boolean',
                                        'array',
                                        'object',
                                      ]"
                                      placeholder="Type"
                                      @change="onPropertyTypeChange(param.schema)"
                                    />
                                  </div>
                                  <template v-if="param.schema.type === 'array'">
                                      <div class="form-field">
                                        <label>Items Type(s)</label>
                                        <MultiSelect
                                          :modelValue="param.schema._itemSchemas ? [...new Set(param.schema._itemSchemas.map(s => s.type))] : []"
                                          :options="['string','number','integer','boolean','object']"
                                          placeholder="Select one or more types"
                                          display="chip"
                                          @update:modelValue="onItemTypesChange(param.schema, $event)"
                                        />
                                      </div>
                                      <!-- Per-type schema sections -->
                                      <div v-if="param.schema._itemSchemas && param.schema._itemSchemas.length > 0" class="item-schemas-list">
                                        <div
                                          v-for="(itemSchema, sIdx) in param.schema._itemSchemas"
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
                                              @click="param.schema._itemSchemas.splice(sIdx, 1)"
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
                                                    :options="availableSchemas.filter(s => s.value === itemSchema.$ref || !param.schema._itemSchemas.some(other => other !== itemSchema && other.type === 'object' && other.$ref === s.value))"
                                                    optionLabel="label"
                                                    optionValue="value"
                                                    :placeholder="availableSchemas.filter(s => s.value === itemSchema.$ref || !param.schema._itemSchemas.some(other => other !== itemSchema && other.type === 'object' && other.$ref === s.value)).length === 0 ? 'No schemas available' : 'Select schema'"
                                                    :disabled="availableSchemas.filter(s => s.value === itemSchema.$ref || !param.schema._itemSchemas.some(other => other !== itemSchema && other.type === 'object' && other.$ref === s.value)).length === 0"
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
                                                  v-if="availableSchemas.filter(s => s.value === itemSchema.$ref || !param.schema._itemSchemas.some(other => other !== itemSchema && other.type === 'object' && other.$ref === s.value)).length === 0"
                                                  class="helper-text"
                                                >{{ availableSchemas.length === 0 ? 'No schemas yet — create one first.' : 'All schemas are already used — create a new one.' }}</small>
                                              </div>
                                              <Button
                                                v-if="sIdx === param.schema._itemSchemas.map((s,i) => s.type === 'object' ? i : -1).filter(i => i >= 0).slice(-1)[0]"
                                                label="Add another object schema"
                                                icon="pi pi-plus"
                                                size="small"
                                                text
                                                class="mt-1"
                                                @click="param.schema._itemSchemas.splice(sIdx + 1, 0, { type: 'object', $ref: '' })"
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
                                                    <label :for="'item-excl-min-' + pIndex + '-' + sIdx">Exclusive Minimum</label>
                                                    <InputNumber v-model="itemSchema.exclusiveMinimum" :inputId="'item-excl-min-' + pIndex + '-' + sIdx" placeholder="Exclusive min value" />
                                                  </div>
                                                  <div class="form-field">
                                                    <label :for="'item-excl-max-' + pIndex + '-' + sIdx">Exclusive Maximum</label>
                                                    <InputNumber v-model="itemSchema.exclusiveMaximum" :inputId="'item-excl-max-' + pIndex + '-' + sIdx" placeholder="Exclusive max value" />
                                                  </div>
                                                </template>
                                                <template v-else>
                                                  <div class="form-field checkbox-field">
                                                    <Checkbox v-model="itemSchema.exclusiveMinimum" :inputId="'item-excl-min-' + pIndex + '-' + sIdx" :binary="true" />
                                                    <label :for="'item-excl-min-' + pIndex + '-' + sIdx">Exclusive Minimum</label>
                                                  </div>
                                                  <div class="form-field checkbox-field">
                                                    <Checkbox v-model="itemSchema.exclusiveMaximum" :inputId="'item-excl-max-' + pIndex + '-' + sIdx" :binary="true" />
                                                    <label :for="'item-excl-max-' + pIndex + '-' + sIdx">Exclusive Maximum</label>
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

                                  <!-- String validations -->
                                  <div
                                    v-if="param.schema.type === 'string'"
                                    class="form-row"
                                  >
                                    <div class="form-field">
                                      <label>Format</label>
                                      <Select
                                        v-model="param.schema.format"
                                        :options="[
                                          '',
                                          'date',
                                          'date-time',
                                          'email',
                                          'uri',
                                          'uuid',
                                          'hostname',
                                          'ipv4',
                                          'ipv6',
                                        ]"
                                        placeholder="Format"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Pattern</label>
                                      <InputText
                                        v-model="param.schema.pattern"
                                        placeholder="^[a-zA-Z0-9]+$"
                                      />
                                    </div>
                                  </div>

                                  <div
                                    v-if="param.schema.type === 'string'"
                                    class="form-row"
                                  >
                                    <div class="form-field">
                                      <label>Min Length</label>
                                      <InputNumber
                                        v-model="param.schema.minLength"
                                        placeholder="Min length"
                                        :min="0"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Max Length</label>
                                      <InputNumber
                                        v-model="param.schema.maxLength"
                                        placeholder="Max length"
                                        :min="0"
                                      />
                                    </div>
                                  </div>

                                  <!-- Number/Integer validations -->
                                  <div
                                    v-if="
                                      param.schema.type === 'number' ||
                                      param.schema.type === 'integer'
                                    "
                                    class="form-row"
                                  >
                                    <div class="form-field">
                                      <label>Minimum</label>
                                      <InputNumber
                                        v-model="param.schema.minimum"
                                        placeholder="Min value"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Maximum</label>
                                      <InputNumber
                                        v-model="param.schema.maximum"
                                        placeholder="Max value"
                                      />
                                    </div>
                                  </div>

                                  <div
                                    v-if="
                                      param.schema.type === 'number' ||
                                      param.schema.type === 'integer'
                                    "
                                    class="form-row"
                                  >
                                    <div class="form-field">
                                      <label>Format</label>
                                      <Select
                                        v-model="param.schema.format"
                                        :options="
                                          param.schema.type === 'integer'
                                            ? ['', 'int32', 'int64']
                                            : ['', 'float', 'double']
                                        "
                                        placeholder="Format"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Multiple Of</label>
                                      <InputNumber
                                        v-model="param.schema.multipleOf"
                                        placeholder="Multiple of"
                                        :min="0"
                                      />
                                    </div>
                                  </div>

                                  <div
                                    v-if="
                                      param.schema.type === 'number' ||
                                      param.schema.type === 'integer'
                                    "
                                    class="form-row"
                                  >
                                    <template v-if="isOpenAPI31">
                                      <div class="form-field">
                                        <label :for="'param-excl-min-' + pIndex">Exclusive Minimum</label>
                                        <InputNumber
                                          v-model="param.schema.exclusiveMinimum"
                                          :inputId="'param-excl-min-' + pIndex"
                                          placeholder="Exclusive min value"
                                        />
                                      </div>
                                      <div class="form-field">
                                        <label :for="'param-excl-max-' + pIndex">Exclusive Maximum</label>
                                        <InputNumber
                                          v-model="param.schema.exclusiveMaximum"
                                          :inputId="'param-excl-max-' + pIndex"
                                          placeholder="Exclusive max value"
                                        />
                                      </div>
                                    </template>
                                    <template v-else>
                                      <div class="form-field checkbox-field">
                                        <Checkbox
                                          v-model="param.schema.exclusiveMinimum"
                                          :inputId="'param-excl-min-' + pIndex"
                                          :binary="true"
                                        />
                                        <label :for="'param-excl-min-' + pIndex"
                                          >Exclusive Minimum</label
                                        >
                                      </div>
                                      <div class="form-field checkbox-field">
                                        <Checkbox
                                          v-model="param.schema.exclusiveMaximum"
                                          :inputId="'param-excl-max-' + pIndex"
                                          :binary="true"
                                        />
                                        <label :for="'param-excl-max-' + pIndex"
                                          >Exclusive Maximum</label
                                        >
                                      </div>
                                    </template>
                                  </div>

                                  <!-- Array validations -->
                                  <div
                                    v-if="param.schema.type === 'array'"
                                    class="form-row"
                                    style="margin-top: 0.75rem;"
                                  >
                                    <div class="form-field">
                                      <label>Min Items</label>
                                      <InputNumber
                                        v-model="param.schema.minItems"
                                        placeholder="Min items"
                                        :min="0"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Max Items</label>
                                      <InputNumber
                                        v-model="param.schema.maxItems"
                                        placeholder="Max items"
                                        :min="0"
                                      />
                                    </div>
                                  </div>

                                  <div
                                    v-if="param.schema.type === 'array'"
                                    class="form-field checkbox-field"
                                  >
                                    <Checkbox
                                      v-model="param.schema.uniqueItems"
                                      :inputId="'param-unique-' + pIndex"
                                      :binary="true"
                                    />
                                    <label :for="'param-unique-' + pIndex"
                                      >Unique Items</label
                                    >
                                  </div>

                                  <!-- Enum values -->
                                  <div
                                    class="form-field"
                                    v-if="param.schema.type !== 'object'"
                                  >
                                    <label>Enum Values (optional)</label>
                                    <AutoComplete
                                      multiple
                                      typeahead
                                      v-model="param.schema.enum"
                                      :suggestions="[]"
                                      placeholder="Add enum value and press Enter"
                                      @keydown.enter.prevent="addChipOnEnter($event, param.schema, 'enum')"
                                    />
                                  </div>

                                  <div class="form-field">
                                    <label>Default Value</label>
                                    <InputText
                                      v-model="param.schema.default"
                                      placeholder="Default value"
                                    />
                                  </div>

                                  <div class="form-field">
                                    <label>Example</label>
                                    <InputText
                                      v-model="param.schema.example"
                                      placeholder="Example value"
                                    />
                                  </div>

                                  <div class="form-row">
                                    <div class="form-field checkbox-field">
                                      <Checkbox
                                        v-model="param.required"
                                        :inputId="'param-required-' + pIndex"
                                        :binary="true"
                                      />
                                      <label :for="'param-required-' + pIndex"
                                        >Required</label
                                      >
                                    </div>
                                    <div class="form-field checkbox-field">
                                      <template v-if="isOpenAPI31">
                                        <Checkbox
                                          :modelValue="Array.isArray(param.schema.type) && param.schema.type.includes('null')"
                                          :inputId="'param-nullable-' + pIndex"
                                          :binary="true"
                                          @update:modelValue="val => {
                                            const base = Array.isArray(param.schema.type) ? param.schema.type.filter(t => t !== 'null') : [param.schema.type || 'string'];
                                            param.schema.type = val ? [...base, 'null'] : (base.length === 1 ? base[0] : base);
                                          }"
                                        />
                                      </template>
                                      <template v-else>
                                        <Checkbox
                                          v-model="param.schema.nullable"
                                          :inputId="'param-nullable-' + pIndex"
                                          :binary="true"
                                        />
                                      </template>
                                      <label :for="'param-nullable-' + pIndex"
                                        >Nullable</label
                                      >
                                    </div>
                                  </div>
                                </div>
                                </div>
                              </div>
                              </div>
                          </div>
</template>

<script>
import { ref, computed } from "vue";
import "../../assets/form-editor-shared.css";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Select from "primevue/select";
import MultiSelect from "primevue/multiselect";
import Checkbox from "primevue/checkbox";
import AutoComplete from "primevue/autocomplete";
import Tag from "primevue/tag";

// One step ("Parameters") of the operation editor — see
// OperationBasicInfoStep.vue's header comment for the shared contract
// (formData/api props, used both inline and inside AddPathDialog's wizard).
// Per-parameter expand/collapse state (isParamExpanded/toggleParamExpanded/
// onAddParameter) lives here rather than in usePathsEditor.js since it's
// purely presentational and scoped to whichever step component is mounted —
// same reasoning as PathsTab.vue's old methodSectionsCollapsed, just one
// level more local now that each step is its own component.
export default {
  name: "OperationParametersStep",
  components: { Button, InputText, InputNumber, Select, MultiSelect, Checkbox, AutoComplete, Tag },
  props: {
    formData: { type: Object, required: true },
    api: { type: Object, required: true },
  },
  setup(props) {
    const expandedParams = ref({});
    const paramExpandKey = (index) =>
      `${props.api.selectedPath.value}::${props.api.selectedMethod.value}::${index}`;
    const isParamExpanded = (param, index) => {
      const key = paramExpandKey(index);
      if (key in expandedParams.value) return expandedParams.value[key];
      if (props.api.isParameterRef(param)) return false;
      const params = props.api.currentMethodData.value.parameters || [];
      return !param.name || props.api.isParameterDuplicate(params, index);
    };
    const toggleParamExpanded = (param, index) => {
      const key = paramExpandKey(index);
      expandedParams.value[key] = !isParamExpanded(param, index);
    };
    const onAddParameter = () => {
      props.api.addParameter(props.api.selectedPath.value, props.api.selectedMethod.value);
      const params = props.api.currentMethodData.value.parameters || [];
      expandedParams.value[paramExpandKey(params.length - 1)] = true;
    };

    return {
      formData: computed(() => props.formData),
      ...props.api,
      isParamExpanded,
      toggleParamExpanded,
      onAddParameter,
    };
  },
};
</script>
