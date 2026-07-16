<template>
  <div>
    <div v-if="inline" class="diff-panel">
      <div class="drawer-header">
        <h3>Changes Overview</h3>
        <div class="header-actions">
          <Button
            v-if="hasChanges"
            icon="pi pi-copy"
            label="Copy as Markdown"
            size="small"
            severity="secondary"
            @click="copyAsMarkdown"
            :loading="copying"
            aria-label="Copy changes as markdown"
          />
        </div>
      </div>

      <ScrollPanel style="height: 100%">
        <div
          ref="diffContainer"
          class="diff-container"
          role="region"
          aria-label="Changes content"
        >
          <DiffSummaryBar
            :type-counts="typeCounts"
            :filter="filter"
            v-model:search="search"
            @set-filter="setFilter"
          />

          <div v-if="!hasChanges" class="no-changes">
            <i class="pi pi-check-circle"></i>
            <h3>No Changes</h3>
            <p>The specification hasn't been modified.</p>
          </div>

          <div v-else class="cards-area">
            <DiffEndpointsSection
              :endpoints="endpoints"
              :expanded="expandedSections.endpoints"
              @toggle-section="toggleSection"
              @open-details="openDetails"
            />
            <DiffSchemasSection
              :schemas="schemas"
              :expanded="expandedSections.schemas"
              :expanded-schemas="expandedSchemas"
              :detailed="false"
              @toggle-section="toggleSection"
              @toggle-schema-expand="toggleSchemaExpand"
              @open-details="openDetails"
            />
            <DiffInfoSection
              :infos="infos"
              :expanded="expandedSections.info"
              :detailed="false"
              @toggle-section="toggleSection"
              @open-details="openDetails"
            />
            <DiffServersSection
              :servers="servers"
              :expanded="expandedSections.servers"
              @toggle-section="toggleSection"
              @open-details="openDetails"
            />
          </div>
        </div>
      </ScrollPanel>
    </div>

    <!-- Drawer mode -->
    <Drawer
      v-else
      :visible="visible"
      @update:visible="$emit('update:visible', $event)"
      position="right"
      :style="{ width: '60vw' }"
    >
      <template #header>
        <div class="drawer-header">
          <h3>Changes Overview</h3>
          <div class="header-actions">
            <Button
              v-if="hasChanges"
              icon="pi pi-copy"
              label="Copy as Markdown"
              size="small"
              severity="secondary"
              @click="copyAsMarkdown"
              :loading="copying"
            />
          </div>
        </div>
      </template>

      <ScrollPanel style="height: 100%">
        <div
          ref="diffContainer"
          class="diff-container"
          role="region"
          aria-label="Changes content"
        >
          <DiffSummaryBar
            :type-counts="typeCounts"
            :filter="filter"
            v-model:search="search"
            @set-filter="setFilter"
          />

          <div v-if="!hasChanges" class="no-changes">
            <i class="pi pi-check-circle"></i>
            <h3>No Changes</h3>
            <p>The specification hasn't been modified.</p>
          </div>

          <div v-else class="cards-area">
            <DiffEndpointsSection
              :endpoints="endpoints"
              :expanded="expandedSections.endpoints"
              @toggle-section="toggleSection"
              @open-details="openDetails"
            />
            <DiffSchemasSection
              :schemas="schemas"
              :expanded="expandedSections.schemas"
              :expanded-schemas="expandedSchemas"
              :detailed="true"
              @toggle-section="toggleSection"
              @toggle-schema-expand="toggleSchemaExpand"
              @open-details="openDetails"
            />
            <DiffInfoSection
              :infos="infos"
              :expanded="expandedSections.info"
              :detailed="true"
              @toggle-section="toggleSection"
              @open-details="openDetails"
            />
            <DiffServersSection
              :servers="servers"
              :expanded="expandedSections.servers"
              @toggle-section="toggleSection"
              @open-details="openDetails"
            />
          </div>
        </div>
      </ScrollPanel>
    </Drawer>

    <!-- Details dialog -->
    <DiffDetailDialog
      :visible="detailOpen"
      @update:visible="setDetailOpen"
      :selected-item="selectedItem"
      :show-json="showJson"
      @update:show-json="showJson = $event"
      :dereference-schema="dereferenceSchema"
      @copy-item-markdown="copyItemMarkdown"
    />
  </div>
</template>

