<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    header="Change Details"
    :modal="true"
    :closable="true"
    :style="{ width: '70vw' }"
  >
    <div v-if="selectedItem">
      <div class="detail-header">
        <div class="detail-left">
          <span class="header-left-label">{{
            selectedItem.key || selectedItem.name
          }}</span>
          <Tag v-if="selectedItem.method" :severity="getMethodSeverity(selectedItem.method)">{{
            selectedItem.method
          }}</Tag>
          <code class="detail-path">{{ selectedItem.path }}</code>
          <div v-if="selectedItem.summary" class="detail-summary">
            {{ selectedItem.summary }}
          </div>
          <div
            v-if="selectedItem.dereferencedSchema?.description"
            class="detail-summary"
          >
            {{ selectedItem.dereferencedSchema?.description }}
          </div>
        </div>
        <div class="detail-actions">
          <Button
            icon="pi pi-copy"
            label="Copy Markdown"
            class="p-button-text"
            @click="$emit('copy-item-markdown')"
          />
        </div>
      </div>

      <div class="detail-body">
        <section v-if="selectedItem.diffDetails">
          <h5>Field-level changes</h5>
          <div class="fields-grid">
            <div
              v-for="(f, i) in selectedItem.diffDetails.fields || []"
              :key="i"
              class="field-row change-header"
            >
              <div class="field-name">{{ formatFieldName(f.field) }}</div>
              <div class="field-old">
                <code>{{ f.old ?? "—" }}</code>
              </div>
              <div class="field-arrow">➡</div>
              <div class="field-new">
                <code>{{ f.new ?? "—" }}</code>
              </div>
            </div>
          </div>
        </section>

        <section v-if="selectedItem.method">
          <h5>Endpoint Details</h5>
          <div class="endpoint-details">
            <div v-if="selectedItem.description" class="detail-section">
              <h6>📝 Description</h6>
              <p>{{ selectedItem.description }}</p>
            </div>

            <div
              v-if="selectedItem.parameters && selectedItem.parameters.length"
              class="detail-section parameters-section"
            >
              <h6>📋 Parameters</h6>
              <div class="parameters-table">
                <table class="p-datatable p-datatable-sm">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>In</th>
                      <th>Required</th>
                      <th>Type</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="param in selectedItem.parameters" :key="param.name">
                      <td>
                        <code>{{ param.name }}</code>
                      </td>
                      <td>{{ param.in }}</td>
                      <td>
                        <Tag v-if="param.required" severity="danger">Required</Tag>
                        <Tag v-else severity="success">Optional</Tag>
                      </td>
                      <td>{{ param.schema?.type || "object" }}</td>
                      <td>{{ param.description || "-" }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div v-if="selectedItem.requestBody" class="detail-section">
              <h6>📤 Request Body</h6>
              <div v-if="selectedItem.requestBody.description" class="body-desc">
                {{ selectedItem.requestBody.description }}
              </div>
              <div v-if="selectedItem.requestBody.content" class="content-list">
                <div
                  v-for="(content, type) in selectedItem.requestBody.content"
                  :key="type"
                  class="content-item"
                >
                  <div v-if="content.schema" class="schema-preview">
                    <div
                      v-if="dereferenceSchema(content.schema).title"
                      class="schema-title"
                    >
                      {{ dereferenceSchema(content.schema).title }}
                    </div>
                    <div
                      v-if="dereferenceSchema(content.schema).description"
                      class="schema-desc"
                    >
                      {{ dereferenceSchema(content.schema).description }}
                    </div>
                    <div
                      v-if="dereferenceSchema(content.schema).type"
                      class="schema-type"
                    >
                      Type: {{ dereferenceSchema(content.schema).type }}
                    </div>
                    <div
                      v-if="dereferenceSchema(content.schema).properties"
                      class="properties-list"
                    >
                      <div
                        v-for="(prop, name) in dereferenceSchema(content.schema)
                          .properties"
                        :key="name"
                        class="property-item"
                      >
                        <code class="prop-name">{{ name }}</code>
                        <span class="prop-type">{{ prop.type || "object" }}</span>
                        <span v-if="prop.description" class="prop-desc">{{
                          prop.description
                        }}</span>
                        <span v-if="prop.title" class="prop-title">{{
                          prop.title.replace(/^\(|\)$/g, "")
                        }}</span>
                      </div>
                    </div>
                    <div v-else>
                      <pre
                        class="mini-json"
                      ><code>{{ prettyJSON(dereferenceSchema(content.schema)) }}</code></pre>
                    </div>
                  </div>
                  <div v-if="content.example" class="example-preview">
                    <strong>Example:</strong>
                    <pre class="mini-json"><code>{{ prettyJSON(content.example) }}</code></pre>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="selectedItem.responses" class="detail-section">
              <h6>📥 Responses</h6>
              <div class="responses-list">
                <div
                  v-for="(response, code) in selectedItem.responses"
                  :key="code"
                  class="response-item"
                >
                  <div class="response-header">
                    <Tag :severity="getResponseSeverity(code)" size="small">{{
                      code
                    }}</Tag>
                    <span class="response-desc">{{ response.description }}</span>
                  </div>
                  <div v-if="response.content" class="response-content">
                    <div
                      v-for="(content, type) in response.content"
                      :key="type"
                      class="content-item"
                    >
                      <div v-if="content.schema" class="schema-preview">
                        <div
                          v-if="dereferenceSchema(content.schema).title"
                          class="schema-title"
                        >
                          {{ dereferenceSchema(content.schema).title }}
                        </div>
                        <div
                          v-if="dereferenceSchema(content.schema).description"
                          class="schema-desc"
                        >
                          {{ dereferenceSchema(content.schema).description }}
                        </div>
                        <div
                          v-if="dereferenceSchema(content.schema).type"
                          class="schema-type"
                        >
                          Type: {{ dereferenceSchema(content.schema).type }}
                        </div>
                        <div
                          v-if="dereferenceSchema(content.schema).properties"
                          class="properties-list"
                        >
                          <div
                            v-for="(prop, name) in dereferenceSchema(
                              content.schema
                            ).properties"
                            :key="name"
                            class="property-item"
                          >
                            <code class="prop-name">{{ name }}</code>
                            <Tag
                              v-if="
                                dereferenceSchema(content.schema).required &&
                                Array.isArray(
                                  dereferenceSchema(content.schema).required
                                ) &&
                                dereferenceSchema(content.schema).required.includes(
                                  name
                                )
                              "
                              severity="danger"
                              size="small"
                              >Req</Tag
                            >
                            <span class="prop-type">{{ prop.type || "object" }}</span>
                            <span v-if="prop.description" class="prop-desc">{{
                              prop.description
                            }}</span>
                            <span v-if="prop.title" class="prop-title">{{
                              prop.title.replace(/^\(|\)$/g, "")
                            }}</span>
                          </div>
                        </div>
                        <div v-else>
                          <pre
                            class="mini-json"
                          ><code>{{ prettyJSON(dereferenceSchema(content.schema)) }}</code></pre>
                        </div>
                      </div>
                      <div v-if="content.example" class="example-preview">
                        <strong>Example:</strong>
                        <pre class="mini-json"><code>{{ prettyJSON(content.example) }}</code></pre>
                      </div>
                    </div>
                  </div>
                  <div v-else>No content defined</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          v-if="
            selectedItem.changeType === 'modified' && selectedItem.propertiesAdded
          "
        >
          <h5>Schema Changes</h5>
          <div class="schema-changes-detail">
            <div v-if="selectedItem.propertiesAdded.length" class="change-group">
              <h6>Added Properties</h6>
              <ul>
                <li v-for="prop in selectedItem.propertiesAdded" :key="prop.name">
                  {{ prop.name }}
                </li>
              </ul>
            </div>
            <div v-if="selectedItem.propertiesRemoved.length" class="change-group">
              <h6>Removed Properties</h6>
              <ul>
                <li v-for="prop in selectedItem.propertiesRemoved" :key="prop.name">
                  {{ prop.name }}
                </li>
              </ul>
            </div>
            <div v-if="selectedItem.propertiesModified.length" class="change-group">
              <h6>Modified Properties</h6>
              <ul>
                <li v-for="prop in selectedItem.propertiesModified" :key="prop.name">
                  {{ prop.name }}
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section
          v-if="
            selectedItem.changeType === 'added' &&
            selectedItem.dereferencedSchema?.properties
          "
        >
          <h5>Schema Properties</h5>
          <div class="properties-list">
            <div
              v-for="(prop, name) in selectedItem.dereferencedSchema.properties"
              :key="name"
              class="property-item"
            >
              <code class="prop-name">{{ name }}</code>
              <span class="prop-type">{{ prop.type || "object" }}</span>
              <span v-if="prop.description" class="prop-desc">{{
                prop.description
              }}</span>
              <span v-if="prop.title" class="prop-title">{{
                prop.title.replace(/^\(|\)$/g, "")
              }}</span>
              <Tag
                v-if="
                  (selectedItem.dereferencedSchema?.required || []).includes(name)
                "
                severity="danger"
                size="small"
                >Req</Tag
              >
            </div>
          </div>
        </section>

        <section
          v-if="selectedItem.changeType === 'modified' && selectedItem.oldValue"
        >
          <h5>Info Change</h5>
          <div class="detail-section no-hover" style="margin-bottom: 16px">
            <h6>⏪ Before</h6>
            <div class="before-value">
              {{ truncate(selectedItem.oldValue || "", 200) }}
            </div>
          </div>
          <div class="detail-section no-hover">
            <h6>⏩ After</h6>
            <div class="before-value">
              {{ truncate(selectedItem.newValue || "", 200) }}
            </div>
          </div>
        </section>

        <section
          v-else-if="selectedItem.changeType === 'added' && selectedItem.value"
        >
          <h5>Info Change</h5>
          <div class="detail-section no-hover">
            <div
              v-if="
                getFormattedValue(selectedItem.value) &&
                typeof getFormattedValue(selectedItem.value) === 'object'
              "
            >
              <div class="properties-list" style="margin-top: 8px">
                <div
                  v-for="(val, key) in getFormattedValue(selectedItem.value)"
                  :key="key"
                  class="property-item"
                >
                  <div class="prop-left">
                    <code class="prop-name">{{ key }}</code>
                    <div class="prop-desc">
                      :
                      {{
                        typeof val === "object" ? prettyJSON(val) : String(val)
                      }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="before-value">
              {{ truncate(selectedItem.value || "", 200) }}
            </div>
          </div>
        </section>

        <section
          v-else-if="selectedItem.changeType === 'removed' && selectedItem.value"
        >
          <h5>Info Change</h5>
          <div class="detail-section no-hover">
            <h6>🗑️ Removed</h6>
            <div
              v-if="
                getFormattedValue(selectedItem.value) &&
                typeof getFormattedValue(selectedItem.value) === 'object'
              "
            >
              <pre
                class="mini-json"
              ><code>{{ prettyJSON(getFormattedValue(selectedItem.value)) }}</code></pre>
            </div>
            <div v-else class="before-value">
              {{ truncate(selectedItem.value || "", 200) }}
            </div>
          </div>
        </section>

        <section
          v-if="
            selectedItem.value &&
            !selectedItem.method &&
            !(
              selectedItem.changeType === 'added' &&
              ['title', 'version', 'description', 'contact', 'license'].includes(
                selectedItem.key
              )
            )
          "
          class="detail-section"
        >
          <h5>Server Details</h5>
          <div>
            <div v-if="getFormattedValue(selectedItem.value)?.url">
              <h6>🔗 URL</h6>
              <div class="before-value">
                <code>{{ getFormattedValue(selectedItem.value).url }}</code>
              </div>
            </div>
            <div
              v-if="getFormattedValue(selectedItem.value)?.description"
              style="margin-top: 12px"
            >
              <h6>📝 Description</h6>
              <p>{{ getFormattedValue(selectedItem.value).description }}</p>
            </div>
            <div
              v-if="getFormattedValue(selectedItem.value)?.variables"
              style="margin-top: 12px"
            >
              <h6>⚙️ Variables</h6>
              <div class="properties-list">
                <div
                  v-for="(v, name) in getFormattedValue(selectedItem.value)
                    .variables"
                  :key="name"
                  class="property-item"
                >
                  <code class="prop-name">{{ name }}</code>
                  <div class="prop-desc">{{ v.description || "-" }}</div>
                  <div class="prop-type" style="margin-left: auto">
                    {{ v.default !== undefined ? "Default: " + v.default : "" }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div class="json-toggle">
          <Button
            :icon="showJson ? 'pi pi-eye-slash' : 'pi pi-eye'"
            :label="showJson ? 'Hide JSON' : 'Show JSON'"
            class="p-button-text p-button-sm"
            @click="$emit('update:showJson', !showJson)"
          />
        </div>

        <section v-if="showJson">
          <h5>JSON Preview</h5>
          <pre
            class="json-preview"
          ><code>{{ prettyJSON(selectedItem.raw || selectedItem) }}</code></pre>
        </section>
      </div>
    </div>
    <template #footer>
      <Button
        label="Close"
        icon="pi pi-times"
        severity="secondary"
        @click="$emit('update:visible', false)"
      />
    </template>
  </Dialog>
</template>

<script>
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import Tag from "primevue/tag";
import {
  prettyJSON,
  truncate,
  formatFieldName,
  getMethodSeverity,
  getResponseSeverity,
  getFormattedValue,
} from "../../utils/diffDisplay";

// The "Change Details" dialog shown when a diff card's eye icon is clicked.
// Extracted verbatim from DiffDrawer.vue's <Dialog> block.
export default {
  name: "DiffDetailDialog",
  components: { Dialog, Button, Tag },
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    selectedItem: {
      type: Object,
      default: null,
    },
    showJson: {
      type: Boolean,
      default: false,
    },
    dereferenceSchema: {
      type: Function,
      required: true,
    },
  },
  emits: ["update:visible", "update:showJson", "copy-item-markdown"],
  setup() {
    return {
      prettyJSON,
      truncate,
      formatFieldName,
      getMethodSeverity,
      getResponseSeverity,
      getFormattedValue,
    };
  },
};
</script>
