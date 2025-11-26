<template>
  <div class="form-editor">
    <div class="form-header">
      <h3>Form Editor</h3>
      <Button
        icon="pi pi-sync"
        text
        rounded
        v-tooltip.top="'Sync with JSON'"
        @click="syncWithJson"
        :disabled="!hasChanges"
      />
    </div>

    <div class="form-content">
      <Tabs value="0">
        <TabList>
          <Tab value="0">
            <i class="pi pi-info-circle"></i>
            <span>Info</span>
          </Tab>
          <Tab value="1">
            <i class="pi pi-server"></i>
            <span>Servers</span>
          </Tab>
          <Tab value="2">
            <i class="pi pi-sitemap"></i>
            <span>Paths</span>
          </Tab>
          <Tab value="3">
            <i class="pi pi-box"></i>
            <span>Components</span>
          </Tab>
        </TabList>

        <TabPanels>
          <!-- API Info Tab -->
          <TabPanel value="0">
            <div class="form-section">
              <h4>API Information</h4>

              <div class="form-field">
                <label for="openapi-version">OpenAPI Version *</label>
                <InputText
                  id="openapi-version"
                  v-model="formData.openapi"
                  placeholder="3.0.0"
                />
              </div>

              <div class="form-field">
                <label for="api-title">Title *</label>
                <InputText
                  id="api-title"
                  v-model="formData.info.title"
                  placeholder="My API"
                />
              </div>

              <div class="form-field">
                <label for="api-version">Version *</label>
                <InputText
                  id="api-version"
                  v-model="formData.info.version"
                  placeholder="1.0.0"
                />
              </div>

              <div class="form-field">
                <label for="api-description">Description</label>
                <Textarea
                  id="api-description"
                  v-model="formData.info.description"
                  rows="4"
                  placeholder="API Description"
                />
              </div>

              <div class="form-field">
                <label for="api-contact-name">Contact Name</label>
                <InputText
                  id="api-contact-name"
                  v-model="formData.info.contact.name"
                  placeholder="API Support"
                />
              </div>

              <div class="form-field">
                <label for="api-contact-email">Contact Email</label>
                <InputText
                  id="api-contact-email"
                  v-model="formData.info.contact.email"
                  type="email"
                  placeholder="support@example.com"
                />
              </div>

              <div class="form-field">
                <label for="api-license-name">License Name</label>
                <InputText
                  id="api-license-name"
                  v-model="formData.info.license.name"
                  placeholder="MIT"
                />
              </div>

              <div class="form-field">
                <label for="api-license-url">License URL</label>
                <InputText
                  id="api-license-url"
                  v-model="formData.info.license.url"
                  placeholder="https://opensource.org/licenses/MIT"
                />
              </div>
            </div>
          </TabPanel>

          <!-- Servers Tab -->
          <TabPanel value="1">
            <div class="form-section">
              <div class="section-header">
                <h4>Servers</h4>
                <Button
                  label="Add Server"
                  icon="pi pi-plus"
                  size="small"
                  @click="addServer"
                />
              </div>

              <div v-if="formData.servers.length === 0" class="empty-state">
                <i class="pi pi-server"></i>
                <p>No servers defined. Add one to get started.</p>
              </div>

              <div
                v-for="(server, index) in formData.servers"
                :key="index"
                class="list-item"
              >
                <div class="list-item-content">
                  <div class="form-field">
                    <label>URL *</label>
                    <InputText
                      v-model="server.url"
                      placeholder="https://api.example.com"
                    />
                  </div>
                  <div class="form-field">
                    <label>Description</label>
                    <InputText
                      v-model="server.description"
                      placeholder="Production server"
                    />
                  </div>
                </div>
                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  @click="removeServer(index)"
                />
              </div>
            </div>
          </TabPanel>

          <!-- Paths Tab -->
          <TabPanel value="2">
            <div class="form-section">
              <div class="section-header">
                <h4>API Paths</h4>
                <Button
                  label="Add Path"
                  icon="pi pi-plus"
                  size="small"
                  @click="showAddPathDialog = true"
                />
              </div>

              <div v-if="pathsList.length === 0" class="empty-state">
                <i class="pi pi-sitemap"></i>
                <p>No paths defined. Add one to get started.</p>
              </div>

              <Accordion v-if="pathsList.length > 0" :multiple="true">
                <AccordionPanel
                  v-for="(pathItem, index) in pathsList"
                  :key="index"
                  :value="index.toString()"
                >
                  <AccordionHeader>
                    <div class="path-header">
                      <span class="path-url">{{ pathItem.path }}</span>
                      <div class="path-methods">
                        <Tag
                          v-for="method in pathItem.methods"
                          :key="method"
                          :value="method.toUpperCase()"
                          :severity="getMethodSeverity(method)"
                        />
                      </div>
                      <Button
                        icon="pi pi-trash"
                        severity="danger"
                        text
                        rounded
                        size="small"
                        @click.stop="removePath(pathItem.path)"
                      />
                    </div>
                  </AccordionHeader>
                  <AccordionContent>
                    <div class="path-methods-editor">
                      <div class="method-tabs">
                        <Button
                          v-for="method in pathItem.methods"
                          :key="method"
                          :label="method.toUpperCase()"
                          :severity="
                            selectedMethod === method ? 'primary' : 'secondary'
                          "
                          size="small"
                          @click="selectPathMethod(pathItem.path, method)"
                        />
                        <Button
                          label="Add Method"
                          icon="pi pi-plus"
                          size="small"
                          text
                          @click="showAddMethodDialog(pathItem.path)"
                        />
                      </div>

                      <div
                        v-if="selectedPath === pathItem.path && selectedMethod"
                        class="method-editor"
                      >
                        <Tabs value="0">
                          <TabList>
                            <Tab value="0">Basic Info</Tab>
                            <Tab value="1">Parameters</Tab>
                            <Tab value="2">Request Body</Tab>
                            <Tab value="3">Responses</Tab>
                          </TabList>
                          <TabPanels>
                            <!-- Basic Info -->
                            <TabPanel value="0">
                              <div class="form-field">
                                <label>Summary</label>
                                <InputText
                                  v-model="
                                    formData.paths[selectedPath][selectedMethod]
                                      .summary
                                  "
                                  placeholder="Brief summary"
                                />
                              </div>

                              <div class="form-field">
                                <label>Description</label>
                                <Textarea
                                  v-model="
                                    formData.paths[selectedPath][selectedMethod]
                                      .description
                                  "
                                  rows="3"
                                  placeholder="Detailed description"
                                />
                              </div>

                              <div class="form-field">
                                <label>Operation ID</label>
                                <InputText
                                  v-model="
                                    formData.paths[selectedPath][selectedMethod]
                                      .operationId
                                  "
                                  placeholder="operationId"
                                />
                              </div>

                              <div class="form-field">
                                <label>Tags</label>
                                <Chips
                                  v-model="
                                    formData.paths[selectedPath][selectedMethod]
                                      .tags
                                  "
                                  placeholder="Add tag and press Enter"
                                />
                              </div>

                              <div class="form-field checkbox-field">
                                <Checkbox
                                  v-model="
                                    formData.paths[selectedPath][selectedMethod]
                                      .deprecated
                                  "
                                  inputId="deprecated"
                                  :binary="true"
                                />
                                <label for="deprecated">Deprecated</label>
                              </div>
                            </TabPanel>

                            <!-- Parameters -->
                            <TabPanel value="1">
                              <div class="section-header">
                                <h5>Parameters</h5>
                                <Button
                                  label="Add Parameter"
                                  icon="pi pi-plus"
                                  size="small"
                                  @click="
                                    addParameter(selectedPath, selectedMethod)
                                  "
                                />
                              </div>

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
                                class="param-item"
                              >
                                <div class="param-content">
                                  <div class="form-row">
                                    <div class="form-field">
                                      <label>Name *</label>
                                      <InputText
                                        v-model="param.name"
                                        placeholder="id"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Location *</label>
                                      <Select
                                        v-model="param.in"
                                        :options="[
                                          'query',
                                          'path',
                                          'header',
                                          'cookie',
                                        ]"
                                        placeholder="Select location"
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
                                  <div class="form-row">
                                    <div class="form-field">
                                      <label>Type *</label>
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
                                      />
                                    </div>
                                    <div
                                      class="form-field"
                                      v-if="param.schema.type === 'array'"
                                    >
                                      <label>Items Type</label>
                                      <Select
                                        v-model="param.schema.items.type"
                                        :options="[
                                          'string',
                                          'number',
                                          'integer',
                                          'boolean',
                                        ]"
                                        placeholder="Items type"
                                      />
                                    </div>
                                  </div>

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
                                      <label>Multiple Of</label>
                                      <InputNumber
                                        v-model="param.schema.multipleOf"
                                        placeholder="Multiple of"
                                        :min="0"
                                      />
                                    </div>
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
                                  </div>

                                  <!-- Array validations -->
                                  <div
                                    v-if="param.schema.type === 'array'"
                                    class="form-row"
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
                                  <div class="form-field">
                                    <label>Enum Values (optional)</label>
                                    <Chips
                                      v-model="param.schema.enum"
                                      placeholder="Add enum value and press Enter"
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
                                </div>
                                <Button
                                  icon="pi pi-trash"
                                  severity="danger"
                                  text
                                  rounded
                                  @click="
                                    removeParameter(
                                      selectedPath,
                                      selectedMethod,
                                      pIndex
                                    )
                                  "
                                />
                              </div>
                            </TabPanel>

                            <!-- Request Body -->
                            <TabPanel value="2">
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
                                  <Select
                                    v-if="requestBodySchemaType === 'reference'"
                                    v-model="requestBodySchemaRef"
                                    :options="availableSchemas"
                                    placeholder="Select schema"
                                  />
                                </div>
                              </div>

                              <div
                                v-if="
                                  requestBodySchemaType === 'inline' &&
                                  requestBodyContentType
                                "
                                class="form-field"
                              >
                                <label>Inline Schema (JSON)</label>
                                <Textarea
                                  :value="getRequestBodyInlineSchema()"
                                  @input="
                                    updateRequestBodyInlineSchema(
                                      $event.target.value
                                    )
                                  "
                                  rows="10"
                                  class="json-textarea"
                                />
                              </div>
                            </TabPanel>

                            <!-- Responses -->
                            <TabPanel value="3">
                              <div class="section-header">
                                <h5>Responses</h5>
                                <Button
                                  label="Add Response"
                                  icon="pi pi-plus"
                                  size="small"
                                  @click="showAddResponseDialog = true"
                                />
                              </div>

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
                                        :value="statusCode"
                                        :severity="
                                          getStatusSeverity(statusCode)
                                        "
                                      />
                                      <span>{{
                                        response.description || "No description"
                                      }}</span>
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
                                    <div class="form-field">
                                      <label>Description</label>
                                      <Textarea
                                        v-model="response.description"
                                        rows="2"
                                        placeholder="Response description"
                                      />
                                    </div>

                                    <div class="form-field">
                                      <label>Content Type</label>
                                      <Select
                                        :value="
                                          getResponseContentType(response)
                                        "
                                        @change="
                                          setResponseContentType(
                                            response,
                                            $event.value
                                          )
                                        "
                                        :options="[
                                          'application/json',
                                          'application/xml',
                                          'text/plain',
                                          'text/html',
                                        ]"
                                        placeholder="Select content type"
                                      />
                                    </div>

                                    <div
                                      class="form-field"
                                      v-if="getResponseContentType(response)"
                                    >
                                      <label>Schema</label>
                                      <div class="schema-selector">
                                        <Select
                                          :value="
                                            getResponseSchemaType(response)
                                          "
                                          @change="
                                            setResponseSchemaType(
                                              response,
                                              $event.value
                                            )
                                          "
                                          :options="['reference', 'inline']"
                                          placeholder="Schema type"
                                        />
                                        <Select
                                          v-if="
                                            getResponseSchemaType(response) ===
                                            'reference'
                                          "
                                          :value="
                                            getResponseSchemaRef(response)
                                          "
                                          @change="
                                            setResponseSchemaRef(
                                              response,
                                              $event.value
                                            )
                                          "
                                          :options="availableSchemas"
                                          placeholder="Select schema"
                                        />
                                      </div>
                                    </div>

                                    <div
                                      v-if="
                                        getResponseSchemaType(response) ===
                                          'inline' &&
                                        getResponseContentType(response)
                                      "
                                      class="form-field"
                                    >
                                      <label>Inline Schema (JSON)</label>
                                      <Textarea
                                        :value="
                                          getResponseInlineSchema(response)
                                        "
                                        @input="
                                          updateResponseInlineSchema(
                                            response,
                                            $event.target.value
                                          )
                                        "
                                        rows="10"
                                        class="json-textarea"
                                      />
                                    </div>
                                  </AccordionContent>
                                </AccordionPanel>
                              </Accordion>
                            </TabPanel>
                          </TabPanels>
                        </Tabs>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionPanel>
              </Accordion>
            </div>
          </TabPanel>

          <!-- Components Tab -->
          <TabPanel value="3">
            <div class="form-section">
              <div class="section-header">
                <h4>Component Schemas</h4>
                <Button
                  label="Add Schema"
                  icon="pi pi-plus"
                  size="small"
                  @click="showAddSchemaDialog = true"
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
                            <div class="form-field">
                              <label>Type *</label>
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
                              />
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
                                v-for="(prop, propName) in schema.data
                                  .properties"
                                :key="propName"
                                class="property-item"
                              >
                                <div class="property-content">
                                  <div class="form-row">
                                    <div class="form-field">
                                      <label>Property Name *</label>
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
                                      <label>Type *</label>
                                      <Select
                                        v-model="prop.type"
                                        :options="[
                                          'string',
                                          'number',
                                          'integer',
                                          'boolean',
                                          'array',
                                          'object',
                                        ]"
                                        placeholder="Type"
                                      />
                                    </div>
                                  </div>

                                  <div class="form-field">
                                    <label>Description</label>
                                    <InputText
                                      v-model="prop.description"
                                      placeholder="Property description"
                                    />
                                  </div>

                                  <div
                                    v-if="prop.type === 'array'"
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
                                      ]"
                                      placeholder="Items type"
                                    />
                                  </div>

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
                                          'email',
                                          'uri',
                                          'uuid',
                                        ]"
                                        placeholder="Format"
                                      />
                                    </div>
                                    <div class="form-field">
                                      <label>Pattern</label>
                                      <InputText
                                        v-model="prop.pattern"
                                        placeholder="Regex pattern"
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

                            <div
                              v-if="schema.data.type === 'array'"
                              class="form-field"
                            >
                              <label>Array Items Type</label>
                              <Select
                                v-model="schema.data.items.type"
                                :options="[
                                  'string',
                                  'number',
                                  'integer',
                                  'boolean',
                                  'object',
                                ]"
                                placeholder="Items type"
                              />
                            </div>
                          </div>
                        </TabPanel>
                        <TabPanel value="1">
                          <div class="schema-json-editor">
                            <label>Schema JSON</label>
                            <Textarea
                              :value="JSON.stringify(schema.data, null, 2)"
                              @input="
                                updateSchema(schema.name, $event.target.value)
                              "
                              rows="15"
                              class="json-textarea"
                            />
                          </div>
                        </TabPanel>
                      </TabPanels>
                    </Tabs>
                  </AccordionContent>
                </AccordionPanel>
              </Accordion>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>

    <!-- Add Path Dialog -->
    <Dialog
      v-model:visible="showAddPathDialog"
      header="Add New Path"
      :style="{ width: '450px' }"
      modal
    >
      <div class="dialog-content">
        <div class="form-field">
          <label for="new-path">Path *</label>
          <InputText
            id="new-path"
            v-model="newPath"
            placeholder="/users/{id}"
            class="w-full"
          />
        </div>
        <div class="form-field">
          <label for="new-method">Method *</label>
          <Select
            id="new-method"
            v-model="newMethod"
            :options="httpMethods"
            placeholder="Select method"
            class="w-full"
          />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="showAddPathDialog = false" />
        <Button
          label="Add"
          @click="addPath"
          :disabled="!newPath || !newMethod"
        />
      </template>
    </Dialog>

    <!-- Add Method Dialog -->
    <Dialog
      v-model:visible="showAddMethodDialogVisible"
      header="Add Method to Path"
      :style="{ width: '400px' }"
      modal
    >
      <div class="dialog-content">
        <div class="form-field">
          <label for="add-method">Method *</label>
          <Select
            id="add-method"
            v-model="methodToAdd"
            :options="availableMethodsForPath"
            placeholder="Select method"
            class="w-full"
          />
        </div>
      </div>
      <template #footer>
        <Button
          label="Cancel"
          text
          @click="showAddMethodDialogVisible = false"
        />
        <Button label="Add" @click="addMethodToPath" :disabled="!methodToAdd" />
      </template>
    </Dialog>

    <!-- Add Schema Dialog -->
    <Dialog
      v-model:visible="showAddSchemaDialog"
      header="Add New Schema"
      :style="{ width: '400px' }"
      modal
    >
      <div class="dialog-content">
        <div class="form-field">
          <label for="new-schema-name">Schema Name *</label>
          <InputText
            id="new-schema-name"
            v-model="newSchemaName"
            placeholder="User"
            class="w-full"
          />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="showAddSchemaDialog = false" />
        <Button label="Add" @click="addSchema" :disabled="!newSchemaName" />
      </template>
    </Dialog>
  </div>