<script>
import Drawer from "primevue/drawer";
import Button from "primevue/button";
import ScrollPanel from "primevue/scrollpanel";
import DiffSummaryBar from "./diff-drawer/DiffSummaryBar.vue";
import DiffEndpointsSection from "./diff-drawer/DiffEndpointsSection.vue";
import DiffSchemasSection from "./diff-drawer/DiffSchemasSection.vue";
import DiffInfoSection from "./diff-drawer/DiffInfoSection.vue";
import DiffServersSection from "./diff-drawer/DiffServersSection.vue";
import DiffDetailDialog from "./diff-drawer/DiffDetailDialog.vue";
import { useDiffDrawer } from "../composables/useDiffDrawer";

// DiffDrawer renders an OpenAPI spec diff either inline (embedded in a page,
// e.g. PreviewPanel/SaveDialog/SpecList) or in a slide-over Drawer. Both
// modes share the same summary bar + four diff-category sections + detail
// dialog, so the actual rendering lives in frontend/src/components/diff-drawer/
// and the stateful logic lives in composables/useDiffDrawer.js — this file is
// just the shell that wires the two modes together.
export default {
  name: "DiffDrawer",
  components: {
    Drawer,
    Button,
    ScrollPanel,
    DiffSummaryBar,
    DiffEndpointsSection,
    DiffSchemasSection,
    DiffInfoSection,
    DiffServersSection,
    DiffDetailDialog,
  },
  props: {
    diff: {
      type: Object,
      default: () => ({ info: null, added: [], modified: [], removed: [] }),
    },
    // Optional pre-rendered markdown for the whole diff, computed
    // server-side (validation.diff_utils.generate_markdown_report) for
    // diffs sourced from saved spec versions via the /compare endpoint.
    // When absent (e.g. the live/unsaved-edit diff path), it is generated
    // client-side from `diff` as a fallback.
    markdown: {
      type: String,
      default: null,
    },
    spec: {
      type: Object,
      default: () => ({}),
    },
    inline: {
      type: Boolean,
      default: false,
    },
    visible: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update:visible"],
  setup(props) {
    return useDiffDrawer(props);
  },
};
</script>

<style scoped>
:deep(.diff-panel) {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.04);
}
:deep(.drawer-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.04);
}
:deep(.drawer-header h3) {
  margin: 0;
  font-size: 1rem;
}
:deep(.drawer-header .header-actions) {
  display: flex;
  gap: 8px;
}
:deep(.diff-container) {
  padding: 12px;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI",
    Roboto, "Helvetica Neue", Arial;
  color: #0f1724;
}
:deep(.summary-sticky) {
  position: sticky;
  top: 0;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.9),
    rgba(255, 255, 255, 0.6)
  );
  padding-bottom: 8px;
  z-index: 4;
}
:deep(.summary-grid) {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  align-items: center;
  padding: 10px 0;
}
:deep(.summary-pill) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.04);
  background: #fff;
  cursor: pointer;
}
:deep(.summary-pill.added) {
  border-color: rgba(16, 185, 129, 0.06);
}
:deep(.summary-pill.modified) {
  border-color: rgba(245, 158, 11, 0.06);
}
:deep(.summary-pill.removed) {
  border-color: rgba(244, 63, 94, 0.06);
}
:deep(.summary-pill .pill-count) {
  font-weight: 700;
  color: #0f1724;
}
:deep(.summary-pill.active) {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}
:deep(.search-wrap) {
  display: flex;
  align-items: center;
}
:deep(input.p-inputtext) {
  width: 100%;
  border-radius: 8px;
  padding: 8px 10px;
  border: 1px solid rgba(15, 23, 42, 0.06);
}
:deep(.no-changes) {
  text-align: center;
  padding: 2rem 1rem;
  color: #475569;
}
:deep(.no-changes i) {
  font-size: 3rem;
  color: #10b981;
}
:deep(.cards-area) {
  margin-top: 12px;
}
:deep(.endpoints-section) {
  margin-bottom: 24px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
}
:deep(.endpoints-list) {
  margin-top: 12px;
}
:deep(.endpoint-line) {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 16px 20px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.04);
  margin-bottom: 12px;
  gap: 12px;
  font-size: 1rem;
}
:deep(.endpoint-text) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-weight: 600;
  color: #0f1724;
  flex: 1;
  display: flex;
  justify-content: flex-start;
  align-items: center;
}
:deep(.endpoint-left) {
  display: flex;
  align-items: center;
  gap: 8px;
}
:deep(.endpoint-summary) {
  margin-left: auto;
}
:deep(.cards-grid) {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
:deep(.endpoint-card) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.04);
  box-shadow: 0 2px 8px rgba(2, 6, 23, 0.03);
  gap: 12px;
  transition: all 0.2s ease;
  cursor: pointer;
}

