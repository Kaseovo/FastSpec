<template>
  <div class="fet">
    <aside class="fet-tree">
      <div class="fet-search">
        <i class="pi pi-search"></i>
        <input v-model="query" type="text" placeholder="Jump to a section, path, or schema..." />
      </div>

      <div class="fet-tree__scroll">
        <button
          class="fet-node fet-node--section"
          :class="{ 'fet-node--active': active === 'info' }"
          @click="active = 'info'"
        >
          <i class="pi pi-info-circle"></i> Info
        </button>

        <div v-for="s in sections" :key="s.key" class="fet-group">
          <button
            class="fet-node fet-node--section"
            :class="{ 'fet-node--active': active === s.key }"
            @click="active = s.key"
          >
            <i
              class="pi pi-chevron-right fet-node__caret"
              :class="{ 'fet-node__caret--open': s.expanded }"
              @click.stop="toggleCollapsed(s.key)"
            ></i>
            <i :class="s.icon"></i> {{ s.label }}
            <span class="fet-node__count">{{ s.count }}</span>
          </button>
          <div v-if="s.expanded && s.filteredItems.length" class="fet-children">
            <button
              v-for="item in s.visibleItems"
              :key="item"
              class="fet-node fet-node--child"
              @click="openItem(s.key, item)"
              :title="item"
            >
              <span class="fet-node__dot" :class="s.dotClass"></span>{{ item }}
            </button>
            <button
              v-if="s.remaining > 0"
              class="fet-node fet-node--more"
              @click="showAll[s.key] = true"
            >
              + {{ s.remaining }} more — search to filter
            </button>
          </div>
        </div>
      </div>
    </aside>

    <div class="fet-body form-editor">
      <div class="fet-topbar">
        <strong>{{ activeLabel }}</strong>
        <Button
          :icon="showLivePreview ? 'pi pi-eye-slash' : 'pi pi-eye'"
          :label="showLivePreview ? 'Hide Preview' : 'Live Preview'"
          size="small"
          text
          @click="$emit('toggle-live-preview')"
        />
      </div>

      <div class="fet-content">
        <ApiInfoTab v-if="active === 'info'" :form-data="formData" />
        <ServersTab
          v-else-if="active === 'servers'"
          :form-data="formData"
          :has-empty-server-url="hasEmptyServerUrl"
          @add-server="addServer"
          @remove-server="removeServer"
        />
        <PathsTab v-else-if="active === 'paths'" :form-data="formData" :api="pathsApi" />
        <TagsTab
          v-else-if="active === 'tags'"
          :form-data="formData"
          :has-empty-tag-name="hasEmptyTagName"
          :has-duplicate-tag-name="hasDuplicateTagName"
          @add-tag="addTag"
          @remove-tag="removeTag"
        />
        <ComponentsTab v-else-if="active === 'components'" :form-data="formData" :api="componentsApi" />
        <SecurityTab v-else-if="active === 'security'" :form-data="formData" :api="securityApi" />
      </div>
    </div>

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
    <AddPathDialog
      :visible="showAddPathDialog"
      @update:visible="showAddPathDialog = $event"
      :step="addPathStep"
      :http-methods="httpMethods"
      :new-method="newMethod"
      @update:new-method="newMethod = $event"
      :new-path="newPath"
      @update:new-path="newPath = $event"
      :form-data="formData"
      :api="pathsApi"
      @path-keydown="handlePathKeydown"
      @back="goToPrevAddPathStep"
      @next="goToNextAddPathStep"
      @cancel="cancelAddPathDialog"
      @finish="finishAddPathWizard"
    />
    <AddMethodDialog
      :visible="showAddMethodDialogVisible"
      @update:visible="showAddMethodDialogVisible = $event"
      :available-methods="availableMethodsForPath"
      :method-to-add="methodToAdd"
      @update:method-to-add="methodToAdd = $event"
      @confirm="addMethodToPath"
    />
    <EditPathDialog
      :visible="showEditPathDialog"
      @update:visible="showEditPathDialog = $event"
      :edit-path-value="editPathValue"
      @update:edit-path-value="editPathValue = $event"
      :edit-path-error="editPathError"
      @path-keydown="handleEditPathKeydown"
      @confirm="confirmEditPath"
    />
    <AddSchemaDialog
      :visible="showAddSchemaDialog"
      @update:visible="showAddSchemaDialog = $event"
      :step="addSchemaStep"
      @update:step="addSchemaStep = $event"
      :new-schema-name="newSchemaName"
      @update:new-schema-name="newSchemaName = $event"
      :new-schema-kind="newSchemaKind"
      @update:new-schema-kind="newSchemaKind = $event"
      :new-schema-description="newSchemaDescription"
      @update:new-schema-description="newSchemaDescription = $event"
      :new-schema-properties="newSchemaProperties"
      :is-new-schema-name-duplicate="isNewSchemaNameDuplicate"
      @add-property="addWizardProperty"
      @remove-property="removeWizardProperty"
      @next="goToAddSchemaStep2"
      @cancel="cancelAddSchemaDialog"
      @confirm="confirmAddSchema"
    />
  </div>
