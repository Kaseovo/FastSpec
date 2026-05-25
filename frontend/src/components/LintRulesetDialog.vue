<template>
  <Dialog
    v-model:visible="visible"
    header="Custom Lint Ruleset"
    :modal="true"
    :closable="true"
    :style="{ width: '680px', maxWidth: '95vw' }"
    @hide="onHide"
  >
    <Tabs v-model:value="activeTab">
      <TabList>
        <Tab value="rules">Structured Rules</Tab>
        <Tab value="yaml">Raw YAML Override</Tab>
      </TabList>

      <TabPanels>
        <!-- ── Structured Rules tab ─────────────────────────────── -->
        <TabPanel value="rules">
          <div class="rules-tab">
            <p class="tab-hint">
              Build rules using the form. Each rule extends
              <code>spectral:oas</code> automatically.
            </p>

            <div v-if="structuredRules.length === 0" class="rules-empty">
              <i class="pi pi-info-circle" />
              No custom rules yet. Click <strong>Add Rule</strong> to get started.
            </div>

            <Accordion v-else :multiple="true" class="rules-accordion">
              <AccordionPanel
                v-for="(rule, idx) in structuredRules"
                :key="idx"
                :value="String(idx)"
              >
                <AccordionHeader>
                  <div class="accordion-rule-header">
                    <span class="accordion-rule-name">{{ rule.name || "(unnamed rule)" }}</span>
                    <span class="accordion-rule-meta">
                      <span class="rule-severity-badge" :class="'sev-' + rule.severity">{{ rule.severity }}</span>
                      <span class="rule-fn-badge">{{ rule.then_function }}</span>
                    </span>
                    <Button
                      icon="pi pi-trash"
                      severity="danger"
                      text
                      size="small"
                      aria-label="Remove rule"
                      class="accordion-delete-btn"
                      @click.stop="removeRule(idx)"
                    />
                  </div>
                </AccordionHeader>

                <AccordionContent>
                  <div class="rule-fields">
                    <div class="field">
                      <label>Rule name <span class="required">*</span></label>
                      <InputText
                        v-model="rule.name"
                        placeholder="e.g. operation-summary-required"
                        class="w-full"
                      />
                    </div>

                    <div class="field-row">
                      <div class="field">
                        <label>Severity <span class="required">*</span></label>
                        <Select
                          v-model="rule.severity"
                          :options="severityOptions"
                          option-label="label"
                          option-value="value"
                          class="w-full"
                        />
                      </div>
                      <div class="field">
                        <label>Function <span class="required">*</span></label>
                        <Select
                          v-model="rule.then_function"
                          :options="functionOptions"
                          option-label="label"
                          option-value="value"
                          class="w-full"
                        />
                      </div>
                    </div>

                    <div class="field">
                      <label>Given (JSONPath) <span class="required">*</span></label>
                      <InputText
                        v-model="rule.given"
                        placeholder="e.g. $.paths[*][*].summary"
                        class="w-full"
                        font-family="monospace"
                      />
                    </div>

                    <div class="field">
                      <label>Message <span class="optional">optional</span></label>
                      <InputText
                        v-model="rule.message"
                        placeholder="e.g. Operation must have a summary"
                        class="w-full"
                      />
                    </div>

                    <!-- Dynamic functionOptions for pattern -->
                    <template v-if="rule.then_function === 'pattern'">
                      <div class="field">
                        <label>Pattern (regex) <span class="required">*</span></label>
                        <InputText
                          v-model="rule.functionOptions.match"
                          placeholder="e.g. ^[a-z]+"
                          class="w-full"
                          font-family="monospace"
                        />
                      </div>
                    </template>

                    <!-- Dynamic functionOptions for enumeration -->
                    <template v-if="rule.then_function === 'enumeration'">
                      <div class="field">
                        <label>Allowed values (comma-separated) <span class="required">*</span></label>
                        <InputText
                          :model-value="(rule.functionOptions.values || []).join(', ')"
                          @update:model-value="(v) => rule.functionOptions.values = v.split(',').map(s => s.trim()).filter(Boolean)"
                          placeholder="e.g. get, post, put"
                          class="w-full"
                        />
                      </div>
                    </template>

                    <!-- Dynamic functionOptions for length -->
                    <template v-if="rule.then_function === 'length'">
                      <div class="field-row">
                        <div class="field">
                          <label>Min length</label>
                          <InputText
                            v-model.number="rule.functionOptions.min"
                            type="number"
                            placeholder="0"
                            class="w-full"
                          />
                        </div>
                        <div class="field">
                          <label>Max length</label>
                          <InputText
                            v-model.number="rule.functionOptions.max"
                            type="number"
                            placeholder="255"
                            class="w-full"
                          />
                        </div>
                      </div>
                    </template>
                  </div>
                </AccordionContent>
              </AccordionPanel>
            </Accordion>

            <Button
              label="Add Rule"
              icon="pi pi-plus"
              severity="secondary"
              class="add-rule-btn"
              :disabled="!canAddRule"
              @click="addRule"
            />
          </div>
        </TabPanel>

        <!-- ── Raw YAML tab ─────────────────────────────────────── -->
        <TabPanel value="yaml">
          <div class="yaml-tab">
            <p class="tab-hint">
              Write a full <a href="https://docs.stoplight.io/docs/spectral/e5b9616d6d50c-rulesets" target="_blank" rel="noopener">Spectral ruleset</a> in YAML.
              When present, this overrides the Structured Rules above.
              <code>extends: spectral:oas</code> is injected automatically if omitted.
            </p>
            <Textarea
              v-model="rawYaml"
              :rows="18"
              class="yaml-editor w-full"
              placeholder="# Example&#10;rules:&#10;  operation-summary-required:&#10;    given: '$.paths[*][*]'&#10;    severity: warn&#10;    then:&#10;      function: truthy&#10;      field: summary"
              spellcheck="false"
              autocomplete="off"
            />
            <Message v-if="yamlError" severity="error" class="yaml-error-msg">
              {{ yamlError }}
            </Message>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <!-- Footer -->
    <template #footer>
      <div class="dialog-footer">
        <div class="footer-left">
          <Button
            v-if="hasExistingRuleset"
            label="Reset to defaults"
            icon="pi pi-refresh"
            severity="danger"
            text
            :loading="deleting"
            @click="onDelete"
          />
        </div>
        <div class="footer-right">
          <Button label="Cancel" severity="secondary" text @click="onCancel" />
          <Button
            label="Save ruleset"
            icon="pi pi-check"
            :loading="saving"
            @click="onSave"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script>
