<template>
  <div class="form-section">
    <h4>API Information</h4>

    <div class="form-field">
      <label for="openapi-version" class="required">OpenAPI Version</label>
      <InputText
        id="openapi-version"
        v-model="formData.openapi"
        placeholder="3.0.0"
      />
    </div>

    <div class="form-field">
      <label for="api-title" class="required">Title</label>
      <InputText
        id="api-title"
        v-model="formData.info.title"
        placeholder="My API"
      />
    </div>

    <div class="form-field">
      <label for="api-version" class="required">Version</label>
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
</template>

<script>
import "../../assets/form-editor-shared.css";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";

// The "Info" tab of FormEditor: OpenAPI version + info/contact/license
// fields. Receives the whole reactive `formData` object (not a copy) as a
// prop and mutates its nested fields directly — the same mutation pattern
// FormEditor.vue used internally before this was extracted, so behavior is
// unchanged: writes flow straight into the parent's formData ref.
export default {
  name: "ApiInfoTab",
  components: { InputText, Textarea },
  props: {
    formData: {
      type: Object,
      required: true,
    },
  },
};
</script>