</template>

<script>
import { ref, reactive, computed, watch } from "vue";
import Button from "primevue/button";
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
import AddSchemaDialog from "./form-editor/AddSchemaDialog.vue";
import { useFormEditorState } from "../composables/useFormEditorState";

const LABELS = {
  info: "API Information",
  servers: "Servers",
  paths: "Paths",
  tags: "Tags",
  components: "Components",
  security: "Security",
};

// Every groupable section (everything but the single-page Info leaf) gets
// the same collapse + search-filter + capped-list treatment. `getItems`
// pulls the real child labels straight out of formData so the tree always
// reflects actual content, not just a count.
const GROUPS = [
  {
    key: "servers",
    label: "Servers",
    icon: "pi pi-server",
    dotClass: "fet-node__dot--server",
    getItems: (fd) => (fd.servers || []).map((s) => s.url).filter(Boolean),
  },
  {
    key: "paths",
    label: "Paths",
    icon: "pi pi-sitemap",
    dotClass: "",
    getItems: (fd) => Object.keys(fd.paths || {}),
  },
  {
    key: "tags",
    label: "Tags",
    icon: "pi pi-tag",
    dotClass: "fet-node__dot--tag",
    getItems: (fd) => (fd.tags || []).map((t) => t.name).filter(Boolean),
  },
  {
    key: "components",
    label: "Components",
    icon: "pi pi-box",
    dotClass: "fet-node__dot--schema",
    getItems: (fd) => Object.keys(fd.components?.schemas || {}),
  },
  {
    key: "security",
    label: "Security",
    icon: "pi pi-shield",
    dotClass: "fet-node__dot--security",
    getItems: (fd) => Object.keys(fd.components?.securitySchemes || {}),
  },
];

const PAGE_SIZE = 40;