import { computed, ref, watch } from "vue";
import { useConfirm } from "primevue/useconfirm";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import Select from "primevue/select";
import Tab from "primevue/tab";
import TabList from "primevue/tablist";
import TabPanel from "primevue/tabpanel";
import TabPanels from "primevue/tabpanels";
import Tabs from "primevue/tabs";
import Textarea from "primevue/textarea";
import Accordion from "primevue/accordion";
import AccordionContent from "primevue/accordioncontent";
import AccordionHeader from "primevue/accordionheader";
import AccordionPanel from "primevue/accordionpanel";
import { deleteLintRuleset, getLintRuleset, putLintRuleset } from "../api/lint";

const SEVERITY_OPTIONS = [
  { label: "Error", value: "error" },
  { label: "Warning", value: "warn" },
  { label: "Info", value: "info" },
  { label: "Hint", value: "hint" },
  { label: "Off", value: "off" },
];

const FUNCTION_OPTIONS = [
  { label: "truthy — field must be present and truthy", value: "truthy" },
  { label: "falsy — field must be absent or falsy", value: "falsy" },
  { label: "pattern — field must match a regex", value: "pattern" },
  { label: "enumeration — field must be one of a set", value: "enumeration" },
  { label: "length — string/array length check", value: "length" },
  { label: "schema — field must match a JSON Schema", value: "schema" },
];

