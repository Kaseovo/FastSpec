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

        <button
          class="fet-node fet-node--section"
          :class="{ 'fet-node--active': active === 'servers' }"
          @click="active = 'servers'"
        >
          <i class="pi pi-server"></i> Servers
          <span class="fet-node__count">{{ tabCounts.servers }}</span>
        </button>

        <div class="fet-group">
          <button
            class="fet-node fet-node--section"
            :class="{ 'fet-node--active': active === 'paths' }"
            @click="active = 'paths'"
          >
            <i
              class="pi pi-chevron-right fet-node__caret"
              :class="{ 'fet-node__caret--open': pathsExpanded }"
              @click.stop="pathsCollapsed = !pathsCollapsed"
            ></i>
            <i class="pi pi-sitemap"></i> Paths
            <span class="fet-node__count">{{ tabCounts.paths }}</span>
          </button>
          <div v-if="pathsExpanded && filteredPaths.length" class="fet-children">
            <button
              v-for="p in visiblePaths"
              :key="p"
              class="fet-node fet-node--child"
              @click="active = 'paths'"
              :title="p"
            >
              <span class="fet-node__dot"></span>{{ p }}
            </button>
            <button
              v-if="filteredPaths.length > pathsVisibleLimit"
              class="fet-node fet-node--more"
              @click="pathsShowAll = true"
            >
              + {{ filteredPaths.length - pathsVisibleLimit }} more — search to filter
            </button>
          </div>
        </div>

        <button
          class="fet-node fet-node--section"
          :class="{ 'fet-node--active': active === 'tags' }"
          @click="active = 'tags'"
        >
          <i class="pi pi-tag"></i> Tags
          <span class="fet-node__count">{{ tabCounts.tags }}</span>
        </button>

        <div class="fet-group">
          <button
            class="fet-node fet-node--section"
            :class="{ 'fet-node--active': active === 'components' }"
            @click="active = 'components'"
          >
            <i
              class="pi pi-chevron-right fet-node__caret"
              :class="{ 'fet-node__caret--open': componentsExpanded }"
              @click.stop="componentsCollapsed = !componentsCollapsed"
            ></i>
            <i class="pi pi-box"></i> Components
            <span class="fet-node__count">{{ tabCounts.components }}</span>
          </button>
          <div v-if="componentsExpanded && filteredSchemas.length" class="fet-children">
            <button
              v-for="s in visibleSchemas"
              :key="s"
              class="fet-node fet-node--child"
              @click="active = 'components'"
              :title="s"
            >
              <span class="fet-node__dot fet-node__dot--schema"></span>{{ s }}
            </button>
            <button
              v-if="filteredSchemas.length > schemasVisibleLimit"
              class="fet-node fet-node--more"
              @click="schemasShowAll = true"
            >
              + {{ filteredSchemas.length - schemasVisibleLimit }} more — search to filter
            </button>
          </div>
        </div>

        <button
          class="fet-node fet-node--section"
          :class="{ 'fet-node--active': active === 'security' }"
          @click="active = 'security'"
        >
          <i class="pi pi-shield"></i> Security
          <span class="fet-node__count">{{ tabCounts.security }}</span>
        </button>
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
      :http-methods="httpMethods"
      :new-method="newMethod"
      @update:new-method="newMethod = $event"
      :new-path="newPath"
      @update:new-path="newPath = $event"
      @path-keydown="handlePathKeydown"
      @confirm="addPath"
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
  </div>
</template>

<script>
import { ref, computed, watch } from "vue";
import Button from "primevue/button";
import ApiInfoTab from "../form-editor/ApiInfoTab.vue";
import ServersTab from "../form-editor/ServersTab.vue";
import TagsTab from "../form-editor/TagsTab.vue";
import PathsTab from "../form-editor/PathsTab.vue";
import ComponentsTab from "../form-editor/ComponentsTab.vue";
import SecurityTab from "../form-editor/SecurityTab.vue";
import AddPathDialog from "../form-editor/AddPathDialog.vue";
import AddMethodDialog from "../form-editor/AddMethodDialog.vue";
import EditPathDialog from "../form-editor/EditPathDialog.vue";
import ResponseCodeDialog from "../form-editor/ResponseCodeDialog.vue";
import { useFormEditorState } from "../../composables/useFormEditorState";

const LABELS = {
  info: "API Information",
  servers: "Servers",
  paths: "Paths",
  tags: "Tags",
  components: "Components",
  security: "Security",
};

export default {
  name: "FormEditorVariantTree",
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

    const filteredPaths = computed(() => {
      const all = Object.keys(state.formData.value.paths || {});
      if (!query.value.trim()) return all;
      const q = query.value.toLowerCase();
      return all.filter((p) => p.toLowerCase().includes(q));
    });

    const filteredSchemas = computed(() => {
      const all = Object.keys(state.formData.value.components?.schemas || {});
      if (!query.value.trim()) return all;
      const q = query.value.toLowerCase();
      return all.filter((s) => s.toLowerCase().includes(q));
    });

    // Collapse/expand per section — the point of a tree over a flat
    // accordion is that a spec with hundreds of paths doesn't force
    // hundreds of DOM nodes into view at once. A search in progress always
    // wins over a manual collapse (you typed to find something, so show it).
    const pathsCollapsed = ref(false);
    const componentsCollapsed = ref(false);
    const isSearching = computed(() => query.value.trim().length > 0);
    const pathsExpanded = computed(() => isSearching.value || !pathsCollapsed.value);
    const componentsExpanded = computed(() => isSearching.value || !componentsCollapsed.value);

    // Even expanded, a spec with hundreds of entries renders a capped slice
    // by default — "show all" is one click away, and typing narrows the
    // list directly instead of scrolling through it.
    const PAGE_SIZE = 40;
    const pathsShowAll = ref(false);
    const schemasShowAll = ref(false);
    const pathsVisibleLimit = computed(() => (pathsShowAll.value ? Infinity : PAGE_SIZE));
    const schemasVisibleLimit = computed(() => (schemasShowAll.value ? Infinity : PAGE_SIZE));
    const visiblePaths = computed(() => filteredPaths.value.slice(0, pathsVisibleLimit.value));
    const visibleSchemas = computed(() => filteredSchemas.value.slice(0, schemasVisibleLimit.value));

    // Typing a fresh search should re-cap the list — otherwise "show all"
    // from a previous browse stays sticky and defeats the point of typing.
    watch(query, () => {
      pathsShowAll.value = false;
      schemasShowAll.value = false;
    });

    return {
      ...state,
      active,
      query,
      activeLabel,
      filteredPaths,
      filteredSchemas,
      pathsCollapsed,
      componentsCollapsed,
      pathsExpanded,
      componentsExpanded,
      pathsShowAll,
      schemasShowAll,
      pathsVisibleLimit,
      schemasVisibleLimit,
      visiblePaths,
      visibleSchemas,
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