:deep(.schema-card) {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.04);
  box-shadow: 0 2px 8px rgba(2, 6, 23, 0.03);
  gap: 16px;
  transition: all 0.2s ease;
  cursor: pointer;
}

:deep(.schema-card:hover) {
  box-shadow: 0 4px 16px rgba(2, 6, 23, 0.08);
  transform: translateY(-2px);
  border-color: rgba(15, 23, 42, 0.08);
}

:deep(.endpoint-card:hover) {
  box-shadow: 0 4px 16px rgba(2, 6, 23, 0.08);
  transform: translateY(-2px);
  border-color: rgba(15, 23, 42, 0.08);
}
:deep(.card-left) {
  margin-top: 8px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
}

:deep(.schema-card .card-left) {
  align-items: flex-start;
  white-space: normal;
}
:deep(.path) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  color: #0f1724;
  font-weight: 600;
}
:deep(.short) {
  color: #475569;
  font-size: 0.85rem;
}
:deep(.license-inline) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: #0f1724;
  overflow: hidden;
  min-width: 0;
}
:deep(.license-inline a) {
  text-decoration: none;
  color: inherit;
}
:deep(.license-paren) {
  color: #64748b;
  font-weight: 400;
  font-size: 0.85rem;
  margin-left: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:deep(.server-name) {
  font-weight: 600;
  color: #0f1724;
  font-size: 0.95rem;
  flex: 1;
  min-width: 0;
  margin-right: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:deep(.server-desc) {
  color: #64748b;
  font-size: 0.85rem;
  margin-top: 0;
  text-align: right;
  align-self: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-left: auto;
}
:deep(.endpoint-line) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  color: #0f1724;
  font-weight: 600;
}
:deep(.method-text) {
  font-weight: bold;
}
:deep(.card-details) {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
:deep(.mini-section) {
  background: #f8fafc;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.03);
}
:deep(.mini-label) {
  font-size: 0.8rem;
  color: #6b7280;
  margin-bottom: 6px;
}
:deep(.mini-json) {
  background: #0b1220;
  color: #d1fae5;
  padding: 8px;
  border-radius: 6px;
  max-height: 96px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 0.78rem;
}
:deep(.mini-desc) {
  color: #374151;
  font-size: 0.9rem;
}
:deep(.modified-inline) {
  display: flex;
  gap: 8px;
  align-items: center;
  background: #fff;
  padding: 6px;
  border-radius: 6px;
  border: 1px solid rgba(15, 23, 42, 0.03);
}
:deep(.mf) {
  font-weight: 600;
  width: 120px;
}
:deep(.mv) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  padding: 4px 6px;
  border-radius: 4px;
}
:deep(.mv.old) {
  background: #fff7ed;
  color: #92400e;
}
:deep(.mv.new) {
  background: #ecfdf5;
  color: #064e3b;
}
:deep(.marr) {
  color: #6b7280;
}
:deep(.card-right) {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  min-width: 120px;
}
:deep(.change-hints .hint) {
  background: #f3f4f6;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 0.8rem;
  margin-left: 6px;
}
:deep(.change-hints .deprecated) {
  background: #fff1f2;
  color: #b91c1c;
}
:deep(.card-actions button) {
  margin-left: 6px;
}
:deep(.detail-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
}
:deep(.detail-left) {
  display: flex;
  align-items: center;
  gap: 10px;
}
:deep(.detail-path) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  color: #0f1724;
}
:deep(.detail-summary) {
  color: #6b7280;
}
:deep(.detail-body) {
  margin-top: 12px;
}
:deep(.fields-grid) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
:deep(.field-row) {
  display: grid;
  grid-template-columns: 1fr 1fr 40px 1fr;
  gap: 8px;
  align-items: center;
  padding: 6px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid rgba(15, 23, 42, 0.03);
}

:deep(.change-header) {
  gap: 12px;
}
:deep(.field-name) {
  font-weight: 600;
}
:deep(.field-old code),
:deep(.field-new code) {
  background: #0f1724;
  color: #d1fae5;
  padding: 6px;
  border-radius: 6px;
  display: block;
}
:deep(.json-preview) {
  background: #0b1220;
  color: #d1fae5;
  padding: 12px;
  border-radius: 8px;
  overflow: auto;
  max-height: 320px;
}
:deep(.endpoint-details) {
  display: flex;
  flex-direction: column;
  gap: 28px;
  margin-top: 16px;
}