/** Return a fresh empty rule object. */
function emptyRule() {
  return {
    name: "",
    severity: "warn",
    given: "",
    message: "",
    then_function: "truthy",
    functionOptions: {},
  };
}

export default {
  name: "LintRulesetDialog",

  components: {
    Accordion,
    AccordionContent,
    AccordionHeader,
    AccordionPanel,
    Button,
    Dialog,
    InputText,
    Message,
    Select,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    Textarea,
  },

  props: {
    /** Controls dialog visibility — use v-model:open */
    open: {
      type: Boolean,
      default: false,
    },
  },

  emits: ["update:open", "saved", "deleted"],

  setup(props, { emit }) {
    const confirm = useConfirm();
    const visible = ref(false);
    const activeTab = ref("rules");

    // Structured rules state
    const structuredRules = ref([]);
    // Raw YAML state
    const rawYaml = ref("");
    const yamlError = ref(null);

    // Loading/status flags
    const saving = ref(false);
    const deleting = ref(false);
    const hasExistingRuleset = ref(false);

    const severityOptions = SEVERITY_OPTIONS;
    const functionOptions = FUNCTION_OPTIONS;

    // --- Sync visibility with the `open` prop ---
    watch(
      () => props.open,
      async (isOpen) => {
        visible.value = isOpen;
        if (isOpen) {
          await loadRuleset();
        }
      },
    );

    // Keep parent in sync when Dialog closes via its own X button
    watch(visible, (v) => {
      if (!v) emit("update:open", false);
    });

    // --- Load existing ruleset from the API ---
    async function loadRuleset() {
      try {
        const data = await getLintRuleset();
        if (data) {
          hasExistingRuleset.value = true;
          structuredRules.value = (data.rules || []).map((r) => ({
            ...r,
            functionOptions: r.then_function_options ?? {},
          }));
          rawYaml.value = data.raw_yaml ?? "";
        } else {
          hasExistingRuleset.value = false;
          structuredRules.value = [];
          rawYaml.value = "";
        }
      } catch {
        // Non-critical — start with empty state
        hasExistingRuleset.value = false;
      }
    }

    /**
     * Allow adding a new rule only when there are no rules yet, or the last
     * rule has its mandatory fields filled (name + given).
     */
    const canAddRule = computed(() => {
      if (structuredRules.value.length === 0) return true;
      const last = structuredRules.value[structuredRules.value.length - 1];
      return last.name.trim().length > 0 && last.given.trim().length > 0;
    });

    function addRule() {
      structuredRules.value.push(emptyRule());
    }

    function removeRule(idx) {
      const ruleName = structuredRules.value[idx]?.name || "this rule";
      confirm.require({
        message: `Remove "${ruleName}"?`,
        header: "Delete Rule",
        icon: "pi pi-exclamation-triangle",
        rejectLabel: "Cancel",
        acceptLabel: "Delete",
        acceptClass: "p-button-danger",
        accept: () => {
          structuredRules.value.splice(idx, 1);
        },
      });
    }

    async function onSave() {
      yamlError.value = null;
      saving.value = true;

      const payload = {
        rules: structuredRules.value
          .filter((r) => r.name.trim())
          .map((r) => ({
            name: r.name.trim(),
            severity: r.severity,
            given: r.given.trim(),
            message: r.message.trim() || null,
            then_function: r.then_function,
            then_function_options:
              Object.keys(r.functionOptions).length > 0
                ? r.functionOptions
                : null,
          })),
        raw_yaml: rawYaml.value.trim() || null,
      };

      try {
        await putLintRuleset(payload);
        hasExistingRuleset.value = true;
        emit("saved");
        visible.value = false;
      } catch (err) {
        if (err.response?.status === 400) {
          yamlError.value = err.response.data?.detail ?? "Invalid YAML syntax.";
          activeTab.value = "yaml";
        } else {
          yamlError.value = "Failed to save ruleset. Please try again.";
        }
      } finally {
        saving.value = false;
      }
    }

    function onDelete() {
      confirm.require({
        message: "This will remove all custom rules and revert to the default spectral:oas ruleset.",
        header: "Reset to Defaults",
        icon: "pi pi-exclamation-triangle",
        rejectLabel: "Cancel",
        acceptLabel: "Reset",
        acceptClass: "p-button-danger",
        accept: async () => {
          deleting.value = true;
          try {
            await deleteLintRuleset();
            hasExistingRuleset.value = false;
            structuredRules.value = [];
            rawYaml.value = "";
            emit("deleted");
            visible.value = false;
          } catch {
            visible.value = false;
          } finally {
            deleting.value = false;
          }
        },
      });
    }

    function onCancel() {
      visible.value = false;
    }

    function onHide() {
      yamlError.value = null;
    }

    return {
      visible,
      activeTab,
      structuredRules,
      rawYaml,
      yamlError,
      saving,
      deleting,
      hasExistingRuleset,
      severityOptions,
      functionOptions,
      canAddRule,
      addRule,
      removeRule,
      onSave,
      onDelete,
      onCancel,
      onHide,
    };
  },
};
</script>

