<template>
  <div class="form-section">
    <div class="section-header">
      <h4>Security Schemes</h4>
      <Button
        label="Add Security Scheme"
        icon="pi pi-plus"
        size="small"
        @click="api.addSecurityScheme"
      />
    </div>

    <div v-if="api.securitySchemesList.value.length === 0" class="empty-state">
      <i class="pi pi-shield"></i>
      <p>No security schemes defined. Add one to get started.</p>
    </div>

    <Accordion v-if="api.securitySchemesList.value.length > 0">
      <AccordionPanel
        v-for="(scheme, index) in api.securitySchemesList.value"
        :key="index"
        :value="index.toString()"
      >
        <AccordionHeader>
          <div class="schema-header">
            <span class="schema-name">{{ scheme.name }}</span>
            <Tag :value="scheme.data.type" severity="info" />
            <Button
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              size="small"
              @click.stop="api.removeSecurityScheme(scheme.name)"
            />
          </div>
        </AccordionHeader>
        <AccordionContent>
          <div class="security-scheme-builder">
            <div class="form-row">
              <div class="form-field">
                <label class="required">Name</label>
                <InputText
                  :value="scheme.name"
                  @input="api.renameSecurityScheme(scheme.name, $event.target.value)"
                  placeholder="SchemeName"
                />
              </div>
              <div class="form-field">
                <label class="required">Type</label>
                <Select
                  v-model="scheme.data.type"
                  :options="['apiKey', 'http', 'oauth2', 'openIdConnect']"
                  @change="api.onSecuritySchemeTypeChange(scheme.data)"
                />
              </div>
            </div>

            <div class="form-field">
              <label>Description</label>
              <Textarea v-model="scheme.data.description" rows="2" />
            </div>

            <!-- apiKey -->
            <div v-if="scheme.data.type === 'apiKey'" class="form-row">
              <div class="form-field">
                <label class="required">Parameter Name</label>
                <InputText v-model="scheme.data.name" placeholder="X-API-Key" />
              </div>
              <div class="form-field">
                <label class="required">Location</label>
                <Select
                  v-model="scheme.data.in"
                  :options="['header', 'query', 'cookie']"
                />
              </div>
            </div>

            <!-- http -->
            <div v-if="scheme.data.type === 'http'" class="form-row">
              <div class="form-field">
                <label class="required">Scheme</label>
                <InputText v-model="scheme.data.scheme" placeholder="bearer" />
              </div>
              <div v-if="scheme.data.scheme === 'bearer'" class="form-field">
                <label>Bearer Format</label>
                <InputText v-model="scheme.data.bearerFormat" placeholder="JWT" />
              </div>
            </div>

            <!-- openIdConnect -->
            <div v-if="scheme.data.type === 'openIdConnect'" class="form-field">
              <label class="required">OpenID Connect URL</label>
              <InputText
                v-model="scheme.data.openIdConnectUrl"
                placeholder="https://example.com/.well-known/openid-configuration"
              />
            </div>

            <!-- oauth2 -->
            <div v-if="scheme.data.type === 'oauth2'" class="oauth2-flows">
              <div class="section-header">
                <h5>Flows</h5>
                <Select
                  :modelValue="null"
                  :options="availableFlowTypes(scheme.data)"
                  placeholder="Add flow"
                  @update:modelValue="
                    (v) => v && api.addOAuth2Flow(scheme.data, v)
                  "
                />
              </div>

              <div
                v-if="Object.keys(scheme.data.flows || {}).length === 0"
                class="empty-state-small"
              >
                <p>No flows defined</p>
              </div>

              <div
                v-for="(flow, flowType) in scheme.data.flows"
                :key="flowType"
                class="oauth2-flow"
              >
                <div class="section-header">
                  <h6>{{ flowType }}</h6>
                  <Button
                    icon="pi pi-trash"
                    severity="danger"
                    text
                    rounded
                    size="small"
                    @click="api.removeOAuth2Flow(scheme.data, flowType)"
                  />
                </div>

                <div class="form-row">
                  <div
                    v-if="
                      api.oauth2FlowFields[flowType].includes('authorizationUrl')
                    "
                    class="form-field"
                  >
                    <label class="required">Authorization URL</label>
                    <InputText v-model="flow.authorizationUrl" />
                  </div>
                  <div
                    v-if="api.oauth2FlowFields[flowType].includes('tokenUrl')"
                    class="form-field"
                  >
                    <label class="required">Token URL</label>
                    <InputText v-model="flow.tokenUrl" />
                  </div>
                  <div class="form-field">
                    <label>Refresh URL</label>
                    <InputText v-model="flow.refreshUrl" />
                  </div>
                </div>

                <div class="section-header">
                  <h6>Scopes</h6>
                  <Button
                    label="Add Scope"
                    icon="pi pi-plus"
                    size="small"
                    text
                    @click="api.addScope(flow)"
                  />
                </div>
                <div
                  v-if="!flow.scopes || Object.keys(flow.scopes).length === 0"
                  class="empty-state-small"
                >
                  <p>No scopes defined</p>
                </div>
                <div
                  v-for="(scopeDesc, scopeName) in flow.scopes"
                  :key="scopeName"
                  class="list-item"
                >
                  <div class="list-item-content">
                    <div class="form-field">
                      <label>Scope</label>
                      <InputText
                        :value="scopeName"
                        @input="
                          api.renameScope(flow, scopeName, $event.target.value)
                        "
                      />
                    </div>
                    <div class="form-field">
                      <label>Description</label>
                      <InputText v-model="flow.scopes[scopeName]" />
                    </div>
                  </div>
                  <Button
                    icon="pi pi-trash"
                    severity="danger"
                    text
                    rounded
                    @click="api.removeScope(flow, scopeName)"
                  />
                </div>
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>

    <div class="global-security-section">
      <h4>Global Security Requirements</h4>
      <SecurityRequirementList
        :model-value="formData.security || []"
        @update:model-value="formData.security = $event"
        :schemes="api.availableSecuritySchemes.value"
        hint="Applied to every operation by default. An operation can override this in its Basic Info tab."
        empty-label="No security required by default."
      />
    </div>
  </div>
</template>

<script>
import "../../assets/form-editor-shared.css";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import Select from "primevue/select";
import Accordion from "primevue/accordion";
import AccordionPanel from "primevue/accordionpanel";
import AccordionHeader from "primevue/accordionheader";
import AccordionContent from "primevue/accordioncontent";
import Tag from "primevue/tag";
import SecurityRequirementList from "./SecurityRequirementList.vue";

// The "Security" tab of FormEditor: defines components.securitySchemes and
// the top-level `security` requirement list. `api` bundles everything from
// useSecurityEditor (constructed once in FormEditor.vue) so template bindings
// read `api.<thing>.value` for computed refs, matching the pattern used by
// PathsTab/ComponentsTab's `api` prop.
export default {
  name: "SecurityTab",
  components: {
    Button,
    InputText,
    Textarea,
    Select,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
    Tag,
    SecurityRequirementList,
  },
  props: {
    formData: {
      type: Object,
      required: true,
    },
    api: {
      type: Object,
      required: true,
    },
  },
  methods: {
    availableFlowTypes(schemeData) {
      const defined = Object.keys(schemeData.flows || {});
      return Object.keys(this.api.oauth2FlowFields).filter(
        (t) => !defined.includes(t)
      );
    },
  },
};
</script>

<style scoped>
.oauth2-flows {
  margin-top: 16px;
}

.oauth2-flow {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
}

.oauth2-flow h6 {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.global-security-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}
</style>