:deep(.detail-section) {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  transition: all 0.2s ease;
}

:deep(.detail-section:hover) {
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

:deep(.detail-section.no-hover:hover) {
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  transform: none;
}

:deep(.detail-section h6) {
  margin: 0 0 12px 0;
  font-size: 1rem;
  color: #0f1724;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.detail-section h6::before) {
  content: "";
  width: 4px;
  height: 16px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  border-radius: 2px;
}

:deep(.parameters-section) {
  padding-left: 0;
  padding-right: 0;
}

:deep(.parameters-section h6) {
  padding-left: 16px;
}

:deep(.parameters-table) {
  margin: 0;
  width: 100%;
}

:deep(.parameters-table .p-datatable) {
  border: none;
  background: transparent;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
  width: 100%;
}

:deep(.parameters-table .p-datatable thead th) {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  border: none;
  padding: 12px 8px;
  font-weight: 600;
  color: #f1f5f9;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

:deep(.parameters-table .p-datatable tbody td) {
  border: none;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  padding: 10px 8px;
  font-size: 0.85rem;
  background: #ffffff;
}

:deep(.parameters-table .p-datatable tbody tr:nth-child(even)) {
  background: #f8fafc;
}

:deep(.parameters-table .p-datatable tbody tr:hover) {
  background: #e2e8f0;
  transition: background-color 0.2s ease;
}

:deep(.parameters-table code) {
  background: #1e293b;
  color: #e2e8f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
}

:deep(.content-list),
:deep(.response-content) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

:deep(.content-item) {
  background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  transition: all 0.2s ease;
}

:deep(.content-item:hover) {
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
  transform: translateY(-1px);
}

:deep(.content-item h6) {
  margin: 0 0 10px 0;
  font-size: 0.95rem;
  color: #0f1724;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

:deep(.content-item h6::before) {
  content: "📄";
  font-size: 0.9rem;
}

:deep(.schema-preview),
:deep(.example-preview) {
  margin-top: 8px;
}

:deep(.schema-preview .mini-json),
:deep(.example-preview .mini-json) {
  max-height: 150px;
}

:deep(.schema-ref) {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #0c4a6e;
  font-weight: 500;
  font-size: 0.85rem;
}

:deep(.schema-ref i) {
  color: #0ea5e9;
}

:deep(.schema-properties) {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

:deep(.property-item) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  font-size: 0.85rem;
  flex-wrap: wrap;
}

:deep(.prop-name) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-weight: 600;
  color: #0f1724;
  background: #1e293b;
  color: #e2e8f0;
  padding: 2px 6px;
  border-radius: 4px;
}

:deep(.prop-type) {
  color: #3b82f6;
  font-weight: 500;
}

:deep(.prop-desc) {
  color: #6b7280;
  font-style: italic;
}

:deep(.body-desc) {
  color: #374151;
  font-size: 0.9rem;
  margin-bottom: 8px;
}

:deep(.json-toggle) {
  display: flex;
  justify-content: center;
  margin: 12px 0;
}

:deep(.response-header) {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

:deep(.response-desc) {
  color: #374151;
  font-size: 0.9rem;
}

:deep(.responses-list) {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

:deep(.schema-title) {
  font-weight: bold;
  margin-bottom: 8px;
  font-size: 1rem;
  color: #0f1724;
}
:deep(.schema-type) {
  font-size: 0.9rem;
  color: #6b7280;
  margin-bottom: 4px;
}
:deep(.required-list) {
  font-size: 0.9rem;
  color: #dc2626;
  margin-bottom: 8px;
}
:deep(.properties-list) {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
:deep(.prop-title) {
  color: #059669;
  font-weight: 500;
  font-size: 0.8rem;
  margin-left: auto;
}

:deep(.schema-header) {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

:deep(.schema-header > div) {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
}

:deep(.schema-name) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-weight: 600;
  color: #0f1724;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9rem;
}

:deep(.change-type-tag) {
  margin-left: auto;
}

:deep(.schema-overview) {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

:deep(.schema-type) {
  font-size: 0.85rem;
  color: #475569;
}

:deep(.schema-desc) {
  font-size: 0.85rem;
  color: #64748b;
  font-style: italic;
  padding-top: 2px;
}

:deep(.schema-changes) {
  margin-top: 8px;
}

:deep(.change-summary) {
  display: flex;
  gap: 12px;
  font-size: 0.8rem;
}

:deep(.change-added) {
  color: #10b981;
  font-weight: 500;
}

:deep(.change-removed) {
  color: #ef4444;
  font-weight: 500;
}

:deep(.change-modified) {
  color: #f59e0b;
  font-weight: 500;
}

:deep(.schema-properties) {
  margin-top: 12px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  padding-top: 8px;
}

:deep(.expand-btn) {
  margin-right: 8px;
}

:deep(.properties-count) {
  font-size: 0.8rem;
  color: #64748b;
}

:deep(.properties-list) {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
  transition: all 0.3s ease;
}

:deep(.property-item) {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: #f8fafc;
  font-size: 0.8rem;
  transition: background-color 0.2s ease;
}

:deep(.prop-left) {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.prop-right) {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.prop-name) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-weight: 600;
  color: #0f1724;
  background: #e2e8f0;
  padding: 2px 4px;
  border-radius: 3px;
  text-align: left;
}

:deep(.prop-type) {
  color: #3b82f6;
  font-weight: 500;
}

:deep(.change-indicator) {
  margin-left: auto;
  font-weight: bold;
  font-size: 0.9rem;
}

:deep(.prop-added) {
  background: #ecfdf5;
  border-left: 3px solid #10b981;
}

:deep(.prop-removed) {
  background: #fef2f2;
  border-left: 3px solid #ef4444;
}

:deep(.prop-modified) {
  background: #fffbeb;
  border-left: 3px solid #f59e0b;
}

:deep(.schema-changes-detail) {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

:deep(.change-group h6) {
  margin: 0 0 8px 0;
  font-size: 0.9rem;
  color: #0f1724;
  font-weight: 600;
}

:deep(.change-group ul) {
  margin: 0;
  padding-left: 20px;
}

:deep(.change-group li) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 0.85rem;
  color: #475569;
}

:deep(.change-value) {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.change-value.added code) {
  background: #ecfdf5;
  color: #064e3b;
}

:deep(.change-value.removed code) {
  background: #fef2f2;
  color: #b91c1c;
}

:deep(.change-value.modified) {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.diff-line) {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

:deep(.old) {
  background: #f8fafc;
  color: #0f1724;
  padding: 4px 6px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 0.85rem;
}

:deep(.new) {
  background: #ecfdf5;
  color: #064e3b;
  padding: 4px 6px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 0.85rem;
}

:deep(.arrow) {
  color: #6b7280;
  font-weight: bold;
  font-size: 0.9rem;
}

:deep(.label) {
  font-weight: 600;
  color: #6b7280;
  font-size: 0.8rem;
}

:deep(.change-value code) {
  padding: 4px 6px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 0.85rem;
}

:deep(.strikethrough) {
  text-decoration: line-through;
  color: #b91c1c;
}

:deep(.before-section) {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

:deep(.expand-btn) {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background-color 0.2s ease;
  font-size: 0.85rem;
  color: #6b7280;
  font-weight: 600;
}

:deep(.expand-btn:hover) {
  background-color: rgba(107, 114, 128, 0.1);
}

:deep(.before-content) {
  margin-left: 16px;
  margin-top: 4px;
  animation: slideDown 0.3s ease;
}

:deep(.before-only) {
  background: #f8fafc;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.03);
}

:deep(.before-value code) {
  background: #0b1220;
  color: #d1fae5;
  padding: 8px;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 0.78rem;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.info-change) {
  background: #f8fafc;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.03);
  display: flex;
  align-items: center;
  gap: 12px;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 500px;
  }
}

@media (max-width: 900px) {
:deep(.cards-grid) {
    grid-template-columns: 1fr;
  }
:deep(.summary-grid) {
    grid-template-columns: 1fr;
  }
:deep(.endpoint-card) {
    flex-direction: column;
    align-items: center;
  }
:deep(.schema-card) {
    flex-direction: column;
    align-items: center;
  }
:deep(.card-right) {
    align-items: flex-start;
  }
}

:deep(.mini-label) {
  min-width: 56px;
}

:deep(.header-left-label) {
  margin-right: 12px;
  font-weight: bold;
  font-size: 1.1rem;
  color: inherit;
}

</style>