<style scoped>
/* ── Tab content wrappers ──────────────────────────────────── */
.rules-tab,
.yaml-tab {
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tab-hint {
  font-size: 0.85rem;
  color: var(--p-text-muted-color, #6c757d);
  margin: 0;
  line-height: 1.5;
}

.tab-hint a {
  color: var(--p-primary-color, #6366f1);
}

/* ── Field label badges ────────────────────────────────────── */
.required {
  color: #ef4444;
  font-weight: 700;
  font-size: 0.9rem;
  line-height: 1;
  margin-left: 2px;
  vertical-align: middle;
}

.optional {
  font-size: 0.72rem;
  font-weight: 400;
  font-style: italic;
  color: var(--p-text-muted-color, #6c757d);
  margin-left: 4px;
}

/* ── Empty state ───────────────────────────────────────────── */
.rules-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-radius: 8px;
  background: var(--p-surface-section, #f8f9fa);
  font-size: 0.875rem;
  color: var(--p-text-muted-color, #6c757d);
}

/* ── Rules accordion ───────────────────────────────────────── */
.rules-accordion {
  width: 100%;
}

.accordion-rule-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.accordion-rule-name {
  font-weight: 600;
  font-size: 0.875rem;
  font-family: monospace;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.accordion-rule-meta {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.accordion-delete-btn {
  flex-shrink: 0;
  margin-left: 4px;
}

.rule-severity-badge,
.rule-fn-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.rule-fn-badge {
  background: var(--p-surface-section, #f1f5f9);
  color: var(--p-text-muted-color, #6c757d);
}

.rule-severity-badge.sev-error   { background: #fee2e2; color: #ef4444; }
.rule-severity-badge.sev-warn    { background: #ffedd5; color: #f97316; }
.rule-severity-badge.sev-info    { background: #dcfce7; color: #22c55e; }
.rule-severity-badge.sev-hint    { background: #f3e8ff; color: #a855f7; }
.rule-severity-badge.sev-off     { background: var(--p-surface-section, #f1f5f9); color: var(--p-text-muted-color, #6c757d); }

.rule-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.field label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--p-text-muted-color, #6c757d);
}

.optional {
  font-weight: 400;
  font-style: italic;
}

.field-row {
  display: flex;
  gap: 12px;
}

.w-full {
  width: 100%;
}

.add-rule-btn {
  align-self: flex-start;
}

/* ── Raw YAML editor ───────────────────────────────────────── */
.yaml-editor {
  font-family: "Fira Code", "Cascadia Code", "Consolas", monospace;
  font-size: 0.85rem;
  resize: vertical;
  min-height: 200px;
}

.yaml-error-msg {
  margin-top: 4px;
}

/* ── Dialog footer ─────────────────────────────────────────── */
.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.footer-right {
  display: flex;
  gap: 8px;
}

.footer-left {
  display: flex;
  gap: 8px;
}
</style>
