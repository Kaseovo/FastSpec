<template>
  <div class="form-editor">
    <div class="form-header">
      <h3>Form Editor</h3>
      <div class="form-header__controls">
        <Button
          :icon="showLivePreview ? 'pi pi-eye-slash' : 'pi pi-eye'"
          :label="showLivePreview ? 'Hide Preview' : 'Live Preview'"
          class="preview-toggle-btn"
          size="small"
          text
          @click="$emit('toggle-live-preview')"
        />
      </div>
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
            <span v-if="tabCounts.servers" class="tab-count-badge">{{ tabCounts.servers }}</span>
          </Tab>
          <Tab value="2">
            <i class="pi pi-sitemap"></i>
            <span>Paths</span>
            <span v-if="tabCounts.paths" class="tab-count-badge">{{ tabCounts.paths }}</span>
          </Tab>
          <Tab value="3">
            <i class="pi pi-tag"></i>
            <span>Tags</span>
            <span v-if="tabCounts.tags" class="tab-count-badge">{{ tabCounts.tags }}</span>
          </Tab>
          <Tab value="4">
            <i class="pi pi-box"></i>
            <span>Components</span>
            <span v-if="tabCounts.components" class="tab-count-badge">{{ tabCounts.components }}</span>
          </Tab>
          <Tab value="5">
            <i class="pi pi-shield"></i>
            <span>Security</span>
            <span v-if="tabCounts.security" class="tab-count-badge">{{ tabCounts.security }}</span>
          </Tab>
        </TabList>

        <TabPanels>
          <!-- API Info Tab -->
          <TabPanel value="0">
            <ApiInfoTab :form-data="formData" />
          </TabPanel>

          <!-- Servers Tab -->
          <TabPanel value="1">
            <ServersTab
              :form-data="formData"
              :has-empty-server-url="hasEmptyServerUrl"
              @add-server="addServer"
              @remove-server="removeServer"
            />
          </TabPanel>

          <!-- Paths Tab -->
          <TabPanel value="2">
            <PathsTab :form-data="formData" :api="pathsApi" />
          </TabPanel>

          <!-- Tags Tab -->
          <TabPanel value="3">
            <TagsTab
              :form-data="formData"
              :has-empty-tag-name="hasEmptyTagName"
              :has-duplicate-tag-name="hasDuplicateTagName"
              @add-tag="addTag"
              @remove-tag="removeTag"
            />
          </TabPanel>

          <!-- Components Tab -->
          <TabPanel value="4">
            <ComponentsTab :form-data="formData" :api="componentsApi" />
          </TabPanel>

          <!-- Security Tab -->
          <TabPanel value="5">
            <SecurityTab :form-data="formData" :api="securityApi" />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>

    <!-- Add / Edit Response Code Dialog (two-step: category → code) -->
    <ResponseCodeDialog
      :visible="showAddResponseDialog"
      @update:visible="showAddResponseDialog = $event"
      :editing-response-code="editingResponseCode"
      :step="responseDialogStep"
      @update:step="responseDialogStep = $event"
      :category="responseDialogCategory"
      @update:category="responseDialogCategory = $event"
      :new-response-code="newResponseCode"
      @update:new-response-code="newResponseCode = $event"
      :status-code-categories="statusCodeCategories"
      :status-codes-for-category="statusCodesForCategory"
      :is-response-code-used="isResponseCodeUsed"
      :get-status-severity="getStatusSeverity"
      @reset="resetResponseDialog"
      @confirm="confirmResponseDialog"
    />

    <!-- Add Path Dialog -->
    <AddPathDialog
      :visible="showAddPathDialog"
      @update:visible="showAddPathDialog = $event"
      :http-methods="httpMethods"
      :new-method="newMethod"
      @update:new-method="newMethod = $event"
      :new-path="newPath"
      @update:new-path="newPath = $event"
      @path-keydown="handlePathKeydown"
      @confirm="addPath"
    />

    <!-- Add Method Dialog -->
    <AddMethodDialog
      :visible="showAddMethodDialogVisible"
      @update:visible="showAddMethodDialogVisible = $event"
      :available-methods="availableMethodsForPath"
      :method-to-add="methodToAdd"
      @update:method-to-add="methodToAdd = $event"
      @confirm="addMethodToPath"
    />

    <!-- Edit Path Dialog -->
    <EditPathDialog
      :visible="showEditPathDialog"
      @update:visible="showEditPathDialog = $event"
      :edit-path-value="editPathValue"
      @update:edit-path-value="editPathValue = $event"
      :edit-path-error="editPathError"
      @path-keydown="handleEditPathKeydown"
      @confirm="confirmEditPath"
    />

  </div>
</template>

<script>
import Button from "primevue/button";
import Tabs from "primevue/tabs";
import TabList from "primevue/tablist";
import Tab from "primevue/tab";
import TabPanels from "primevue/tabpanels";
import TabPanel from "primevue/tabpanel";
import ApiInfoTab from "./form-editor/ApiInfoTab.vue";
import ServersTab from "./form-editor/ServersTab.vue";
import TagsTab from "./form-editor/TagsTab.vue";
import PathsTab from "./form-editor/PathsTab.vue";
import ComponentsTab from "./form-editor/ComponentsTab.vue";
import SecurityTab from "./form-editor/SecurityTab.vue";
import AddPathDialog from "./form-editor/AddPathDialog.vue";
import AddMethodDialog from "./form-editor/AddMethodDialog.vue";
import EditPathDialog from "./form-editor/EditPathDialog.vue";
import ResponseCodeDialog from "./form-editor/ResponseCodeDialog.vue";
import { useFormEditorState } from "../composables/useFormEditorState";

export default {
  name: "FormEditor",
  components: {
    Button,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    ApiInfoTab,
    ServersTab,
    TagsTab,
    PathsTab,
    ComponentsTab,
    SecurityTab,
    AddPathDialog,
    AddMethodDialog,
    EditPathDialog,
    ResponseCodeDialog,
  },
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
    showLivePreview: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update:modelValue", "toggle-live-preview"],
  setup(props, { emit }) {
    // All state/logic lives in useFormEditorState so the design-prototype
    // shells (components/form-editor-prototype/*) can reuse the exact same
    // data wiring and only vary how the tabs are arranged on screen.
    return useFormEditorState(props, emit);
  },
};
</script>

<style>
/* Shared, unscoped by design: PathsTab/ComponentsTab/ServersTab/TagsTab/
   ApiInfoTab/SecurityTab and the Add/Edit dialogs were split out of this
   component into their own SFCs, but Vue's `scoped` CSS only reaches a
   component's OWN template — it does not reach into child components'
   internals. These classes need to be visible across that whole family
   (including inside PrimeVue Dialogs, which teleport their content out of
   this component's DOM subtree entirely), so they live in a real global
   stylesheet instead. See src/assets/form-editor-shared.css's header
   comment for how collisions with the rest of the app are avoided. */
@import "../assets/form-editor-shared.css";
</style>