</template>

<script>
import { ref, computed, watch } from "vue";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Textarea from "primevue/textarea";
import Select from "primevue/select";
import Checkbox from "primevue/checkbox";
import Chips from "primevue/chips";
import Dialog from "primevue/dialog";
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

export default {
  name: "FormEditor",
  components: {
    Button,
    InputText,
    InputNumber,
    Textarea,
    Select,
    Checkbox,
    Chips,
    Dialog,
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
    modelValue: {
      type: Object,
      required: true,
    },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    const formData = ref({
      openapi: "3.0.0",
      info: {
        title: "",
        version: "",
        description: "",
        contact: { name: "", email: "" },
        license: { name: "", url: "" },
      },
      servers: [],
      paths: {},
      components: {
        schemas: {},
      },
    });

    const hasChanges = ref(false);
    const showAddPathDialog = ref(false);
    const showAddMethodDialogVisible = ref(false);
    const showAddSchemaDialog = ref(false);
    const showAddResponseDialog = ref(false);
    const newPath = ref("");
    const newMethod = ref("");
    const newSchemaName = ref("");
    const newResponseCode = ref("");
    const methodToAdd = ref("");
    const currentPathForMethod = ref("");
    const selectedPath = ref("");
    const selectedMethod = ref("");
    const requestBodyContentType = ref("application/json");
    const requestBodySchemaType = ref("reference");
    const requestBodySchemaRef = ref("");

    const httpMethods = [
      "get",
      "post",
      "put",
      "patch",
      "delete",
      "options",
      "head",
    ];

    // Initialize form data from prop
    watch(
      () => props.modelValue,
      (newValue) => {
        if (newValue && Object.keys(newValue).length > 0) {
          formData.value = JSON.parse(JSON.stringify(newValue));
          // Ensure nested objects exist
          if (!formData.value.info) formData.value.info = {};
          if (!formData.value.info.contact) formData.value.info.contact = {};
          if (!formData.value.info.license) formData.value.info.license = {};
          if (!formData.value.servers) formData.value.servers = [];
          if (!formData.value.paths) formData.value.paths = {};
          if (!formData.value.components) formData.value.components = {};
          if (!formData.value.components.schemas)
            formData.value.components.schemas = {};
        }
      },
      { immediate: true, deep: true }
    );

    // Watch for form changes
    watch(
      formData,
      () => {
        hasChanges.value = true;
      },
      { deep: true }
    );

    const pathsList = computed(() => {
      return Object.keys(formData.value.paths).map((path) => ({
        path,
        methods: Object.keys(formData.value.paths[path]),
      }));
    });

    const schemasList = computed(() => {
      return Object.keys(formData.value.components?.schemas || {}).map(
        (name) => ({
          name,
          data: formData.value.components.schemas[name],
        })
      );
    });

    const availableMethodsForPath = computed(() => {
      if (!currentPathForMethod.value) return httpMethods;
      const existingMethods = Object.keys(
        formData.value.paths[currentPathForMethod.value] || {}
      );
      return httpMethods.filter((m) => !existingMethods.includes(m));
    });

    const syncWithJson = () => {
      // Clean up empty fields
      const cleaned = JSON.parse(JSON.stringify(formData.value));

      // Remove empty contact/license
      if (
        cleaned.info.contact &&
        !cleaned.info.contact.name &&
        !cleaned.info.contact.email
      ) {
        delete cleaned.info.contact;
      }
      if (
        cleaned.info.license &&
        !cleaned.info.license.name &&
        !cleaned.info.license.url
      ) {
        delete cleaned.info.license;
      }

      emit("update:modelValue", cleaned);
      hasChanges.value = false;
    };

    const addServer = () => {
      formData.value.servers.push({ url: "", description: "" });
    };

    const removeServer = (index) => {
      formData.value.servers.splice(index, 1);
    };

    const addPath = () => {
      if (!newPath.value || !newMethod.value) return;

      if (!formData.value.paths[newPath.value]) {
        formData.value.paths[newPath.value] = {};
      }

      formData.value.paths[newPath.value][newMethod.value] = {
        summary: "",
        description: "",
        operationId: "",
        tags: [],
        deprecated: false,
        responses: {
          200: {
            description: "Successful response",
          },
        },
      };

      selectedPath.value = newPath.value;
      selectedMethod.value = newMethod.value;
      newPath.value = "";
      newMethod.value = "";
      showAddPathDialog.value = false;
    };

    const removePath = (path) => {
      delete formData.value.paths[path];
      if (selectedPath.value === path) {
        selectedPath.value = "";
        selectedMethod.value = "";
      }
    };

    const showAddMethodDialog = (path) => {
      currentPathForMethod.value = path;
      methodToAdd.value = "";
      showAddMethodDialogVisible.value = true;
    };

    const addMethodToPath = () => {
      if (!methodToAdd.value || !currentPathForMethod.value) return;

      formData.value.paths[currentPathForMethod.value][methodToAdd.value] = {
        summary: "",
        description: "",
        operationId: "",
        tags: [],
        deprecated: false,
        responses: {
          200: {
            description: "Successful response",
          },
        },
      };

      selectedPath.value = currentPathForMethod.value;
      selectedMethod.value = methodToAdd.value;
      showAddMethodDialogVisible.value = false;
    };

    const selectPathMethod = (path, method) => {
      selectedPath.value = path;
      selectedMethod.value = method;
    };

    const addSchema = () => {
      if (!newSchemaName.value) return;

      formData.value.components.schemas[newSchemaName.value] = {
        type: "object",
        properties: {},
      };

      newSchemaName.value = "";
      showAddSchemaDialog.value = false;
    };

    const removeSchema = (name) => {
      delete formData.value.components.schemas[name];
    };

    const updateSchema = (name, jsonString) => {
      try {
        formData.value.components.schemas[name] = JSON.parse(jsonString);
      } catch (e) {
        // Invalid JSON, don't update
      }
    };

    const getMethodSeverity = (method) => {
      const severityMap = {
        get: "info",
        post: "success",
        put: "warn",
        patch: "warn",
        delete: "danger",
        options: "secondary",
        head: "secondary",
      };
      return severityMap[method.toLowerCase()] || "secondary";
    };

    const getStatusSeverity = (statusCode) => {
      const code = parseInt(statusCode);
      if (code >= 200 && code < 300) return "success";
      if (code >= 300 && code < 400) return "info";
      if (code >= 400 && code < 500) return "warn";
      if (code >= 500) return "danger";
      return "secondary";
    };

    // Computed properties for current method
    const currentMethodData = computed(() => {
      if (!selectedPath.value || !selectedMethod.value) return {};
      const methodData =
        formData.value.paths[selectedPath.value]?.[selectedMethod.value] || {};

      // Ensure structures exist
      if (!methodData.parameters) methodData.parameters = [];
      if (!methodData.requestBody)
        methodData.requestBody = { required: false, description: "" };
      if (!methodData.responses) methodData.responses = {};

      return methodData;
    });

    const availableSchemas = computed(() => {
      return Object.keys(formData.value.components?.schemas || {}).map(
        (name) => `#/components/schemas/${name}`
      );
    });

    // Parameter methods
    const addParameter = (path, method) => {
      if (!formData.value.paths[path][method].parameters) {
        formData.value.paths[path][method].parameters = [];
      }
      formData.value.paths[path][method].parameters.push({
        name: "",
        in: "query",
        description: "",
        required: false,
        schema: { type: "string", items: { type: "string" } },
      });
    };

    const removeParameter = (path, method, index) => {
      formData.value.paths[path][method].parameters.splice(index, 1);
    };

    // Request body methods
    const getRequestBodyInlineSchema = () => {
      const content = currentMethodData.value.requestBody?.content;
      if (!content || !requestBodyContentType.value) return "{}";
      const schema = content[requestBodyContentType.value]?.schema;
      return JSON.stringify(schema || {}, null, 2);
    };

    const updateRequestBodyInlineSchema = (jsonString) => {
      try {
        const schema = JSON.parse(jsonString);
        if (!currentMethodData.value.requestBody.content) {
          currentMethodData.value.requestBody.content = {};
        }
        if (
          !currentMethodData.value.requestBody.content[
            requestBodyContentType.value
          ]
        ) {
          currentMethodData.value.requestBody.content[
            requestBodyContentType.value
          ] = {};
        }
        currentMethodData.value.requestBody.content[
          requestBodyContentType.value
        ].schema = schema;
      } catch (e) {
        // Invalid JSON
      }
    };

    // Watch for request body schema type changes
    watch(
      [requestBodySchemaType, requestBodySchemaRef, requestBodyContentType],
      () => {
        if (!selectedPath.value || !selectedMethod.value) return;

        const methodData =
          formData.value.paths[selectedPath.value][selectedMethod.value];
        if (!methodData.requestBody)
          methodData.requestBody = { required: false };
        if (!methodData.requestBody.content)
          methodData.requestBody.content = {};

        if (
          requestBodyContentType.value &&
          requestBodySchemaType.value === "reference" &&
          requestBodySchemaRef.value
        ) {
          methodData.requestBody.content[requestBodyContentType.value] = {
            schema: { $ref: requestBodySchemaRef.value },
          };
        }
      }
    );

    // Response methods
    const addResponse = () => {
      if (!newResponseCode.value) return;

      if (
        !formData.value.paths[selectedPath.value][selectedMethod.value]
          .responses
      ) {
        formData.value.paths[selectedPath.value][
          selectedMethod.value
        ].responses = {};
      }

      formData.value.paths[selectedPath.value][selectedMethod.value].responses[
        newResponseCode.value
      ] = {
        description: "",
        content: {},
      };

      newResponseCode.value = "";
      showAddResponseDialog.value = false;
    };

    const removeResponse = (path, method, statusCode) => {
      delete formData.value.paths[path][method].responses[statusCode];
    };

    const getResponseContentType = (response) => {
      if (!response.content) return "";
      return Object.keys(response.content)[0] || "";
    };

    const setResponseContentType = (response, contentType) => {
      if (!response.content) response.content = {};
      const oldContent = response.content;
      response.content = {};
      if (contentType) {
        response.content[contentType] = oldContent[
          Object.keys(oldContent)[0]
        ] || { schema: {} };
      }
    };

    const getResponseSchemaType = (response) => {
      const contentType = getResponseContentType(response);
      if (!contentType || !response.content[contentType]?.schema)
        return "inline";
      return response.content[contentType].schema.$ref ? "reference" : "inline";
    };

    const setResponseSchemaType = (response, type) => {
      const contentType = getResponseContentType(response);
      if (!contentType) return;

      if (type === "reference") {
        response.content[contentType].schema = { $ref: "" };
      } else {
        response.content[contentType].schema = { type: "object" };
      }
    };

    const getResponseSchemaRef = (response) => {
      const contentType = getResponseContentType(response);
      if (!contentType) return "";
      return response.content[contentType]?.schema?.$ref || "";
    };

    const setResponseSchemaRef = (response, ref) => {
      const contentType = getResponseContentType(response);
      if (!contentType) return;
      response.content[contentType].schema = { $ref: ref };
    };

    const getResponseInlineSchema = (response) => {
      const contentType = getResponseContentType(response);
      if (!contentType) return "{}";
      const schema = response.content[contentType]?.schema;
      if (schema?.$ref) return "{}";
      return JSON.stringify(schema || {}, null, 2);
    };

    const updateResponseInlineSchema = (response, jsonString) => {
      try {
        const schema = JSON.parse(jsonString);
        const contentType = getResponseContentType(response);
        if (contentType) {
          response.content[contentType].schema = schema;
        }
      } catch (e) {
        // Invalid JSON
      }
    };

    // Schema builder methods
    const addSchemaProperty = (schemaName) => {
      const schema = formData.value.components.schemas[schemaName];
      if (!schema.properties) schema.properties = {};

      let propName = "newProperty";
      let counter = 1;
      while (schema.properties[propName]) {
        propName = `newProperty${counter}`;
        counter++;
      }

      schema.properties[propName] = {
        type: "string",
        description: "",
        items: { type: "string" },
      };
    };

    const removeSchemaProperty = (schemaName, propName) => {
      const schema = formData.value.components.schemas[schemaName];
      delete schema.properties[propName];

      // Remove from required array if present
      if (schema.required) {
        schema.required = schema.required.filter((r) => r !== propName);
      }
    };

    const renameSchemaProperty = (schemaName, oldName, newName) => {
      if (oldName === newName || !newName) return;

      const schema = formData.value.components.schemas[schemaName];
      if (!schema.properties) return;

      if (schema.properties[newName]) {
        // New name already exists
        return;
      }

      schema.properties[newName] = schema.properties[oldName];
      delete schema.properties[oldName];

      // Update required array
      if (schema.required) {
        const index = schema.required.indexOf(oldName);
        if (index !== -1) {
          schema.required[index] = newName;
        }
      }
    };

    const toggleSchemaPropertyRequired = (schemaName, propName, isRequired) => {
      const schema = formData.value.components.schemas[schemaName];
      if (!schema.required) schema.required = [];

      if (isRequired) {
        if (!schema.required.includes(propName)) {
          schema.required.push(propName);
        }
      } else {
        schema.required = schema.required.filter((r) => r !== propName);
      }
    };

    return {
      formData,
      hasChanges,
      showAddPathDialog,
      showAddMethodDialogVisible,
      showAddSchemaDialog,
      showAddResponseDialog,
      newPath,
      newMethod,
      newSchemaName,
      newResponseCode,
      methodToAdd,
      currentPathForMethod,
      selectedPath,
      selectedMethod,
      requestBodyContentType,
      requestBodySchemaType,
      requestBodySchemaRef,
      httpMethods,
      pathsList,
      schemasList,
      availableMethodsForPath,
      availableSchemas,
      currentMethodData,
      syncWithJson,
      addServer,
      removeServer,
      addPath,
      removePath,
      showAddMethodDialog,
      addMethodToPath,
      selectPathMethod,
      addSchema,
      removeSchema,
      updateSchema,
      getMethodSeverity,
      getStatusSeverity,
      addParameter,
      removeParameter,
      getRequestBodyInlineSchema,
      updateRequestBodyInlineSchema,
      addResponse,
      removeResponse,
      getResponseContentType,
      setResponseContentType,
      getResponseSchemaType,
      setResponseSchemaType,
      getResponseSchemaRef,
      setResponseSchemaRef,
      getResponseInlineSchema,
      updateResponseInlineSchema,
      addSchemaProperty,
      removeSchemaProperty,
      renameSchemaProperty,
      toggleSchemaPropertyRequired,
    };
  },
};
</script>