export default {
  name: "FormEditor",
  components: {
    Button,
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
    AddSchemaDialog,
  },
  props: {
    modelValue: { type: Object, required: true },
    showLivePreview: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "toggle-live-preview"],
  setup(props, { emit }) {
    const state = useFormEditorState(props, emit);
    const active = ref("paths");
    const query = ref("");

    const activeLabel = computed(() => LABELS[active.value]);
    const isSearching = computed(() => query.value.trim().length > 0);

    // Collapse/expand per section — the point of a tree over a flat
    // accordion is that a spec with hundreds of paths (or dozens of tags,
    // servers, security schemes...) doesn't force that many DOM nodes into
    // view at once. A search in progress always wins over a manual
    // collapse (you typed to find something, so show it).
    const collapsed = reactive({});
    const showAll = reactive({});
    for (const g of GROUPS) {
      collapsed[g.key] = false;
      showAll[g.key] = false;
    }
    const toggleCollapsed = (key) => {
      collapsed[key] = !collapsed[key];
    };

    // Typing a fresh search should re-cap every section — otherwise "show
    // all" from a previous browse stays sticky and defeats the point of
    // typing.
    watch(query, () => {
      for (const g of GROUPS) showAll[g.key] = false;
    });

    const sections = computed(() =>
      GROUPS.map((g) => {
        const all = g.getItems(state.formData.value);
        const q = query.value.trim().toLowerCase();
        const filteredItems = q ? all.filter((item) => item.toLowerCase().includes(q)) : all;
        const limit = showAll[g.key] ? Infinity : PAGE_SIZE;
        return {
          key: g.key,
          label: g.label,
          icon: g.icon,
          dotClass: g.dotClass,
          count: all.length,
          filteredItems,
          visibleItems: filteredItems.slice(0, limit),
          remaining: Math.max(0, filteredItems.length - limit),
          expanded: isSearching.value || !collapsed[g.key],
        };
      }),
    );

    // Clicking a path/schema in the tree should actually open that item —
    // not just switch to its tab and leave the user to find it again in a
    // list of hundreds. Servers/Tags/Security are flat lists with no
    // per-item open/closed state to drive, so those just switch tabs (their
    // existing behavior).
    const openItem = (sectionKey, item) => {
      active.value = sectionKey;
      if (sectionKey === "paths") {
        const pathItem = state.pathsList.value.find((p) => p.path === item);
        state.selectAndOpenPath(item, pathItem?.methods?.[0]);
      } else if (sectionKey === "components") {
        state.selectAndOpenSchema(item);
      }
    };

    return {
      ...state,
      active,
      query,
      activeLabel,
      sections,
      showAll,
      toggleCollapsed,
      openItem,
    };
  },
};
</script>

<style scoped>
.fet {
  display: grid;
  grid-template-columns: 280px 1fr;
  height: 100%;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.fet-tree {
  display: flex;
  flex-direction: column;
  background: #fafbfc;
  border-right: 1px solid #e5e7eb;
  min-height: 0;
}

.fet-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  color: #9ca3af;
}

.fet-search input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 13px;
  background: transparent;
  color: #111827;
}

.fet-tree__scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.fet-node {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  text-align: left;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
}

.fet-node--section {
  font-weight: 600;
}

.fet-node:hover {
  background: #f3f4f6;
}

.fet-node--active {
  background: #eff6ff;
  color: #1d4ed8;
}

.fet-node__count {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  color: #9ca3af;
}

.fet-node--active .fet-node__count {
  color: #3b82f6;
}

.fet-children {
  padding-left: 14px;
  border-left: 1px dashed #e5e7eb;
  margin-left: 20px;
}

.fet-node--child {
  font-weight: 400;
  font-size: 12px;
  font-family: "SF Mono", "Monaco", monospace;
  color: #6b7280;
  padding: 5px 8px;
}

.fet-node--more {
  font-weight: 500;
  font-size: 11px;
  font-style: italic;
  color: #9ca3af;
  padding: 5px 8px;
}

.fet-node--more:hover {
  color: #6b7280;
}

.fet-node__caret {
  font-size: 9px;
  color: #9ca3af;
  flex-shrink: 0;
  padding: 4px;
  margin: -4px;
  border-radius: 4px;
  transition: transform 0.15s ease;
}

.fet-node__caret:hover {
  color: #6b7280;
  background: rgba(0, 0, 0, 0.04);
}

.fet-node__caret--open {
  transform: rotate(90deg);
}

.fet-node__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #93c5fd;
  flex-shrink: 0;
}

.fet-node__dot--server {
  background: #6ee7b7;
}

.fet-node__dot--tag {
  background: #fcd34d;
}

.fet-node__dot--security {
  background: #fca5a5;
}

.fet-node__dot--schema {
  background: #c4b5fd;
}

.fet-group {
  margin-bottom: 2px;
}

.fet-body.form-editor {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: transparent;
  border: none;
  border-radius: 0;
  overflow: visible;
  height: auto;
}

.fet-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 14px;
}

.fet-topbar strong {
  color: #111827;
}

.fet-content {
  flex: 1;
  overflow-y: auto;
}
</style>
