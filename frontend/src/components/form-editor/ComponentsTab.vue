<template>
            <div class="form-section">
              <div class="section-header">
                <h4>Component Schemas</h4>
                <Button
                  label="Add Schema"
                  icon="pi pi-plus"
                  size="small"
                  @click="openAddSchemaDialog"
                />
              </div>

              <div v-if="schemasList.length === 0" class="empty-state">
                <i class="pi pi-box"></i>
                <p>No schemas defined. Add one to get started.</p>
              </div>

              <div v-else class="filter-bar">
                <IconField class="filter-bar__search">
                  <InputIcon class="pi pi-search" />
                  <InputText
                    v-model="schemaSearchQuery"
                    placeholder="Search schema or property names…"
                    class="w-full"
                  />
                </IconField>
                <Button
                  v-if="hasActiveSchemaFilter"
                  label="Clear"
                  icon="pi pi-times"
                  size="small"
                  text
                  @click="clearSchemaFilter"
                />
              </div>

              <div
                v-if="schemasList.length > 0 && filteredSchemasList.length === 0"
                class="empty-state-small"
              >
                <p>No schemas match your search.</p>
              </div>

              <Accordion v-if="schemasList.length > 0" :multiple="true" :value="openSchemas" @update:value="openSchemas = $event">
                <AccordionPanel
                  v-for="(schema, index) in filteredSchemasList"
                  :key="schema.name"
                  :value="index.toString()"
                >
                  <AccordionHeader>
                    <div class="schema-header">
                      <span class="schema-name">{{ schema.name }}</span>
                      <Tag :value="getSchemaKind(schema.data)" severity="info" />
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
                                  :modelValue="getSchemaKind(schema.data)"
                                  @update:modelValue="setSchemaKind(schema.data, $event)"
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
                            </div>

                            <!-- ── Schema composition ── -->
                            <div v-if="isCompositionKind(getSchemaKind(schema.data))">
                              <div class="form-field">
                                <label class="required">Member Schemas</label>
                                <MultiSelect
                                  :modelValue="compositionMemberRefs(schema.data, getSchemaKind(schema.data))"
                                  @update:modelValue="setCompositionMembers(schema.data, getSchemaKind(schema.data), $event)"
                                  :options="availableSchemas.filter((s) => s.label !== schema.name)"
                                  optionLabel="label"
                                  optionValue="value"
                                  display="chip"
                                  placeholder="Select the schemas that make up this composition"
                                />
                                <small class="helper-text">
                                  {{
                                    getSchemaKind(schema.data) === 'allOf'
                                      ? 'The resulting schema must satisfy ALL of the selected schemas.'
                                      : getSchemaKind(schema.data) === 'oneOf'
                                        ? 'The resulting schema must satisfy EXACTLY ONE of the selected schemas.'
                                        : 'The resulting schema must satisfy AT LEAST ONE of the selected schemas.'
                                  }}
                                </small>
                              </div>

                              <div v-if="getSchemaKind(schema.data) !== 'allOf'" class="form-field checkbox-field">
                                <Checkbox
                                  :modelValue="!!schema.data.discriminator"
                                  @update:modelValue="setDiscriminatorEnabled(schema.data, $event)"
                                  :inputId="'discriminator-enabled-' + schema.name"
                                  :binary="true"
                                />
                                <label :for="'discriminator-enabled-' + schema.name">
                                  Use a discriminator (tells readers which member schema applies, by property value)
                                </label>
                              </div>

                              <template v-if="schema.data.discriminator">
                                <div class="form-field">
                                  <label class="required">Discriminator Property</label>
                                  <InputText
                                    v-model="schema.data.discriminator.propertyName"
                                    placeholder="e.g. petType"
                                  />
                                </div>

                                <div class="section-header">
                                  <button
                                    class="section-header__toggle"
                                    @click="toggleSchemaSection(schema.name, 'mapping')"
                                  >
                                    <i
                                      class="pi pi-chevron-right method-section-caret"
                                      :class="{ 'method-section-caret--open': !isSchemaSectionCollapsed(schema.name, 'mapping') }"
                                    ></i>
                                    <h5>Mapping (optional)</h5>
                                    <span
                                      v-if="schema.data.discriminator.mapping && Object.keys(schema.data.discriminator.mapping).length"
                                      class="section-header__count"
                                    >{{ Object.keys(schema.data.discriminator.mapping).length }}</span>
                                  </button>
                                  <Button
                                    label="Add Mapping"
                                    icon="pi pi-plus"
                                    size="small"
                                    text
                                    @click="expandSchemaSection(schema.name, 'mapping'); addDiscriminatorMapping(schema.data)"
                                  />
                                </div>
                                <div v-show="!isSchemaSectionCollapsed(schema.name, 'mapping')">
                                <small class="helper-text">
                                  If omitted, the discriminator property's value is matched against member schema names directly.
                                </small>
                                <div
                                  v-for="(ref, key) in schema.data.discriminator.mapping"
                                  :key="key"
                                  class="list-item"
                                >
                                  <div class="list-item-content">
                                    <div class="form-row">
                                      <div class="form-field">
                                        <label>Property Value</label>
                                        <InputText
                                          :value="key"
                                          @input="renameDiscriminatorMappingKey(schema.data, key, $event.target.value)"
                                        />
                                      </div>
                                      <div class="form-field">
                                        <label>Schema</label>
                                        <Select
                                          v-model="schema.data.discriminator.mapping[key]"
                                          :options="availableSchemas"
                                          optionLabel="label"
                                          optionValue="value"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <Button
                                    icon="pi pi-trash"
                                    severity="danger"
                                    text
                                    rounded
                                    @click="removeDiscriminatorMapping(schema.data, key)"
                                  />
                                </div>
                                </div>
                              </template>
                            </div>

                            <div v-if="schema.data.type === 'object'">
                              <div class="section-header">
                                <button
                                  class="section-header__toggle"
                                  @click="toggleSchemaSection(schema.name, 'properties')"
                                >
                                  <i
                                    class="pi pi-chevron-right method-section-caret"
                                    :class="{ 'method-section-caret--open': !isSchemaSectionCollapsed(schema.name, 'properties') }"
                                  ></i>
                                  <h5>Properties</h5>
                                  <span
                                    v-if="schema.data.properties && Object.keys(schema.data.properties).length"
                                    class="section-header__count"
                                  >{{ Object.keys(schema.data.properties).length }}</span>
                                </button>
                                <Button
                                  label="Add Property"
                                  icon="pi pi-plus"
                                  size="small"
                                  @click="onAddSchemaProperty(schema.name)"
                                />
                              </div>

                              <div v-show="!isSchemaSectionCollapsed(schema.name, 'properties')">
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
                                  class="item-row-header"
                                  @click="togglePropertyExpanded(schema.name, propName)"
                                >
                                  <div class="drag-handle" title="Drag to reorder">
                                    <i class="pi pi-bars"></i>
                                  </div>
                                  <i
                                    class="pi pi-chevron-right item-row-caret"
                                    :class="{ 'item-row-caret--open': isPropertyExpanded(schema.name, propName) }"
                                  ></i>
                                  <span class="item-row-name">{{ propName }}</span>
                                  <div class="item-row-badges">
                                    <span :class="['type-badge', 'type-badge--' + (Array.isArray(prop.type) ? prop.type.find(t => t !== 'null') : prop.type)]">
                                      {{ Array.isArray(prop.type) ? prop.type.join(' | ') : prop.type }}
                                    </span>
                                    <Tag v-if="schema.data.required?.includes(propName)" value="required" severity="warn" />
                                  </div>
                                  <Button
                                    icon="pi pi-trash"
                                    severity="danger"
                                    text
                                    rounded
                                    size="small"
                                    class="item-row-delete"
                                    @click.stop="removeSchemaProperty(schema.name, propName)"
                                  />
                                </div>
                                <div v-show="isPropertyExpanded(schema.name, propName)" class="item-row-body">
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
                                      :suggestions="[]"
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
                                </div>
                              </div>
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
                                  :suggestions="[]"
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

              <!-- ── Reusable Parameters ── -->
              <div class="components-subsection">
                <div class="section-header">
                  <button class="section-header__toggle" @click="reusableParamsCollapsed = !reusableParamsCollapsed">
                    <i
                      class="pi pi-chevron-right method-section-caret"
                      :class="{ 'method-section-caret--open': !reusableParamsCollapsed }"
                    ></i>
                    <h4>Reusable Parameters</h4>
                    <span v-if="parametersList.length" class="section-header__count">{{ parametersList.length }}</span>
                  </button>
                  <Button
                    label="Add Parameter"
                    icon="pi pi-plus"
                    size="small"
                    @click="reusableParamsCollapsed = false; addReusableParameter()"
                  />
                </div>

                <div v-show="!reusableParamsCollapsed">
                <div v-if="parametersList.length === 0" class="empty-state-small">
                  <p>No reusable parameters yet. Define one here to reference it from any operation's Parameters tab.</p>
                </div>

                <Accordion v-if="parametersList.length > 0">
                  <AccordionPanel
                    v-for="(parameter, index) in parametersList"
                    :key="parameter.name"
                    :value="index.toString()"
                  >
                    <AccordionHeader>
                      <div class="schema-header">
                        <span class="schema-name">{{ parameter.name }}</span>
                        <Tag :value="parameter.data.in" severity="info" />
                        <Button
                          icon="pi pi-trash"
                          severity="danger"
                          text
                          rounded
                          size="small"
                          @click.stop="removeReusableParameter(parameter.name)"
                        />
                      </div>
                    </AccordionHeader>
                    <AccordionContent>
                      <div class="form-row">
                        <div class="form-field">
                          <label class="required">Component Name</label>
                          <InputText
                            :value="parameter.name"
                            @input="renameReusableParameter(parameter.name, $event.target.value)"
                            placeholder="e.g. PageOffset"
                          />
                        </div>
                        <div class="form-field">
                          <label class="required">Parameter Name</label>
                          <InputText v-model="parameter.data.name" placeholder="offset" />
                        </div>
                      </div>
                      <div class="form-row">
                        <div class="form-field">
                          <label class="required">Location</label>
                          <Select
                            v-model="parameter.data.in"
                            :options="['query', 'header', 'cookie']"
                          />
                        </div>
                        <div class="form-field">
                          <label class="required">Type</label>
                          <Select
                            v-model="parameter.data.schema.type"
                            :options="['string', 'number', 'integer', 'boolean', 'array']"
                          />
                        </div>
                      </div>
                      <div
                        v-if="parameter.data.schema.type === 'array'"
                        class="form-field"
                      >
                        <label>Item Type</label>
                        <Select
                          :modelValue="parameter.data.schema.items?.type || 'string'"
                          @update:modelValue="parameter.data.schema.items = { type: $event }"
                          :options="['string', 'number', 'integer', 'boolean']"
                        />
                      </div>
                      <div class="form-field">
                        <label>Description</label>
                        <Textarea v-model="parameter.data.description" rows="2" />
                      </div>
                      <div class="form-field checkbox-field">
                        <Checkbox
                          v-model="parameter.data.required"
                          :inputId="'reusable-param-required-' + parameter.name"
                          :binary="true"
                        />
                        <label :for="'reusable-param-required-' + parameter.name">Required</label>
                      </div>
                    </AccordionContent>
                  </AccordionPanel>
                </Accordion>
                </div>
              </div>

              <!-- ── Reusable Responses ── -->
              <div class="components-subsection">
                <div class="section-header">
                  <button class="section-header__toggle" @click="reusableResponsesCollapsed = !reusableResponsesCollapsed">
                    <i
                      class="pi pi-chevron-right method-section-caret"
                      :class="{ 'method-section-caret--open': !reusableResponsesCollapsed }"
                    ></i>
                    <h4>Reusable Responses</h4>
                    <span v-if="responsesList.length" class="section-header__count">{{ responsesList.length }}</span>
                  </button>
                  <Button
                    label="Add Response"
                    icon="pi pi-plus"
                    size="small"
                    @click="reusableResponsesCollapsed = false; addReusableResponse()"
                  />
                </div>

                <div v-show="!reusableResponsesCollapsed">
                <div v-if="responsesList.length === 0" class="empty-state-small">
                  <p>No reusable responses yet. Define one here to reference it from any operation's Responses tab.</p>
                </div>

                <Accordion v-if="responsesList.length > 0">
                  <AccordionPanel
                    v-for="(response, index) in responsesList"
                    :key="response.name"
                    :value="index.toString()"
                  >
                    <AccordionHeader>
                      <div class="schema-header">
                        <span class="schema-name">{{ response.name }}</span>
                        <span
                          :class="{ 'response-header__missing-desc': !response.data.description || !response.data.description.trim() }"
                        >
                          {{ response.data.description || "Description required" }}
                        </span>
                        <Button
                          icon="pi pi-trash"
                          severity="danger"
                          text
                          rounded
                          size="small"
                          @click.stop="removeReusableResponse(response.name)"
                        />
                      </div>
                    </AccordionHeader>
                    <AccordionContent>
                      <div class="form-field">
                        <label class="required">Component Name</label>
                        <InputText
                          :value="response.name"
                          @input="renameReusableResponse(response.name, $event.target.value)"
                          placeholder="e.g. NotFoundError"
                        />
                      </div>
                      <div class="form-field">
                        <label class="required">Description</label>
                        <Textarea
                          v-model="response.data.description"
                          rows="2"
                          placeholder="Response description"
                          :class="{ 'p-invalid': !response.data.description || !response.data.description.trim() }"
                        />
                      </div>

                      <div class="form-field checkbox-field">
                        <Checkbox
                          :modelValue="!!getResponseContentType(response.data)"
                          @update:modelValue="setResponseContentType(response.data, $event ? 'application/json' : '')"
                          :inputId="'reusable-response-has-body-' + response.name"
                          :binary="true"
                        />
                        <label :for="'reusable-response-has-body-' + response.name">Has a response body</label>
                      </div>

                      <template v-if="getResponseContentType(response.data)">
                        <div class="form-field">
                          <label>Content Type</label>
                          <InputText
                            :modelValue="getResponseContentType(response.data)"
                            @update:modelValue="setResponseContentType(response.data, $event)"
                            placeholder="application/json"
                          />
                        </div>
                        <div class="form-field">
                          <label>Schema</label>
                          <Select
                            :modelValue="getResponseSchemaType(response.data)"
                            @update:modelValue="setResponseSchemaType(response.data, $event)"
                            :options="[
                              { label: 'Inline object', value: 'inline' },
                              { label: 'Reference to a schema', value: 'reference' },
                            ]"
                            optionLabel="label"
                            optionValue="value"
                          />
                        </div>

                        <div v-if="getResponseSchemaType(response.data) === 'reference'" class="form-field">
                          <label>Schema Reference</label>
                          <Select
                            :modelValue="getResponseSchemaRef(response.data)"
                            @update:modelValue="setResponseSchemaRef(response.data, $event)"
                            :options="availableSchemas"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="Select a schema"
                          />
                        </div>

                        <template v-else>
                          <div class="section-header">
                            <h5>Properties</h5>
                            <Button
                              label="Add Property"
                              icon="pi pi-plus"
                              size="small"
                              @click="addResponseProperty(response.data)"
                            />
                          </div>
                          <div
                            v-if="Object.keys(getResponseInlineSchema(response.data).properties || {}).length === 0"
                            class="empty-state-small"
                          >
                            <p>No properties defined</p>
                          </div>
                          <div
                            v-for="(propSchema, propName) in getResponseInlineSchema(response.data).properties"
                            :key="propName"
                            class="list-item"
                          >
                            <div class="list-item-content">
                              <div class="form-row">
                                <div class="form-field">
                                  <label>Name</label>
                                  <InputText
                                    :value="propName"
                                    @input="renameResponseProperty(response.data, propName, $event.target.value)"
                                  />
                                </div>
                                <div class="form-field">
                                  <label>Type</label>
                                  <Select
                                    v-model="propSchema.type"
                                    :options="['string', 'number', 'integer', 'boolean', 'array', 'object']"
                                  />
                                </div>
                              </div>
                            </div>
                            <Button
                              icon="pi pi-trash"
                              severity="danger"
                              text
                              rounded
                              @click="removeResponseProperty(response.data, propName)"
                            />
                          </div>
                        </template>
                      </template>
                    </AccordionContent>
                  </AccordionPanel>
                </Accordion>
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
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";

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
    IconField,
    InputIcon,
  },
  props: {
    formData: { type: Object, required: true },
    api: { type: Object, required: true },
  },
  setup(props) {
    // Per-schema, per-section collapse state (Mapping / Properties), same
    // disclosure-triangle pattern as PathsTab.vue's method editor sections
    // and the tree nav's Servers/Paths/Tags/Components/Security groups.
    // Keyed by "schemaName:section" since multiple schemas' accordion
    // panels can be open at once (unlike PathsTab, where only one method
    // is ever selected).
    const collapsedSchemaSections = ref({});
    const sectionKey = (schemaName, section) => `${schemaName}:${section}`;
    const isSchemaSectionCollapsed = (schemaName, section) =>
      !!collapsedSchemaSections.value[sectionKey(schemaName, section)];
    const toggleSchemaSection = (schemaName, section) => {
      const key = sectionKey(schemaName, section);
      collapsedSchemaSections.value[key] = !collapsedSchemaSections.value[key];
    };
    const expandSchemaSection = (schemaName, section) => {
      collapsedSchemaSections.value[sectionKey(schemaName, section)] = false;
    };

    // Page-level sections — one instance each, so plain booleans.
    const reusableParamsCollapsed = ref(false);
    const reusableResponsesCollapsed = ref(false);

    // Per-property expand/collapse, mirroring PathsTab.vue's per-parameter
    // rows: a schema with many properties reads as a wall of open forms
    // otherwise. Keyed by "schemaName:propName" — new properties start
    // expanded (via onAddSchemaProperty below) so the just-created row is
    // immediately editable; existing ones start collapsed to keep long
    // schemas scannable.
    const expandedProperties = ref({});
    const propertyKey = (schemaName, propName) => `${schemaName}:${propName}`;
    const isPropertyExpanded = (schemaName, propName) =>
      !!expandedProperties.value[propertyKey(schemaName, propName)];
    const togglePropertyExpanded = (schemaName, propName) => {
      const key = propertyKey(schemaName, propName);
      expandedProperties.value[key] = !expandedProperties.value[key];
    };
    const onAddSchemaProperty = (schemaName) => {
      expandSchemaSection(schemaName, "properties");
      const propName = props.api.addSchemaProperty(schemaName);
      expandedProperties.value[propertyKey(schemaName, propName)] = true;
    };

    // A plain `props.formData` snapshot only captures whatever the prop was
    // AT MOUNT TIME — it never updates when the parent later swaps in the
    // real spec (loaded asynchronously after this component's first
    // render), permanently freezing the whole schema editor on blank
    // default data (same bug fixed in PathsTab.vue). `computed()` re-reads
    // the prop on every access instead, and gets auto-unwrapped by Vue
    // since it's a top-level key in this returned object.
    return {
      formData: computed(() => props.formData),
      ...props.api,
      isSchemaSectionCollapsed,
      toggleSchemaSection,
      expandSchemaSection,
      reusableParamsCollapsed,
      reusableResponsesCollapsed,
      isPropertyExpanded,
      togglePropertyExpanded,
      onAddSchemaProperty,
    };
  },
};
</script>