<style scoped>
.form-editor {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.form-header {
  padding: 15px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-header h3 {
  font-size: 16px;
  color: #1f2937;
}

.form-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.form-section {
  padding: 20px;
}

.form-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 20px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h4 {
  margin-bottom: 0;
}

.form-field {
  margin-bottom: 20px;
}

.form-field label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.form-field :deep(.p-inputtext),
.form-field :deep(.p-textarea),
.form-field :deep(.p-select) {
  width: 100%;
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox-field label {
  margin-bottom: 0;
}

.list-item {
  display: flex;
  gap: 12px;
  padding: 15px;
  background: #f9fafb;
  border-radius: 6px;
  margin-bottom: 12px;
  align-items: flex-start;
}

.list-item-content {
  flex: 1;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;
}

.empty-state i {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  font-size: 14px;
}

.path-header,
.schema-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.path-url,
.schema-name {
  font-family: "Monaco", "Courier New", monospace;
  font-weight: 600;
  color: #1f2937;
}

.path-methods {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.path-methods-editor {
  padding: 15px;
  background: #f9fafb;
  border-radius: 6px;
}

.method-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.method-editor {
  padding-top: 15px;
  border-top: 1px solid #e5e7eb;
}

.section-header h5 {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.empty-state-small {
  text-align: center;
  padding: 30px 20px;
  color: #9ca3af;
  font-size: 13px;
}

.param-item,
.property-item {
  display: flex;
  gap: 12px;
  padding: 15px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin-bottom: 12px;
  align-items: flex-start;
}

.param-content,
.property-content {
  flex: 1;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.schema-selector {
  display: flex;
  gap: 12px;
}

.schema-selector :deep(.p-select) {
  flex: 1;
}

.response-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.response-header span {
  flex: 1;
  font-weight: 500;
}

.schema-builder {
  padding: 15px;
  background: #f9fafb;
  border-radius: 6px;
}

.schema-json-editor {
  padding: 15px;
  background: #f9fafb;
  border-radius: 6px;
}

.json-textarea {
  font-family: "Monaco", "Courier New", monospace;
  font-size: 12px;
}

.dialog-content {
  padding: 20px 0;
}

.w-full {
  width: 100%;
}

:deep(.p-tabs-nav) {
  background: #f9fafb;
  border-bottom: 2px solid #e5e7eb;
  padding: 0 20px;
}

:deep(.p-tab) {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.p-accordion-panel) {
  margin-bottom: 12px;
}

:deep(.p-accordion-header-content) {
  width: 100%;
}
</style>
