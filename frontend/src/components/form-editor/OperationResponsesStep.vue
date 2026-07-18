<template>
                          <div class="operation-step">
                            <div class="section-header">
                              <h5>Responses</h5>
                              <span v-if="currentMethodData.responses && Object.keys(currentMethodData.responses).length" class="section-header__count">{{ Object.keys(currentMethodData.responses).length }}</span>
                              <Button
                                label="Add Response"
                                icon="pi pi-plus"
                                size="small"
                                @click="openAddResponseDialog"
                              />
                            </div>
                            <div class="operation-step__body">
                              <div
                                v-if="
                                  !currentMethodData.responses ||
                                  Object.keys(currentMethodData.responses)
                                    .length === 0
                                "
                                class="empty-state-small"
                              >
                                <p>No responses defined</p>
                              </div>

                              <Accordion
                                v-if="
                                  currentMethodData.responses &&
                                  Object.keys(currentMethodData.responses)
                                    .length > 0
                                "
                              >
                                <AccordionPanel
                                  v-for="(
                                    response, statusCode
                                  ) in currentMethodData.responses"
                                  :key="statusCode"
                                  :value="statusCode"
                                >
                                  <AccordionHeader>
                                    <div class="response-header">
                                      <Tag
                                        :value="statusCode + ' ' + (getStatusName(statusCode))"
                                        :severity="getStatusSeverity(statusCode)"
                                      />
                                      <span v-if="isResponseRef(response)">
                                        <i class="pi pi-link"></i> {{ response.$ref.split('/').pop() || "Select a reusable response" }}
                                      </span>
                                      <span v-else :class="{ 'response-header__missing-desc': isResponseDescriptionMissing(response) }">
                                        {{ response.description || "Description required" }}
                                      </span>
                                      <Button
                                        icon="pi pi-pencil"
                                        text
                                        rounded
                                        size="small"
                                        class="response-edit-code-btn"
                                        v-tooltip.top="'Change status code'"
                                        @click.stop="openEditResponseCodeDialog(statusCode)"
                                      />
                                      <Button
                                        icon="pi pi-trash"
                                        severity="danger"
                                        text
                                        rounded
                                        size="small"
                                        @click.stop="
                                          removeResponse(
                                            selectedPath,
                                            selectedMethod,
                                            statusCode
                                          )
                                        "
                                      />
                                    </div>
                                  </AccordionHeader>
                                  <AccordionContent>
                                    <div class="reusable-ref-toggle">
                                      <Button
                                        v-if="!isResponseRef(response)"
                                        label="Use existing reusable response"
                                        icon="pi pi-link"
                                        size="small"
                                        text
                                        @click="convertResponseToRef(selectedPath, selectedMethod, statusCode)"
                                      />
                                      <Button
                                        v-else
                                        label="Define inline instead"
                                        icon="pi pi-pencil"
                                        size="small"
                                        text
                                        @click="convertResponseToInline(selectedPath, selectedMethod, statusCode)"
                                      />
                                    </div>

                                    <div v-if="isResponseRef(response)" class="form-field">
                                      <label class="required">Reusable Response</label>
                                      <Select
                                        v-model="response.$ref"
                                        :options="availableResponses"
                                        optionLabel="label"
                                        optionValue="value"
                                        placeholder="Select a reusable response"
                                      />
                                    </div>

                                    <template v-else>
                                    <div class="form-field">
                                      <label class="required">Description</label>
                                      <Textarea
                                        v-model="response.description"
                                        rows="2"
                                        placeholder="Response description"
                                        :class="{ 'p-invalid': isResponseDescriptionMissing(response) }"
                                      />
                                      <small v-if="isResponseDescriptionMissing(response)" class="p-error">
                                        Required — every response must have a description.
                                      </small>
                                    </div>

                                    <div class="form-field">
                                      <label>Content Type</label>
                                      <Select
                                        :value="getResponseContentType(response)"
                                        @change="setResponseContentType(response, $event.value)"
                                        :options="['application/json','application/xml','text/plain','text/html']"
                                        placeholder="Select content type"
                                      />
                                    </div>

                                    <template v-if="getResponseContentType(response)">
                                      <div class="form-field">
                                        <label>Schema</label>
                                        <div class="schema-selector">
                                          <Select
                                            :value="getResponseSchemaType(response)"
                                            @change="setResponseSchemaType(response, $event.value)"
                                            :options="['reference', 'inline']"
                                            placeholder="Schema type"
                                          />
                                          <template v-if="getResponseSchemaType(response) === 'reference'">
                                            <Select
                                              :value="getResponseSchemaRef(response)"
                                              @change="setResponseSchemaRef(response, $event.value)"
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

                                      <!-- Inline schema builder (mirrors Request Body) -->
                                      <template v-if="getResponseSchemaType(response) === 'inline'">
                                        <div class="form-field">
                                          <label class="required">Type</label>
                                          <Select
                                            :value="getResponseInlineSchemaType(response)"
                                            :options="['object','array','string','number','integer','boolean']"
                                            placeholder="Select type"
                                            @change="setResponseInlineSchemaType(response, $event.value)"
                                          />
                                        </div>

                                        <!-- object: property list -->
                                        <div v-if="getResponseInlineSchemaType(response) === 'object'">
                                          <div class="section-header">
                                            <h5>Properties</h5>
                                            <Button label="Add Property" icon="pi pi-plus" size="small" @click="addResponseProperty(response)" />
                                          </div>
                                          <div v-if="!getResponseInlineSchema(response).properties || Object.keys(getResponseInlineSchema(response).properties).length === 0" class="empty-state-small">
                                            <p>No properties defined</p>
                                          </div>
                                          <div
                                            v-for="(prop, propName) in getResponseInlineSchema(response).properties"
                                            :key="propName"
                                            class="property-item"
                                          >
                                            <div class="property-content">
                                              <div class="form-row">
                                                <div class="form-field">
                                                  <label class="required">Property Name</label>
                                                  <InputText
                                                    :value="propName"
                                                    @input="renameResponseProperty(response, propName, $event.target.value)"
                                                    placeholder="propertyName"
                                                  />
                                                </div>
                                                <div class="form-field">
                                                  <label class="required">Type</label>
                                                  <Select
                                                    v-model="prop.type"
                                                    :options="['string','number','integer','boolean','array','object','$ref']"
                                                    placeholder="Type"
                                                    @change="onPropertyTypeChange(prop)"
                                                  />
                                                </div>
                                              </div>
                                              <div v-if="prop.type === '$ref'" class="form-field">
                                                <label>Schema Reference</label>
                                                <div class="schema-selector">
                                                  <Select
                                                    v-model="prop.$ref"
                                                    :options="availableSchemas"
                                                    optionLabel="label"
                                                    optionValue="value"
                                                    :placeholder="availableSchemas.length === 0 ? 'No schemas available' : 'Select schema'"
                                                  />
                                                  <Button label="New Schema" icon="pi pi-plus" size="small" text @click="addSchema" />
                                                </div>
                                              </div>
                                              <div class="form-field" v-if="prop.type !== '$ref'">
                                                <label>Description</label>
                                                <InputText v-model="prop.description" placeholder="Property description" />
                                              </div>
                                              <template v-if="prop.type === 'string'">
                                                <div class="form-row">
                                                  <div class="form-field"><label>Format</label><Select v-model="prop.format" :options="['','date','date-time','password','byte','binary','email','uri','uuid','hostname','ipv4','ipv6']" placeholder="Format" /></div>
                                                  <div class="form-field"><label>Pattern</label><InputText v-model="prop.pattern" placeholder="^[a-zA-Z0-9]+$" /></div>
                                                </div>
                                                <div class="form-row">
                                                  <div class="form-field"><label>Min Length</label><InputNumber v-model="prop.minLength" placeholder="Min length" :min="0" /></div>
                                                  <div class="form-field"><label>Max Length</label><InputNumber v-model="prop.maxLength" placeholder="Max length" :min="0" /></div>
                                                </div>
                                              </template>
                                              <template v-if="prop.type === 'number' || prop.type === 'integer'">
                                                <div class="form-row">
                                                  <div class="form-field"><label>Format</label><Select v-model="prop.format" :options="prop.type === 'integer' ? ['','int32','int64'] : ['','float','double']" placeholder="Format" /></div>
                                                  <div class="form-field"><label>Multiple Of</label><InputNumber v-model="prop.multipleOf" placeholder="Multiple of" :min="0" /></div>
                                                </div>
                                                <div class="form-row">
                                                  <div class="form-field"><label>Minimum</label><InputNumber v-model="prop.minimum" placeholder="Min value" /></div>
                                                  <div class="form-field"><label>Maximum</label><InputNumber v-model="prop.maximum" placeholder="Max value" /></div>
                                                </div>
                                              </template>
                                              <template v-if="prop.type === 'array'">
                                                <div class="form-field" v-if="prop.items">
                                                  <label>Array Items Type</label>
                                                  <Select v-model="prop.items.type" :options="['string','number','integer','boolean','object','$ref']" placeholder="Items type" />
                                                </div>
                                                <div class="form-field" v-if="prop.items && prop.items.type === '$ref'">
                                                  <label>Array Items Schema Reference</label>
                                                  <Select v-model="prop.items.$ref" :options="availableSchemas" optionLabel="label" optionValue="value" :placeholder="availableSchemas.length === 0 ? 'No schemas available' : 'Select schema'" />
                                                </div>
                                                <div class="form-row">
                                                  <div class="form-field"><label>Min Items</label><InputNumber v-model="prop.minItems" placeholder="Min items" :min="0" /></div>
                                                  <div class="form-field"><label>Max Items</label><InputNumber v-model="prop.maxItems" placeholder="Max items" :min="0" /></div>
                                                </div>
                                                <div class="form-field checkbox-field">
                                                  <Checkbox v-model="prop.uniqueItems" :inputId="'resprop-unique-' + propName" :binary="true" />
                                                  <label :for="'resprop-unique-' + propName">Unique Items</label>
                                                </div>
                                              </template>
                                              <template v-if="prop.type !== '$ref'">
                                                <div class="form-field">
                                                  <label>Enum Values</label>
                                                  <AutoComplete multiple typeahead v-model="prop.enum" :suggestions="[]" placeholder="Add value and press Enter" @keydown.enter.prevent="addChipOnEnter($event, prop, 'enum')" />
                                                </div>
                                                <div class="form-row">
                                                  <div class="form-field"><label>Default Value</label><InputText v-model="prop.default" placeholder="Default value" /></div>
                                                  <div class="form-field"><label>Example</label><InputText v-model="prop.example" placeholder="Example value" /></div>
                                                </div>
                                              </template>
                                              <div class="form-row" v-if="prop.type !== '$ref'">
                                                <div class="form-field checkbox-field">
                                                  <Checkbox
                                                    :checked="getResponseInlineSchema(response).required && getResponseInlineSchema(response).required.includes(propName)"
                                                    :inputId="'resprop-req-' + propName"
                                                    :binary="true"
                                                    @change="toggleResponsePropertyRequired(response, propName, $event.checked)"
                                                  />
                                                  <label :for="'resprop-req-' + propName">Required</label>
                                                </div>
                                                <div class="form-field checkbox-field">
                                                  <template v-if="isOpenAPI31">
                                                    <Checkbox
                                                      :modelValue="Array.isArray(prop.type) && prop.type.includes('null')"
                                                      :inputId="'resprop-nullable-' + propName"
                                                      :binary="true"
                                                      @update:modelValue="val => {
                                                        const base = Array.isArray(prop.type) ? prop.type.filter(t => t !== 'null') : [prop.type || 'string'];
                                                        prop.type = val ? [...base, 'null'] : (base.length === 1 ? base[0] : base);
                                                      }"
                                                    />
                                                  </template>
                                                  <template v-else>
                                                    <Checkbox v-model="prop.nullable" :inputId="'resprop-nullable-' + propName" :binary="true" />
                                                  </template>
                                                  <label :for="'resprop-nullable-' + propName">Nullable</label>
                                                </div>
                                              </div>
                                            </div>
                                            <Button icon="pi pi-trash" severity="danger" text rounded @click="removeResponseProperty(response, propName)" />
                                          </div>
                                          <div class="form-row" style="margin-top: 0.75rem;">
                                            <div class="form-field"><label>Min Properties</label><InputNumber v-model="getResponseInlineSchema(response).minProperties" placeholder="Min properties" :min="0" /></div>
                                            <div class="form-field"><label>Max Properties</label><InputNumber v-model="getResponseInlineSchema(response).maxProperties" placeholder="Max properties" :min="0" /></div>
                                          </div>
                                          <div class="form-field checkbox-field">
                                            <Checkbox v-model="getResponseInlineSchema(response).additionalProperties" inputId="resp-addl-props" :binary="true" :trueValue="true" :falseValue="false" />
                                            <label for="resp-addl-props">Allow Additional Properties</label>
                                          </div>
                                        </div>

                                        <!-- array: item type + constraints -->
                                        <template v-if="getResponseInlineSchemaType(response) === 'array'">
                                          <div class="form-field">
                                            <label>Items Type(s)</label>
                                            <MultiSelect
                                              :modelValue="getResponseInlineSchema(response)._itemSchemas ? [...new Set(getResponseInlineSchema(response)._itemSchemas.map(s => s.type))] : []"
                                              :options="['string','number','integer','boolean','object']"
                                              placeholder="Select one or more types"
                                              display="chip"
                                              @update:modelValue="onItemTypesChange(getResponseInlineSchema(response), $event)"
                                            />
                                          </div>
                                          <div v-if="getResponseInlineSchema(response)._itemSchemas && getResponseInlineSchema(response)._itemSchemas.length > 0" class="item-schemas-list">
                                            <div
                                              v-for="(itemSchema, sIdx) in getResponseInlineSchema(response)._itemSchemas"
                                              :key="sIdx"
                                              class="item-schema-entry"
                                            >
                                              <div class="item-schema-entry-header">
                                                <span :class="['type-badge', 'type-badge--' + itemSchema.type]">{{ itemSchema.type }}</span>
                                                <span v-if="itemSchema.type === 'object' && itemSchema.$ref" class="item-schema-ref-label">{{ itemSchema.$ref.split('/').pop() }}</span>
                                                <Button icon="pi pi-trash" severity="danger" text rounded size="small" class="item-schema-remove" v-tooltip.top="'Remove this type entry'" @click="getResponseInlineSchema(response)._itemSchemas.splice(sIdx, 1)" />
                                              </div>
                                              <div class="item-schema-entry-body">
                                                <template v-if="itemSchema.type === 'object'">
                                                  <div class="form-field">
                                                    <label>Schema Reference</label>
                                                    <div class="schema-selector">
                                                      <Select v-model="itemSchema.$ref" :options="availableSchemas" optionLabel="label" optionValue="value" :placeholder="availableSchemas.length === 0 ? 'No schemas available' : 'Select schema'" />
                                                      <Button label="New Schema" icon="pi pi-plus" size="small" text @click="addSchema" />
                                                    </div>
                                                  </div>
                                                </template>
                                                <template v-else-if="itemSchema.type === 'string'">
                                                  <div class="form-row">
                                                    <div class="form-field"><label>Format</label><Select v-model="itemSchema.format" :options="['','date','date-time','email','uri','uuid','hostname','ipv4','ipv6']" placeholder="Format" /></div>
                                                    <div class="form-field"><label>Pattern</label><InputText v-model="itemSchema.pattern" placeholder="^[a-zA-Z0-9]+$" /></div>
                                                  </div>
                                                </template>
                                                <template v-else-if="itemSchema.type === 'number' || itemSchema.type === 'integer'">
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
                                          <div class="form-row" style="margin-top: 0.75rem;">
                                            <div class="form-field"><label>Min Items</label><InputNumber v-model="getResponseInlineSchema(response).minItems" placeholder="Min items" :min="0" /></div>
                                            <div class="form-field"><label>Max Items</label><InputNumber v-model="getResponseInlineSchema(response).maxItems" placeholder="Max items" :min="0" /></div>
                                          </div>
                                          <div class="form-field checkbox-field">
                                            <Checkbox v-model="getResponseInlineSchema(response).uniqueItems" inputId="resp-unique-items" :binary="true" />
                                            <label for="resp-unique-items">Unique Items</label>
                                          </div>
                                        </template>

                                        <!-- string constraints -->
                                        <template v-if="getResponseInlineSchemaType(response) === 'string'">
                                          <div class="form-row">
                                            <div class="form-field"><label>Format</label><Select v-model="getResponseInlineSchema(response).format" :options="['','date','date-time','password','byte','binary','email','uri','uuid','hostname','ipv4','ipv6']" placeholder="Format" /></div>
                                            <div class="form-field"><label>Pattern</label><InputText v-model="getResponseInlineSchema(response).pattern" placeholder="^[a-zA-Z0-9]+$" /></div>
                                          </div>
                                          <div class="form-row">
                                            <div class="form-field"><label>Min Length</label><InputNumber v-model="getResponseInlineSchema(response).minLength" placeholder="Min length" :min="0" /></div>
                                            <div class="form-field"><label>Max Length</label><InputNumber v-model="getResponseInlineSchema(response).maxLength" placeholder="Max length" :min="0" /></div>
                                          </div>
                                        </template>

                                        <!-- number/integer constraints -->
                                        <template v-if="getResponseInlineSchemaType(response) === 'number' || getResponseInlineSchemaType(response) === 'integer'">
                                          <div class="form-row">
                                            <div class="form-field"><label>Format</label><Select v-model="getResponseInlineSchema(response).format" :options="getResponseInlineSchemaType(response) === 'integer' ? ['','int32','int64'] : ['','float','double']" placeholder="Format" /></div>
                                            <div class="form-field"><label>Multiple Of</label><InputNumber v-model="getResponseInlineSchema(response).multipleOf" placeholder="Multiple of" :min="0" /></div>
                                          </div>
                                          <div class="form-row">
                                            <div class="form-field"><label>Minimum</label><InputNumber v-model="getResponseInlineSchema(response).minimum" placeholder="Min value" /></div>
                                            <div class="form-field"><label>Maximum</label><InputNumber v-model="getResponseInlineSchema(response).maximum" placeholder="Max value" /></div>
                                          </div>
                                        </template>

                                        <!-- common: enum / default / example (non-object) -->
                                        <template v-if="getResponseInlineSchemaType(response) !== 'object'">
                                          <div class="form-field">
                                            <label>Enum Values</label>
                                            <AutoComplete multiple typeahead v-model="getResponseInlineSchema(response).enum" :suggestions="[]" placeholder="Add value and press Enter" @keydown.enter.prevent="addChipOnEnter($event, getResponseInlineSchema(response), 'enum')" />
                                          </div>
                                          <div class="form-row">
                                            <div class="form-field"><label>Default Value</label><InputText v-model="getResponseInlineSchema(response).default" placeholder="Default value" /></div>
                                            <div class="form-field"><label>Example</label><InputText v-model="getResponseInlineSchema(response).example" placeholder="Example value" /></div>
                                          </div>
                                          <div class="form-field checkbox-field">
                                            <template v-if="isOpenAPI31">
                                              <Checkbox
                                                :modelValue="Array.isArray(getResponseInlineSchema(response).type) && getResponseInlineSchema(response).type.includes('null')"
                                                inputId="resp-nullable"
                                                :binary="true"
                                                @update:modelValue="val => {
                                                  const s = getResponseInlineSchema(response);
                                                  const base = Array.isArray(s.type) ? s.type.filter(t => t !== 'null') : [s.type || 'string'];
                                                  s.type = val ? [...base, 'null'] : (base.length === 1 ? base[0] : base);
                                                }"
                                              />
                                            </template>
                                            <template v-else>
                                              <Checkbox v-model="getResponseInlineSchema(response).nullable" inputId="resp-nullable" :binary="true" />
                                            </template>
                                            <label for="resp-nullable">Nullable</label>
                                          </div>
                                        </template>
                                      </template>
                                    </template>
                                    </template>
                                  </AccordionContent>
                                </AccordionPanel>
                              </Accordion>
                              </div>
                          </div>
</template>

<script>
import { computed } from "vue";
import "../../assets/form-editor-shared.css";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Textarea from "primevue/textarea";
import Select from "primevue/select";
import MultiSelect from "primevue/multiselect";
import Checkbox from "primevue/checkbox";
import AutoComplete from "primevue/autocomplete";
import Accordion from "primevue/accordion";
import AccordionPanel from "primevue/accordionpanel";
import AccordionHeader from "primevue/accordionheader";
import AccordionContent from "primevue/accordioncontent";
import Tag from "primevue/tag";

// One step ("Responses") of the operation editor — see
// OperationBasicInfoStep.vue's header comment for the shared contract.
export default {
  name: "OperationResponsesStep",
  components: {
    Button,
    InputText,
    InputNumber,
    Textarea,
    Select,
    MultiSelect,
    Checkbox,
    AutoComplete,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
    Tag,
  },
  props: {
    formData: { type: Object, required: true },
    api: { type: Object, required: true },
  },
  setup(props) {
    return {
      formData: computed(() => props.formData),
      ...props.api,
    };
  },
};
</script>
