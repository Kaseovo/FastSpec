<template>
            <div class="form-section">
              <div class="section-header">
                <h4>Component Schemas</h4>
                <Button
                  label="Add Schema"
                  icon="pi pi-plus"
                  size="small"
                  @click="addSchema"
                />
              </div>

              <div v-if="schemasList.length === 0" class="empty-state">
                <i class="pi pi-box"></i>
                <p>No schemas defined. Add one to get started.</p>
              </div>

              <Accordion v-if="schemasList.length > 0">
                <AccordionPanel
                  v-for="(schema, index) in schemasList"
                  :key="index"
                  :value="index.toString()"
                >
                  <AccordionHeader>
                    <div class="schema-header">
                      <span class="schema-name">{{ schema.name }}</span>
                      <Tag
                        v-if="schema.data.type"
                        :value="schema.data.type"
                        severity="info"
                      />
                      <Button
                        icon="pi pi-trash"
                        severity="danger"
                        text
                        rounded
                        size="small"
                        @click.stop="removeSchema(schema.name)"
                      />
                    </div>
                  </AccordionHeader>
                  <AccordionContent>
                    <Tabs value="0">
                      <TabList>
                        <Tab value="0">Builder</Tab>
                        <Tab value="1">JSON</Tab>
                      </TabList>
                      <TabPanels>
                        <TabPanel value="0">
                          <div class="schema-builder">
                            <div class="form-row">
                              <div class="form-field">
                                <label class="required">Schema Name</label>
                                <InputText
                                  :value="schema.name"
                                  @input="renameSchema(schema.name, $event.target.value)"
                                  placeholder="SchemaName"
                                />
                              </div>
                              <div class="form-field">
                                <label class="required">Type</label>
                                <Select
                                  v-model="schema.data.type"
                                  :options="[
                                    'object',
                                    'array',
                                    'string',
                                    'number',
                                    'integer',
                                    'boolean',
                                  ]"
                                  placeholder="Select type"
                                  @change="onSchemaTypeChange(schema)"
                                />
                              </div>
                            </div>

                            <div v-if="schema.data.type === 'object'">
                              <div class="section-header">
                                <h5>Properties</h5>
                                <Button
                                  label="Add Property"
                                  icon="pi pi-plus"
                                  size="small"
                                  @click="addSchemaProperty(schema.name)"
                                />
                              </div>

                              <div
                                v-if="
                                  !schema.data.properties ||
                                  Object.keys(schema.data.properties).length ===
                                    0
                                "
                                class="empty-state-small"
                              >
                                <p>No properties defined</p>
                              </div>

                              <div
                                v-for="(prop, propName, propIndex) in schema
                                  .data.properties"
                                :key="propName"
                                class="property-item"
                                draggable="true"
                                @dragstart="
                                  handleDragStart(
                                    $event,
                                    schema.name,
                                    propName,
                                    propIndex
                                  )
                                "
                                @dragover="handleDragOver($event)"
                                @drop="
                                  handleDrop($event, schema.name, propIndex)
                                "
                                @dragend="handleDragEnd"
                                :class="{
                                  dragging: draggedProperty === propName,
                                }"
                              >
                                <div
                                  class="drag-handle"
                                  title="Drag to reorder"
                                >
                                  <i class="pi pi-bars"></i>
                                </div>
                                <div class="property-content">
                                  <div class="form-row">
                                    <div class="form-field">
                                      <label class="required">Property Name</label>
                                      <InputText
                                        :value="propName"
                                        @input="
                                          renameSchemaProperty(
                                            schema.name,
                                            propName,
                                            $event.target.value
                                          )
                                        "
                                        placeholder="propertyName"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label class="required">Type</label>
                                      <Select
                                        v-model="prop.type"
                                        :options="[
                                          'string',
                                          'number',
                                          'integer',
                                          'boolean',
                                          'array',
                                          'object',
                                          '$ref',
                                        ]"
                                        placeholder="Type"
                                        @change="onPropertyTypeChange(prop)"
                                        />
                                    </div>
                                  </div>

                                 <!-- $ref selector when type is $ref -->
                                 <div
                                   v-if="prop.type === '$ref'"
                                   class="form-field"
                                 >
                                   <label>Schema Reference</label>
                                   <Select
                                     v-model="prop.$ref"
                                     :options="availableSchemas"
                                     optionLabel="label"
                                     optionValue="value"
                                     :placeholder="availableSchemas.length === 0 ? 'No schemas available' : 'Select schema'"
                                   />
                                 </div>

                                 <div class="form-field" v-if="prop.type !== '$ref'">
                                    <label>Description</label>
                                    <InputText
                                      v-model="prop.description"
                                      placeholder="Property description"
                                    />
                                  </div>

                                  <!-- String validations -->
                                  <div
                                    v-if="prop.type === 'string'"
                                    class="form-row"
                                  >
                                    <div class="form-field">
                                      <label>Format</label>
                                      <Select
                                        v-model="prop.format"
                                        :options="[
                                          '',
                                          'date',
                                          'date-time',
                                          'password',
                                          'byte',
                                          'binary',
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
                                        v-model="prop.pattern"
                                        placeholder="^[a-zA-Z0-9]+$"
                                      />
                                    </div>
                                  </div>

                                  <div
                                    v-if="prop.type === 'string'"
                                    class="form-row"
                                  >
                                    <div class="form-field">
                                      <label>Min Length</label>
                                      <InputNumber
                                        v-model="prop.minLength"
                                        placeholder="Min length"
                                        :min="0"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Max Length</label>
                                      <InputNumber
                                        v-model="prop.maxLength"
                                        placeholder="Max length"
                                        :min="0"
                                      />
                                    </div>
                                  </div>

                                  <!-- Number/Integer validations -->
                                  <div
                                    v-if="
                                      prop.type === 'number' ||
                                      prop.type === 'integer'
                                    "
                                    class="form-row"
                                  >
                                    <div class="form-field">
                                      <label>Format</label>
                                      <Select
                                        v-model="prop.format"
                                        :options="
                                          prop.type === 'integer'
                                            ? ['', 'int32', 'int64']
                                            : ['', 'float', 'double']
                                        "
                                        placeholder="Format"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Multiple Of</label>
                                      <InputNumber
                                        v-model="prop.multipleOf"
                                        placeholder="Multiple of"
                                        :min="0"
                                      />
                                    </div>
                                  </div>

                                  <div
                                    v-if="
                                      prop.type === 'number' ||
                                      prop.type === 'integer'
                                    "
                                    class="form-row"
                                  >
                                    <div class="form-field">
                                      <label>Minimum</label>
                                      <InputNumber
                                        v-model="prop.minimum"
                                        placeholder="Min value"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Maximum</label>
                                      <InputNumber
                                        v-model="prop.maximum"
                                        placeholder="Max value"
                                      />
                                    </div>
                                  </div>

                                  <div
                                    v-if="
                                      prop.type === 'number' ||
                                      prop.type === 'integer'
                                    "
                                    class="form-row"
                                  >
                                    <template v-if="isOpenAPI31">
                                      <div class="form-field">
                                        <label :for="'prop-excl-min-' + propName">Exclusive Minimum</label>
                                        <InputNumber
                                          v-model="prop.exclusiveMinimum"
                                          :inputId="'prop-excl-min-' + propName"
                                          placeholder="Exclusive min value"
                                        />
                                      </div>
                                      <div class="form-field">
                                        <label :for="'prop-excl-max-' + propName">Exclusive Maximum</label>
                                        <InputNumber
                                          v-model="prop.exclusiveMaximum"
                                          :inputId="'prop-excl-max-' + propName"
                                          placeholder="Exclusive max value"
                                        />
                                      </div>
                                    </template>
                                    <template v-else>
                                      <div class="form-field checkbox-field">
                                        <Checkbox
                                          v-model="prop.exclusiveMinimum"
                                          :inputId="'prop-excl-min-' + propName"
                                          :binary="true"
                                        />
                                        <label :for="'prop-excl-min-' + propName"
                                          >Exclusive Minimum</label
                                        >
                                      </div>
                                      <div class="form-field checkbox-field">
                                        <Checkbox
                                          v-model="prop.exclusiveMaximum"
                                          :inputId="'prop-excl-max-' + propName"
                                          :binary="true"
                                        />
                                        <label :for="'prop-excl-max-' + propName"
                                          >Exclusive Maximum</label
                                        >
                                      </div>
                                    </template>
                                  </div>

                                  <!-- Array validations -->
                                  <div
                                    v-if="prop.type === 'array' && prop.items"
                                    class="form-field"
                                  >
                                    <label>Array Items Type</label>
                                    <Select
                                      v-model="prop.items.type"
                                      :options="[
                                        'string',
                                        'number',
                                        'integer',
                                        'boolean',
                                        'object',
                                        '$ref',
                                      ]"
                                      placeholder="Items type"
                                    />
                                  </div>
                                  <div
                                    v-if="prop.type === 'array' && prop.items && prop.items.type === '$ref'"
                                    class="form-field"
                                  >
                                    <label>Array Items Schema Reference</label>
                                    <Select
                                      v-model="prop.items.$ref"
                                      :options="availableSchemas"
                                      optionLabel="label"
                                      optionValue="value"
                                      :placeholder="availableSchemas.length === 0 ? 'No schemas available' : 'Select schema'"
                                    />
                                  </div>

                                  <div
                                    v-if="prop.type === 'array'"
                                    class="form-row"
                                  >
                                    <div class="form-field">
                                      <label>Min Items</label>
                                      <InputNumber
                                        v-model="prop.minItems"
                                        placeholder="Min items"
                                        :min="0"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Max Items</label>
                                      <InputNumber
                                        v-model="prop.maxItems"
                                        placeholder="Max items"
                                        :min="0"
                                      />
                                    </div>
                                  </div>

                                  <div
                                    v-if="prop.type === 'array'"
                                    class="form-field checkbox-field"
                                  >
                                    <Checkbox
                                      v-model="prop.uniqueItems"
                                      :inputId="'prop-unique-' + propName"
                                      :binary="true"
                                    />
                                    <label :for="'prop-unique-' + propName"
                                      >Unique Items</label
                                    >
                                  </div>

                                  <!-- Common validations for all types (hidden for $ref) -->
                                  <div class="form-field" v-if="prop.type !== '$ref'">
                                    <label>Enum Values</label>
                                    <AutoComplete
                                      multiple
                                      typeahead
                                      v-model="prop.enum"
                                      placeholder="Add value and press Enter"
                                      @keydown.enter.prevent="addChipOnEnter($event, prop, 'enum')"
                                    />
                                  </div>

                                  <div class="form-row" v-if="prop.type !== '$ref'">
                                    <div class="form-field">
                                      <label>Default Value</label>
                                      <InputText
                                        v-model="prop.default"
                                        placeholder="Default value"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Example</label>
                                      <InputText
                                        v-model="prop.example"
                                        placeholder="Example value"
                                      />
                                    </div>
                                  </div>

                                  <div class="form-row">
                                    <div class="form-field checkbox-field">
                                      <Checkbox
                                        :checked="
                                          schema.data.required?.includes(propName)
                                        "
                                        @change="
                                          toggleSchemaPropertyRequired(
                                            schema.name,
                                            propName,
                                            $event.checked
                                          )
                                        "
                                        :inputId="'prop-req-' + propName"
                                        :binary="true"
                                      />
                                      <label :for="'prop-req-' + propName"
                                        >Required</label
                                      >
                                    </div>
                                    <div class="form-field checkbox-field">
                                      <template v-if="isOpenAPI31">
                                        <Checkbox
                                          :modelValue="Array.isArray(prop.type) && prop.type.includes('null')"
                                          :inputId="'prop-nullable-' + propName"
                                          :binary="true"
                                          @update:modelValue="val => {
                                            const base = Array.isArray(prop.type) ? prop.type.filter(t => t !== 'null') : [prop.type || 'string'];
                                            prop.type = val ? [...base, 'null'] : (base.length === 1 ? base[0] : base);
                                          }"
                                        />
                                      </template>
                                      <template v-else>
                                        <Checkbox
                                          v-model="prop.nullable"
                                          :inputId="'prop-nullable-' + propName"
                                          :binary="true"
                                        />
                                      </template>
                                      <label :for="'prop-nullable-' + propName"
                                        >Nullable</label
                                      >
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  icon="pi pi-trash"
                                  severity="danger"
                                  text
                                  rounded
                                  @click="
                                    removeSchemaProperty(schema.name, propName)
                                  "
                                />
                              </div>
                            </div>

                            <!-- String top-level schema validations -->
                            <div v-if="schema.data.type === 'string'">
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Format</label>
                                  <Select
                                    v-model="schema.data.format"
                                    :options="[
                                      '',
                                      'date',
                                      'date-time',
                                      'password',
                                      'byte',
                                      'binary',
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
                                    v-model="schema.data.pattern"
                                    placeholder="^[a-zA-Z0-9]+$"
                                  />
                                </div>
                              </div>
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Min Length</label>
                                  <InputNumber
                                    v-model="schema.data.minLength"
                                    placeholder="Min length"
                                    :min="0"
                                  />
                                </div>
                                <div class="form-field">
                                  <label>Max Length</label>
                                  <InputNumber
                                    v-model="schema.data.maxLength"
                                    placeholder="Max length"
                                    :min="0"
                                  />
                                </div>
                              </div>
                            </div>

                            <!-- Number/Integer top-level schema validations -->
                            <div
                              v-if="
                                schema.data.type === 'number' ||
                                schema.data.type === 'integer'
                              "
                            >
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Format</label>
                                  <Select
                                    v-model="schema.data.format"
                                    :options="
                                      schema.data.type === 'integer'
                                        ? ['', 'int32', 'int64']
                                        : ['', 'float', 'double']
                                    "
                                    placeholder="Format"
                                  />
                                </div>
                                <div class="form-field">
                                  <label>Multiple Of</label>
                                  <InputNumber
                                    v-model="schema.data.multipleOf"
                                    placeholder="Multiple of"
                                    :min="0"
                                  />
                                </div>
                              </div>
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Minimum</label>
                                  <InputNumber
                                    v-model="schema.data.minimum"
                                    placeholder="Min value"
                                  />
                                </div>
                                <div class="form-field">
                                  <label>Maximum</label>
                                  <InputNumber
                                    v-model="schema.data.maximum"
                                    placeholder="Max value"
                                  />
                                </div>
                              </div>
                              <div class="form-row">
                                <template v-if="isOpenAPI31">
                                  <div class="form-field">
                                    <label :for="'schema-excl-min-' + schema.name">Exclusive Minimum</label>
                                    <InputNumber
                                      v-model="schema.data.exclusiveMinimum"
                                      :inputId="'schema-excl-min-' + schema.name"
                                      placeholder="Exclusive min value"
                                    />
                                  </div>
                                  <div class="form-field">
                                    <label :for="'schema-excl-max-' + schema.name">Exclusive Maximum</label>
                                    <InputNumber
                                      v-model="schema.data.exclusiveMaximum"
                                      :inputId="'schema-excl-max-' + schema.name"
                                      placeholder="Exclusive max value"
                                    />
                                  </div>
                                </template>
                                <template v-else>
                                  <div class="form-field checkbox-field">
                                    <Checkbox
                                      v-model="schema.data.exclusiveMinimum"
                                      :inputId="'schema-excl-min-' + schema.name"
                                      :binary="true"
                                    />
                                    <label
                                      :for="'schema-excl-min-' + schema.name"
                                      >Exclusive Minimum</label
                                    >
                                  </div>
                                  <div class="form-field checkbox-field">
                                    <Checkbox
                                      v-model="schema.data.exclusiveMaximum"
                                      :inputId="'schema-excl-max-' + schema.name"
                                      :binary="true"
                                    />
                                    <label
                                      :for="'schema-excl-max-' + schema.name"
                                      >Exclusive Maximum</label
                                    >
                                  </div>
                                </template>
                              </div>
                            </div>

                            <!-- Array top-level schema validations -->
                            <div v-if="schema.data.type === 'array'">
                              <div class="form-field" v-if="schema.data.items">
                                <label>Array Items Type</label>
                                <Select
                                  v-model="schema.data.items.type"
                                  :options="[
                                    'string',
                                    'number',
                                    'integer',
                                    'boolean',
                                    'object',
                                    '$ref',
                                  ]"
                                  placeholder="Items type"
                                />
                              </div>
                              <div
                                class="form-field"
                                v-if="schema.data.items && schema.data.items.type === '$ref'"
                              >
                                <label>Array Items Schema Reference</label>
                                <Select
                                  v-model="schema.data.items.$ref"
                                  :options="availableSchemas"
                                  optionLabel="label"
                                  optionValue="value"
                                  :placeholder="availableSchemas.length === 0 ? 'No schemas available' : 'Select schema'"
                                />
                              </div>
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Min Items</label>
                                  <InputNumber
                                    v-model="schema.data.minItems"
                                    placeholder="Min items"
                                    :min="0"
                                  />
                                </div>
                                <div class="form-field">
                                  <label>Max Items</label>
                                  <InputNumber
                                    v-model="schema.data.maxItems"
                                    placeholder="Max items"
                                    :min="0"
                                  />
                                </div>
                              </div>
                              <div class="form-field checkbox-field">
                                <Checkbox
                                  v-model="schema.data.uniqueItems"
                                  :inputId="'schema-unique-' + schema.name"
                                  :binary="true"
                                />
                                <label :for="'schema-unique-' + schema.name"
                                  >Unique Items</label
                                >
                              </div>
                            </div>

                            <!-- Object top-level additional validations -->
                            <div v-if="schema.data.type === 'object'">
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Min Properties</label>
                                  <InputNumber
                                    v-model="schema.data.minProperties"
                                    placeholder="Min properties"
                                    :min="0"
                                  />
                                </div>
                                <div class="form-field">
                                  <label>Max Properties</label>
                                  <InputNumber
                                    v-model="schema.data.maxProperties"
                                    placeholder="Max properties"
                                    :min="0"
                                  />
                                </div>
                              </div>
                              <div class="form-field checkbox-field">
                                <Checkbox
                                  v-model="schema.data.additionalProperties"
                                  :inputId="
                                    'schema-addl-props-' + schema.name
                                  "
                                  :binary="true"
                                  :trueValue="true"
                                  :falseValue="false"
                                />
                                <label
                                  :for="'schema-addl-props-' + schema.name"
                                  >Allow Additional Properties</label
                                >
                              </div>
                            </div>

                            <!-- Common fields for all non-object types -->
                            <div
                              v-if="schema.data.type !== 'object'"
                            >
                              <div class="form-field">
                                <label>Enum Values</label>
                                <AutoComplete
                                  multiple
                                  typeahead
                                  v-model="schema.data.enum"
                                  placeholder="Add value and press Enter"
                                  @keydown.enter.prevent="addChipOnEnter($event, schema.data, 'enum')"
                                />
                              </div>
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Default Value</label>
                                  <InputText
                                    v-model="schema.data.default"
                                    placeholder="Default value"
                                  />
                                </div>
                                <div class="form-field">
                                  <label>Example</label>
                                  <InputText
                                    v-model="schema.data.example"
                                    placeholder="Example value"
                                  />
                                </div>
                              </div>
                              <div class="form-field checkbox-field">
                                <template v-if="isOpenAPI31">
                                  <Checkbox
                                    :modelValue="Array.isArray(schema.data.type) && schema.data.type.includes('null')"
                                    :inputId="'schema-nullable-' + schema.name"
                                    :binary="true"
                                    @update:modelValue="val => {
                                      const base = Array.isArray(schema.data.type) ? schema.data.type.filter(t => t !== 'null') : [schema.data.type || 'string'];
                                      schema.data.type = val ? [...base, 'null'] : (base.length === 1 ? base[0] : base);
                                    }"
                                  />
                                </template>
                                <template v-else>
                                  <Checkbox
                                    v-model="schema.data.nullable"
                                    :inputId="'schema-nullable-' + schema.name"
                                    :binary="true"
                                  />
                                </template>
                                <label
                                  :for="'schema-nullable-' + schema.name"
                                  >Nullable</label
                                >
                              </div>
                            </div>
                          </div>
                        </TabPanel>
                        <TabPanel value="1">
                          <div class="schema-json-editor">
                            <div class="json-editor-header">
                              <label>Schema JSON</label>
                              <div class="json-editor-actions">
                                <Button
                                  label="Format"
                                  icon="pi pi-align-left"
                                  size="small"
                                  text
                                  @click="
                                    updateSchema(
                                      schema.name,
                                      JSON.stringify(
                                        JSON.parse(
                                          JSON.stringify(schema.data, null, 2)
                                        ),
                                        null,
                                        2
                                      )
                                    )
                                  "
                                />
                                <Button
                                  label="Copy"
                                  icon="pi pi-copy"
                                  size="small"
                                  text
                                  @click="
                                    navigator.clipboard.writeText(
                                      JSON.stringify(schema.data, null, 2)
                                    )
                                  "
                                />
                              </div>
                            </div>
                            <div class="json-editor-wrapper">
                              <Textarea
                                :value="JSON.stringify(schema.data, null, 2)"
                                @input="
                                  updateSchema(schema.name, $event.target.value)
                                "
                                rows="20"
                                class="json-textarea monaco-style"
                                spellcheck="false"
                              />
                            </div>
                          </div>
                        </TabPanel>
                      </TabPanels>
                    </Tabs>
                  </AccordionContent>
                </AccordionPanel>
              </Accordion>
            </div>
</template>

<script>
import "../../assets/form-editor-shared.css";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Textarea from "primevue/textarea";
import Select from "primevue/select";
import MultiSelect from "primevue/multiselect";
import Checkbox from "primevue/checkbox";
import AutoComplete from "primevue/autocomplete";
import Tabs from "primevue/tabs";
import TabList from "primevue/tablist";
import Tab from "primevue/tab";
import TabPanels from "primevue/tabpanels";
import TabPanel from "primevue/tabpanel";
import Accordion from "primevue/accordion";
import AccordionPanel from "primevue/accordionpanel";
import AccordionHeader from "primevue/accordionheader";
import AccordionContent from "primevue/accordioncontent";
import Tag from "primevue/tag";

// The "Components / schemas" tab of FormEditor. Receives the whole reactive
// `formData` object as one mutable prop plus an `api` bundle (the return value
// of useComponentsEditor() instantiated once in FormEditor). Re-exposing the
// bundle from setup() keeps the moved template's bare identifiers working.
export default {
  name: "ComponentsTab",
  components: {
    Button,
    InputText,
    InputNumber,
    Textarea,
    Select,
    MultiSelect,
    Checkbox,
    AutoComplete,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
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
    return { formData: props.formData, ...props.api };
  },
};
</script>
